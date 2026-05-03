import * as math from 'mathjs';

export type PolynomialRootMethod = 'muller' | 'bairstow' | 'horner';

export interface PolynomialIteration {
  iteration: number;
  description: string;
  values: Record<string, string>;
}

export interface PolynomialGraphMarker {
  x: number;
  y: number;
  label: string;
  tone: 'seed' | 'iteration' | 'root';
}

export interface PolynomialRootResult {
  method: PolynomialRootMethod;
  converged: boolean;
  message: string;
  roots: string[];
  realRoots: number[];
  hiddenComplexRoots: string[];
  iterations: PolynomialIteration[];
  graphMarkers: PolynomialGraphMarker[];
  polynomialExpression: string;
  params: Record<string, any>;
}

export class PolynomialMethods {
  static parseCoefficients(coefText: string): number[] {
    const tokens = coefText
      .replace(/\s+/g, ' ')
      .split(/[,;\s]+/)
      .filter(Boolean);

    const coeffs = tokens.map((token) => {
      const value = Number(token.replace(',', '.'));
      if (Number.isNaN(value)) {
        throw new Error(`Coeficiente invalido: ${token}`);
      }
      return value;
    });

    if (coeffs.length < 2) {
      throw new Error('Ingresa al menos dos coeficientes (grado minimo 1).');
    }

    if (coeffs[0] === 0) {
      throw new Error('El coeficiente principal no puede ser cero.');
    }

    return coeffs;
  }

  static formatComplex(value: math.Complex): string {
    const re = Number(value.re.toFixed(8));
    const im = Number(value.im.toFixed(8));
    if (Math.abs(im) < 1e-10) {
      return `${re}`;
    }
    if (Math.abs(re) < 1e-10) {
      return `${im}i`;
    }
    return `${re} ${im >= 0 ? '+' : '-'} ${Math.abs(im)}i`;
  }

  static isNearlyReal(value: math.Complex) {
    return Math.abs(value.im) < 1e-8;
  }

  static toPowerAscending(coeffsDescending: number[]) {
    return coeffsDescending.slice().reverse();
  }

  static toPowerLabel(index: number, degree: number) {
    return `a${degree - index}`;
  }

  static polynomialToExpression(coeffs: number[]) {
    const degree = coeffs.length - 1;
    const terms = coeffs
      .map((coefficient, index) => {
        if (Math.abs(coefficient) < 1e-12) return null;
        const power = degree - index;
        const abs = Math.abs(coefficient);
        const sign = coefficient < 0 ? '-' : '+';
        const coeffText = abs === 1 && power > 0 ? '' : `${abs}`;
        const variableText = power === 0 ? '' : power === 1 ? 'x' : `x^${power}`;
        return `${sign} ${coeffText}${variableText}`.trim();
      })
      .filter(Boolean) as string[];

    if (terms.length === 0) return '0';

    const [first, ...rest] = terms;
    return `${first.startsWith('+') ? first.slice(2) : first} ${rest.join(' ')}`.trim();
  }

  static evaluatePolynomial(coeffs: number[], x: number): number {
    let result = coeffs[0];
    for (let i = 1; i < coeffs.length; i += 1) {
      result = result * x + coeffs[i];
    }
    return result;
  }

  static evaluatePolynomialComplex(coeffs: number[], x: math.Complex): math.Complex {
    let result = math.complex(coeffs[0], 0);
    for (let i = 1; i < coeffs.length; i += 1) {
      result = math.add(math.multiply(result, x), coeffs[i]) as math.Complex;
    }
    return result;
  }

  static buildHornerArrays(coeffs: number[], x: number) {
    const n = coeffs.length - 1;
    const b = new Array(coeffs.length).fill(0);
    const d = new Array(Math.max(coeffs.length - 1, 1)).fill(0);

    b[0] = coeffs[0];
    for (let i = 1; i <= n; i += 1) {
      b[i] = coeffs[i] + x * b[i - 1];
    }

    if (n > 0) {
      d[0] = b[0];
      for (let i = 1; i < n; i += 1) {
        d[i] = b[i] + x * d[i - 1];
      }
    }

    return {
      value: b[n],
      derivative: n > 0 ? d[n - 1] : 0,
      b,
      d,
    };
  }

