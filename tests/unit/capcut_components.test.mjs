import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeMotionBlurVector,
  getActiveCaptionState,
} from '../../src/kinematics/capcutEasing.ts';

const root = path.resolve(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

test('computeMotionBlurVector: retorna blur zero em repouso e pico direcional durante transição', () => {
  const idle = computeMotionBlurVector({
    frame: 50,
    transitionStartFrame: 0,
    transitionDurationFrames: 12,
    maxBlurPx: 18,
    direction: 'horizontal',
  });
  assert.equal(idle.stdDeviationX, 0);
  assert.equal(idle.stdDeviationY, 0);
  assert.equal(idle.scale, 1);

  const mid = computeMotionBlurVector({
    frame: 3,
    transitionStartFrame: 0,
    transitionDurationFrames: 12,
    maxBlurPx: 18,
    direction: 'horizontal',
  });
  assert.ok(mid.stdDeviationX > 2, `esperado blur horizontal > 2 no pico, obtido ${mid.stdDeviationX}`);
  assert.equal(mid.stdDeviationY, 0);
  assert.ok(mid.scale > 1.0, 'esperado zoom óptico durante transição');
});

test('getActiveCaptionState: identifica palavra ativa no tempo exato em segundos e calcula progresso', () => {
  const words = [
    { word: 'Kage', start: 0.0, end: 0.5 },
    { word: 'Bunshin', start: 0.5, end: 1.2 },
    { word: 'Jutsu!', start: 1.2, end: 2.0 },
  ];

  const state = getActiveCaptionState(words, 0.85);
  assert.equal(state.activeIndex, 1);
  assert.equal(state.activeWord?.word, 'Bunshin');
  assert.ok(state.wordProgress > 0.4 && state.wordProgress < 0.6);
});

test('CapcutMotionBlur e TikTokStyleCaptions respeitam regra anti-clipping do Chromium (sem -webkit-background-clip)', () => {
  const files = [
    path.join(root, 'src', 'components', 'effects', 'CapcutMotionBlur.tsx'),
    path.join(root, 'src', 'components', 'captions', 'TikTokStyleCaptions.tsx'),
  ];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      !content.includes('-webkit-background-clip'),
      `${path.basename(file)} não pode usar -webkit-background-clip`
    );
  }
});
