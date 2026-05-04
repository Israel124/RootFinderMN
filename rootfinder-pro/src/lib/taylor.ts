import { MathEvaluator } from './mathEvaluator';

export type TaylorTerm = {
  order: number;
  derivativeExpression: string;
  derivativeValue: number;
  factorial: number;
  coefficient: number;
  termExpression: string;
};

export type TaylorResult = {
  terms: TaylorTerm[];
  polynomial: string;
  approximation: number;
  exactValue: number;
  absoluteError: number;
  relativeError: number;
  center: number;
  order: number;
  evaluateAt: number;
};

function factorial(n: number) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) {
    result *= i;
  }
  return result;
}

function formatNumber(value: number) {
  return Number(value.toFixed(10)).toString();
}

export function buildTaylorResult(fx: string, center: string, order: string, evaluateAt: string): TaylorResult {
  const a = Number.parseFloat(center);
  const n = Number.parseInt(order, 10);
  const x = Number.parseFloat(evaluateAt);

  if (!fx.trim()) throw new Error('Debes ingresar una funcion');
  if (!MathEvaluator.isValid(fx)) throw new Error('La funcion ingresada no es valida');
  if (Number.isNaN(a)) throw new Error('El centro a debe ser numerico');
  if (Number.isNaN(n) || n < 0) throw new Error('El orden debe ser un entero no negativo');
  if (Number.isNaN(x)) throw new Error('El punto de evaluacion debe ser numerico');

  const terms: TaylorTerm[] = [];
  const polynomialTerms: string[] = [];
  let approximation = 0;

  for (let k = 0; k <= n; k += 1) {
    const derivativeExpression = MathEvaluator.getNthDerivativeExpression(fx, k);
    let derivativeValue: number;
    try {
      derivativeValue = MathEvaluator.evaluateNthDerivative(fx, k, { x: a });
    } catch {
      throw new Error(`La derivada de orden ${k} no existe o no es finita en a = ${formatNumber(a)}.`);
    }

    if (!Number.isFinite(derivativeValue)) {
      throw new Error(`La derivada de orden ${k} no existe o no es finita en a = ${formatNumber(a)}.`);
    }
    const fact = factorial(k);
    const coefficient = derivativeValue / fact;
    const centeredTerm = k === 0 ? '1' : k === 1 ? `(x - ${formatNumber(a)})` : `(x - ${formatNumber(a)})^${k}`;
    const termExpression = k === 0 ? formatNumber(derivativeValue) : `${formatNumber(coefficient)} * ${centeredTerm}`;

    terms.push({
      order: k,
      derivativeExpression,
      derivativeValue,
      factorial: fact,
      coefficient,
      termExpression,
    });

    polynomialTerms.push(termExpression);
    approximation += coefficient * Math.pow(x - a, k);
  }

  const exactValue = MathEvaluator.evaluate(fx, x);
  const absoluteError = Math.abs(exactValue - approximation);
  const relativeError = exactValue !== 0 ? (absoluteError / Math.abs(exactValue)) * 100 : 0;

  return {
    terms,
    polynomial: polynomialTerms.join(' + '),
    approximation,
    exactValue,
    absoluteError,
    relativeError,
    center: a,
    order: n,
    evaluateAt: x,
  };
}
