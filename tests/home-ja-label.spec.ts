import { expect, test } from '@playwright/test';

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
  await page.keyboard.press('Escape');
  await expect(label).toHaveCount(0);
  const reach = page.getByRole('button', { name: 'Reach out', exact: true });
  await reach.dispatchEvent('pointerenter', { pointerType: 'touch' });
  await reach.dispatchEvent('click');
  await expect(label).toHaveText('ご連絡');
  await reach.dispatchEvent('click');
  await expect(label).toHaveCount(0);
});

test('keyboard focus overrides a hovered section and Escape closes it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const label = page.locator('.home-japanese-label');
  await page.getByRole('button', { name: 'About', exact: true }).hover();
  await expect(label).toHaveText('プロフィール');
  await page.keyboard.press('Tab');
  const blog = page.getByRole('link', { name: 'Blog', exact: true });
  await blog.focus();
  await expect(blog).toBeFocused();
  await expect(label).toHaveText('ブログ');
  await page.keyboard.press('Escape');
  await expect(label).toHaveCount(0);
});
