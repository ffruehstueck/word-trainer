const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
}
const { selectReviewWords, wordKey, readReviewHistory, REVIEW_HISTORY_KEY } = load('lib/examReview.ts');
const { loadOlderWords } = load('lib/data.ts');
const word = id => ({ id, source: `word ${id}`, target: `Wort ${id}`, sourceLanguage: 'English', targetLanguage: 'German' });

test('adds eight unique review cards, excluding current-unit cards and duplicate entries', () => {
  const pool = Array.from({ length: 15 }, (_, i) => word(i));
  const selected = selectReviewWords([...pool, ...pool], [word(0)], {});
  assert.equal(selected.length, 8);
  assert.equal(new Set(selected.map(wordKey)).size, 8);
  assert(!selected.some(w => w.source === 'word 0'));
});
test('prioritizes past mistakes; correct answers reduce priority', () => {
  const pool = Array.from({ length: 20 }, (_, i) => word(i));
  const history = { [wordKey(word(19))]: { incorrect: 3, correct: 0 }, [wordKey(word(18))]: { incorrect: 3, correct: 10 } };
  assert.deepEqual(selectReviewWords(pool, [], history).slice(0, 2).map(w => w.id), [19, 18]);
});
test('uses every available card when fewer than eight exist', () => {
  assert.equal(selectReviewWords([word(1)], [], {}).length, 1);
  assert.deepEqual(selectReviewWords([], [], {}), []);
});
test('uses saved exam mistakes and ignores training progress or invalid JSON', () => {
  const entries = new Map([
    ['word-trainer-progress-old-exam', JSON.stringify({ allProgress: [[1, { word: word(1), attempts: 4, isCorrect: true }]] })],
    ['word-trainer-progress-old-training', JSON.stringify({ allProgress: [[2, { word: word(2), attempts: 9, isCorrect: false }]] })],
    ['word-trainer-progress-bad-exam', '{'],
    [REVIEW_HISTORY_KEY, '{}'],
  ]);
  const storage = { length: entries.size, key: i => [...entries.keys()][i], getItem: key => entries.get(key) };
  const history = readReviewHistory(storage);
  assert.deepEqual(history[wordKey(word(1))], { correct: 1, incorrect: 3 });
  assert.equal(history[wordKey(word(2))], undefined);
});
test('older pool respects class and unit boundaries, excluding extras of the same unit', async () => {
  assert((await loadOlderWords('class-3-unit-1.json')).length > 8);
  assert.deepEqual(await loadOlderWords('unit-5.json'), []);
  assert.deepEqual(await loadOlderWords('all'), []);
  assert.deepEqual(await loadOlderWords('irregular-verbs.json'), []);
  const expected = [10,9,8,7,6,5].flatMap(unit => JSON.parse(fs.readFileSync(`public/data/unit-${unit}.json`)));
  assert.deepEqual(await loadOlderWords('unit-11.json'), expected);
});
