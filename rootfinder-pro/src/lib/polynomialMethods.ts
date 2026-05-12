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

export interface HornerSyntheticDivision {
  evaluationPoint: number;
  coefficients: number[];
  powers: number[];
  products: Array<number | null>;
  results: number[];
  quotient: number[];
  remainder: number;
  polynomialExpression: string;
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
  hornerDivisions?: HornerSyntheticDivision[];
}

type HornerSingleRootResult = {
  root: number;
  deflated: number[];
  converged: boolean;
  iterations: PolynomialIteration[];
  graphMarkers: PolynomialGraphMarker[];
  message: string;
  syntheticDivision?: HornerSyntheticDivision;
};

/**
 * Implementa métodos de raíces polinómicas y sus utilidades auxiliares.
 */
export class PolynomialMethods {
  /**
   * Parsea coeficientes separados por coma, punto y coma o espacios.
   */
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

  /**
   * Formatea números complejos de forma compacta para la UI.
   */
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

  /**
   * Indica si un complejo puede tratarse como real.
   */
  static isNearlyReal(value: math.Complex): boolean {
    return Math.abs(value.im) < 1e-8;
  }

  /**
   * Convierte coeficientes descendentes a orden ascendente por potencia.
   */
  static toPowerAscending(coeffsDescending: number[]): number[] {
    return coeffsDescending.slice().reverse();
  }

  /**
   * Devuelve la etiqueta textual del coeficiente según su potencia.
   */
  static toPowerLabel(index: number, degree: number): string {
    return `a${degree - index}`;
  }

  /**
   * Convierte un polinomio a expresión legible.
   */
  static polynomialToExpression(coeffs: number[]): string {
    const degree = coeffs.length - 1;
    const terms = coeffs
      .map((coefficient, index) => {
        if (Math.abs(coefficient) < 1e-12) {
          return null;
        }

        const power = degree - index;
        const abs = Math.abs(coefficient);
        const sign = coefficient < 0 ? '-' : '+';
        const coeffText = abs === 1 && power > 0 ? '' : `${abs}`;
        const variableText = power === 0 ? '' : power === 1 ? 'x' : `x^${power}`;
        return `${sign} ${coeffText}${variableText}`.trim();
      })
      .filter(Boolean) as string[];

    if (terms.length === 0) {
      return '0';
    }

    const [first, ...rest] = terms;
    return `${first.startsWith('+') ? first.slice(2) : first} ${rest.join(' ')}`.trim();
  }

  /**
   * Evalúa un polinomio real por Horner.
   */
  static evaluatePolynomial(coeffs: number[], x: number): number {
    let result = coeffs[0];
    for (let index = 1; index < coeffs.length; index += 1) {
      result = result * x + coeffs[index];
    }
    return result;
  }

  /**
   * Evalúa un polinomio en un complejo.
   */
  static evaluatePolynomialComplex(coeffs: number[], x: math.Complex): math.Complex {
    let result = math.complex(coeffs[0], 0);
    for (let index = 1; index < coeffs.length; index += 1) {
      result = math.add(math.multiply(result, x), coeffs[index]) as math.Complex;
    }
    return result;
  }

  /**
   * Construye los arreglos b y d del esquema de Horner-Newton.
   */
  static buildHornerArrays(coeffs: number[], x: number) {
    const n = coeffs.length - 1;
    const b = new Array(coeffs.length).fill(0);
    const d = new Array(Math.max(coeffs.length - 1, 1)).fill(0);
    const products: Array<number | null> = new Array(coeffs.length).fill(null);

    b[0] = coeffs[0];
    for (let index = 1; index <= n; index += 1) {
      products[index] = x * b[index - 1];
      b[index] = coeffs[index] + products[index]!;
    }

    if (n > 0) {
      d[0] = b[0];
      for (let index = 1; index < n; index += 1) {
        d[index] = b[index] + x * d[index - 1];
      }
    }

    return {
      value: b[n],
      derivative: n > 0 ? d[n - 1] : 0,
      b,
      d,
      products,
    };
  }


