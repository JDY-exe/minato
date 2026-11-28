// A streaming transliterator, not a dictionary: callers supply the committed text.
const kana: Record<string, string> = {};
const vowels = ['a', 'i', 'u', 'e', 'o'];
function row(prefix: string, characters: string) {
  [...characters].forEach((character, index) => { kana[prefix + vowels[index]] = character; });
}
row('', 'あいうえお');
for (const [prefix, characters] of Object.entries({
  k: 'かきくけこ', g: 'がぎぐげご', s: 'さしすせそ', z: 'ざじずぜぞ',
  t: 'たちつてと', d: 'だぢづでど', n: 'なにぬねの', h: 'はひふへほ',
  b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ', m: 'まみむめも', r: 'らりるれろ',
})) row(prefix, characters);
Object.assign(kana, {
  ya: 'や', yu: 'ゆ', yo: 'よ', wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を',
  shi: 'し', chi: 'ち', tsu: 'つ', fu: 'ふ', ji: 'じ', 'n\'': 'ん', nn: 'ん',
  '-': 'ー',
});
for (const [prefix, base] of Object.entries({
  ky: 'き', gy: 'ぎ', sy: 'し', sh: 'し', zy: 'じ', jy: 'じ', j: 'じ',
  ty: 'ち', ch: 'ち', cy: 'ち', dy: 'ぢ', ny: 'に', hy: 'ひ', by: 'び',
  py: 'ぴ', my: 'み', ry: 'り',
})) {
  for (const [vowel, small] of Object.entries({ a: 'ゃ', u: 'ゅ', o: 'ょ' })) kana[prefix + vowel] = base + small;
}
for (const prefix of ['x', 'l']) {
  row(prefix, 'ぁぃぅぇぉ');
  Object.assign(kana, {
    [prefix + 'ya']: 'ゃ', [prefix + 'yu']: 'ゅ', [prefix + 'yo']: 'ょ',
    [prefix + 'tu']: 'っ', [prefix + 'tsu']: 'っ', [prefix + 'wa']: 'ゎ',
  });
}
for (const [prefix, base] of Object.entries({ f: 'ふ', v: 'ゔ', ts: 'つ' })) {
  for (const [index, vowel] of vowels.entries()) kana[prefix + vowel] ??= base + [...'ぁぃぅぇぉ'][index];
}
Object.assign(kana, { she: 'しぇ', je: 'じぇ', che: 'ちぇ', thi: 'てぃ', dhu: 'でゅ', dhi: 'でぃ', thu: 'てゅ', vu: 'ゔ' });

/** Preserve an unfinished suffix until another keystroke resolves it. */
export function romajiToKana(input: string, final = false): string {
  let result = '';
  let position = 0;
  while (position < input.length) {
    const rest = input.slice(position).toLowerCase();
    if (/^nn[aiueoy]/.test(rest)) {
      result += 'ん';
      position++;
      continue;
    }
    if (/^([bcdfghjklmpqrstvwxyz])\1/.test(rest) || rest.startsWith('tch')) {
      result += 'っ';
      position++;
      continue;
    }
    // n remains ambiguous before a vowel or y; n' and nn explicitly resolve it.
    if (rest[0] === 'n' && ((rest.length > 1 && !/[aiueoyn']/.test(rest[1])) || (final && rest === 'n'))) {
      result += 'ん';
      position++;
      continue;
    }
    let match = '';
    for (let length = Math.min(4, rest.length); length > 0; length--) {
      if (kana[rest.slice(0, length)]) { match = rest.slice(0, length); break; }
    }
    if (match) {
      result += kana[match];
      position += match.length;
    } else {
      result += input[position];
      position++;
    }
  }
  return result;
}
