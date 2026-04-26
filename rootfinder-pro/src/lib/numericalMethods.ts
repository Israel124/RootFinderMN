import { MathEvaluator } from './mathEvaluator';
import {
  IterationData,
  CalculationResult,
  MethodType,
  FixedPointCandidate,
  SystemCalculationResult,
  SystemIterationData,
} from '../types';

export class NumericalMethods {
  private static readonly FIXED_POINT_TOLERANCE = 0.98;

  private static calculateError(current: number, previous: number | null): { ea: number; er: number } {
    if (previous === null) return { ea: 0, er: 0 };
    const ea = Math.abs(current - previous);
    const er = current !== 0 ? (ea / Math.abs(current)) * 100 : 0;
    return { ea, er };
  }

  private static formatLambda(lambda: number): string {
    return Number(lambda.toFixed(12)).toString();
  }

  private static buildFixedPointExpression(f: string, lambda: number): string {
    const lambdaText = this.formatLambda(lambda);
    if (lambda >= 0) {
      return `x + (${lambdaText}) * (${f})`;
    }
    return `x - (${this.formatLambda(Math.abs(lambda))}) * (${f})`;
  }

  static generateFixedPointCandidates(
    f: string,
    referencePoint: number,
    interval?: { a?: number; b?: number }
  ): FixedPointCandidate[] {
    const candidates: FixedPointCandidate[] = [];
    const seen = new Set<string>();
    const derivativeAtReference = MathEvaluator.derivative(f, referencePoint);

    const baseLambdas: number[] = [];

    if (Math.abs(derivativeAtReference) > 1e-8) {
      const optimalLambda = -1 / derivativeAtReference;
      baseLambdas.push(
        optimalLambda,
        optimalLambda * 0.5,
        optimalLambda * 1.5,
        optimalLambda * 0.25,
        optimalLambda * 0.75,
      );
    }

    baseLambdas.push(-1, -0.5, -0.25, -0.1, 0.1, 0.25, 0.5, 1);

    for (const rawLambda of baseLambdas) {
      if (!Number.isFinite(rawLambda) || Math.abs(rawLambda) < 1e-12) continue;

      const lambda = Number(rawLambda.toFixed(12));
      const expression = this.buildFixedPointExpression(f, lambda);
      if (seen.has(expression)) continue;
      seen.add(expression);

      try {
        const derivativeValue = Math.abs(MathEvaluator.derivative(expression, referencePoint));
        const convergent = derivativeValue < this.FIXED_POINT_TOLERANCE;
        const reason = convergent
          ? `|g'(x)| = ${derivativeValue.toFixed(6)} < 1`
          : `|g'(x)| = ${derivativeValue.toFixed(6)} >= 1`;

        if (interval?.a !== undefined && interval?.b !== undefined) {
          const mid = (interval.a + interval.b) / 2;
          MathEvaluator.evaluate(expression, interval.a);
          MathEvaluator.evaluate(expression, interval.b);
          MathEvaluator.evaluate(expression, mid);
        } else {
          MathEvaluator.evaluate(expression, referencePoint);
        }

        candidates.push({
          expression,
          lambda,
          derivativeAtPoint: derivativeValue,
          convergent,
          reason,
        });
      } catch {
        candidates.push({
          expression,
          lambda,
          derivativeAtPoint: null,
          convergent: false,
          reason: 'No se pudo evaluar de forma estable',
        });
      }
    }

    return candidates.sort((left, right) => {
      if (left.convergent !== right.convergent) {
        return left.convergent ? -1 : 1;
      }

      const leftScore = left.derivativeAtPoint ?? Number.POSITIVE_INFINITY;
      const rightScore = right.derivativeAtPoint ?? Number.POSITIVE_INFINITY;
      return leftScore - rightScore;
    });
  }

  static selectFixedPointTransformation(
    f: string,
    referencePoint: number,
    interval?: { a?: number; b?: number }
  ): { selected: FixedPointCandidate | null; candidates: FixedPointCandidate[] } {
    const candidates = this.generateFixedPointCandidates(f, referencePoint, interval);
    const selected = candidates.find((candidate) => candidate.convergent) ?? null;
    return { selected, candidates };
  }

