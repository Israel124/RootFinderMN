import test from 'node:test';
import assert from 'node:assert/strict';
import { NumericalMethods } from '../src/lib/numericalMethods';

test('Biseccion detecta una raiz exacta en el extremo del intervalo', () => {
  const result = NumericalMethods.bisection('x^2 - 4', 2, 5, 1e-6, 50);
  assert.equal(result.converged, true);
  assert.equal(result.root, 2);
  assert.equal(result.iterations.length, 0);
});

test('Regla falsa detecta una raiz exacta en el extremo del intervalo', () => {
  const result = NumericalMethods.falsePosition('x^2 - 4', -5, -2, 1e-6, 50);
  assert.equal(result.converged, true);
  assert.equal(result.root, -2);
  assert.equal(result.iterations.length, 0);
});

test('Newton-Raphson converge para una funcion suave', () => {
  const result = NumericalMethods.newtonRaphson('x^2 - 2', 1, 1e-8, 20);
  assert.equal(result.converged, true);
  assert.ok(result.root !== null);
  assert.ok(Math.abs(result.root! - Math.SQRT2) < 1e-6);
});

test('Newton-Raphson para sistema acepta ecuaciones con equality', () => {
  const result = NumericalMethods.newtonRaphsonSystem2x2('x^2 + y^2 = 4', 'x - y = 1', 1.5, 0.5, 1e-6, 20);
  assert.equal(result.converged, true);
  assert.ok(result.solution !== null);
  assert.ok(Math.abs(result.solution!.x - 1.8228756555) < 1e-6);
  assert.ok(Math.abs(result.solution!.y - 0.8228756555) < 1e-6);
});
