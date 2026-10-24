import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPCUT_BEZIER_PRESETS,
  CAPCUT_EASE,
  CAPCUT_EASE_FRAMES,
  cubicBezier,
} from '../../src/kinematics/capcutEasing.ts';

test('cubicBezier: respeita fronteiras 0 e 1 e linearidade quando P1=P2 diagonal', () => {
  const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
  assert.equal(linear(0), 0);
  assert.equal(linear(1), 1);
  assert.ok(Math.abs(linear(0.5) - 0.5) < 1e-4);
  assert.ok(Math.abs(linear(0.25) - 0.25) < 1e-4);
});

test('CAPCUT_EASE: todas as curvas respeitam t<=0 -> 0 e t>=1 -> 1 sem NaN', () => {
  for (const [name, fn] of Object.entries(CAPCUT_EASE)) {
    assert.equal(fn(0), 0, `${name}(0) deve ser 0`);
    assert.equal(fn(-0.5), 0, `${name}(-0.5) deve ser 0`);
    assert.equal(fn(1), 1, `${name}(1) deve ser 1`);
    assert.equal(fn(1.5), 1, `${name}(1.5) deve ser 1`);

    for (let i = 1; i < 20; i++) {
      const t = i / 20;
      const val = fn(t);
      assert.ok(Number.isFinite(val), `${name}(${t}) deve ser finito`);
    }
  }
});

test('CAPCUT_EASE: flashIn dispara rápido no início e flashOut acelera no corte final', () => {
  // Flash In entrega explosão inicial (> 0.70 em t = 0.30)
  assert.ok(CAPCUT_EASE.flashIn(0.3) > 0.7, `flashIn(0.3) esperado > 0.7, obtido ${CAPCUT_EASE.flashIn(0.3)}`);
  // Flash Out retém no início (< 0.25 em t = 0.50) e explode no fim
  assert.ok(CAPCUT_EASE.flashOut(0.5) < 0.25, `flashOut(0.5) esperado < 0.25, obtido ${CAPCUT_EASE.flashOut(0.5)}`);
});

test('CAPCUT_EASE: tiktokBounce possui overshoot elástico acima de 1.0 antes de pousar', () => {
  let maxVal = 0;
  for (let i = 1; i < 100; i++) {
    const v = CAPCUT_EASE.tiktokBounce(i / 100);
    if (v > maxVal) maxVal = v;
  }
  assert.ok(maxVal > 1.05, `tiktokBounce deve ter overshoot > 1.05 (pico medido: ${maxVal})`);
  assert.equal(CAPCUT_EASE.tiktokBounce(1), 1);
});

test('CAPCUT_BEZIER_PRESETS e CAPCUT_EASE_FRAMES possuem metadados consistentes', () => {
  for (const key of Object.keys(CAPCUT_EASE)) {
    assert.ok(
      typeof CAPCUT_EASE_FRAMES[key] === 'number' && CAPCUT_EASE_FRAMES[key] > 0,
      `CAPCUT_EASE_FRAMES.${key} deve ser inteiro positivo`
    );
  }
  assert.equal(CAPCUT_BEZIER_PRESETS.flashIn.length, 4);
  assert.equal(CAPCUT_BEZIER_PRESETS.heroZoom.length, 4);
});
