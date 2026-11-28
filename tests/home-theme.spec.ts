import { expect, test } from '@playwright/test';

test('homepage theme label switches modes, updates its prompt and persists the preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const darkMode = page.getByRole('button', { name: 'Dark mode', exact: true });
  await darkMode.hover();
  const prompt = page.locator('.home-japanese-label[data-section="Theme"]');
  await expect(prompt).toHaveText('ダークモードに切り替えますか');
  await darkMode.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Light mode', exact: true })).toBeVisible();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('.home-section[data-expanded]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('minato-theme'))).toBe('dark');
  await page.reload();
  const lightMode = page.getByRole('button', { name: 'Light mode', exact: true });
  await expect(lightMode).toBeVisible();
  await page.keyboard.press('Tab');
  await lightMode.focus();
  await expect(prompt).toHaveText('ライトモードに切り替えますか');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('minato-theme'))).toBe('light');

});

test('theme prompt uses natural typing and resets when the label closes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.route('**/clouds/video.json', route => route.abort());
  await page.goto('/');
  const mode = page.getByRole('button', { name: 'Dark mode', exact: true });
  const prompt = page.locator('.home-japanese-label[data-section="Theme"]');
  await mode.hover();
  await expect(prompt.locator('.mn-ja-anim-text__composition')).toHaveText(/\S/);
  await expect(prompt).toHaveText('ダークモードに切り替えますか');
  await page.mouse.move(1, 1);
  await expect(prompt).toHaveCount(0);
});
