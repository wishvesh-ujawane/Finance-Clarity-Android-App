import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * Whole-app mobile layout audit against DESIGN §10 and §12. Walks every
 * screen, Analysis tab, and the sheets/dialogs reachable from the FAB and
 * list rows, at the supported phone widths, with filled and empty data and
 * at 130% text size. Uses synthetic data only.
 */

const MIN_CARD_INSET = 8;
const MIN_TEXT_PX = 11;
const MIN_TARGET_PX = 48;
const MAX_EMPTY_SPACE_PX = 200;
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [data-testid="transaction-sheet"]';

interface AuditConfig {
  name: string;
  viewport: { width: number; height: number };
  data: 'filled' | 'empty';
  textScale?: number;
}

const CONFIGS: AuditConfig[] = [
  { name: '320 filled', viewport: { width: 320, height: 640 }, data: 'filled' },
  { name: '360 filled', viewport: { width: 360, height: 740 }, data: 'filled' },
  { name: '412 filled', viewport: { width: 412, height: 915 }, data: 'filled' },
  { name: '360 filled text-130%', viewport: { width: 360, height: 740 }, data: 'filled', textScale: 1.3 },
  { name: '320 empty', viewport: { width: 320, height: 640 }, data: 'empty' },
];

type Screen = { name: string; route: string; tab?: string };

const SCREENS: Screen[] = [
  { name: 'dashboard', route: '/' },
  { name: 'transactions', route: '/transactions' },
  { name: 'budgets', route: '/budgets' },
  { name: 'analysis/Overview', route: '/analysis', tab: 'Overview' },
  { name: 'analysis/Planning', route: '/analysis', tab: 'Planning' },
  { name: 'analysis/Trends', route: '/analysis', tab: 'Trends' },
  { name: 'settings', route: '/settings' },
  { name: 'settings/recurring', route: '/settings/recurring' },
  { name: 'settings/categories', route: '/settings/categories' },
  { name: 'settings/savings', route: '/settings/savings' },
  { name: 'settings/security', route: '/settings/security' },
  { name: 'settings/backup', route: '/settings/backup' },
];

/** Sheets opened from a list row or button, filled data only. */
const ROW_OVERLAYS: { name: string; route: string; testId: string }[] = [
  { name: 'transaction edit sheet', route: '/transactions', testId: 'txn-e2e-long-2' },
  { name: 'budget detail', route: '/budgets', testId: 'budget-e2e-b1' },
  { name: 'recurring edit sheet', route: '/settings/recurring', testId: 'recurring-edit-e2e-r2' },
  { name: 'category edit', route: '/settings/categories', testId: 'category-item-e2e-long' },
  { name: 'analysis month picker', route: '/analysis', testId: 'month-picker-trigger' },
];

