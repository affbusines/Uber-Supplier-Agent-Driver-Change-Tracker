# Bug Fix Prompt
## Pagination Next Button — Actual HTML Structure Fix
### Uber Driver Data Extractor — v2.0.6

---

## 🔍 Root Cause — Confirmed from Actual Uber HTML

Uber-এর Next button-এর actual HTML structure দেখা গেছে:

### Desktop:
```html
<div class="_css-bCJnGI">Next</div>
```

### Mobile:
```html
<path d="m18.4 12-7.7 10H6.9l7.7-10L6.9 2h3.8l7.7 10Z" fill="currentColor"></path>
```

**মূল সমস্যা:** Next button একটি `<button>` tag নয় — এটি `<div>` এর ভেতরে text অথবা SVG `<path>` icon। Current code শুধু `<button>` tag খোঁজে, তাই কোনো match হয় না।

**দ্বিতীয় সমস্যা:** `page.evaluate()` এবং `page.waitForFunction()` callback-এর ভেতরে TypeScript syntax (`: any`, `as HTMLButtonElement`, `const`, `let`) আছে — browser pure JavaScript expect করে, তাই `ReferenceError: _name is not defined` error আসছে।

---

## ✅ Fix — `server.ts` এ `hasNextButton`, `clickNextButton`, `waitForPageChange` তিনটি function সম্পূর্ণ replace করো

### এই পুরো block টি খুঁজে বের করো (line 234–395) এবং নিচের code দিয়ে replace করো:

```typescript
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
  return await page.evaluate(function () {
    // Check element is clickable and visible
    function isActive(el) {
      if (!el) return false;
      if (el.disabled) return false;
      if (el.getAttribute('aria-disabled') === 'true') return false;
      var s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      return true;
    }

    // DESKTOP: <div class="_css-...">Next</div> — find parent button or clickable div
    // Search all elements (not just buttons) for "Next" text
    var allElements = Array.from(document.querySelectorAll('div, button, span, a'));
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      // Must have exactly "Next" as direct text (trim whitespace)
      var directText = '';
      for (var j = 0; j < el.childNodes.length; j++) {
        if (el.childNodes[j].nodeType === 3) { // text node
          directText += el.childNodes[j].textContent;
        }
      }
      directText = directText.trim();
      if (directText === 'Next' && isActive(el)) {
        return true;
      }
    }

    // MOBILE: SVG chevron icon button — find button containing the specific path
    // The path "m18.4 12-7.7 10..." is the "next/forward" chevron
    var paths = Array.from(document.querySelectorAll('path'));
    for (var k = 0; k < paths.length; k++) {
      var d = paths[k].getAttribute('d') || '';
      if (d.startsWith('m18.4 12') || d.includes('18.4') ) {
        // Walk up DOM to find the clickable parent button or div
        var parent = paths[k].parentElement;
        while (parent && parent !== document.body) {
          if (parent.tagName === 'BUTTON' || parent.getAttribute('role') === 'button') {
            if (isActive(parent)) return true;
          }
          // Also check if parent div is clickable (has onClick or tabIndex)
          if (parent.tagName === 'DIV' && (parent.getAttribute('tabindex') || parent.onclick)) {
            if (isActive(parent)) return true;
          }
          parent = parent.parentElement;
        }
        // If we found the path, assume it's the next button area
        return true;
      }
    }

    return false;
  });
}


async function clickNextButton(page: any): Promise<boolean> {
  // Scroll to bottom first so button is visible
  await page.evaluate(function () {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(600);

  // ── ATTEMPT 1: Desktop — click the div/button containing exact text "Next" ──
  try {
    // Find element with exact "Next" text using Playwright locator
    // :text-is() matches exact text content
    const nextDivDesktop = page.locator(':text-is("Next")').last();
    if (await nextDivDesktop.count() > 0) {
      const isDisabled = await nextDivDesktop.evaluate(function (el) {
        if (el.disabled) return true;
        if (el.getAttribute('aria-disabled') === 'true') return true;
        var s = window.getComputedStyle(el);
        return s.opacity === '0' || s.display === 'none';
      });
      if (!isDisabled) {
        await nextDivDesktop.scrollIntoViewIfNeeded({ timeout: 2000 });
        await nextDivDesktop.click({ timeout: 5000, force: true });
        console.log('[Pagination] Clicked via :text-is("Next") locator (desktop div).');
        return true;
      }
    }
  } catch (e: any) {
    console.warn('[Pagination] Desktop div text attempt:', e.message);
  }

  // ── ATTEMPT 2: Desktop — button containing a div with "Next" text ──
  try {
    const btnWithNext = page.locator('button:has-text("Next"), [role="button"]:has-text("Next")').last();
    if (await btnWithNext.count() > 0 && !(await btnWithNext.isDisabled())) {
      await btnWithNext.scrollIntoViewIfNeeded({ timeout: 2000 });
      await btnWithNext.click({ timeout: 5000, force: true });
      console.log('[Pagination] Clicked via button:has-text("Next").');
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] button:has-text attempt:', e.message);
  }

  // ── ATTEMPT 3: Mobile — click the SVG chevron next button ──
  try {
    // Find the SVG path and click its nearest clickable ancestor
    const clicked = await page.evaluate(function () {
      var paths = Array.from(document.querySelectorAll('path'));
      for (var k = 0; k < paths.length; k++) {
        var d = paths[k].getAttribute('d') || '';
        if (d.startsWith('m18.4 12') || (d.includes('18.4') && d.includes('7.7'))) {
          var parent = paths[k].parentElement;
          while (parent && parent !== document.body) {
            if (parent.tagName === 'BUTTON') {
              if (!parent.disabled) {
                parent.click();
                return 'mobile-svg-button';
              }
            }
            if (parent.getAttribute('role') === 'button') {
              parent.click();
              return 'mobile-svg-role-button';
            }
            if (parent.tagName === 'DIV' && parent.getAttribute('tabindex') !== null) {
              parent.click();
              return 'mobile-svg-div';
            }
            parent = parent.parentElement;
          }
          // Last resort: click the SVG element itself
          paths[k].parentElement && paths[k].parentElement.click();
          return 'mobile-svg-parent';
        }
      }
      return null;
    });
    if (clicked) {
      console.log(`[Pagination] Clicked mobile SVG chevron: ${clicked}`);
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] Mobile SVG attempt:', e.message);
  }

  // ── ATTEMPT 4: Pure JS — scan ALL elements for "Next" text ──
  try {
    const clicked = await page.evaluate(function () {
      function isActive(el) {
        if (!el) return false;
        if (el.disabled) return false;
        if (el.getAttribute('aria-disabled') === 'true') return false;
        var s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        return true;
      }

      // Scan div, button, span for exact "Next" direct text
      var candidates = Array.from(document.querySelectorAll('div, button, span'));
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var directText = '';
        for (var j = 0; j < el.childNodes.length; j++) {
          if (el.childNodes[j].nodeType === 3) {
            directText += el.childNodes[j].textContent;
          }
        }
        if (directText.trim() === 'Next' && isActive(el)) {
          el.click();
          return 'js-scan:' + el.tagName + '.' + (el.className || '').slice(0, 30);
        }
      }
      return null;
    });
    if (clicked) {
      console.log(`[Pagination] Clicked via JS full scan: ${clicked}`);
      return true;
    }
  } catch (e: any) {
    console.warn('[Pagination] JS full scan attempt:', e.message);
  }

  console.log('[Pagination] All attempts exhausted — Next button not found/clickable.');
  return false;
}


async function waitForPageChange(page: any, prevFirstUUID: string, pageNum: number): Promise<void> {
  console.log(`[Pagination] Waiting for page ${pageNum + 1} (prev: ${prevFirstUUID})...`);

  await page.waitForTimeout(1000);

  try {
    // Pure ES5 JS — NO TypeScript inside waitForFunction
    await page.waitForFunction(
      function (prev) {
        var rows = document.querySelectorAll('[data-testid="drivers-table-row"]');
        if (!rows || rows.length === 0) return false;
        var firstRow = rows[0];
        var payload = firstRow.getAttribute('data-tracking-payload') || '';
        var uuid = '';
        try {
          uuid = JSON.parse(payload.replace(/&quot;/g, '"')).driverUUID || '';
        } catch (e) {
          uuid = (firstRow.textContent || '').slice(0, 40);
        }
        return uuid !== '' && uuid !== prev;
      },
      prevFirstUUID,
      { timeout: 12000, polling: 500 }
    );
    console.log(`[Pagination] Page ${pageNum + 1} confirmed loaded.`);
  } catch (_) {
    console.warn('[Pagination] waitForFunction timed out — using 4s fallback...');
    await page.waitForTimeout(4000);
    var rowCount = await page.locator('[data-testid="drivers-table-row"]').count();
    console.log(`[Pagination] Fallback: ${rowCount} rows visible.`);
    if (rowCount === 0) {
      throw new Error('NO_ROWS_AFTER_NEXT: No driver rows found after next page navigation.');
    }
  }
}
```

