import test from 'node:test';
import assert from 'node:assert/strict';
import { MathEvaluator } from '../src/lib/mathEvaluator';

test('MathEvaluator normaliza funciones comunes en espanol', () => {
  assert.equal(MathEvaluator.evaluate('sen(x)', Math.PI / 2), 1);
  assert.equal(MathEvaluator.evaluate('seno(x)', Math.PI / 2), 1);
  assert.equal(MathEvaluator.evaluate('coseno(x)', 0), 1);
  assert.equal(MathEvaluator.evaluate('raiz(x)', 4), 2);
  assert.equal(MathEvaluator.evaluate('sqrt(x) + 1/2', 4), 2.5);
  assert.ok(Math.abs(MathEvaluator.evaluate('ln(x)', Math.E) - 1) < 1e-10);
});

test('MathEvaluator calcula derivadas y derivadas de orden superior', () => {
  assert.ok(Math.abs(MathEvaluator.derivative('x^3', 2) - 12) < 1e-10);
  assert.ok(Math.abs(MathEvaluator.evaluateNthDerivative('exp(x)', 2, { x: 0 }) - 1) < 1e-10);
});

test('MathEvaluator rechaza expresiones invalidas', () => {
  assert.equal(MathEvaluator.isValid('sqrt('), false);
});

test('MathEvaluator acepta multiplicación implícita con xy', () => {
  assert.equal(MathEvaluator.evaluateWithScope('x^2 + xy - 10', { x: 1.5, y: 3.5 }), 1.5 ** 2 + 1.5 * 3.5 - 10);
});
