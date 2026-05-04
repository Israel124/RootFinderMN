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

test('Bairstow factoriza x^3 + 3x^2 - x - 3 con las raices esperadas', () => {
  const result = PolynomialMethods.bairstowFullRoots([1, 3, -1, -3], -1 / 3, -1, 1e-8, 50);
  assert.equal(result.converged, true);
  const roots = result.roots.map((root) => parseFloat(root)).sort((a, b) => a - b);
  assert.equal(roots.length, 3);
  assert.ok(Math.abs(roots[0] + 3) < 1e-5);
  assert.ok(Math.abs(roots[1] + 1) < 1e-5);
  assert.ok(Math.abs(roots[2] - 1) < 1e-5);
});

test('Bairstow calcula valores iniciales automaticos usables', () => {
  const initial = PolynomialMethods.estimateBairstowInitialValues([1, 3, -1, -3]);
  assert.equal(Number.isFinite(initial.r0), true);
  assert.equal(Number.isFinite(initial.s0), true);

  const result = PolynomialMethods.bairstowFullRoots([1, 3, -1, -3], initial.r0, initial.s0, 1e-8, 50);
  assert.equal(result.converged, true);
  const roots = result.roots.map((root) => parseFloat(root)).sort((a, b) => a - b);
  assert.ok(Math.abs(roots[0] + 3) < 1e-5);
  assert.ok(Math.abs(roots[1] + 1) < 1e-5);
  assert.ok(Math.abs(roots[2] - 1) < 1e-5);
});

test('Horner-Newton aproxima una raiz de x^3 + 3x^2 - x - 3', () => {
  const result = PolynomialMethods.hornerRoot([1, 3, -1, -3], 0.8, 1e-8, 30);
  assert.equal(result.converged, true);
  const root = parseFloat(result.roots[0]);
  assert.ok(Math.abs(root - 1) < 1e-5);
});
