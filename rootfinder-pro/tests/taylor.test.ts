import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaylorResult } from '../src/lib/taylor';

test('buildTaylorResult aproxima exp(x) alrededor de cero', () => {
  const result = buildTaylorResult('exp(x)', '0', '4', '1');
  assert.equal(result.order, 4);
  assert.ok(Math.abs(result.approximation - 2.7083333333) < 1e-6);
  assert.ok(result.absoluteError < 0.02);
});