  static bisection(
    f: string,
    a: number,
    b: number,
    tol: number,
    maxIter: number
  ): CalculationResult {
    const iterations: IterationData[] = [];
    const params = { a, b, tol, maxIter };
    let fa = MathEvaluator.evaluate(f, a);
    let fb = MathEvaluator.evaluate(f, b);

    if (fa * fb >= 0) {
      return this.errorResult('bisection', f, 'No hay cambio de signo en el intervalo [a, b]', params);
    }

    let xr = a;
    let xrOld: number | null = null;
    let converged = false;

    for (let i = 1; i <= maxIter; i++) {
      xrOld = xr;
      xr = (a + b) / 2;
      const fxr = MathEvaluator.evaluate(f, xr);
      const { ea, er } = this.calculateError(xr, i === 1 ? null : xrOld);

      iterations.push({
        iteration: i,
        a,
        b,
        xr,
        fa,
        fb,
        fxr,
        ea,
        er: er.toFixed(6) + '%'
      });

      if (Math.abs(fxr) < 1e-15 || (i > 1 && ea < tol)) {
        converged = true;
        break;
      }

      if (fa * fxr < 0) {
        b = xr;
        fb = fxr;
      } else {
        a = xr;
        fa = fxr;
      }
    }

    return this.successResult('bisection', f, xr, iterations, converged, params);
  }

  static falsePosition(
    f: string,
    a: number,
    b: number,
    tol: number,
    maxIter: number
  ): CalculationResult {
    const iterations: IterationData[] = [];
    const params = { a, b, tol, maxIter };
    let fa = MathEvaluator.evaluate(f, a);
    let fb = MathEvaluator.evaluate(f, b);

    if (fa * fb >= 0) {
      return this.errorResult('false-position', f, 'No hay cambio de signo en el intervalo [a, b]', params);
    }

    let xr = a;
    let xrOld: number | null = null;
    let converged = false;

    for (let i = 1; i <= maxIter; i++) {
      xrOld = xr;
      xr = b - (fb * (a - b)) / (fa - fb);
      const fxr = MathEvaluator.evaluate(f, xr);
      const { ea, er } = this.calculateError(xr, i === 1 ? null : xrOld);

      iterations.push({
        iteration: i,
        a,
        b,
        xr,
        fa,
        fb,
        fxr,
        ea,
        er: er.toFixed(6) + '%'
      });

      if (Math.abs(fxr) < 1e-15 || (i > 1 && ea < tol)) {
        converged = true;
        break;
      }

      if (fa * fxr < 0) {
        b = xr;
        fb = fxr;
      } else {
        a = xr;
        fa = fxr;
      }
    }

    return this.successResult('false-position', f, xr, iterations, converged, params);
  }

  static newtonRaphson(
    f: string,
    x0: number,
    tol: number,
    maxIter: number
  ): CalculationResult {
    const iterations: IterationData[] = [];
    let xi = x0;
    let converged = false;

    for (let i = 1; i <= maxIter; i++) {
      const fxi = MathEvaluator.evaluate(f, xi);
      const df = MathEvaluator.derivative(f, xi);

      if (Math.abs(df) < 1e-12) {
        return this.errorResult('newton-raphson', f, 'Derivada cercana a cero', { x0, tol, maxIter });
      }

      const xiNext = xi - fxi / df;
      const { ea, er } = this.calculateError(xiNext, xi);

      iterations.push({
        iteration: i,
        xi,
        fxi,
        df,
        xiNext,
        ea,
        er: er.toFixed(6) + '%'
      });

      if (Math.abs(fxi) < 1e-15 || ea < tol) {
        xi = xiNext;
        converged = true;
        break;
      }

      xi = xiNext;
    }

    return this.successResult('newton-raphson', f, xi, iterations, converged, { x0, tol, maxIter });
  }