function monthKey(offset: number) {
  const d = new Date();
  const shifted = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function filledData() {
  const months = [-2, -1, 0].map(monthKey);
  const today = new Date().getDate();
  const day = (n: number) => String(Math.min(n, today)).padStart(2, '0');
  const transactions = months.flatMap((m, i) => [
    { id: `e2e-sal-${i}`, type: 'income', amount: 85000, categoryId: 'salary', note: '', date: `${m}-01` },
    { id: `e2e-gro-${i}`, type: 'expense', amount: 6400, categoryId: 'groceries', note: 'Weekly vegetables and fruit from the market', date: `${m}-${day(2)}` },
    { id: `e2e-din-${i}`, type: 'expense', amount: 3250, categoryId: 'dining', note: '', date: `${m}-${day(3)}` },
    { id: `e2e-tra-${i}`, type: 'expense', amount: 1890, categoryId: 'transport', note: '', date: `${m}-${day(4)}` },
    { id: `e2e-lei-${i}`, type: 'expense', amount: 12345, categoryId: 'leisure', note: '', date: `${m}-${day(5)}` },
    { id: `e2e-long-${i}`, type: 'expense', amount: 123456, categoryId: 'e2e-long', note: 'Refrigerator replacement', date: `${m}-${day(6)}` },
  ]);
  const current = monthKey(0);
  const rule = (id: string, description: string, amount: number, dayOfMonth: number) => ({
    id, description, amount, categoryId: 'rent', dayOfMonth, active: true,
    startMonth: monthKey(-2), lastGeneratedMonth: current,
  });
  return {
    'financial-clarity:categories': [
      { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense', active: true },
      { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'expense', active: true },
      { id: 'leisure', name: 'Leisure', icon: 'Smile', color: '#F59E0B', type: 'expense', active: true },
      { id: 'transport', name: 'Transport', icon: 'Car', color: '#3B82F6', type: 'expense', active: true },
      { id: 'dining', name: 'Dining', icon: 'Utensils', color: '#F97316', type: 'expense', active: true },
      { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income', active: true },
      { id: 'e2e-long', name: 'Home appliances and electronics', icon: 'Laptop', color: '#8B5CF6', type: 'expense', active: true },
    ],
    'financial-clarity:transactions': transactions,
    'financial-clarity:budgets': [
      { id: 'e2e-b1', categoryId: 'groceries', limit: 8000, month: current },
      { id: 'e2e-b2', categoryId: 'dining', limit: 3000, month: current },
      { id: 'e2e-b3', categoryId: 'leisure', limit: 10000, month: current },
      { id: 'e2e-b4', categoryId: 'e2e-long', limit: 150000, month: current },
    ],
    'financial-clarity:recurring': [
      rule('e2e-r1', 'House rent', 25000, 1),
      rule('e2e-r2', 'Broadband and streaming bundle', 1499, 10),
      rule('e2e-r3', 'Car loan EMI', 18750, 15),
      rule('e2e-r4', 'Gym', 1200, 28),
    ],
  };
}

async function prepare(page: Page, config: AuditConfig, options: { dismissMonthEnd?: boolean } = {}) {
  await page.route(
    /^https:\/\/(apis\.google\.com|accounts\.google\.com|www\.gstatic\.com)\//,
    route => route.abort(),
  );
  await page.addInitScript(({ seed, previousMonth, dismissMonthEnd }) => {
    if (sessionStorage.getItem('e2e:seeded')) return;
    sessionStorage.setItem('e2e:seeded', '1');
    localStorage.setItem('financial-clarity:onboarding-complete', 'e2e');
    if (dismissMonthEnd) localStorage.setItem(`financial-clarity:month-end-review:${previousMonth}`, `dismissed:${Date.now()}`);
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value));
  }, { seed: config.data === 'filled' ? filledData() : {}, previousMonth: monthKey(-1), dismissMonthEnd: options.dismissMonthEnd ?? true });

  if (config.textScale) {
    // Approximates Android system font scaling: every element with its own
    // font size is enlarged once; inherited sizes follow their parent.
    await page.addInitScript(scale => {
      const scaleTree = (root: Element) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        for (let n = walker.currentNode as Element | null; n; n = walker.nextNode() as Element | null) {
          const el = n as HTMLElement;
          if (el.dataset?.e2eScaled || !el.style || !el.parentElement) continue;
          const own = parseFloat(getComputedStyle(el).fontSize);
          const parent = parseFloat(getComputedStyle(el.parentElement).fontSize);
          el.dataset.e2eScaled = '1';
          if (own !== parent || !el.parentElement.dataset.e2eScaled) el.style.fontSize = `${own * scale}px`;
        }
      };
      new MutationObserver(records => {
        for (const r of records) for (const node of Array.from(r.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) scaleTree(node as Element);
        }
      }).observe(document, { childList: true, subtree: true });
    }, config.textScale);
  }
}

interface AuditResult {
  horizontalOverflow: number;
  cutOffText: string[];
  offScreenText: string[];
  overlappingText: string[];
  coveredByFixed: string[];
  smallText: string[];
  smallTargets: string[];
  tightCards: string[];
  emptySpaceBelow: number;
}

