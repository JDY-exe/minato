import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function textRaster(page: Page) {
  return page.locator('.home-japanese-label').evaluate(async text => {
    const url = (text as HTMLElement).style.backgroundImage.slice(5, -2);
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) colors.add(Array.from(pixels.slice(i, i + 4)).join(','));
    const style = getComputedStyle(text);
    const rect = text.getBoundingClientRect();
    return { colors: [...colors].sort(), width: canvas.width, height: canvas.height,
      size: style.backgroundSize, position: style.backgroundPosition,
      x: rect.x, y: rect.y, url, clip: style.backgroundClip };
  });
}

test('poster text uses its own tidal palette, follows theme and cover positioning', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await page.getByRole('button', { name: 'About', exact: true }).click();
  const label = page.locator('.home-japanese-label');
  await expect(label).toHaveAttribute('data-palette-ready', '');
  const light = await textRaster(page);
  expect(light.colors).toEqual(['0,101,109,255', '0,79,87,255']);
  expect(light.clip).toBe('text');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await textRaster(page)).colors).toEqual(['182,242,244,255', '83,220,228,255']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await textRaster(page)).size).not.toBe(light.size);
  const mobile = await textRaster(page);
  const scale = Math.max(390 / mobile.width, 844 / mobile.height);
  const [x, y] = mobile.position.split(' ').map(parseFloat);
  expect(x).toBeCloseTo((390 - mobile.width * scale) / 2 - mobile.x, 1);
  expect(y).toBeCloseTo((844 - mobile.height * scale) / 2 - mobile.y, 1);
  const colors = await page.locator('.home-palette-background').first().evaluate(canvas => {
    const data = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height).data;
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) colors.add(Array.from(data.slice(i, i + 4)).join(','));
    return [...colors].sort();
  });
  expect(colors).toEqual(['37,50,55,255', '92,107,115,255']);
});

test('live mask keeps native pixels and viewport alignment as glyphs type', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.route('**/clouds/manifest.json', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state', 'static');
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await expect(page.locator('.cloud-hero')).toHaveAttribute('data-exposure-scale', '0.8');
  await expect(page.locator('.home-japanese-label')).toHaveAttribute('data-palette-ready', '');
  // Dispatch the same synchronous frame event as CloudHero with a known binary mask.
  await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillRect(0, 0, 2, 2);
    dispatchEvent(new CustomEvent('cloud-frame', { detail: canvas }));
  });
  await expect.poll(async () => (await textRaster(page)).width).toBe(4);
  const first = await textRaster(page);
  expect(first.width).toBe(4); expect(first.height).toBe(2);
  expect(first.colors).toEqual(['0,101,109,255', '0,79,87,255']);
  await expect(page.locator('.home-japanese-label')).toHaveText('プロフィール');
  await expect.poll(async () => {
    const raster = await textRaster(page);
    return Math.abs(parseFloat(raster.position) + raster.x);
  }).toBeLessThan(0.1);
  const final = await textRaster(page);
  expect(final.url).toBe(first.url);
  expect(final.size).toBe('1440px 900px');
  const [x, y] = final.position.split(' ').map(parseFloat);
  expect(x).toBeCloseTo(-final.x, 1); expect(y).toBeCloseTo(-final.y, 1);
});

test('frame bursts retain the visible text image until replacements finish decoding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await expect(page.locator('.home-japanese-label')).toHaveAttribute('data-palette-ready', '');
  const initial = await textRaster(page);
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    const releases: (() => void)[] = [];
    Object.assign(window, {
      pendingTextDecodes: () => releases.length,
      releaseTextDecode: () => releases.shift()?.(),
      restoreTextDecode: () => { HTMLImageElement.prototype.decode = decode; },
    });
    HTMLImageElement.prototype.decode = function () {
      return decode.call(this).then(() => new Promise<void>(resolve => releases.push(resolve)));
    };
    for (const width of [4, 5, 6]) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 2;
      canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
      dispatchEvent(new CustomEvent('cloud-frame', { detail: canvas }));
    }
  });
  const pending = () => page.evaluate(() => (window as unknown as { pendingTextDecodes(): number }).pendingTextDecodes());
  const release = () => page.evaluate(() => (window as unknown as { releaseTextDecode(): void }).releaseTextDecode());
  // Read the CSS directly: the decode instrumentation intentionally blocks new Images.
  const background = () => page.locator('.home-japanese-label').evaluate(text => (text as HTMLElement).style.backgroundImage);
  await expect.poll(pending).toBe(1);
  expect(await background()).toContain(initial.url);
  await expect(page.locator('.home-japanese-label')).toHaveText('プロフィール');
  await release();
  await expect.poll(background).not.toContain(initial.url);
  await expect.poll(pending).toBe(1);
  await release();
  // Restore decode before inspecting the actual background pixels.
  await page.evaluate(() => (window as unknown as { restoreTextDecode(): void }).restoreTextDecode());
  await expect.poll(async () => (await textRaster(page)).width).toBe(6);
});