  /**
   * Prepara la lectura completa de la division sintetica para un valor de x.
   */
  static buildHornerSyntheticDivision(coeffs: number[], x: number): HornerSyntheticDivision {
    const { value, b, products } = this.buildHornerArrays(coeffs, x);
    const degree = coeffs.length - 1;

    return {
      evaluationPoint: x,
      coefficients: coeffs.slice(),
      powers: coeffs.map((_, index) => degree - index),
      products,
      results: b,
      quotient: b.slice(0, -1),
      remainder: value,
      polynomialExpression: this.polynomialToExpression(coeffs),
    };
  }

  /**
   * Encuentra todas las raíces por Horner con deflación sucesiva.
   */
  static hornerRoot(coeffs: number[], x0: number, tol: number, maxIter: number): PolynomialRootResult {
    return this.hornerAllRoots(coeffs, x0, tol, maxIter);
  }

  /**
   * Encuentra todas las raíces por Horner-Newton, deflando tras cada raíz real.
   */
  static hornerAllRoots(coeffs: number[], x0: number, tol: number, maxIter: number): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const graphMarkers: PolynomialGraphMarker[] = [];
    const roots: string[] = [];
    const hornerDivisions: HornerSyntheticDivision[] = [];
    let remaining = coeffs.slice();
    let seed = x0;
    let converged = true;
    let message = 'Convergencia alcanzada con Horner-Newton y deflación completa.';
    const maxDeflations = coeffs.length + 2;
    let deflationCount = 0;

    while (remaining.length > 3) {
      if (deflationCount >= maxDeflations) {
        converged = false;
        message = 'Se alcanzó el límite de deflaciones seguras en Horner.';
        break;
      }

      const result = this.hornerOneRoot(remaining, seed, tol, maxIter, iterations.length);
      iterations.push(...result.iterations);
      graphMarkers.push(...result.graphMarkers);
      if (result.syntheticDivision) {
        hornerDivisions.push(result.syntheticDivision);
      }

      if (!result.converged) {
        converged = false;
        message = result.message;
        break;
      }

      roots.push(result.root.toFixed(10));
      remaining = result.deflated;
      seed = result.root;
      deflationCount += 1;
    }

    if (converged) {
      if (remaining.length === 3) {
        const quadraticRoots = this.solveQuadraticEquation(remaining[0], remaining[1], remaining[2]);
        roots.push(...quadraticRoots.map((root) => this.formatComplex(root)));
      } else if (remaining.length === 2) {
        roots.push(this.solveLinearEquation(remaining[0], remaining[1]).toFixed(10));
      } else if (remaining.length === 1 && Math.abs(remaining[0]) > 1e-12) {
        converged = false;
        message = 'No fue posible deflar completamente el polinomio.';
      }
    }