/**
 * Measures the open dialog if there is one, otherwise <main>. Scrolls to the
 * bottom first so fixed bars are checked against the last content.
 */
async function audit(page: Page): Promise<AuditResult> {
  return page.evaluate(({ minInset, minText, minTarget }) => {
    const vw = window.innerWidth;
    const dialogSelector = '[role="dialog"], [role="alertdialog"], [data-testid="transaction-sheet"]';
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>(dialogSelector))
      .filter(d => d.getBoundingClientRect().height > 0);
    const scope = dialogs.at(-1) ?? document.querySelector<HTMLElement>('main') ?? document.body;
    const inDialog = scope.matches(dialogSelector);

    window.scrollTo(0, document.documentElement.scrollHeight);
    const main = document.querySelector<HTMLElement>('main');
    if (main) main.scrollTop = main.scrollHeight;
    for (const el of [scope, ...Array.from(scope.querySelectorAll<HTMLElement>('*'))]) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    }

    const label = (el: Element | null) => {
      if (!el) return '?';
      const h = el as HTMLElement;
      const text = (h.getAttribute('aria-label') ?? h.dataset?.testid ?? h.textContent ?? '').trim().replace(/\s+/g, ' ');
      return text.slice(0, 40) || h.tagName.toLowerCase();
    };
    const isHidden = (el: Element) => {
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return true;
        if (e.getAttribute('aria-hidden') === 'true' && e !== scope) return true;
        if (e.classList.contains('sr-only')) return true;
      }
      return false;
    };
    const visibleSpan = (rect: DOMRect, from: Element | null, stop: Element) => {
      let left = rect.left;
      let right = rect.right;
      let top = rect.top;
      let bottom = rect.bottom;
      let ellipsis = false;
      // Clipping by a scroll container is expected (content scrolls into
      // view); clipping by a non-scrolling container hides text for good.
      let hardClipped = false;
      let scrollClipped = false;
      for (let el = from; el && el !== stop.parentElement; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') ellipsis = true;
        const b = el.getBoundingClientRect();
        const outX = rect.left < b.left - 1 || rect.right > b.right + 1;
        const outY = rect.top < b.top - 1 || rect.bottom > b.bottom + 1;
        if (s.overflowX !== 'visible') {
          if (s.overflowX === 'hidden' || s.overflowX === 'clip') { if (outX && !scrollClipped) hardClipped = true; }
          else if (outX) scrollClipped = true;
          left = Math.max(left, b.left);
          right = Math.min(right, b.right);
        }
        if (s.overflowY !== 'visible') {
          if (s.overflowY === 'hidden' || s.overflowY === 'clip') { if (outY && !scrollClipped) hardClipped = true; }
          else if (outY) scrollClipped = true;
          top = Math.max(top, b.top);
          bottom = Math.min(bottom, b.bottom);
        }
      }
      return { rect: new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top)), ellipsis, hardClipped };
    };

    type TextBox = { node: Text; parent: Element; rect: DOMRect; text: string };
    const boxes: TextBox[] = [];
    const cutOffText: string[] = [];
    const offScreenText: string[] = [];
    const smallText: string[] = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const text = n.textContent?.trim();
      const parent = n.parentElement;
      if (!text || !parent || parent.closest('svg') || isHidden(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const raw of Array.from(range.getClientRects())) {
        if (raw.width === 0 || raw.height === 0) continue;
        const { rect, ellipsis, hardClipped } = visibleSpan(raw, parent, scope);
        if (rect.width === 0 || rect.height === 0) continue; // fully scrolled/clipped away (e.g. inactive tab)
        if (!ellipsis && hardClipped) cutOffText.push(text.slice(0, 40));
        if (rect.right > vw + 1 || rect.left < -1) offScreenText.push(text.slice(0, 40));
        boxes.push({ node: n, parent, rect, text: text.slice(0, 30) });
      }
      const fs = parseFloat(getComputedStyle(parent).fontSize);
      if (fs < minText) smallText.push(`${text.slice(0, 30)} (${fs}px)`);
    }

    const overlappingText: string[] = [];
    // Content scrolling under a sticky header/footer is expected.
    const inSticky = (el: Element) => {
      for (let e: Element | null = el; e && e !== scope.parentElement; e = e.parentElement) {
        if (getComputedStyle(e).position === 'sticky') return true;
      }
      return false;
    };
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].rect;
        const b = boxes[j].rect;
        if (boxes[i].node === boxes[j].node) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 3 && h > 3 && inSticky(boxes[i].parent) === inSticky(boxes[j].parent)) overlappingText.push(`"${boxes[i].text}" × "${boxes[j].text}"`);
      }
    }

    const fixed = inDialog ? [] : Array.from(document.querySelectorAll<HTMLElement>('nav, [data-testid="fab-add"], button.fixed'))
      .filter(el => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 0);
    const coveredByFixed: string[] = [];
    for (const box of boxes) {
      for (const f of fixed) {
        if (f.contains(box.parent)) continue;
        const r = f.getBoundingClientRect();
        const w = Math.min(box.rect.right, r.right) - Math.max(box.rect.left, r.left);
        const h = Math.min(box.rect.bottom, r.bottom) - Math.max(box.rect.top, r.top);
        if (w > 2 && h > 2) coveredByFixed.push(`"${box.text}" under ${f.tagName === 'NAV' ? 'bottom nav' : 'FAB'}`);
      }
    }

    const smallTargets: string[] = [];
    const targets = scope.querySelectorAll<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], input:not([type="hidden"]), select, textarea');
    for (const t of Array.from(targets)) {
      if (isHidden(t) || (t as HTMLButtonElement).disabled) continue;
      // Documented exceptions (proposed DESIGN §12.3 amendment): dense 7-column
      // grids and pickers that cannot reach 48 px at 320 px, and checkboxes
      // whose whole 48 px label is the tap target.
      if (t.closest('[data-dense-grid]')) continue;
      if (t.matches('input[type="checkbox"]') && (t.closest('label')?.getBoundingClientRect().height ?? 0) >= minTarget) continue;
      const r = t.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right < 0 || r.left > vw) continue;
      // `tap-target` expands the hit area with ::after (DESIGN §12.3).
      const after = getComputedStyle(t, '::after');
      const hitW = Math.max(r.width, after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.width) || 0 : 0);
      const hitH = Math.max(r.height, after.content !== 'none' && after.position === 'absolute' ? parseFloat(after.height) || 0 : 0);
      if (hitW < minTarget - 0.5 || hitH < minTarget - 0.5) smallTargets.push(`${label(t)} (${Math.round(hitW)}×${Math.round(hitH)})`);
    }

    const tightCards: string[] = [];
    for (const card of Array.from(scope.querySelectorAll<HTMLElement>('.bg-card.rounded-2xl'))) {
      const r = card.getBoundingClientRect();
      if (r.width === 0 || r.right < 0 || r.left > vw) continue;
      let worst = Infinity;
      let worstText = '';
      for (const box of boxes) {
        if (!card.contains(box.parent)) continue;
        const inset = Math.min(box.rect.left - r.left, r.right - box.rect.right);
        if (inset < worst) { worst = inset; worstText = box.text; }
      }
      if (worst < minInset) tightCards.push(`${label(card.querySelector('h2, h3, p') ?? card)}: "${worstText}" at ${Math.round(worst)}px`);
    }

    let emptySpaceBelow = 0;
    if (!inDialog && main && boxes.length > 0) {
      const contentBottom = Math.max(...Array.from(main.querySelectorAll('*'))
        .filter(el => !isHidden(el))
        .map(el => {
          const b = el.getBoundingClientRect();
          return b.height > 0 && b.width > 0 && el.children.length === 0 ? b.bottom : -Infinity;
        }));
      const navTop = Math.min(window.innerHeight, ...fixed.filter(f => f.tagName === 'NAV').map(f => f.getBoundingClientRect().top));
      // Only space the user can scroll into counts; a short screen that fits
      // the viewport is not "empty scrolling".
      const scrolled = window.scrollY + main.scrollTop;
      emptySpaceBelow = contentBottom < 0 || scrolled <= 0 ? 0 : Math.round(Math.min(scrolled, navTop - contentBottom));
    }

    const overflowOf = (el: Element | null) => (el ? el.scrollWidth - el.clientWidth : 0);
    const uniq = (xs: string[]) => Array.from(new Set(xs)).slice(0, 15);
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, overflowOf(main), inDialog ? overflowOf(scope) : 0),
      cutOffText: uniq(cutOffText),
      offScreenText: uniq(offScreenText),
      overlappingText: uniq(overlappingText),
      coveredByFixed: uniq(coveredByFixed),
      smallText: uniq(smallText),
      smallTargets: uniq(smallTargets),
      tightCards: uniq(tightCards),
      emptySpaceBelow,
    };
  }, { minInset: MIN_CARD_INSET, minText: MIN_TEXT_PX, minTarget: MIN_TARGET_PX });
}

