import { expect, test } from '@playwright/test';
import manifest from '../public/clouds/manifest.json' with { type: 'json' };

test('scroll selects frames in either direction, across all atlas boundaries', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const hero = page.locator('.cloud-hero'), canvas = hero.locator('canvas');
  await expect(hero).toHaveAttribute('data-state', 'ready');
  await page.mouse.wheel(0,300);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-variant', 'desktop');
  const last = manifest.variants.desktop.count - 1;
  const capacity = manifest.variants.desktop.columns * manifest.variants.desktop.rows;
  const boundaries = manifest.variants.desktop.pages.slice(1).flatMap((_, i) => [(i + 1) * capacity - 1, (i + 1) * capacity]);
  for (const target of [0, ...boundaries, last, Math.floor(last / 2), 0]) {
    await hero.evaluate((element, { frame, last }) => {
      const stage = element.querySelector('.cloud-hero__stage')!;
      const start = element.getBoundingClientRect().top + scrollY;
      scrollTo(0,start+(element.clientHeight-stage.clientHeight)*frame/last);
    }, { frame: target, last });
    await expect(canvas).toHaveAttribute('data-frame', String(target));
  }
  const dimensions = await canvas.evaluate(element => ({ width: element.width, height: element.height }));
  expect(dimensions.width*dimensions.height).toBeLessThanOrEqual(256000);
  expect(errors).toEqual([]);
});

test('theme changes redraw without resetting time or downloading assets again', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const requests: string[] = [];
  page.on('request', request => { if (/\/clouds\/(manifest|desktop-)/.test(request.url())) requests.push(request.url()); });
  await page.addInitScript(() => {
    Object.assign(window, { cloudDraws: 0 });
    window.addEventListener('cloud-frame', () => {
      (window as unknown as { cloudDraws: number }).cloudDraws++;
    });
  });
  await page.goto('/');
  const hero = page.locator('.cloud-hero'), canvas = hero.locator('canvas');
  await expect(hero).toHaveAttribute('data-state', 'ready');
  const draws = () => page.evaluate(() => (window as unknown as { cloudDraws: number }).cloudDraws);
  const initialDraws = await draws();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { dispatchEvent(new Event('scroll')); resolve(); }))));
  expect(await draws()).toBe(initialDraws);
  const originalRequests = [...requests];
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(draws).toBeGreaterThan(initialDraws);
  await expect(canvas).toHaveAttribute('data-frame', '0');
  await hero.evaluate((element, last) => {
    const stage = element.querySelector('.cloud-hero__stage')!;
    scrollTo(0, element.getBoundingClientRect().top + scrollY + (element.clientHeight - stage.clientHeight) * 100 / last);
  }, manifest.variants.desktop.count - 1);
  await expect(canvas).toHaveAttribute('data-frame', '100');
  const beforeStorage = await draws();
  await page.evaluate(() => dispatchEvent(new StorageEvent('storage', { key: 'minato-theme', newValue: 'light' })));
  await expect.poll(draws).toBeGreaterThan(beforeStorage);
  await expect(canvas).toHaveAttribute('data-frame', '100');
  expect(requests).toEqual(originalRequests);
});

test('mobile uses smaller assets and survives portrait-to-landscape resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const desktopRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/desktop-')) desktopRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
  await expect(page.locator('.cloud-hero canvas')).toHaveAttribute('data-variant','mobile');
  await page.locator('.cloud-hero').evaluate((element, last) => {
    const stage = element.querySelector('.cloud-hero__stage')!;
    scrollTo(0,element.getBoundingClientRect().top+scrollY+(element.clientHeight-stage.clientHeight)*60/last);
  }, manifest.variants.mobile.count - 1);
  await expect(page.locator('.cloud-hero canvas')).toHaveAttribute('data-frame','60');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
  await expect(page.locator('.cloud-hero canvas')).toHaveAttribute('data-variant','mobile');
  expect(desktopRequests).toEqual([]);
});

test('reduced motion retains the poster and downloads no animation assets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const assets: string[] = [];
  page.on('request', request => { if (/\/clouds\/(manifest|desktop-|mobile-)/.test(request.url())) assets.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(assets).toEqual([]);
});

test('unsupported WebGL and failed assets fall back to the poster', async ({ page }) => {
  await page.route('**/clouds/desktop-0.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
  await page.unroute('**/clouds/desktop-0.webp');
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test instrumentation preserves other context types
    HTMLCanvasElement.prototype.getContext = function(type: string, options: unknown) {
      return type === 'webgl2' ? null : original.call(this,type,options as never);
    };
  });
  await page.reload();
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
});

test('changing motion preference cancels loading and can restart animation', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/clouds/desktop-0.webp', async route => {
    await gate;
    await route.continue().catch(() => {}); // The first request is aborted by the preference change.
  });
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','loading');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
  release();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
});

test('context loss falls back and restoration rebuilds the renderer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
  const supported = await page.locator('.cloud-hero canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    Object.assign(window, { cloudContextExtension: extension });
    extension.loseContext();
    return true;
  });
  test.skip(!supported, 'Browser does not expose context-loss testing');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
  await page.evaluate(() => {
    (window as unknown as { cloudContextExtension: WEBGL_lose_context }).cloudContextExtension.restoreContext();
  });
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
});

test('context loss while assets load never reveals an incomplete canvas', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/clouds/desktop-5.webp', async route => {
    await gate;
    await route.continue().catch(() => {});
  });
  const requested = page.waitForRequest('**/clouds/desktop-5.webp');
  await page.goto('/');
  await requested;
  const supported = await page.locator('.cloud-hero canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    Object.assign(window, { cloudContextExtension: extension });
    extension.loseContext(); return true;
  });
  release();
  test.skip(!supported, 'Browser does not expose context-loss testing');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','static');
  await page.evaluate(() => {
    (window as unknown as { cloudContextExtension: WEBGL_lose_context }).cloudContextExtension.restoreContext();
  });
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state','ready');
});