    const decoratedMarkers = [...graphMarkers];
    for (const root of roots) {
      const numeric = Number(root);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        decoratedMarkers.push({
          x: numeric,
          y: 0,
          label: 'raiz',
          tone: 'root',
        });
      }
    }

    const graphSummary = this.buildGraphSummary(coeffs, roots, decoratedMarkers);
    return {
      method: 'horner',
      converged,
      message,
      roots,
      iterations,
      ...graphSummary,
      params: { x0, tol, maxIter, coefficients: coeffs },
      hornerDivisions,
    };
  }

  /**
   * Resuelve una raíz por Müller.
   */
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

    for (let iteration = 1; iteration <= maxIter; iteration += 1) {
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
        iteration,
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
          x3: this.formatComplex(z3),
          error: error.toExponential(4),
        },
      });

      if (this.isNearlyReal(z3)) {
        graphMarkers.push({
          x: z3.re,
          y: this.evaluatePolynomial(coeffs, z3.re),
          label: `x${iteration + 2}`,
          tone: 'iteration',
        });
      }

      if (error < tol) {
        const rootText = this.formatComplex(z3);
        const graphSummary = this.buildGraphSummary(coeffs, [rootText], [
          ...graphMarkers,
          ...(this.isNearlyReal(z3) ? [{ x: z3.re, y: 0, label: 'raiz', tone: 'root' as const }] : []),
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
      ...(this.isNearlyReal(z2) ? [{ x: z2.re, y: 0, label: 'raiz aprox', tone: 'root' as const }] : []),
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

  /**
   * Resuelve una ecuación cuadrática permitiendo raíces complejas.
   */
  static solveQuadraticEquation(a: number, b: number, c: number): math.Complex[] {
    const discriminant = math.complex(b * b - 4 * a * c, 0);
    const sqrtDiscriminant = math.sqrt(discriminant) as math.Complex;
    const twoA = 2 * a;
    return [
      math.divide(math.subtract(math.complex(-b, 0), sqrtDiscriminant) as math.Complex, twoA) as math.Complex,
      math.divide(math.add(math.complex(-b, 0), sqrtDiscriminant) as math.Complex, twoA) as math.Complex,
    ];
  }

  /**
   * Resuelve una ecuación lineal `ax + b = 0`.
   */
  static solveLinearEquation(a: number, b: number): number {
    return -b / a;
  }

  /**
   * Ejecuta un paso de Bairstow en coeficientes ascendentes.
   */
  static bairstowStep(aAsc: number[], r: number, s: number) {
    const degree = aAsc.length - 1;
    const b = new Array(degree + 1).fill(0);
    const c = new Array(degree + 1).fill(0);

    b[degree] = aAsc[degree];
    b[degree - 1] = aAsc[degree - 1] + r * b[degree];

    for (let index = degree - 2; index >= 0; index -= 1) {
      b[index] = aAsc[index] + r * b[index + 1] + s * b[index + 2];
    }

    c[degree] = b[degree];
    c[degree - 1] = b[degree - 1] + r * c[degree];

    for (let index = degree - 2; index >= 0; index -= 1) {
      c[index] = b[index] + r * c[index + 1] + s * c[index + 2];
    }

    return {
      b,
      c,
      denominator: c[2] * c[2] - c[3] * c[1],
    };
  }

  /**
   * Estima valores iniciales razonables para Bairstow.
   */
  static estimateBairstowInitialValues(coeffs: number[]) {
    if (coeffs.length < 3) {
      return { r0: 0, s0: 0 };
    }

    const leading = coeffs[0];
    const rFromLeadingTerms = coeffs[1] / leading;
    const sFromLeadingTerms = coeffs[2] / leading;
    const normalizedConstant = coeffs[coeffs.length - 1] / leading;
    const degree = coeffs.length - 1;
    const constantScale = Math.sign(normalizedConstant || -1) * Math.pow(Math.abs(normalizedConstant || 1), 2 / degree);

    const candidates = [
      { r0: rFromLeadingTerms, s0: sFromLeadingTerms },
      { r0: -rFromLeadingTerms / Math.max(degree - 1, 1), s0: constantScale },
      { r0: 0, s0: constantScale },
      { r0: 0, s0: -1 },
      { r0: 0, s0: 1 },
    ];

    for (const candidate of candidates) {
      if (!Number.isFinite(candidate.r0) || !Number.isFinite(candidate.s0)) {
        continue;
      }

      const { denominator } = this.bairstowStep(this.toPowerAscending(coeffs), candidate.r0, candidate.s0);
      if (Number.isFinite(denominator) && Math.abs(denominator) > 1e-12) {
        return candidate;
      }
    }

    return { r0: 0, s0: -1 };
  }

  /**
   * Factoriza completamente un polinomio por Bairstow.
   */
  static bairstowFullRoots(
    coeffs: number[],
    r0: number = PolynomialMethods.estimateBairstowInitialValues(coeffs).r0,
    s0: number = PolynomialMethods.estimateBairstowInitialValues(coeffs).s0,
    tol: number,
    maxIter: number,
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const roots: string[] = [];
    let aAsc = this.toPowerAscending(coeffs);
    let r = r0;
    let s = s0;
    let deflationCount = 0;
    const maxDeflations = Math.max(coeffs.length * 2, 4);

    while (aAsc.length > 3) {
      if (deflationCount >= maxDeflations) {
        const graphSummary = this.buildGraphSummary(coeffs, roots, []);
        return {
          method: 'bairstow',
          converged: false,
          message: 'Bairstow alcanzó el límite seguro de deflación antes de terminar.',
          roots,
          iterations,
          ...graphSummary,
          params: { r0, s0, tol, maxIter, coefficients: coeffs },
        };
      }

      const degree = aAsc.length - 1;
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
          description: `Ajuste de Bairstow sobre el factor x^2 + r*x + s para grado ${degree}.`,
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
      deflationCount += 1;
    }

    if (aAsc.length === 3) {
      const [a0, a1, a2] = aAsc;
      roots.push(...this.solveQuadraticEquation(a2, a1, a0).map((root) => this.formatComplex(root)));
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

  private static hornerOneRoot(
    coeffs: number[],
    x0: number,
    tol: number,
    maxIter: number,
    iterationOffset: number,
  ): HornerSingleRootResult {
    const iterations: PolynomialIteration[] = [];
    const graphMarkers: PolynomialGraphMarker[] = [
      {
        x: x0,
        y: this.evaluatePolynomial(coeffs, x0),
        label: `x${iterationOffset}`,
        tone: 'seed',
      },
    ];
    let xi = x0;

    for (let iteration = 1; iteration <= maxIter; iteration += 1) {
      const { value, derivative, b, d } = this.buildHornerArrays(coeffs, xi);
      if (Math.abs(derivative) < 1e-12) {
        return {
          root: xi,
          deflated: coeffs.slice(),
          converged: false,
          iterations,
          graphMarkers,
          message: 'La derivada quedo demasiado cerca de cero durante Horner-Newton.',
          syntheticDivision: this.buildHornerSyntheticDivision(coeffs, xi),
        };
      }

      const xiNext = xi - value / derivative;
      const error = Math.abs(xiNext - xi);
      iterations.push({
        iteration: iterationOffset + iteration,
        description: 'Esquema de Horner con actualizacion de Newton para polinomios.',
        values: {
          xk: xi.toFixed(10),
          'P(xk)': value.toFixed(10),
          "P'(xk)": derivative.toFixed(10),
          'xk+1': xiNext.toFixed(10),
          error: error.toExponential(4),
          b: `[${b.map((item) => item.toFixed(6)).join(', ')}]`,
          c: `[${d.map((item) => item.toFixed(6)).join(', ')}]`,
        },
      });

      graphMarkers.push({
        x: xiNext,
        y: this.evaluatePolynomial(coeffs, xiNext),
        label: `x${iterationOffset + iteration}`,
        tone: 'iteration',
      });

      if (error < tol || Math.abs(this.evaluatePolynomial(coeffs, xiNext)) < tol) {
        const syntheticDivision = this.buildHornerSyntheticDivision(coeffs, xiNext);
        const deflated = syntheticDivision.quotient;
        return {
          root: xiNext,
          deflated,
          converged: true,
          iterations,
          graphMarkers,
          message: 'Convergencia alcanzada con Horner-Newton.',
          syntheticDivision,
        };
      }

      xi = xiNext;
    }

    return {
      root: xi,
      deflated: coeffs.slice(),
      converged: false,
      iterations,
      graphMarkers,
      message: 'No se alcanzo convergencia con Horner-Newton en el maximo de iteraciones.',
      syntheticDivision: this.buildHornerSyntheticDivision(coeffs, xi),
    };
  }

  private static buildGraphSummary(
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
      } else {
        hiddenComplexRoots.push(root);
      }
    }

    return {
      realRoots,
      hiddenComplexRoots,
      polynomialExpression: this.polynomialToExpression(coeffs),
      graphMarkers,
    };
  }
}
