import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import videoSource from '../public/clouds/video.json' with { type: 'json' };

const end = videoSource.duration-1/videoSource.fps;

const hero = '.cloud-hero';
const canvas = '.cloud-hero canvas';
const time = async (page: Page) => Number(await page.locator(canvas).getAttribute('data-time'));
async function seek(page: Page, fraction: number) {
  await page.evaluate(fraction => {
    dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    const cloud = document.querySelector<HTMLElement>('.cloud-hero')!;
    const stage = cloud.querySelector<HTMLElement>('.cloud-hero__stage')!;
    scrollTo(0, (cloud.offsetHeight-stage.clientHeight)*fraction);
  }, fraction);
  await expect.poll(async () => Math.abs(await time(page)-fraction*end)).toBeLessThan(0.12);
}

test('video starts by default, reuses one texture, and coalesces scroll jumps', async ({ page }) => {
  const assets: string[] = [], errors: string[] = [];
  page.on('request', r => { if (r.url().includes('/clouds/')) assets.push(r.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).videoTextureAllocations = 0;
    const create = WebGL2RenderingContext.prototype.createTexture;
    WebGL2RenderingContext.prototype.createTexture = function () {
      (window as any).videoTextureAllocations++;
      return create.call(this);
    };
  });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state', 'ready');
  await expect(page.locator(canvas)).toHaveAttribute('data-variant', 'video');
  expect(assets.every(url => /video.json|cloud-video.mp4|poster(-light)?.webp/.test(url))).toBe(true);
  await seek(page, 0.7);
  await seek(page, 0.2);
  await page.evaluate(() => {
    dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    for (const fraction of [0.95,0.05,0.8,0.4]) {
      scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction);
      dispatchEvent(new Event('scroll'));
    }
  });
  await expect.poll(async () => Math.abs(await time(page)-0.4*end)).toBeLessThan(0.12);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => (window as any).videoTextureAllocations)).toBe(1);
  expect(errors).toEqual([]);
});

test('video idle motion pauses for input and touch holds, then reverses at the end', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state', 'ready');
  await expect.poll(() => time(page)).toBeGreaterThan(0.3);
  await seek(page, 0.5);
  const held = await time(page);
  await page.evaluate(() => dispatchEvent(new Event('touchstart')));
  await page.waitForTimeout(2400);
  expect(Math.abs(await time(page)-held)).toBeLessThan(0.1);
  await page.evaluate(() => dispatchEvent(new Event('touchend')));
  await expect.poll(() => time(page)).toBeGreaterThan(held+0.3);
  await seek(page, 1);
  await expect.poll(() => time(page)).toBeLessThan(end-Math.min(0.45,end/10));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('video seek and exposure preserve time across theme changes without media reloads', async ({ page }) => {
  const requests: string[] = [];
  await page.emulateMedia({ colorScheme: 'light' });
  page.on('request', request => { if (/video.json|cloud-video.mp4/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state', 'ready');
  await seek(page, 0.4);
  await page.evaluate(() => dispatchEvent(new Event('touchstart')));
  const held = await time(page), initialRequests = [...requests];
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await expect(page.locator(hero)).toHaveAttribute('data-exposure-scale','1.2');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator(hero)).toHaveAttribute('data-exposure-scale','0.8');
  expect(Math.abs(await time(page)-held)).toBeLessThan(0.1);
  expect(requests).toEqual(initialRequests);
});

test('reduced motion downloads no video and can restart when the preference changes', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/video.json|cloud-video.mp4/.test(request.url())) requests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
  expect(requests).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
});

test('failed media and rejected playback retain the poster', async ({ page }) => {
  await page.route('**/cloud-video.mp4', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
  await page.unroute('**/cloud-video.mp4');
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Blocked','NotAllowedError')); });
  await page.reload();
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
});

test('video context loss falls back and restoration rebuilds playback', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  const supported = await page.locator(canvas).evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    (window as any).videoContextExtension = extension;
    extension.loseContext(); return true;
  });
  test.skip(!supported, 'Browser does not expose context-loss testing');
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
  await page.evaluate(() => (window as any).videoContextExtension.restoreContext());
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
});

test('a scroll jump during loading presents its requested position first', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/clouds/video.json', async route => { await gate; await route.continue(); });
  await page.addInitScript(() => {
    (window as any).firstVideoTime = null;
    window.addEventListener('cloud-frame', () => {
      if ((window as any).firstVideoTime !== null) return;
      // data-time is updated after the synchronous overlay notification.
      queueMicrotask(() => { (window as any).firstVideoTime ??= Number(document.querySelector<HTMLElement>('.cloud-hero canvas')?.dataset.time); });
    });
  });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','loading');
  await page.evaluate(() => scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*0.6));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  release();
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  expect(Math.abs(await page.evaluate(() => (window as any).firstVideoTime)-0.6*end)).toBeLessThan(0.12);
});

test('hidden documents pause playback and resume from the held position', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  await expect.poll(() => time(page)).toBeGreaterThan(0.3);
  await page.evaluate(() => {
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const held = await time(page);
  await page.waitForTimeout(2300);
  expect(Math.abs(await time(page)-held)).toBeLessThan(0.1);
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => time(page)).toBeGreaterThan(held+0.3);
});

test('playback works when video-frame callbacks are unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{configurable:true,value:undefined});
  });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  await expect.poll(() => time(page)).toBeGreaterThan(0.3);
  await seek(page,0.3);
});

test('late callbacks advance playback and pre-seek callbacks cannot overwrite a jump', async ({ page }) => {
  await page.addInitScript(() => {
    const request = HTMLVideoElement.prototype.requestVideoFrameCallback;
    HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
      // Cancellation cannot retract a callback that has already been queued.
      return request.call(this,(now,metadata) => { setTimeout(() => callback(now,metadata),120); });
    };
  });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','ready');
  await expect.poll(() => time(page)).toBeGreaterThan(0.3);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => dispatchEvent(new Event('touchstart')));
  await seek(page,0.7);
  await seek(page,0.2);
  await page.waitForTimeout(350);
  expect(Math.abs(await time(page)-0.2*end)).toBeLessThan(0.12);
});

test('unavailable WebGL retains the poster without requesting video data', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('cloud-video.mp4')) requests.push(request.url()); });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error instrumentation preserves all other context types
    HTMLCanvasElement.prototype.getContext = function(type: string, options: unknown) {
      return type === 'webgl2' ? null : original.call(this,type,options as never);
    };
  });
  await page.goto('/');
  await expect(page.locator(hero)).toHaveAttribute('data-state','static');
  expect(requests).toEqual([]);
});
