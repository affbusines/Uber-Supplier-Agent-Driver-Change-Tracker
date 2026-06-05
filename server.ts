import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import fs from "fs";
import { chromium } from "playwright";

// ── Chromium Fallback Detection ──
function findSystemChromium(): string | undefined {
  const paths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  return paths.find(p => fs.existsSync(p));
}

async function launchBrowser() {
  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-gpu",
    "--single-process",
    "--no-zygote",
  ];
  try {
    // headless: true → invisible background execution
    // slowMo: 0      → fastest execution speed
    const browser = await chromium.launch({ headless: true, slowMo: 0, args: launchArgs });
    console.log("[Browser] Launched Playwright Chromium (HEADLESS — invisible).");
    return browser;
  } catch (err: any) {
    console.warn("[Browser] Standard launch failed:", err.message);
  }
  const systemPath = findSystemChromium();
  if (systemPath) {
    console.log("[Browser] Using system Chromium:", systemPath);
    const browser = await chromium.launch({ headless: true, executablePath: systemPath, args: launchArgs });
    return browser;
  }
  throw new Error("CHROMIUM_NOT_FOUND: No Chromium binary found. Run: npx playwright install chromium");
}

const app = express();
const PORT = 3000;
app.use(express.json());

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "uber_secure_compliance_secret_32b";

function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

function decrypt(text: string): string {
  try {
    const parts = text.split(":");
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("Decryption error:", err);
    return text;
  }
}

interface SyncStatus {
  running: boolean;
  step: "idle" | "login" | "navigate" | "scraping" | "saving" | "done" | "error";
  message: string;
  progress: number;
  found: number;
  added: number;
  updated: number;
  started_at: string | null;
  ended_at: string | null;
  error_code?: string;
  drivers?: any[];
}

let activeSyncStatus: SyncStatus = {
  running: false, step: "idle",
  message: "No active sync has been started.",
  progress: 0, found: 0, added: 0, updated: 0,
  started_at: null, ended_at: null
};

app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: "playwright_real" }));
app.get("/api/sync/status", (_req, res) => res.json(activeSyncStatus));

app.post("/api/sync/cancel", (_req, res) => {
  if (activeSyncStatus.running) {
    activeSyncStatus = { ...activeSyncStatus, running: false, step: "error", message: "Sync cancelled.", ended_at: new Date().toISOString(), error_code: "CANCELLED" };
    return res.json({ success: true });
  }
  res.json({ success: false, message: "No active sync running." });
});

app.post("/api/credentials/test", async (req, res) => {
  const { email, password, orgId } = req.body;
  if (!email || !password || !orgId) return res.status(400).json({ success: false, error: "Missing fields." });
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await loginToUber(page, email, password);
    res.json({ success: true, message: "Login successful." });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message || "Login failed." });
  } finally {
    if (browser) await browser.close();
  }
});

app.post("/api/credentials/encrypt", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text." });
  res.json({ encrypted: encrypt(text) });
});

app.post("/api/sync/start", (req, res) => {
  const { email, password, orgId, encrypted, maxPages, startPage } = req.body;
  if (activeSyncStatus.running) return res.status(400).json({ error: "Another sync is already running." });

  let finalEmail = email || "";
  let finalPassword = password || "";
  let finalOrgId = orgId || "";
  // maxPages: 0 or missing = scrape all pages; positive integer = stop after N pages from startPage
  const finalMaxPages = parseInt(maxPages) > 0 ? parseInt(maxPages) : 0;
  // startPage: 1 or missing = start from page 1 (no skip); positive integer = skip to that page first
  const finalStartPage = parseInt(startPage) > 1 ? parseInt(startPage) : 1;

  if (encrypted) {
    finalEmail = decrypt(finalEmail);
    finalPassword = decrypt(finalPassword);
    if (finalOrgId.includes(":")) finalOrgId = decrypt(finalOrgId);
  }

  if (!finalEmail || !finalPassword || !finalOrgId) {
    return res.status(400).json({ error: "Please configure credentials in System Settings first." });
  }

  res.json({ status: "started", message: "Sync started.", maxPages: finalMaxPages || "all", startPage: finalStartPage });
  runRealScraper(finalEmail, finalPassword, finalOrgId, finalMaxPages, finalStartPage);
});

