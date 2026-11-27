import { expect, test } from '@playwright/test';

test('exposure eases at a bounded rate, reverses from its current value and stops at rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.clock.install();
  await page.addInitScript(() => {
    Object.assign(window, { exposureUpdates: [] });
    addEventListener('cloud-frame', () => {
      (window as unknown as { exposureUpdates: { time: number; scale: number }[] }).exposureUpdates.push({
        time: performance.now(), scale: Number(document.querySelector<HTMLElement>('.cloud-hero')!.dataset.exposureScale),
      });
    });
  });
  await page.goto('/');
  const hero = page.locator('.cloud-hero');
  await expect(hero).toHaveAttribute('data-state', 'ready');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(() => { (window as unknown as { exposureUpdates: unknown[] }).exposureUpdates = []; });
  const updates = () => page.evaluate(() => (window as unknown as { exposureUpdates: { time: number; scale: number }[] }).exposureUpdates);
  const scale = async () => Number(await hero.getAttribute('data-exposure-scale'));
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await page.clock.runFor(100);
  expect(await scale()).toBeGreaterThan(0.8);
  expect(await scale()).toBeLessThan(1);
  await page.clock.runFor(300);
  expect(await scale()).toBe(0.8);
  const down = await updates();
  expect(down.length).toBeGreaterThan(2);
  expect(down.length).toBeLessThanOrEqual(11);
  for (let i = 1; i < down.length; i++) {
    expect(down[i].scale).toBeLessThanOrEqual(down[i - 1].scale);
    expect(down[i].time - down[i - 1].time).toBeGreaterThanOrEqual(30);
  }
  await page.clock.runFor(1000);
  expect((await updates()).length).toBe(down.length);
  await about.dispatchEvent('pointerout', { pointerType: 'mouse' });
  await page.clock.runFor(100);
  const reversing = await scale();
  expect(reversing).toBeGreaterThan(0.8); expect(reversing).toBeLessThan(1);
  await about.dispatchEvent('pointerover', { pointerType: 'mouse' });
  expect(await scale()).toBe(reversing);
  await page.clock.runFor(400);
  expect(await scale()).toBe(0.8);
  await about.dispatchEvent('pointerout', { pointerType: 'mouse' });
  await page.clock.runFor(400);
  expect(await scale()).toBe(1);
});

test('active sections lower exposure at the held frame and restore it without downloads', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', request => { if (/\/clouds\/(manifest|desktop-|mobile-)/.test(request.url())) assets.push(request.url()); });
  await page.addInitScript(() => {
    const scratch = document.createElement('canvas');
    const context = scratch.getContext('2d', { willReadFrequently: true })!;
    Object.assign(window, { hoverFrames: [] });
    window.addEventListener('cloud-frame', event => {
      const canvas = (event as CustomEvent<HTMLCanvasElement>).detail;
      scratch.width = canvas.width; scratch.height = canvas.height;
      context.drawImage(canvas, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let coverage = 0, hash = 0;
      let ink: number[] = [];
      for (let i = 3; i < pixels.length; i += 4) {
        coverage += pixels[i] / 255; hash = (Math.imul(hash, 31) + pixels[i]) | 0;
        if (pixels[i] && !ink.length) ink = Array.from(pixels.slice(i - 3, i));
      }
      (window as unknown as { hoverFrames: unknown[] }).hoverFrames.push({
        coverage, hash, ink, scale: document.querySelector<HTMLElement>('.cloud-hero')!.dataset.exposureScale,
      });
    });
  });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('.cloud-hero')).toHaveAttribute('data-state', 'ready');
    const frame = await page.locator('.cloud-hero canvas').getAttribute('data-frame');
    const latest = () => page.evaluate(() => (window as unknown as { hoverFrames: { coverage: number; hash: number; ink: number[]; scale: string }[] }).hoverFrames.at(-1)!);
    const baseline = await latest();
    const initialAssets = [...assets];
    const blog = page.getByRole('link', { name: 'Blog', exact: true });
    await blog.hover();
    await expect.poll(async () => (await latest()).scale).toBe('0.8');
    const dimmed = await latest();
    expect(dimmed.hash).not.toBe(baseline.hash);
    if (theme === 'light') expect(dimmed.coverage).toBeGreaterThan(baseline.coverage);
    else expect(dimmed.coverage).toBeLessThan(baseline.coverage);
    if (theme === 'dark') {
      dimmed.ink.forEach((channel, index) => expect(Math.abs(channel - baseline.ink[index] * 0.8)).toBeLessThanOrEqual(1));
    } else expect(dimmed.ink).toEqual(baseline.ink);
    await expect(page.locator('.cloud-hero canvas')).toHaveAttribute('data-frame', frame!);
    const underline = () => blog.locator('.home-section__label').evaluate(text => getComputedStyle(text, '::after').transform);
    await expect.poll(underline).toBe('matrix(1, 0, 0, 1, 0, 0)');
    await page.mouse.move(1, 1);
    await expect.poll(async () => (await latest()).scale).toBe('1');
    expect((await latest()).hash).toBe(baseline.hash);
    expect((await latest()).ink).toEqual(baseline.ink);
    await expect.poll(underline).toBe('matrix(0, 0, 0, 1, 0, 0)');
    expect(assets).toEqual(initialAssets);
  }
});

test('reduced motion dims only poster ink and shows a static underline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hero = page.locator('.cloud-hero'), poster = page.locator('.cloud-hero__poster');
  await expect(hero).toHaveAttribute('data-state', 'static');
  const sky = await hero.evaluate(element => getComputedStyle(element).backgroundColor);
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.dispatchEvent('click');
  await expect(poster).toHaveCSS('filter', 'brightness(0.8)');
  expect(await hero.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(sky);
  const duration = await about.locator('.home-section__label').evaluate(text => parseFloat(getComputedStyle(text, '::after').transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.00001);
  await about.dispatchEvent('click');
  await expect(poster).toHaveCSS('filter', 'brightness(1)');
});
