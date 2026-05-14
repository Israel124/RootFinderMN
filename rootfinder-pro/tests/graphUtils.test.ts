import test from 'node:test';
import assert from 'node:assert/strict';
import { detectZeroCrossings, estimateFunctionViewport, normalizeRange } from '../src/lib/graphUtils';

test('detectZeroCrossings interpola y elimina duplicados cercanos', () => {
  const crossings = detectZeroCrossings([
    { x: -1, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: -1 },
    { x: 2, y: 1 },
  ]);

  assert.equal(crossings.length, 2);
  assert.ok(Math.abs(crossings[0]) < 1e-9);
});

test('normalizeRange recupera un rango valido cuando la entrada es invalida', () => {
  const fallback = { xmin: -10, xmax: 10, ymin: -5, ymax: 5 };
  assert.deepEqual(
    normalizeRange({ xmin: 4, xmax: 4, ymin: Number.NaN, ymax: 8 }, fallback),
    fallback
  );
});

test('estimateFunctionViewport ajusta el eje y para funciones que no caben en [-10,10]', () => {
  const viewport = estimateFunctionViewport('x^2 - 100', {
    fallback: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
  });

  assert.equal(viewport.xmin, -10);
  assert.equal(viewport.xmax, 10);
  assert.ok(viewport.ymax > 10);
  assert.ok(viewport.ymin <= -100);
});

test('estimateFunctionViewport expande el eje x cuando la raíz queda fuera del rango base', () => {
  const viewport = estimateFunctionViewport('x - 25', {
    root: 25,
    fallback: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
  });

  assert.ok(viewport.xmax >= 25);
  assert.ok(viewport.xmin < viewport.xmax);
  assert.ok(viewport.ymin < 0);
  assert.ok(viewport.ymax > 0);
});