// ═══════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════
async function loginToUber(page: any, email: string, password: string) {
  console.log("[Login] Navigating to supplier.uber.com...");
  await page.goto("https://supplier.uber.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log("[Login] URL:", page.url());

  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 40000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  console.log("[Login] Email filled.");

  const nextBtn = page.locator('button[type="submit"], button:has-text("Next"), button:has-text("Continue")').first();
  if (await nextBtn.count() > 0) {
    try { await nextBtn.click({ force: true, timeout: 5000 }); } catch (_) {}
  }

  await page.waitForTimeout(4000);

  // --- OTP BYPASS LOGIC ---
  const pwdCount = await page.locator('input[type="password"]').count();
  if (pwdCount === 0) {
    console.log("[Login] No password field. Looking for 'More options' to bypass OTP...");
    
    // Find a button containing "More options", "Other ways", etc.
    const moreBtn = page.locator('button').filter({ hasText: /More|Other|Try another/i }).first();
    if (await moreBtn.count() > 0) {
      await moreBtn.click({ force: true });
      console.log("[Login] Clicked 'More options' button.");
      await page.waitForTimeout(2000);
      
      // Find a button or role=button containing "Password"
      const passOption = page.locator('button, [role="button"], [data-testid="credential-option"], li').filter({ hasText: /Password/i }).first();
      if (await passOption.count() > 0) {
        await passOption.click({ force: true });
        console.log("[Login] Clicked 'Password' login option.");
        await page.waitForTimeout(2000);
      } else {
        console.log("[Login] 'Password' option not found in the More menu.");
      }
    } else {
      console.log("[Login] 'More options' button not found.");
    }
  }

  await page.waitForSelector('input[type="password"]', { timeout: 40000 });
  await page.fill('input[type="password"]', password);
  console.log("[Login] Password filled.");

  const signInBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();
  if (await signInBtn.count() > 0) {
    try { await signInBtn.click({ force: true, timeout: 10000 }); } catch (e: any) { console.warn("[Login] Sign in click:", e.message); }
  }

  await page.waitForURL("**/orgs/**", { timeout: 30000 });
  console.log("[Login] Success. URL:", page.url());
}

// ═══════════════════════════════════════════
//  HTML PARSER
// ═══════════════════════════════════════════
function parseDriversFromScrapedHTML(html: string): any[] {
  const drivers: any[] = [];
  const rowSplits = html.split(/(?=<div[^>]*data-testid="drivers-table-row")/);

  for (const rowHtml of rowSplits) {
    if (!rowHtml.includes('data-testid="drivers-table-row"')) continue;

    const payloadMatch = rowHtml.match(/data-tracking-payload="([^"]+)"/);
    let uuid = "";
    if (payloadMatch) {
      try {
        const decoded = payloadMatch[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&');
        uuid = JSON.parse(decoded).driverUUID || "";
      } catch (_) {}
    }

    const nameMatch = rowHtml.match(/data-baseweb="avatar"[\s\S]*?<img[^>]*alt="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : "";

    const photoMatch = rowHtml.match(/data-baseweb="avatar"[\s\S]*?<img[^>]*src="([^"]+)"/);
    const photo_url = photoMatch ? photoMatch[1].replace(/&amp;/g, '&') : "";

    const tripMatch = rowHtml.match(/data-tracking-name="driver-trip-count"[^>]*>\s*(\d+)\s*</);
    const tip_count = tripMatch ? parseInt(tripMatch[1]) : 0;

    const leafTexts: string[] = [];
    const divRe = /<div[^>]*>([^<]+)<\/div>/g;
    let m;
    while ((m = divRe.exec(rowHtml)) !== null) {
      const t = m[1].trim();
      if (t.length > 0) leafTexts.push(t);
    }

    const phone = leafTexts.find(t => t.startsWith("+") || /^0\d{9,}$/.test(t.replace(/\s/g, ""))) || "";
    const email = leafTexts.find(t => t.includes("@")) || "";

    if (!uuid && email) uuid = `scraped_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    if (name || email) drivers.push({ uuid, name, phone, email, tip_count, photo_url, source: "auto_sync" });
  }
  return drivers;
}

// ═══════════════════════════════════════════
//  PAGINATION HELPERS
//  RULE: page.evaluate() / waitForFunction() callbacks-এ
//  কোনো TypeScript syntax ব্যবহার করা যাবে না।
//  Pure ES5 JavaScript লিখতে হবে।
//  No: const/let → use var
//  No: : any, : string, as X → remove all type annotations
//  No: arrow functions inside evaluate → use function() {}
// ═══════════════════════════════════════════

async function hasNextButton(page: any): Promise<boolean> {
  // STRING literal — esbuild cannot mangle names inside strings
  return await page.evaluate(`(function () {
    function isActive(el) {
      if (!el) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      var s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      return true;
    }
    // DESKTOP: <div class="_css-...">Next</div>
    var allElements = Array.from(document.querySelectorAll('div, button, span, a'));
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      var directText = '';
      for (var j = 0; j < el.childNodes.length; j++) {
        if (el.childNodes[j].nodeType === 3) {
          directText += el.childNodes[j].textContent;
        }
      }
      if (directText.trim() === 'Next' && isActive(el)) return true;
    }
    // MOBILE: SVG chevron path
    var paths = Array.from(document.querySelectorAll('path'));
    for (var k = 0; k < paths.length; k++) {
      var d = paths[k].getAttribute('d') || '';
      if (d.startsWith('m18.4 12') || d.includes('18.4')) {
        var par = paths[k].parentElement;
        while (par && par !== document.body) {
          if (par.tagName === 'BUTTON' || par.getAttribute('role') === 'button') {
            if (isActive(par)) return true;
          }
          if (par.tagName === 'DIV' && (par.getAttribute('tabindex') || par.onclick)) {
            if (isActive(par)) return true;
          }
          par = par.parentElement;
        }
        return true;
      }
    }
    return false;
  })()`);
}


async function clickNextButton(page: any): Promise<boolean> {
  // Scroll to bottom first so button is visible
  await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await page.waitForTimeout(600);

  // ── ATTEMPT 1: Playwright :text-is("Next") locator ──
  try {
    const nextDivDesktop = page.locator(':text-is("Next")').last();
    const count = await nextDivDesktop.count();
    if (count > 0) {
      // Use Playwright-native isDisabled() — avoids any esbuild __name injection
      const isDisabled = await nextDivDesktop.isDisabled().catch(() => false);
      if (!isDisabled) {
        await nextDivDesktop.scrollIntoViewIfNeeded({ timeout: 2000 });
        await nextDivDesktop.click({ timeout: 5000, force: true });
        console.log('[Pagination] Clicked via :text-is("Next") locator.');
        return true;
      }
    }
  } catch (e: any) {
    console.warn('[Pagination] Attempt 1 failed:', e.message);
  }

  // ── ATTEMPT 2: button/role=button :has-text("Next") ──
  try {
    const btnWithNext = page.locator('button:has-text("Next"), [role="button"]:has-text("Next")').last();
    if (await btnWithNext.count() > 0 && !(await btnWithNext.isDisabled())) {
      await btnWithNext.scrollIntoViewIfNeeded({ timeout: 2000 });
      await btnWithNext.click({ timeout: 5000, force: true });
      console.log('[Pagination] Clicked via button:has-text("Next").');
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] Attempt 2 failed:', e.message);
  }

  // ── ATTEMPT 3: Mobile SVG chevron (string evaluate) ──
  try {
    const clicked = await page.evaluate(`(function () {
      var paths = Array.from(document.querySelectorAll('path'));
      for (var k = 0; k < paths.length; k++) {
        var d = paths[k].getAttribute('d') || '';
        if (d.startsWith('m18.4 12') || (d.includes('18.4') && d.includes('7.7'))) {
          var par = paths[k].parentElement;
          while (par && par !== document.body) {
            if (par.tagName === 'BUTTON') {
              if (!par.disabled) { par.click(); return 'mobile-svg-button'; }
            }
            if (par.getAttribute('role') === 'button') { par.click(); return 'mobile-svg-role-button'; }
            if (par.tagName === 'DIV' && par.getAttribute('tabindex') !== null) { par.click(); return 'mobile-svg-div'; }
            par = par.parentElement;
          }
          if (paths[k].parentElement) paths[k].parentElement.click();
          return 'mobile-svg-parent';
        }
      }
      return null;
    })()`);
    if (clicked) {
      console.log('[Pagination] Clicked mobile SVG chevron: ' + clicked);
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] Attempt 3 (SVG) failed:', e.message);
  }

  // ── ATTEMPT 4: Full DOM scan for exact "Next" text (string evaluate) ──
  try {
    const clicked = await page.evaluate(`(function () {
      function isActive(el) {
        if (!el) return false;
        if (el.disabled) return false;
        if (el.getAttribute('aria-disabled') === 'true') return false;
        var s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        return true;
      }
      var candidates = Array.from(document.querySelectorAll('div, button, span'));
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var directText = '';
        for (var j = 0; j < el.childNodes.length; j++) {
          if (el.childNodes[j].nodeType === 3) directText += el.childNodes[j].textContent;
        }
        if (directText.trim() === 'Next' && isActive(el)) {
          el.click();
          return 'js-scan:' + el.tagName + '.' + (el.className || '').slice(0, 30);
        }
      }
      return null;
    })()`);
    if (clicked) {
      console.log('[Pagination] Clicked via JS full scan: ' + clicked);
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] Attempt 4 (DOM scan) failed:', e.message);
  }

  console.log('[Pagination] All attempts exhausted — Next button not found/clickable.');
  return false;
}


async function waitForPageChange(page: any, prevFirstUUID: string, pageNum: number): Promise<void> {
  console.log(`[Pagination] Waiting for page ${pageNum + 1} (prev: ${prevFirstUUID})...`);
  await page.waitForTimeout(1000);

  // ── Strategy 1: waitForFunction with prev UUID embedded in string ──
  // IMPORTANT: pass as STRING so esbuild cannot mangle variable names.
  // Embed prevFirstUUID directly via template literal — no arg passing needed.
  const escapedPrev = prevFirstUUID.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  try {
    await page.waitForFunction(
      `(function() {
        var rows = document.querySelectorAll('[data-testid="drivers-table-row"]');
        if (!rows || rows.length === 0) return false;
        var firstRow = rows[0];
        var payload = firstRow.getAttribute('data-tracking-payload') || '';
        var uuid = '';
        try { uuid = JSON.parse(payload.replace(/&quot;/g, '"')).driverUUID || ''; }
        catch (e) { uuid = (firstRow.textContent || '').slice(0, 40); }
        return uuid !== '' && uuid !== '${escapedPrev}';
      })()`,
      undefined,
      { timeout: 12000, polling: 500 }
    );
    console.log(`[Pagination] Page ${pageNum + 1} confirmed loaded.`);
  } catch (_) {
    console.warn('[Pagination] waitForFunction timed out — using 4s fallback...');
    await page.waitForTimeout(4000);
    const rowCount = await page.locator('[data-testid="drivers-table-row"]').count();
    console.log(`[Pagination] Fallback: ${rowCount} rows visible.`);
    if (rowCount === 0) {
      throw new Error('NO_ROWS_AFTER_NEXT: No driver rows found after next page navigation.');
    }
  }
}

// ═══════════════════════════════════════════
//  MAIN SCRAPER
// ═══════════════════════════════════════════
async function runRealScraper(email: string, password: string, orgId: string, maxPages: number = 0, startPage: number = 1) {
  const startedAt = new Date().toISOString();
  const allDrivers: any[] = [];
  let pageNum = 1;

  // pageLimit counts pages scraped FROM startPage, not absolute page numbers
  const pageLimit = maxPages > 0 ? maxPages : Infinity;
  console.log(`[Scraper] Start page: ${startPage} | Page limit: ${maxPages > 0 ? maxPages + ' page(s) from start' : 'unlimited'}`);

  activeSyncStatus = {
    running: true, step: "login",
    message: "Launching headless browser...",
    progress: 5, found: 0, added: 0, updated: 0,
    started_at: startedAt, ended_at: null
  };

  let browser: any;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();

    // ── Login ──
    activeSyncStatus.message = "Logging into supplier.uber.com...";
    activeSyncStatus.progress = 15;
    await loginToUber(page, email, password);

    // ── Navigate to drivers page ──
    activeSyncStatus.step = "navigate";
    activeSyncStatus.message = "Navigating to drivers list...";
    activeSyncStatus.progress = 30;

    const driversUrl = `https://supplier.uber.com/orgs/${orgId}/drivers`;
    console.log("[Scraper] Navigating to:", driversUrl);
    await page.goto(driversUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.waitForSelector('[data-testid="drivers-table-row"]', { timeout: 25000 });
    console.log("[Scraper] Drivers page ready.");

    activeSyncStatus.step = "scraping";
    activeSyncStatus.message = "Scraping drivers...";
    activeSyncStatus.progress = 40;

    // ── Skip phase: navigate to startPage without collecting data ──
    if (startPage > 1) {
      console.log(`[Scraper] Skipping to page ${startPage}...`);
      activeSyncStatus.message = `Skipping to page ${startPage}...`;

      for (let skipPage = 1; skipPage < startPage; skipPage++) {
        // Wait for rows to confirm we're on a valid page
        try {
          await page.waitForSelector('[data-testid="drivers-table-row"]', { timeout: 15000 });
        } catch {
          throw new Error(`NO_ROWS_ON_SKIP_PAGE_${skipPage}: Could not find driver rows while skipping to page ${startPage}.`);
        }

        const skipExists = await hasNextButton(page);
        if (!skipExists) {
          throw new Error(`SKIP_TARGET_BEYOND_LAST_PAGE: Tried to skip to page ${startPage} but there are only ${skipPage} page(s) of drivers.`);
        }

        // Capture current first-row UUID before clicking Next
        const skipFirstUUID = await page.evaluate(`
          (function() {
            var row = document.querySelector('[data-testid="drivers-table-row"]');
            if (!row) return '';
            var payload = row.getAttribute('data-tracking-payload') || '';
            try { return JSON.parse(payload.replace(/&quot;/g, '"')).driverUUID || ''; }
            catch (e) { return (row.textContent || '').slice(0, 40); }
          })()
        `);

        const didClickSkip = await clickNextButton(page);
        if (!didClickSkip) {
          throw new Error(`SKIP_CLICK_FAILED: Could not click Next button while skipping page ${skipPage}.`);
        }

        await waitForPageChange(page, skipFirstUUID, skipPage);
        console.log(`[Scraper] Skipped page ${skipPage} → now at page ${skipPage + 1}`);
        activeSyncStatus.message = `Skipped ${skipPage}/${startPage - 1} pages, heading to page ${startPage}...`;
      }

      console.log(`[Scraper] Reached target start page ${startPage}. Beginning data collection.`);
      activeSyncStatus.message = `Now on page ${startPage}. Starting data collection...`;
    }

    // ── Pagination loop (collects data from startPage onward) ──
    while (true) {
      const absolutePage = startPage + pageNum - 1;
      console.log(`[Scraper] ── Page ${absolutePage} (collection page ${pageNum}) ──`);

      // Wait for rows
      try {
        await page.waitForSelector('[data-testid="drivers-table-row"]', { timeout: 15000 });
      } catch {
        console.log(`[Scraper] No rows on page ${pageNum}. Done.`);
        break;
      }

      // Get page HTML and parse — use string to prevent esbuild mangling
      const html = await page.evaluate(`
        (function() {
          var el = document.querySelector('[role="rowgroup"]');
          return el ? el.outerHTML : '';
        })()
      `);

      if (!html) {
        console.log(`[Scraper] Empty HTML on page ${pageNum}. Done.`);
        break;
      }

      const pageDrivers = parseDriversFromScrapedHTML(html);
      const absolutePage2 = startPage + pageNum - 1;
      console.log(`[Scraper] Page ${absolutePage2}: ${pageDrivers.length} drivers parsed.`);
      allDrivers.push(...pageDrivers);

      activeSyncStatus.message = `Page ${absolutePage2} done — ${allDrivers.length} drivers total...`;
      activeSyncStatus.found = allDrivers.length;
      activeSyncStatus.progress = Math.min(40 + pageNum * 8, 88);

      // Get current first row UUID before clicking next — string to prevent mangling
      const currentFirstUUID = await page.evaluate(`
        (function() {
          var row = document.querySelector('[data-testid="drivers-table-row"]');
          if (!row) return '';
          var payload = row.getAttribute('data-tracking-payload') || '';
          try { return JSON.parse(payload.replace(/&quot;/g, '"')).driverUUID || ''; }
          catch (e) { return (row.textContent || '').slice(0, 40); }
        })()
      `);

      // Scroll to bottom before checking next button — use string to prevent esbuild __name injection
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(500);

      // Check if next page exists
      const nextExists = await hasNextButton(page);
      console.log(`[Scraper] Page ${pageNum} — next button exists: ${nextExists}`);

      if (!nextExists) {
        console.log("[Scraper] No more pages. Scraping complete.");
        break;
      }

      // ── Page limit check ──
      if (pageNum >= pageLimit) {
        console.log(`[Scraper] Reached page limit (${pageLimit}). Stopping.`);
        break;
      }

      // Click next
      const didClick = await clickNextButton(page);
      if (!didClick) {
        console.log("[Scraper] Could not click Next. Stopping.");
        break;
      }

      // Wait for new page to load
      await waitForPageChange(page, currentFirstUUID, pageNum);
      pageNum++;
    }

    // ── Done ──
    activeSyncStatus.step = "saving";
    activeSyncStatus.message = `Saving ${allDrivers.length} drivers...`;
    activeSyncStatus.progress = 95;
    await page.waitForTimeout(500);

    const pagesScraped = pageNum;
    const firstPageScraped = startPage;
    const lastPageScraped = startPage + pageNum - 1;
    activeSyncStatus = {
      running: false, step: "done",
      message: `Sync complete! ${allDrivers.length} drivers loaded from page ${firstPageScraped}–${lastPageScraped} (${pagesScraped} page(s) scraped).`,
      progress: 100,
      found: allDrivers.length, added: 0, updated: 0,
      started_at: startedAt, ended_at: new Date().toISOString(),
      drivers: allDrivers
    };
    console.log(`[Scraper] Done. Total: ${allDrivers.length} drivers from pages ${firstPageScraped}-${lastPageScraped} (${pagesScraped} pages).`);

  } catch (err: any) {
    console.error("[Scraper] Error:", err.message);
    const partial = allDrivers.length > 0;
    activeSyncStatus = {
      running: false,
      step: partial ? "done" : "error",
      message: partial
        ? `Partial sync: ${allDrivers.length} drivers from ${pageNum} page(s). Stopped: ${err.message}`
        : `Sync failed: ${err.message}`,
      progress: partial ? 100 : 0,
      found: allDrivers.length, added: 0, updated: 0,
      started_at: startedAt, ended_at: new Date().toISOString(),
      error_code: partial ? undefined : (
        err.message?.includes("LOGIN") ? "LOGIN_FAILED" :
        err.message?.includes("2FA") ? "2FA_REQUIRED" : "UNKNOWN_ERROR"
      ),
      drivers: partial ? allDrivers : undefined
    };
    console.log(`[Scraper] Saved ${allDrivers.length} partial drivers.`);
  } finally {
    if (browser) await browser.close();
  }
}

// ── Server ──
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.all("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on port ${PORT} with real Playwright sync enabled.`);
  });
}

startServer();