  static secant(
    f: string,
    x0: number,
    x1: number,
    tol: number,
    maxIter: number
  ): CalculationResult {
    const iterations: IterationData[] = [];
    let xi_prev = x0;
    let xi = x1;
    let converged = false;

    for (let i = 1; i <= maxIter; i++) {
      const fxi = MathEvaluator.evaluate(f, xi);
      const fxi_prev = MathEvaluator.evaluate(f, xi_prev);

      if (Math.abs(fxi - fxi_prev) < 1e-12) {
        return this.errorResult('secant', f, 'División por cero en la secante', { x0, x1, tol, maxIter });
      }

      const xi_next = xi - (fxi * (xi_prev - xi)) / (fxi_prev - fxi);
      const { ea, er } = this.calculateError(xi_next, xi);

      iterations.push({
        iteration: i,
        xi_prev,
        xi,
        fxi_prev,
        fxi,
        xi_next,
        ea,
        er: er.toFixed(6) + '%'
      });

      if (Math.abs(fxi) < 1e-15 || ea < tol) {
        xi = xi_next;
        converged = true;
        break;
      }

      xi_prev = xi;
      xi = xi_next;
    }

    return this.successResult('secant', f, xi, iterations, converged, { x0, x1, tol, maxIter });
  }

  static fixedPoint(
    f: string,
    x0: number,
    tol: number,
    maxIter: number,
    g1Value?: number,
    interval?: { a?: number; b?: number }
  ): CalculationResult {
    const referencePoint = g1Value !== undefined ? g1Value : x0;
    const { selected, candidates } = this.selectFixedPointTransformation(f, referencePoint, interval);

    if (!selected) {
      return this.errorResult(
        'fixed-point',
        f,
        'No se encontró una transformación g(x) convergente a partir de f(x)',
        { x0, tol, maxIter, g1Value, candidates }
      );
    }

    return this.fixedPointWithTransformation(
      f,
      selected.expression,
      x0,
      tol,
      maxIter,
      g1Value,
      candidates,
      selected.derivativeAtPoint
    );
  }

  static fixedPointWithTransformation(
    f: string,
    g: string,
    x0: number,
    tol: number,
    maxIter: number,
    g1Value?: number,
    candidates: FixedPointCandidate[] = [],
    selectedDerivative?: number | null
  ): CalculationResult {
    const iterations: IterationData[] = [];
    let xi = x0;
    let converged = false;
    const referencePoint = g1Value !== undefined ? g1Value : x0;
    const params = {
      x0,
      tol,
      maxIter,
      g1Value,
      selectedG: g,
      selectedDerivative: selectedDerivative ?? null,
      candidates,
    };

    try {
      const dg = MathEvaluator.derivative(g, referencePoint);
      if (Math.abs(dg) >= 1) {
        console.warn(`El criterio de convergencia no se cumple en x=${referencePoint}: |g'(x)| = ${Math.abs(dg).toFixed(4)} >= 1. El método podría divergir.`);
      }
    } catch {
      console.warn("No se pudo evaluar la derivada de g(x) para el criterio de convergencia.");
    }

    for (let i = 1; i <= maxIter; i++) {
      let xiNext: number;
      let dgi: number | null = null;
      let fxi: number | null = null;
      
      try {
        xiNext = MathEvaluator.evaluate(g, xi);
        fxi = MathEvaluator.evaluate(f, xi);
        try {
          dgi = MathEvaluator.derivative(g, xi);
        } catch {}
      } catch (e) {
        return this.errorResult('fixed-point', f, 'Error evaluando g(x) o f(x)', params, g);
      }

      const { ea, er } = this.calculateError(xiNext, xi);

      iterations.push({
        iteration: i,
        xi,
        fxi: fxi !== null ? fxi : 'N/A',
        xiNext,
        dgi: dgi !== null ? dgi.toFixed(6) : 'N/A',
        ea,
        er: er.toFixed(6) + '%'
      });

      if (ea < tol || (fxi !== null && Math.abs(fxi) < 1e-15)) {
        xi = xiNext;
        converged = true;
        break;
      }

      xi = xiNext;
      
      if (!isFinite(xi) || Math.abs(xi) > 1e15) {
        return this.errorResult('fixed-point', f, 'El método diverge', params, g);
      }
    }

    return this.successResult('fixed-point', f, xi, iterations, converged, params, g);
  }

