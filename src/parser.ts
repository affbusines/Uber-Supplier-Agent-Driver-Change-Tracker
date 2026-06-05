import { Driver } from './types';

/**
 * Extracts driver objects from the provided raw HTML string.
 */
export function parseDriversFromHTML(htmlString: string): Omit<Driver, 'first_seen' | 'last_updated' | 'has_contact_change'>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Find all rows of drivers
  let rows = Array.from(doc.querySelectorAll('[data-testid="drivers-table-row"]'));

  // Fallbacks if selectors mismatch
  if (rows.length === 0) {
    rows = Array.from(doc.querySelectorAll('[role="row"]')).filter(r => {
      // row contains avatar and cell details
      return r.querySelector('[data-baseweb="avatar"]') || r.textContent?.includes('@');
    });
  }

  // If still empty, check simple tr elements or any nested structure
  if (rows.length === 0) {
    rows = Array.from(doc.querySelectorAll('tr')).filter(r => r.textContent?.includes('@'));
  }

  const parsedDrivers: Omit<Driver, 'first_seen' | 'last_updated' | 'has_contact_change'>[] = [];

  rows.forEach((row, index) => {
    try {
      // 1. UUID Parsing
      let uuid = '';
      const trackingPayloadStr = row.getAttribute('data-tracking-payload');
      if (trackingPayloadStr) {
        try {
          const payload = JSON.parse(trackingPayloadStr);
          uuid = payload.driverUUID || payload.uuid || payload.id || '';
        } catch (_) {
          // Ignore parse errors from payload
        }
      }

      // Fallback uuid in case tracking payload lacks it or is missing
      if (!uuid) {
        // Let's search inside attributes
        const anyTrackingName = row.querySelector('[data-tracking-name]');
        const trackingName = anyTrackingName?.getAttribute('data-tracking-name');
        if (trackingName && trackingName !== 'driver-trip-count') {
          uuid = trackingName;
        } else {
          // Fallback based on index or hash signature of contents
          uuid = `drv-${Math.abs(hashString(row.textContent || `row-${index}`))}`;
        }
      }

      // 2. Avatar / Name
      let name = 'Unknown Driver';
      let photo_url = '';
      
      const avatarImg = row.querySelector('[data-baseweb="avatar"] img') || row.querySelector('img');
      if (avatarImg) {
        photo_url = avatarImg.getAttribute('src') || '';
        name = avatarImg.getAttribute('alt') || '';
      }

      // Clean up Name if it's extracted as 'Avatar of X' or uppercase values
      if (name.startsWith('Avatar of ')) {
        name = name.replace('Avatar of ', '');
      }
      if (!name || name === 'Unknown Driver' || name.trim() === '') {
        // Look for uppercase text elements
        const headings = Array.from(row.querySelectorAll('h1, h2, h3, h4, span, div'))
          .map(el => el.textContent?.trim() || '')
          .filter(txt => txt.length > 2 && txt === txt.toUpperCase() && !txt.includes('@') && !txt.includes('+') && isNaN(Number(txt)));
        if (headings.length > 0) {
          name = headings[0];
        }
      }

      // 3. Email & Phone Number Parsing
      let email = '';
      let phone = '';

      // Find individual contact element role="gridcell" which contains email symbol '@'
      const cells = Array.from(row.querySelectorAll('[role="gridcell"], td, .contact-cell'));
      let contactCell = cells.find(c => c.textContent?.includes('@'));

      if (!contactCell) {
        contactCell = Array.from(row.querySelectorAll('div, span')).find(d => d.textContent?.includes('@'));
      }

      if (contactCell) {
        // Collect all non-empty text leaf nodes inside the contact cell
        const leafNodes = Array.from(contactCell.querySelectorAll('div, span, p, a'))
          .filter(d => d.childElementCount === 0 && d.textContent?.trim().length)
          .map(d => d.textContent!.trim());

        if (leafNodes.length === 0 && contactCell.textContent) {
          const textPieces = contactCell.textContent.split(/[\r\n]+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
          leafNodes.push(...textPieces);
        }

        // Identify email (contains '@') and phone (does not contain '@' but has numbers or '+')
        const foundEmail = leafNodes.find(t => t.includes('@'));
        const foundPhone = leafNodes.find(t => !t.includes('@') && (t.includes('+') || t.match(/[0-9]/)));

        if (foundEmail) email = foundEmail;
        if (foundPhone) phone = foundPhone;

        // Fallback inside contact cell if above didn't match cleanly using regex
        if (!email || !phone) {
          for (const node of leafNodes) {
            if (node.includes('@') && !email) {
              const match = node.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (match) email = match[0];
            } else if (!node.includes('@') && !phone) {
              const match = node.match(/\+?[0-9][0-9\s-]{8,20}/);
              if (match) phone = match[0].trim();
            }
          }
        }
      }

      // Backup extraction if cells/strategies did not capture
      if (!email) {
        for (const cell of cells) {
          const text = cell.textContent?.trim() || '';
          if (text.includes('@')) {
            const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) email = match[0];
          }
        }
      }
      if (!phone) {
        for (const cell of cells) {
          const text = cell.textContent?.trim() || '';
          if (text.includes('+') && !text.includes('@')) {
            const match = text.match(/\+?[0-9][0-9\s-]{8,20}/);
            if (match) phone = match[0].trim();
          }
        }
      }

      // Final backup: raw row text matched with regex
      if (!email) {
        const totalText = row.textContent || '';
        const emailMatch = totalText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) email = emailMatch[0];
      }
      if (!phone) {
        const totalText = row.textContent || '';
        const phoneMatch = totalText.match(/\+?[0-9]{2,3}[\s-]?[0-9]{3,4}[\s-]?[0-9]{4,6}/);
        if (phoneMatch) phone = phoneMatch[0];
      }

      // --- CROSS-SWAP CORRECTION BARRIER ---
      // If phone has '@' and email doesn't, swap them.
      if (phone && email && phone.includes('@') && !email.includes('@')) {
        const temp = phone;
        phone = email;
        email = temp;
      }

      // Strip email if it does not contain '@'
      if (email && !email.includes('@')) {
        email = '';
      }

      // Strip phone if it contains '@'
      if (phone && phone.includes('@')) {
        phone = '';
      }

      // 4. Trip/Tip Count
      let tip_count = 0;
      const tripCountEl = row.querySelector('[data-tracking-name="driver-trip-count"]') || row.querySelector('.trip-count-selector');
      if (tripCountEl) {
        const parsedVal = parseInt(tripCountEl.textContent || '0', 10);
        if (!isNaN(parsedVal)) {
          tip_count = parsedVal;
        }
      } else {
        // look for words like "trips" or cell ending in trips
        const tripTextCell = cells.find(c => c.textContent?.toLowerCase().includes('trip'));
        if (tripTextCell) {
          const numberMatch = tripTextCell.textContent?.match(/\d+/);
          if (numberMatch) {
            tip_count = parseInt(numberMatch[0], 10);
          }
        } else {
          // fallback search through cells for any integer count
          for (const cell of cells) {
            const txt = cell.textContent?.trim() || '';
            if (/^\d+$/.test(txt)) {
              const val = parseInt(txt, 10);
              if (val > 0 && val < 50000) { // realistic trip limit
                tip_count = val;
                break;
              }
            }
          }
        }
      }

      if (name && (email || phone)) {
        parsedDrivers.push({
          uuid: uuid || `drv-${index}`,
          name: name.trim(),
          photo_url: photo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=06C167&textColor=000`,
          tip_count,
          email: email.trim(),
          phone: phone.trim()
        });
      }
    } catch (e) {
      console.error('Error parsing row index', index, e);
    }
  });

  return parsedDrivers;
}

/**
 * Validates driver record fields to ensure email and phone weren't concatenated or broken
 */
export function validateDriverData(driver: { name: string; uuid: string; phone: string; email: string }) {
  const errors: string[] = [];

  // Phone validation
  if (driver.phone) {
    if (driver.phone.includes('@')) {
      errors.push(`মোবাইলে '@' ক্যারেক্টার পাওয়া গিয়েছে — ইমেইলের সাথে জোড়া লেগে থাকতে পারে: ${driver.phone}`);
    }
    // phone length (excluding spaces, dashes, parentheses, plus sign)
    const digitCount = driver.phone.replace(/\D/g, '').length;
    if (digitCount > 15) {
      errors.push(`মোবাইল নম্বর অস্বাভাবিক বড় (${digitCount} ডিজিট) — ইমেইলের সাথে জোড়া লেগে থাকতে পারে: ${driver.phone}`);
    }
  } else {
    errors.push('মোবাইল নম্বর পাওয়া যায়নি।');
  }

  // Email validation
  if (driver.email) {
    if (!driver.email.includes('@')) {
      errors.push(`ইমেইল ঠিকানায় '@' সংকেত নেই: ${driver.email}`);
    }
  } else {
    errors.push('ইমেইল ঠিকানা পাওয়া যায়নি।');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export interface TextParsedDriver {
  uuid: string;
  name: string;
  phone: string;
  email: string;
  tip_count: number;
  photo_url: string | null;
  source: string;
}

export function parseSingleDriverBlock(lines: string[]): TextParsedDriver | null {
  const data = {
    name: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    tip_count: 0,
    photo_url: null as string | null,   // always null for text paste method
    source: 'text_paste'  // track how driver was added
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || '';

    // Name — comes after "User" line
    if (line.toLowerCase() === 'user') {
      data.name = next;
      continue;
    }

    // Phone — line after "Phone"
    if (line.toLowerCase() === 'phone') {
      data.phone = next;
      continue;
    }

    // Email — line after "Email"
    if (line.toLowerCase() === 'email') {
      data.email = next;
      continue;
    }

    // Trip count — line after "Trip count"
    if (line.toLowerCase() === 'trip count') {
      data.tip_count = parseInt(next, 10) || 0;
      continue;
    }
  }

  // Name or Email missing makes it invalid
  if (!data.name || !data.email) {
    return null;
  }

  const cleanEmail = data.email.toLowerCase().trim();
  const uuid = `manual_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

  return {
    uuid,
    name: data.name,
    phone: data.phone || '',
    email: data.email,
    tip_count: data.tip_count,
    photo_url: data.photo_url,
    source: data.source
  };
}

export function parseMultipleDriversFromText(rawText: string): TextParsedDriver[] {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase() === 'user') {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else {
      if (currentBlock.length > 0) {
        currentBlock.push(line);
      }
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks
    .map(block => parseSingleDriverBlock(block))
    .filter((d): d is TextParsedDriver => d !== null);
}

export function parseDriverFromText(rawText: string) {
  const list = parseMultipleDriversFromText(rawText);
  if (list.length > 0) {
    return list[0];
  }
  return {
    name: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    tip_count: 0,
    photo_url: null as string | null,   // always null for text paste method
    source: 'text_paste'  // track how driver was added
  };
}

export function validateTextParsedDriver(data: { name: string | null; phone: string | null; email: string | null; tip_count: number }) {
  const errors: string[] = [];

  if (!data.name)
    errors.push('Name পাওয়া যায়নি — "User" লেবেলের নিচে নাম থাকতে হবে');

  if (!data.phone)
    errors.push('Phone পাওয়া যায়নি — "Phone" লেবেলের নিচে নম্বর থাকতে হবে');

  if (!data.email)
    errors.push('Email পাওয়া যায়নি — "Email" লেবেলের নিচে ইমেইল থাকতে হবে');

  if (data.email && !data.email.includes('@'))
    errors.push(`ইমেইলটি সঠিক নয়: ${data.email}`);

  if (data.tip_count === 0)
    errors.push('Trip count পাওয়া যায়নি বা 0 - দয়া করে নিশ্চিত করুন');

  return { valid: errors.length === 0, errors };
}

// ── SAMPLE MOCK DATA FOR THE SANDBOX SIMULATION ──

export const SAMPLE_HTML_BASELINE = `
<div class="uber-table-mock animate-fade-in" role="rowgroup">
  <!-- Driver 1: Mehedi Hasan -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "e0d56434-9cab-4c6c-b932-ad1d44ba1d4f"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mehedi" alt="MD. MEHEDI HASAN" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">MD. MEHEDI HASAN</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1624618097</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">01624618097ar@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">234</div>
  </div>

  <!-- Driver 2: Rakibul Hasan -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "2cf03e6a-7585-468c-92ce-d71c3fd18b71"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rakib" alt="RAKIBUL HASAN" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">RAKIBUL HASAN</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1712345678</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">rakib.hasan@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">89</div>
  </div>

  <!-- Driver 3: Shafiqul Islam -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "3df04e2a-8485-47cc-93ce-d81c3fd19b72"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Shafiq" alt="SHAFIQUL ISLAM" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">SHAFIQUL ISLAM</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1812345679</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">shafiq@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">153</div>
  </div>

  <!-- Driver 4: Tanvir Ahmed -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "4ef05e1a-9485-48cc-94ce-d91c3fd20b73"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Tanvir" alt="TANVIR AHMED" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">TANVIR AHMED</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1912345680</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">tanvir@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">412</div>
  </div>
</div>
`;

export const SAMPLE_HTML_UPDATED = `
<div class="uber-table-mock animate-fade-in" role="rowgroup">
  <!-- Driver 1: Mehedi Hasan — EMAIL & PHONE BOTH CHANGED! Trips increased to 258 -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "e0d56434-9cab-4c6c-b932-ad1d44ba1d4f"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mehedi" alt="MD. MEHEDI HASAN" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">MD. MEHEDI HASAN</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1624618999</div> <!-- CHANGED PHONE -->
      <div class="_css-fRzRxF text-gray-400 mt-0.5">hasan.mehedi@gmail.com</div> <!-- CHANGED EMAIL -->
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">258</div> <!-- INCREASED TRIPS -->
  </div>

  <!-- Driver 2: Rakibul Hasan — Trips increased to 95 -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "2cf03e6a-7585-468c-92ce-d71c3fd18b71"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rakib" alt="RAKIBUL HASAN" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">RAKIBUL HASAN</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1712345678</div> 
      <div class="_css-fRzRxF text-gray-400 mt-0.5">rakib.hasan@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">95</div>
  </div>

  <!-- Driver 3: Shafiqul Islam — EMAIL CHANGED! Trips increased to 160 -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "3df04e2a-8485-47cc-93ce-d81c3fd19b72"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Shafiq" alt="SHAFIQUL ISLAM" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">SHAFIQUL ISLAM</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1812345679</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">islam.shafiq@gmail.com</div> <!-- CHANGED EMAIL -->
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">160</div>
  </div>

  <!-- Driver 4: Tanvir Ahmed — Trips increased to 430 -->
  <div role="row" class="drivers-table-row flex items-center p-4 border-b border-gray-100" data-testid="drivers-table-row" data-tracking-payload='{"driverUUID": "4ef05e1a-9485-48cc-94ce-d91c3fd20b73"}'>
    <div class="avatar px-3" data-baseweb="avatar">
      <img class="w-10 h-10 rounded-full" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Tanvir" alt="TANVIR AHMED" />
    </div>
    <div class="name-cell flex-1 font-semibold text-gray-900 text-sm">TANVIR AHMED</div>
    <div role="gridcell" class="contact-cell flex-1 text-xs">
      <div class="_css-laRbCo text-gray-700 font-medium">+880 1912345680</div>
      <div class="_css-fRzRxF text-gray-400 mt-0.5">tanvir@gmail.com</div>
    </div>
    <div role="gridcell" class="tips-cell px-6 text-sm py-2 font-mono" data-tracking-name="driver-trip-count">430</div>
  </div>
</div>
`;
