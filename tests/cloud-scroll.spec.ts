import { expect, test } from '@playwright/test';

test('clouds hold still until scrolling, then hold the new frame', async ({ page }) => {
  await page.clock.install();
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const hero = page.locator('.cloud-hero'), canvas = hero.locator('canvas');
  await expect.poll(async () => {
    await page.clock.runFor(50);
    return hero.getAttribute('data-state');
  }).toBe('ready');
  await page.clock.runFor(30000);
  await expect(canvas).toHaveAttribute('data-frame','0');
  for (const frame of [100,40]) {
    await hero.evaluate((element,frame) => {
      const stage = element.querySelector('.cloud-hero__stage')!;
      scrollTo(0,(element.clientHeight-stage.clientHeight)*frame/239);
    },frame);
    await expect.poll(async () => {
      await page.clock.runFor(16);
      return canvas.getAttribute('data-frame');
    }).toBe(String(frame));
    await page.clock.runFor(60000);
    await expect(canvas).toHaveAttribute('data-frame',String(frame));
  }
});