  static newtonRaphsonSystem2x2(
    f1: string,
    f2: string,
    x0: number,
    y0: number,
    tol: number,
    maxIter: number
  ): SystemCalculationResult {
    const iterations: SystemIterationData[] = [];
    let x = x0;
    let y = y0;
    let converged = false;
    const params = { f1, f2, x0, y0, tol, maxIter };

    for (let i = 1; i <= maxIter; i++) {
      const scope = { x, y };
      const fx1 = MathEvaluator.evaluateWithScope(f1, scope);
      const fx2 = MathEvaluator.evaluateWithScope(f2, scope);

      const j11 = MathEvaluator.partialDerivative(f1, 'x', scope);
      const j12 = MathEvaluator.partialDerivative(f1, 'y', scope);
      const j21 = MathEvaluator.partialDerivative(f2, 'x', scope);
      const j22 = MathEvaluator.partialDerivative(f2, 'y', scope);

      const det = j11 * j22 - j12 * j21;
      if (Math.abs(det) < 1e-12) {
        return this.systemErrorResult('Jacobiana singular o casi singular', params, f1, f2, iterations);
      }

      const deltaX = (-fx1 * j22 + j12 * fx2) / det;
      const deltaY = (j21 * fx1 - j11 * fx2) / det;
      const xNext = x + deltaX;
      const yNext = y + deltaY;
      const ea = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      const denom = Math.max(Math.abs(xNext), Math.abs(yNext), 1);
      const er = (ea / denom) * 100;

      iterations.push({
        iteration: i,
        x,
        y,
        f1: fx1,
        f2: fx2,
        j11,
        j12,
        j21,
        j22,
        deltaX,
        deltaY,
        xNext,
        yNext,
        ea,
        er: er.toFixed(6) + '%',
      });

      x = xNext;
      y = yNext;

      if (!isFinite(x) || !isFinite(y)) {
        return this.systemErrorResult('La iteración produjo valores no finitos', params, f1, f2, iterations);
      }

      if (ea < tol || Math.max(Math.abs(fx1), Math.abs(fx2)) < 1e-15) {
        converged = true;
        break;
      }
    }

    const lastIter = iterations[iterations.length - 1];
    return {
      functionF1: f1,
      functionF2: f2,
      solution: { x, y },
      error: lastIter?.ea ?? null,
      iterations,
      converged,
      message: converged
        ? 'Convergencia alcanzada para el sistema'
        : 'No se alcanzó la convergencia en el máximo de iteraciones',
      params,
    };
  }

  private static systemErrorResult(
    message: string,
    params: Record<string, any>,
    f1: string,
    f2: string,
    iterations: SystemIterationData[] = []
  ): SystemCalculationResult {
    return {
      functionF1: f1,
      functionF2: f2,
      solution: null,
      error: iterations[iterations.length - 1]?.ea ?? null,
      iterations,
      converged: false,
      message,
      params,
    };
  }

  private static errorResult(method: MethodType, f: string, message: string, params: any, g?: string): CalculationResult {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      method,
      functionF: f,
      functionG: g,
      root: null,
      error: null,
      iterations: [],
      converged: false,
      message,
      params
    };
  }

  private static successResult(
    method: MethodType,
    f: string,
    root: number,
    iterations: IterationData[],
    converged: boolean,
    params: any,
    g?: string
  ): CalculationResult {
    const lastIter = iterations[iterations.length - 1];
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      method,
      functionF: f,
      functionG: g,
      root,
      error: typeof lastIter?.ea === 'number' ? lastIter.ea : null,
      iterations,
      converged,
      message: converged ? 'Convergencia alcanzada' : 'No se alcanzó la convergencia en el máximo de iteraciones',
      params
    };
  }
}
