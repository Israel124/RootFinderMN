import test from 'node:test';
import assert from 'node:assert/strict';
import { PolynomialMethods } from '../src/lib/polynomialMethods';

test('Horner encuentra la raiz real de x^2 - 4 correctamente', () => {
  const result = PolynomialMethods.hornerRoot([1, 0, -4], 1, 1e-8, 20);
  assert.equal(result.converged, true);
  assert.ok(result.roots[0] !== undefined);
  assert.ok(Math.abs(parseFloat(result.roots[0]) - 2) < 1e-6);
});

test('Müller converge hacia una raiz real de x^2 - 4', () => {
  const result = PolynomialMethods.mullerRoot([1, 0, -4], 0, 1, 2, 1e-8, 20);
  assert.equal(result.converged, true);
  assert.ok(result.roots[0] !== undefined);
  assert.ok(result.roots[0].startsWith('2') || result.roots[0].startsWith('-2'));
});

test('Bairstow encuentra las raices de x^2 - 4 en pares conjugados reales', () => {
  const result = PolynomialMethods.bairstowFullRoots([1, 0, -4], 1, -1, 1e-8, 20);
  assert.equal(result.converged, true);
  assert.equal(result.roots.length, 2);
  assert.ok(result.roots.some((root) => root.startsWith('2')));
  assert.ok(result.roots.some((root) => root.startsWith('-2')));
});
