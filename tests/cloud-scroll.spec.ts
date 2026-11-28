import { expect, test } from '@playwright/test';
import manifest from '../public/clouds/manifest.json' with { type: 'json' };

test('idle drift pauses for manual scrolling, resumes, and reverses at the end', async ({ page }) => {
  await page.clock.install();
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const hero = page.locator('.cloud-hero'), canvas = hero.locator('canvas');
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return hero.getAttribute('data-state');
  }).toBe('ready');
  await page.clock.runFor(1000);
  await expect(canvas).toHaveAttribute('data-frame','0');
  await page.clock.runFor(1500);
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return Number(await canvas.getAttribute('data-frame'));
  }).toBeGreaterThan(0);
  for (const frame of [100,40]) {
    await hero.evaluate((element,{frame,last}) => {
      dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
      const stage = element.querySelector('.cloud-hero__stage')!;
      scrollTo(0,(element.clientHeight-stage.clientHeight)*frame/last);
    },{frame,last:manifest.variants.desktop.count-1});
    await expect.poll(async () => {
      await page.clock.runFor(16);
      return canvas.getAttribute('data-frame');
    }).toBe(String(frame));
    await page.clock.runFor(1000);
    await expect(canvas).toHaveAttribute('data-frame',String(frame));
    await page.clock.runFor(1500);
    await expect.poll(async () => {
      await page.clock.runFor(50);
      return Number(await canvas.getAttribute('data-frame'));
    }).toBeGreaterThan(frame);
  }
  const last = manifest.variants.desktop.count - 1;
  await page.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'End' })); scrollTo(0, document.documentElement.scrollHeight); });
  await page.clock.runFor(100);
  await expect(canvas).toHaveAttribute('data-frame', String(last));
  await page.clock.runFor(2500);
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return Number(await canvas.getAttribute('data-frame'));
  }).toBeLessThan(last);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('idle drift stays paused while a touch is held', async ({ page }) => {
  await page.clock.install();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.cloud-hero'), canvas = hero.locator('canvas');
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return hero.getAttribute('data-state');
  }).toBe('ready');
  await page.evaluate(() => dispatchEvent(new Event('touchstart')));
  await page.clock.runFor(4000);
  await expect(canvas).toHaveAttribute('data-frame', '0');
  await page.evaluate(() => dispatchEvent(new Event('touchend')));
  await page.clock.runFor(2500);
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return Number(await canvas.getAttribute('data-frame'));
  }).toBeGreaterThan(0);
});
