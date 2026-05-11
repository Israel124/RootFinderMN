import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaylorResult, factorial, MAX_TAYLOR_ORDER } from '../src/lib/taylor';

test('buildTaylorResult aproxima exp(x) alrededor de cero', () => {
  const result = buildTaylorResult('exp(x)', '0', '4', '1');
  assert.equal(result.order, 4);
  assert.ok(Math.abs(result.approximation - 2.7083333333) < 1e-6);
  assert.ok(result.absoluteError < 0.02);
});

test('buildTaylorResult informa derivadas no finitas sin desbordar la pila', () => {
  assert.throws(
    () => buildTaylorResult('sqrt(x)', '0', '4', '1'),
    /derivada de orden 1 no existe o no es finita/i,
  );
});

test('buildTaylorResult limita el orden máximo permitido', () => {
  assert.throws(
    () => buildTaylorResult('exp(x)', '0', String(MAX_TAYLOR_ORDER + 1), '1'),
    /orden maximo permitido/i,
  );
});

test('factorial memoizado rechaza órdenes fuera del rango seguro', () => {
  assert.equal(factorial(20), 2432902008176640000);
  assert.throws(() => factorial(21), /Orden debe ser entero entre 0 y 20/);
});
