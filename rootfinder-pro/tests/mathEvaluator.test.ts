import test from 'node:test';
import assert from 'node:assert/strict';
import { MathEvaluator } from '../src/lib/mathEvaluator';

test('MathEvaluator normaliza funciones comunes en espanol', () => {
  assert.equal(MathEvaluator.evaluate('sen(x)', Math.PI / 2), 1);
  assert.ok(Math.abs(MathEvaluator.evaluate('ln(x)', Math.E) - 1) < 1e-10);
});

test('MathEvaluator calcula derivadas y derivadas de orden superior', () => {
  assert.ok(Math.abs(MathEvaluator.derivative('x^3', 2) - 12) < 1e-10);
  assert.ok(Math.abs(MathEvaluator.evaluateNthDerivative('exp(x)', 2, { x: 0 }) - 1) < 1e-10);
});

test('MathEvaluator rechaza expresiones invalidas', () => {
  assert.equal(MathEvaluator.isValid('sqrt('), false);
});