async function record(page: Page, info: TestInfo, name: string) {
  await page.waitForTimeout(700);
  const result = await audit(page);
  await info.attach(`audit ${name}`, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  await info.attach(`screenshot ${name}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect.soft(result.horizontalOverflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect.soft(result.cutOffText, `${name}: text cut off without an ellipsis`).toEqual([]);
  expect.soft(result.offScreenText, `${name}: text outside the screen`).toEqual([]);
  expect.soft(result.overlappingText, `${name}: overlapping text`).toEqual([]);
  expect.soft(result.coveredByFixed, `${name}: text under the bottom nav or FAB`).toEqual([]);
  expect.soft(result.tightCards, `${name}: card content closer than ${MIN_CARD_INSET}px to an edge`).toEqual([]);
  expect.soft(result.emptySpaceBelow, `${name}: empty space below content`).toBeLessThanOrEqual(MAX_EMPTY_SPACE_PX);
  expect.soft(result.smallText, `${name}: text under ${MIN_TEXT_PX}px`).toEqual([]);
  expect.soft(result.smallTargets, `${name}: touch targets under ${MIN_TARGET_PX}px`).toEqual([]);
}

async function goTo(page: Page, screen: Screen) {
  await page.goto(screen.route);
  await page.waitForLoadState('networkidle');
  if (screen.tab) await page.getByRole('tab', { name: screen.tab }).click();
}

async function closeOverlay(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

/** Opens the FAB action (or each FAB menu action) on the current route and audits each sheet. */
async function auditFab(page: Page, info: TestInfo, screen: Screen) {
  const fab = page.getByTestId('fab-add');
  if (!(await fab.isVisible().catch(() => false))) return;
  await fab.click();
  await page.waitForTimeout(400);
  if ((await fab.getAttribute('aria-expanded')) === 'true') {
    await record(page, info, `${screen.name} + FAB menu`);
    const labels = await page.locator('div.fixed.bottom-36 button[aria-label]').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label') ?? ''));
    await closeOverlay(page);
    for (const label of labels) {
      await goTo(page, screen);
      await page.getByTestId('fab-add').click();
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.locator(OVERLAY_SELECTOR).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
      await record(page, info, `${screen.name} + FAB "${label}"`);
      await closeOverlay(page);
    }
  } else {
    await page.locator(OVERLAY_SELECTOR).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
    await record(page, info, `${screen.name} + FAB`);
    await closeOverlay(page);
  }
}

for (const config of CONFIGS) {
  test.describe(`ui audit @ ${config.name}`, () => {
    test.use({ viewport: config.viewport });

    test('[UI-AUDIT] screens and FAB sheets', async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
      test.setTimeout(240_000);
      await prepare(page, config);
      for (const screen of SCREENS) {
        await goTo(page, screen);
        await record(page, info, screen.name);
        if (!screen.tab || screen.tab === 'Overview') await auditFab(page, info, screen);
      }
    });

    if (config.data === 'filled') {
      test('[UI-AUDIT] row sheets and month-end review', async ({ page }, info) => {
        test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
        test.setTimeout(120_000);
        await prepare(page, config, { dismissMonthEnd: false });
        await page.goto('/');
        const review = page.getByTestId('month-end-review-modal');
        if (await review.isVisible({ timeout: 5000 }).catch(() => false)) {
          await record(page, info, 'month-end review');
          await page.getByTestId('month-end-continue').click();
          await record(page, info, 'month-end reconcile');
          await page.getByTestId('reconcile-skip').click().catch(() => undefined);
          await record(page, info, 'month-end next step');
          await closeOverlay(page);
        }
        for (const overlay of ROW_OVERLAYS) {
          await page.goto(overlay.route);
          await page.waitForLoadState('networkidle');
          const trigger = page.getByTestId(overlay.testId);
          if (!(await trigger.isVisible().catch(() => false))) {
            expect.soft(false, `${overlay.name}: trigger ${overlay.testId} not visible`).toBe(true);
            continue;
          }
          await trigger.click();
          await page.locator(OVERLAY_SELECTOR).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
          await record(page, info, overlay.name);
          await closeOverlay(page);
        }
      });
    }
  });
}

for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 740 }, { width: 412, height: 915 }]) {
  test.describe(`ui audit @ ${viewport.width} Analysis tab height`, () => {
    test.use({ viewport });

    test('[UI-AUDIT] each Analysis tab is only as tall as its own content', async ({ page }, info) => {
      test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
      test.setTimeout(60_000);
      await prepare(page, CONFIGS[0]);
      for (const tab of ['Overview', 'Planning', 'Trends']) {
        await goTo(page, { name: `analysis/${tab}`, route: '/analysis', tab });
        await page.waitForTimeout(700);
        const m = await page.evaluate(() => {
          const panel = document.querySelector<HTMLElement>('[role="tabpanel"][aria-hidden="false"]');
          const slider = panel?.parentElement?.parentElement;
          if (!panel || !slider) return null;
          const kids = Array.from(panel.children).map(c => c.getBoundingClientRect());
          const content = Math.max(...kids.map(k => k.bottom)) - Math.min(...kids.map(k => k.top));
          return { sliderHeight: Math.round(slider.getBoundingClientRect().height), contentHeight: Math.round(content) };
        });
        await info.attach(`tab height ${tab}`, { body: JSON.stringify(m), contentType: 'application/json' });
        expect.soft(m, `${tab} panel found`).not.toBeNull();
        expect.soft((m?.sliderHeight ?? 0) - (m?.contentHeight ?? 0), `${tab}: empty space below the last card`).toBeLessThanOrEqual(24);
      }
    });
  });
}

test.describe('ui audit @ 320 Upcoming Recurring Payments', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('[UI-AUDIT] upcoming payment rows stay readable', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium-mobile-viewport', 'mobile project only');
    await prepare(page, CONFIGS[0]);
    await goTo(page, { name: 'analysis/Planning', route: '/analysis', tab: 'Planning' });
    await page.waitForTimeout(700);
    const rows = await page.locator('[data-testid^="obligation-"]:not([data-testid="obligation-name"])').evaluateAll(els => els.map(row => {
      const name = row.querySelector<HTMLElement>('[data-testid="obligation-name"]');
      return { row: (row as HTMLElement).dataset.testid, itemWidth: Math.round(name?.getBoundingClientRect().width ?? 0) };
    }));
    await info.attach('upcoming rows', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
    expect(rows.length).toBeGreaterThan(0);
    // At 320 px the name gets the width left after the icon and the amount.
    for (const r of rows) expect.soft(r.itemWidth, `${r.row} item name width`).toBeGreaterThanOrEqual(80);
  });
});
