import test from 'node:test';
import assert from 'node:assert/strict';
import { detectZeroCrossings, normalizeRange } from '../src/lib/graphUtils';

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