  static buildGraphSummary(
    coeffs: number[],
    roots: string[],
    graphMarkers: PolynomialGraphMarker[],
  ) {
    const realRoots: number[] = [];
    const hiddenComplexRoots: string[] = [];

    for (const root of roots) {
      const numeric = Number(root);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        realRoots.push(numeric);
        continue;
      }
      hiddenComplexRoots.push(root);
    }

    return {
      realRoots,
      hiddenComplexRoots,
      polynomialExpression: this.polynomialToExpression(coeffs),
      graphMarkers,
    };
  }

  static hornerRoot(
    coeffs: number[],
    x0: number,
    tol: number,
    maxIter: number,
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const graphMarkers: PolynomialGraphMarker[] = [];
    let xi = x0;

    graphMarkers.push({
      x: x0,
      y: this.evaluatePolynomial(coeffs, x0),
      label: 'x0',
      tone: 'seed',
    });

    for (let i = 1; i <= maxIter; i += 1) {
      const { value, derivative, b, d } = this.buildHornerArrays(coeffs, xi);

      if (Math.abs(derivative) < 1e-12) {
        const graphSummary = this.buildGraphSummary(coeffs, [], graphMarkers);
        return {
          method: 'horner',
          converged: false,
          message: 'La derivada quedo demasiado cerca de cero durante Horner-Newton.',
          roots: [],
          iterations,
          ...graphSummary,
          params: { x0, tol, maxIter, coefficients: coeffs },
        };
      }

      const xiNext = xi - value / derivative;
      const error = Math.abs(xiNext - xi);

      iterations.push({
        iteration: i,
        description: 'Esquema de Horner con actualizacion de Newton para polinomios.',
        values: {
          xk: xi.toFixed(10),
          'P(xk)': value.toFixed(10),
          "P'(xk)": derivative.toFixed(10),
          'xk+1': xiNext.toFixed(10),
          error: error.toExponential(4),
          b: `[${b.map((item) => item.toFixed(6)).join(', ')}]`,
          c: `[${d.slice(0, Math.max(d.length, 0)).map((item) => item.toFixed(6)).join(', ')}]`,
        },
      });

      graphMarkers.push({
        x: xiNext,
        y: this.evaluatePolynomial(coeffs, xiNext),
        label: `x${i}`,
        tone: i === maxIter ? 'iteration' : 'iteration',
      });

      if (error < tol) {
        const rootText = xiNext.toFixed(10);
        const graphSummary = this.buildGraphSummary(coeffs, [rootText], [
          ...graphMarkers,
          {
            x: xiNext,
            y: 0,
            label: 'raiz',
            tone: 'root',
          },
        ]);

        return {
          method: 'horner',
          converged: true,
          message: 'Convergencia alcanzada con Horner-Newton.',
          roots: [rootText],
          iterations,
          ...graphSummary,
          params: { x0, tol, maxIter, coefficients: coeffs },
        };
      }

      xi = xiNext;
    }

    const finalRoot = xi.toFixed(10);
    const graphSummary = this.buildGraphSummary(coeffs, [finalRoot], [
      ...graphMarkers,
      {
        x: xi,
        y: 0,
        label: 'raiz aprox',
        tone: 'root',
      },
    ]);

    return {
      method: 'horner',
      converged: false,
      message: 'No se alcanzo convergencia con Horner-Newton en el maximo de iteraciones.',
      roots: [finalRoot],
      iterations,
      ...graphSummary,
      params: { x0, tol, maxIter, coefficients: coeffs },
    };
  }

  static mullerRoot(
    coeffs: number[],
    x0: number,
    x1: number,
    x2: number,
    tol: number,
    maxIter: number,
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const graphMarkers: PolynomialGraphMarker[] = [
      { x: x0, y: this.evaluatePolynomial(coeffs, x0), label: 'x0', tone: 'seed' },
      { x: x1, y: this.evaluatePolynomial(coeffs, x1), label: 'x1', tone: 'seed' },
      { x: x2, y: this.evaluatePolynomial(coeffs, x2), label: 'x2', tone: 'seed' },
    ];

    let z0 = math.complex(x0, 0);
    let z1 = math.complex(x1, 0);
    let z2 = math.complex(x2, 0);

    for (let i = 1; i <= maxIter; i += 1) {
      const f0 = this.evaluatePolynomialComplex(coeffs, z0);
      const f1 = this.evaluatePolynomialComplex(coeffs, z1);
      const f2 = this.evaluatePolynomialComplex(coeffs, z2);

      const h0 = math.subtract(z1, z0) as math.Complex;
      const h1 = math.subtract(z2, z1) as math.Complex;
      const delta0 = math.divide(math.subtract(f1, f0) as math.Complex, h0) as math.Complex;
      const delta1 = math.divide(math.subtract(f2, f1) as math.Complex, h1) as math.Complex;
      const a = math.divide(math.subtract(delta1, delta0) as math.Complex, math.add(h1, h0) as math.Complex) as math.Complex;
      const b = math.add(math.multiply(a, h1) as math.Complex, delta1) as math.Complex;
      const c = f2;
      const discriminant = math.sqrt(
        math.subtract(math.multiply(b, b) as math.Complex, math.multiply(math.multiply(a, c) as math.Complex, 4)) as math.Complex,
      ) as math.Complex;
      const denominatorPlus = math.add(b, discriminant) as math.Complex;
      const denominatorMinus = math.subtract(b, discriminant) as math.Complex;
      const denominator = math.abs(denominatorPlus) > math.abs(denominatorMinus) ? denominatorPlus : denominatorMinus;

      if (math.abs(denominator) < 1e-12) {
        const graphSummary = this.buildGraphSummary(coeffs, [], graphMarkers);
        return {
          method: 'muller',
          converged: false,
          message: 'El denominador del paso de Muller se volvio nulo.',
          roots: [],
          iterations,
          ...graphSummary,
          params: { x0, x1, x2, tol, maxIter, coefficients: coeffs },
        };
      }

      const z3 = math.subtract(z2, math.divide(math.multiply(c, 2) as math.Complex, denominator) as math.Complex) as math.Complex;
      const error = math.abs(math.subtract(z3, z2) as math.Complex);

      iterations.push({
        iteration: i,
        description: 'Interpolacion cuadratica local con la formula clasica de Muller.',
        values: {
          x0: this.formatComplex(z0),
          x1: this.formatComplex(z1),
          x2: this.formatComplex(z2),
          h0: this.formatComplex(h0),
          h1: this.formatComplex(h1),
          delta0: this.formatComplex(delta0),
          delta1: this.formatComplex(delta1),
          a: this.formatComplex(a),
          b: this.formatComplex(b),
          c: this.formatComplex(c),
          D: this.formatComplex(discriminant),
          'x3': this.formatComplex(z3),
          error: error.toExponential(4),
        },
      });

      if (this.isNearlyReal(z3)) {
        graphMarkers.push({
          x: z3.re,
          y: this.evaluatePolynomial(coeffs, z3.re),
          label: `x${i + 2}`,
          tone: 'iteration',
        });
      }

      if (error < tol) {
        const rootText = this.formatComplex(z3);
        const graphSummary = this.buildGraphSummary(coeffs, [rootText], [
          ...graphMarkers,
          ...(this.isNearlyReal(z3)
            ? [{ x: z3.re, y: 0, label: 'raiz', tone: 'root' as const }]
            : []),
        ]);

        return {
          method: 'muller',
          converged: true,
          message: 'Convergencia alcanzada con Muller.',
          roots: [rootText],
          iterations,
          ...graphSummary,
          params: { x0, x1, x2, tol, maxIter, coefficients: coeffs },
        };
      }

      z0 = z1;
      z1 = z2;
      z2 = z3;
    }

    const finalRoot = this.formatComplex(z2);
    const graphSummary = this.buildGraphSummary(coeffs, [finalRoot], [
      ...graphMarkers,
      ...(this.isNearlyReal(z2)
        ? [{ x: z2.re, y: 0, label: 'raiz aprox', tone: 'root' as const }]
        : []),
    ]);

    return {
      method: 'muller',
      converged: false,
      message: 'No se alcanzo convergencia con Muller dentro del maximo de iteraciones.',
      roots: [finalRoot],
      iterations,
      ...graphSummary,
      params: { x0, x1, x2, tol, maxIter, coefficients: coeffs },
    };
  }

  static solveQuadraticEquation(a: number, b: number, c: number): math.Complex[] {
    const discriminant = math.complex(b * b - 4 * a * c, 0);
    const sqrtDisc = math.sqrt(discriminant) as math.Complex;
    const twoA = 2 * a;
    return [
      math.divide(math.subtract(math.complex(-b, 0), sqrtDisc) as math.Complex, twoA) as math.Complex,
      math.divide(math.add(math.complex(-b, 0), sqrtDisc) as math.Complex, twoA) as math.Complex,
    ];
  }

  static solveLinearEquation(a: number, b: number): number {
    return -b / a;
  }

  static bairstowStep(aAsc: number[], r: number, s: number) {
    const n = aAsc.length - 1;
    const b = new Array(n + 1).fill(0);
    const c = new Array(n + 1).fill(0);

    b[n] = aAsc[n];
    b[n - 1] = aAsc[n - 1] + r * b[n];

    for (let i = n - 2; i >= 0; i -= 1) {
      b[i] = aAsc[i] + r * b[i + 1] + s * b[i + 2];
    }

    c[n] = b[n];
    c[n - 1] = b[n - 1] + r * c[n];

    for (let i = n - 2; i >= 0; i -= 1) {
      c[i] = b[i] + r * c[i + 1] + s * c[i + 2];
    }

    const denominator = c[2] * c[2] - c[3] * c[1];
    return { b, c, denominator };
  }

  static bairstowFullRoots(
    coeffs: number[],
    r0: number,
    s0: number,
    tol: number,
    maxIter: number,
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const roots: string[] = [];
    let aAsc = this.toPowerAscending(coeffs);
    let r = r0;
    let s = s0;

    while (aAsc.length > 3) {
      const n = aAsc.length - 1;
      let converged = false;
      let lastB: number[] = [];

      for (let step = 1; step <= maxIter; step += 1) {
        const { b, c, denominator } = this.bairstowStep(aAsc, r, s);
        lastB = b;

        if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-14) {
          break;
        }

        const deltaR = (b[0] * c[3] - b[1] * c[2]) / denominator;
        const deltaS = (b[1] * c[1] - b[0] * c[2]) / denominator;

        iterations.push({
          iteration: iterations.length + 1,
          description: `Ajuste de Bairstow sobre el factor x^2 + r*x + s para grado ${n}.`,
          values: {
            r: r.toFixed(10),
            s: s.toFixed(10),
            'Delta r': deltaR.toExponential(4),
            'Delta s': deltaS.toExponential(4),
            residuo0: b[0].toExponential(4),
            residuo1: b[1].toExponential(4),
            b: `[${b.slice().reverse().map((item) => item.toFixed(6)).join(', ')}]`,
            c: `[${c.slice().reverse().map((item) => item.toFixed(6)).join(', ')}]`,
          },
        });

        r += deltaR;
        s += deltaS;

        if (Math.abs(deltaR) + Math.abs(deltaS) < tol) {
          converged = true;
          break;
        }
      }

      if (!converged) {
        const graphSummary = this.buildGraphSummary(coeffs, roots, []);
        return {
          method: 'bairstow',
          converged: false,
          message: 'Bairstow no logro estabilizar el factor cuadratico con los valores iniciales dados.',
          roots,
          iterations,
          ...graphSummary,
          params: { r0, s0, tol, maxIter, coefficients: coeffs },
        };
      }

      const extractedRoots = this.solveQuadraticEquation(1, r, s);
      roots.push(...extractedRoots.map((root) => this.formatComplex(root)));
      aAsc = lastB.slice(2);
    }

    if (aAsc.length === 3) {
      const [a0, a1, a2] = aAsc;
      const quadraticRoots = this.solveQuadraticEquation(a2, a1, a0);
      roots.push(...quadraticRoots.map((root) => this.formatComplex(root)));
    } else if (aAsc.length === 2) {
      const [a0, a1] = aAsc;
      roots.push(this.solveLinearEquation(a1, a0).toFixed(10));
    }

    const graphMarkers: PolynomialGraphMarker[] = [];
    for (const root of roots) {
      const numeric = Number(root);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        graphMarkers.push({
          x: numeric,
          y: 0,
          label: 'raiz',
          tone: 'root',
        });
      }
    }

    const graphSummary = this.buildGraphSummary(coeffs, roots, graphMarkers);

    return {
      method: 'bairstow',
      converged: true,
      message: 'Bairstow completo la factorizacion polinomica.',
      roots,
      iterations,
      ...graphSummary,
      params: { r0, s0, tol, maxIter, coefficients: coeffs },
    };
  }
}