---

## ✅ Fix — `hasNextButton` এও একটি change দরকার

এছাড়া `hasNextButton` function-এ বর্তমান loop-এ `waitForSelector` যোগ করো যাতে button visible হওয়ার আগেই check না হয়:

Pagination loop-এ এই line টা `hasNextButton` call-এর আগে যোগ করো:

```typescript
// Scroll to bottom before checking next button
await page.evaluate(function () { window.scrollTo(0, document.body.scrollHeight); });
await page.waitForTimeout(500);

const nextExists = await hasNextButton(page);
```

---

## 📋 Summary — কী কী পরিবর্তন হলো

| # | সমস্যা | Fix |
|---|--------|-----|
| 1 | `hasNextButton` শুধু `<button>` tag খুঁজত | এখন `<div>`, `<span>`, `<button>` সব element-এর direct text "Next" check করে |
| 2 | Mobile SVG chevron (`<path d="m18.4 12...">`) detect হতো না | SVG path দেখে parent clickable element খুঁজে click করে |
| 3 | `evaluate()` এর ভেতরে TypeScript (`: any`, `as X`, `const`) ছিল | সব pure ES5 JavaScript-এ convert — `var`, `function(){}`, type annotation নেই |
| 4 | Click শুধু `<button>` এ try করত | `:text-is("Next")`, `has-text("Next")`, SVG path, full DOM scan — ৪টি fallback strategy |

---

> **সবচেয়ে গুরুত্বপূর্ণ fix:** Uber-এর Next button `<div class="_css-bCJnGI">Next</div>` — এটি `<button>` নয়, তাই আগের সব code কাজ করছিল না। এখন `:text-is("Next")` এবং direct text node scan দিয়ে এই div খুঁজে click করা হবে।

---

*Bug fix prompt for: Uber Driver Data Extractor v2.0.6*
*File: uber-driver-pagination-div-fix.md*
