import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { romajiToKana } from '../src/minato-design/components/JaAnimText/romaji';

test('streaming romaji covers partials, aliases, small kana and contextual n', () => {
  for (const [input, output] of Object.entries({
    t: 't', to: 'と', tou: 'とう', k: 'k', ky: 'ky', kyo: 'きょ', kyou: 'きょう',
    gakkou: 'がっこう', matcha: 'まっちゃ', maccha: 'まっちゃ',
    shinbun: 'しんぶn', shinya: 'しにゃ', "shin'ya": 'しんや',
    konnichiha: 'こんにちは', nn: 'ん', n: 'n', nnya: 'んにゃ',
    si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ',
    xtsu: 'っ', lya: 'ゃ', fa: 'ふぁ', vu: 'ゔ', she: 'しぇ',
    '!? 東京🙂': '!? 東京🙂', KYou: 'きょう', 'ko-hi-': 'こーひー',
  })) expect(romajiToKana(input), input).toBe(output);
  expect(romajiToKana('shinbun', true)).toBe('しんぶん');
});

async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/tests/fixtures/ja-anim-text.html');
  await expect(page.locator('.mn-ja-anim-text')).toBeAttached();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  // Reset after loading so the clock starts at a known point.
  await update(page, { playing: false });
  await update(page, { playing: true });
}
async function update(page: Page, props: Record<string, unknown>) {
  await page.evaluate(props => (window as any).updateJaAnimText(props), props);
}
async function visibleText(page: Page) {
  return page.locator('.mn-ja-anim-text').evaluate(element =>
    (element.querySelector('[aria-hidden]') ?? element).textContent);
}

test('exact frames, commit pauses, underline, semantics and final clean string', async ({ page }) => {
  await setup(page);
  await update(page, { as: 'h2', variant: 'title' });
  const text = page.locator('h2.mn-ja-anim-text');
  await expect(text).toHaveClass(/mn-text--title/);
  await expect(text).toHaveAttribute('lang', 'ja');
  await expect(text).toMatchAriaSnapshot('- heading "東京" [level=2]');
  expect(await visibleText(page)).toBe('');
  for (const [delay, expected] of [[200, 't'], [100, 'と'], [100, 'とう'], [200, '東'], [200, '東k'], [100, '東ky'], [100, '東きょ'], [100, '東きょう']] as const) {
    await page.clock.runFor(delay);
    expect(await visibleText(page)).toBe(expected);
  }
  await expect(text.locator('.mn-ja-anim-text__composition')).toHaveCSS('text-decoration-line', 'underline');
  await page.clock.runFor(199);
  expect(await visibleText(page)).toBe('東きょう');
  await page.clock.runFor(1);
  await expect(text).toHaveText('東京');
  expect(await text.innerHTML()).toBe('東京');
  await page.clock.runFor(10000);
  expect(await text.innerHTML()).toBe('東京');
});

test('reset cancels timers, start replays, and equal segments do not restart', async ({ page }) => {
  await setup(page);
  await page.clock.runFor(300);
  expect(await visibleText(page)).toBe('と');
  await update(page, { segments: [{ text: '東', typing: 'tou' }, { text: '京', typing: 'kyou' }] });
  await page.clock.runFor(100);
  expect(await visibleText(page)).toBe('とう');
  await update(page, { playing: false });
  await page.clock.runFor(5000);
  expect(await visibleText(page)).toBe('');
  await update(page, { playing: true });
  await page.clock.runFor(200);
  expect(await visibleText(page)).toBe('t');
  await update(page, { segments: [{ text: '港', typing: 'minato' }] });
  expect(await visibleText(page)).toBe('');
  await page.clock.runFor(200);
  expect(await visibleText(page)).toBe('m');
  await update(page, { timings: { startDelay: 0, keystroke: 50, jitter: 0 } });
  expect(await visibleText(page)).toBe('');
  await page.clock.runFor(1000);
  expect(await visibleText(page)).toBe('港');
});

test('empty and literal input, unsupported characters, zero and invalid timings', async ({ page }) => {
  await setup(page);
  await update(page, {
    segments: [{ text: '東京', typing: 'toukyou' }, { text: ' 🙂!', typing: '' }, { text: '?', typing: '?' }],
    timings: { startDelay: -1, keystroke: 0, jitter: 0, conversionDelay: 0, segmentDelay: 0 }, underline: false,
  });
  await page.clock.runFor(100);
  expect(await page.locator('.mn-ja-anim-text').innerHTML()).toBe('東京 🙂!?');
  await update(page, { segments: [] });
  expect(await page.locator('.mn-ja-anim-text').innerHTML()).toBe('');
  await update(page, { segments: [{ text: 'あ', typing: 'a' }], timings: { startDelay: null, keystroke: null, jitter: 0 } });
  await page.clock.runFor(344);
  expect(await visibleText(page)).toBe('');
  await page.clock.runFor(1);
  expect(await visibleText(page)).toBe('あ');
  await expect(page.locator('.mn-ja-anim-text [aria-hidden] span')).toHaveCSS('text-decoration-line', 'none');
});

test('reduced motion finishes immediately, reset stays empty, unmount cancels work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await setup(page);
  await page.clock.runFor(200);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.mn-ja-anim-text')).toHaveText('東京');
  expect(await page.locator('.mn-ja-anim-text').innerHTML()).toBe('東京');
  await update(page, { playing: false });
  expect(await visibleText(page)).toBe('');
  await update(page, { playing: true });
  expect(await visibleText(page)).toBe('東京');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => (window as any).unmountJaAnimText());
  await page.clock.runFor(5000);
  expect(errors).toEqual([]);
  await expect(page.locator('#root')).toBeEmpty();
});
