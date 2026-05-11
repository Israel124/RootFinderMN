import test from 'node:test';
import assert from 'node:assert/strict';
import { MathEvaluator } from '../src/lib/mathEvaluator';

const STRICT_TOLERANCE = 1e-12;
const STANDARD_TOLERANCE = 1e-10;

function assertApproximately(actual: number, expected: number, tolerance = STANDARD_TOLERANCE) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function assertEvaluationFails(expression: string, scope: Record<string, number> = { x: 1 }) {
  assert.throws(
    () => MathEvaluator.evaluateWithScope(expression, scope),
    /No se pudo evaluar la expresion|La función no está definida en /,
  );
}

test('MathEvaluator normaliza funciones comunes en espanol', () => {
  assert.equal(MathEvaluator.evaluate('sen(x)', Math.PI / 2), 1);
  assert.equal(MathEvaluator.evaluate('seno(x)', Math.PI / 2), 1);
  assert.equal(MathEvaluator.evaluate('coseno(x)', 0), 1);
  assert.equal(MathEvaluator.evaluate('raiz(x)', 4), 2);
  assert.equal(MathEvaluator.evaluate('sqrt(x) + 1/2', 4), 2.5);
  assertApproximately(MathEvaluator.evaluate('ln(x)', Math.E), 1);
});

test('MathEvaluator calcula derivadas y derivadas de orden superior', () => {
  assertApproximately(MathEvaluator.derivative('x^3', 2), 12);
  assertApproximately(MathEvaluator.evaluateNthDerivative('exp(x)', 2, { x: 0 }), 1);
});

test('MathEvaluator rechaza expresiones invalidas', () => {
  assert.equal(MathEvaluator.isValid('sqrt('), false);
});

test('MathEvaluator distingue sintaxis valida de puntos no definidos', () => {
  const expression = '1 / (x - 1) - e^(2x - 1) + sen(3x + 2)';

  assert.equal(MathEvaluator.isValid(expression), true);
  assert.throws(
    () => MathEvaluator.evaluate(expression, 1),
    /La función no está definida en x = 1/,
  );
});

test('MathEvaluator acepta multiplicacion implicita con xy', () => {
  assert.equal(
    MathEvaluator.evaluateWithScope('x^2 + xy - 10', { x: 1.5, y: 3.5 }),
    1.5 ** 2 + 1.5 * 3.5 - 10,
  );
});

test('MathEvaluator evalua funciones trigonometricas requeridas con precision', () => {
  assertApproximately(MathEvaluator.evaluate('sin(x)', Math.PI / 6), 0.5);
  assertApproximately(MathEvaluator.evaluate('cos(x)', Math.PI / 3), 0.5);
  assertApproximately(MathEvaluator.evaluate('tan(x)', Math.PI / 4), 1);
  assertApproximately(MathEvaluator.evaluateWithScope('sin(pi / 2) + cos(0) + tan(pi / 4)', {}), 3);
});

test('MathEvaluator evalua funciones trigonometricas inversas requeridas con precision', () => {
  assertApproximately(MathEvaluator.evaluate('asin(x)', 0.5), Math.PI / 6);
  assertApproximately(MathEvaluator.evaluate('acos(x)', 0.5), Math.PI / 3);
  assertApproximately(MathEvaluator.evaluate('atan(x)', 1), Math.PI / 4);
});

test('MathEvaluator evalua funciones exponenciales y logaritmicas requeridas con precision', () => {
  assertApproximately(MathEvaluator.evaluate('exp(x)', 1), Math.E);
  assertApproximately(MathEvaluator.evaluate('ln(x)', Math.E), 1);
  assertApproximately(MathEvaluator.evaluate('log(x)', Math.E ** 2), 2);
  assertApproximately(MathEvaluator.evaluateWithScope('exp(ln(x))', { x: 7 }), 7);
});

test('MathEvaluator evalua raices y modulo requeridos con precision', () => {
  assertApproximately(MathEvaluator.evaluate('sqrt(x)', 9), 3, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluate('cbrt(x)', 27), 3, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluate('cbrt(x)', -8), -2, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluate('abs(x)', -12.5), 12.5, STRICT_TOLERANCE);
});

test('MathEvaluator evalua constantes, potencias y multiplicacion implicita', () => {
  assertApproximately(MathEvaluator.evaluateWithScope('pi', {}), Math.PI);
  assertApproximately(MathEvaluator.evaluateWithScope('e', {}), Math.E);
  assertApproximately(MathEvaluator.evaluate('x^3', 2), 8, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluate('2x', 4), 8, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluate('3sin(x)', Math.PI / 2), 3, STRICT_TOLERANCE);
  assertApproximately(MathEvaluator.evaluateWithScope('(x + 1)(x - 1)', { x: 5 }), 24, STRICT_TOLERANCE);
});

test('MathEvaluator rechaza resultados no finitos y dominios reales invalidos', () => {
  assertEvaluationFails('1 / 0');
  assertEvaluationFails('sqrt(x)', { x: -1 });
  assertEvaluationFails('ln(x)', { x: 0 });
  assertEvaluationFails('log(x)', { x: -1 });
  assertEvaluationFails('asin(x)', { x: 2 });
  assertEvaluationFails('acos(x)', { x: -2 });
});

test('MathEvaluator mantiene precision numerica en expresiones compuestas', () => {
  const expression = 'sqrt(x^2 + 2x + 1) + exp(ln(5)) - abs(-3)';
  assertApproximately(MathEvaluator.evaluate(expression, 4), 7);

  const nearZero = MathEvaluator.evaluateWithScope('sin(x) / x', { x: 1e-8 });
  assertApproximately(nearZero, 1, 1e-15);
});

test('MathEvaluator usa derivada numérica adaptativa cerca de cero', () => {
  const derivative = MathEvaluator.partialDerivative('x^2', 'x', { x: 1e-9 });
  assertApproximately(derivative, 2e-9, 1e-9);
});
