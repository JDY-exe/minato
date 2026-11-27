import { expect, test } from '@playwright/test';

test('bracketed arrow starts at 0.5s and types at the Japanese character pace', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/clouds/manifest.json', route => route.abort());
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.clock.install();
  await page.goto('/');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await expect(page.locator('.home-japanese-label')).toBeAttached();
  const characters = about.locator('.home-section__arrow path');
  await page.clock.runFor(499);
  await expect(characters).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(characters).toHaveCount(1);
  await page.clock.runFor(64);
  await expect(characters).toHaveCount(2);
  await page.clock.runFor(64);
  await expect(characters).toHaveCount(3);
  await about.dispatchEvent('pointerout', { pointerType: 'mouse' });
  await expect(characters).toHaveCount(0);
  await about.dispatchEvent('pointerover', { pointerType: 'mouse' });
  await page.clock.runFor(500);
  await expect(characters).toHaveCount(1);
  await about.dispatchEvent('pointerout', { pointerType: 'mouse' });
  await page.clock.runFor(1000);
  await expect(characters).toHaveCount(0);
});

test('homepage labels type on hover, disappear on leave, and replay on re-entry', async ({ page }) => {
  // Avoid loading the cloud atlases; text playback still uses normal motion.
  await page.route('**/clouds/manifest.json', route => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const label = page.locator('.home-japanese-label');
  await expect(label).toHaveCount(0);
  for (const [english, japanese] of [['About', 'プロフィール'], ['Blog', 'ブログ'], ['Reach out', 'ご連絡']]) {
    await page.getByRole(english === 'Blog' ? 'link' : 'button', { name: english, exact: true }).hover();
    await expect(label).toBeAttached();
    await expect(label).toHaveClass(/mn-text--display/);
    await expect(label).toHaveCSS('pointer-events', 'none');
    await expect(label).toHaveCSS('font-family', /Hina Mincho/);
    await expect(label.locator('.mn-ja-anim-text__composition')).toHaveText(/\S/);
    await expect(label).toHaveText(japanese);
    await expect(label.locator('[aria-hidden]')).toHaveCount(0);
    await page.mouse.move(4, 4);
    await expect(label).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await expect(label.locator('.mn-ja-anim-text__composition')).toHaveText(/\S/);
  await page.mouse.move(4, 4);
  await expect(label).toHaveCount(0);
});

test('keyboard and touch activation share labels and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const label = page.locator('.home-japanese-label');
  await page.keyboard.press('Tab');
  await page.getByRole('link', { name: 'Blog', exact: true }).focus();
  await expect(label).toHaveText('ブログ');
  await page.getByRole('button', { name: 'About', exact: true }).focus();
  await expect(label).toHaveText('プロフィール');
  const bounds = await label.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(label).toHaveCount(0);
  const reach = page.getByRole('button', { name: 'Reach out', exact: true });
  await reach.dispatchEvent('pointerenter', { pointerType: 'touch' });
  await reach.dispatchEvent('click');
  await expect(label).toHaveText('ご連絡');
  await reach.dispatchEvent('click');
  await expect(label).toHaveCount(0);
});
