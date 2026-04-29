import * as math from 'mathjs';

export type PolynomialRootMethod = 'muller' | 'bairstow' | 'horner';

export interface PolynomialIteration {
  iteration: number;
  description: string;
  values: Record<string, string>;
}

export interface PolynomialRootResult {
  method: PolynomialRootMethod;
  converged: boolean;
  message: string;
  roots: string[];
  iterations: PolynomialIteration[];
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
        throw new Error(`Coeficiente inválido: ${token}`);
      }
      return value;
    });

    if (coeffs.length < 2) {
      throw new Error('Ingresa al menos dos coeficientes (grado mínimo 1).');
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

  static hornerDerivative(coeffs: number[], x: number): { value: number; derivative: number } {
    const n = coeffs.length - 1;
    let b = coeffs[0];
    let c = coeffs[0];

    for (let i = 1; i < n; i += 1) {
      b = coeffs[i] + x * b;
      c = b + x * c;
    }

    b = coeffs[n] + x * b;
    return { value: b, derivative: n > 0 ? c : 0 };
  }

  static hornerRoot(
    coeffs: number[],
    x0: number,
    tol: number,
    maxIter: number
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    let xi = x0;

    for (let i = 1; i <= maxIter; i += 1) {
      const { value, derivative } = this.hornerDerivative(coeffs, xi);

      if (Math.abs(derivative) < 1e-12) {
        return {
          method: 'horner',
          converged: false,
          message: 'Derivada cercana a cero durante la evaluación de Horner.',
          roots: [],
          iterations,
          params: { x0, tol, maxIter },
        };
      }

      const xiNext = xi - value / derivative;
      const error = Math.abs(xiNext - xi);
      iterations.push({
        iteration: i,
        description: 'Evaluación de Horner y actualización Newtoniana',
        values: {
          x: xi.toFixed(10),
          'p(x)': value.toFixed(10),
          "p'(x)": derivative.toFixed(10),
          'x next': xiNext.toFixed(10),
          error: error.toFixed(10),
        },
      });

      if (error < tol) {
        return {
          method: 'horner',
          converged: true,
          message: 'Convergencia alcanzada usando método de Horner.',
          roots: [xiNext.toFixed(10)],
          iterations,
          params: { x0, tol, maxIter },
        };
      }

      xi = xiNext;
    }

    return {
      method: 'horner',
      converged: false,
      message: 'No se alcanzó convergencia dentro del número máximo de iteraciones.',
      roots: [xi.toFixed(10)],
      iterations,
      params: { x0, tol, maxIter },
    };
  }

  static mullerRoot(
    coeffs: number[],
    x0: number,
    x1: number,
    x2: number,
    tol: number,
    maxIter: number
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    let z0 = math.complex(x0, 0);
    let z1 = math.complex(x1, 0);
    let z2 = math.complex(x2, 0);

    for (let i = 1; i <= maxIter; i += 1) {
      const f0 = this.evaluatePolynomialComplex(coeffs, z0);
      const f1 = this.evaluatePolynomialComplex(coeffs, z1);
      const f2 = this.evaluatePolynomialComplex(coeffs, z2);

      const h1 = math.subtract(z1, z0) as math.Complex;
      const h2 = math.subtract(z2, z1) as math.Complex;
      const δ1 = math.divide(math.subtract(f1, f0) as math.Complex, h1) as math.Complex;
      const δ2 = math.divide(math.subtract(f2, f1) as math.Complex, h2) as math.Complex;
      const d = math.divide(math.subtract(δ2, δ1) as math.Complex, math.add(h2, h1) as math.Complex) as math.Complex;
      const b = math.add(δ2, math.multiply(h2, d)) as math.Complex;
      const D = math.sqrt(math.subtract(math.multiply(b, b) as math.Complex, math.multiply(math.multiply(f2, d) as math.Complex, 4)) as math.Complex) as math.Complex;
      const denominator = math.abs(math.add(b, D) as math.Complex) > math.abs(math.subtract(b, D) as math.Complex)
        ? math.add(b, D) as math.Complex
        : math.subtract(b, D) as math.Complex;

      if (math.abs(denominator) === 0) {
        return {
          method: 'muller',
          converged: false,
          message: 'Denominador nulo durante la iteración de Müller.',
          roots: [],
          iterations,
          params: { x0, x1, x2, tol, maxIter },
        };
      }

      const z3 = math.subtract(z2, math.divide(math.multiply(f2, 2) as math.Complex, denominator) as math.Complex) as math.Complex;
      const error = math.abs(math.subtract(z3, z2) as math.Complex);

      iterations.push({
        iteration: i,
        description: 'Interpolación cuadrática local y extrapolación',
        values: {
          x0: this.formatComplex(z0),
          x1: this.formatComplex(z1),
          x2: this.formatComplex(z2),
          'x3': this.formatComplex(z3),
          error: error.toFixed(10),
        },
      });

      if (error < tol) {
        return {
          method: 'muller',
          converged: true,
          message: 'Convergencia alcanzada con el método de Müller.',
          roots: [this.formatComplex(z3)],
          iterations,
          params: { x0, x1, x2, tol, maxIter },
        };
      }

      z0 = z1;
      z1 = z2;
      z2 = z3;
    }

    return {
      method: 'muller',
      converged: false,
      message: 'No se alcanzó convergencia dentro del número máximo de iteraciones.',
      roots: [this.formatComplex(z2)],
      iterations,
      params: { x0, x1, x2, tol, maxIter },
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

  static bairstowFullRoots(
    coeffs: number[],
    r0: number,
    s0: number,
    tol: number,
    maxIter: number
  ): PolynomialRootResult {
    const iterations: PolynomialIteration[] = [];
    const roots: string[] = [];
    let currentCoeffs = coeffs.slice();
    let currentR = r0;
    let currentS = s0;

    while (currentCoeffs.length > 3) {
      const degree = currentCoeffs.length - 1;
      let converged = false;
      let r = currentR;
      let s = currentS;
      let b: number[] = [];
      let c: number[] = [];

      for (let i = 1; i <= maxIter; i += 1) {
        b = new Array(degree + 1).fill(0);
        c = new Array(degree + 1).fill(0);
        b[0] = currentCoeffs[0];
        b[1] = currentCoeffs[1] + r * b[0];

        for (let j = 2; j <= degree; j += 1) {
          b[j] = currentCoeffs[j] + r * b[j - 1] + s * b[j - 2];
        }

        c[0] = b[0];
        c[1] = b[1] + r * c[0];
        for (let j = 2; j <= degree; j += 1) {
          c[j] = b[j] + r * c[j - 1] + s * c[j - 2];
        }

        const denominator = c[degree - 1] * c[degree - 1] - c[degree] * c[degree - 2];
        if (Math.abs(denominator) < 1e-14) {
          break;
        }

        const dr = (-b[degree - 1] * c[degree - 1] + b[degree] * c[degree - 2]) / denominator;
        const ds = (-b[degree] * c[degree - 1] + b[degree - 1] * c[degree]) / denominator;

        iterations.push({
          iteration: iterations.length + 1,
          description: 'Ajuste de los parámetros de Bairstow',
          values: {
            r: r.toFixed(8),
            s: s.toFixed(8),
            'Δr': dr.toFixed(10),
            'Δs': ds.toFixed(10),
            'Residuo r': b[degree - 1].toFixed(10),
            'Residuo s': b[degree].toFixed(10),
          },
        });

        r += dr;
        s += ds;

        if (Math.abs(dr) + Math.abs(ds) < tol) {
          converged = true;
          break;
        }
      }

      if (!converged) {
        return {
          method: 'bairstow',
          converged: false,
          message: 'No se logró convergencia en Bairstow para el factor cuadrático.',
          roots,
          iterations,
          params: { coeffs, r0, s0, tol, maxIter },
        };
      }

      const quadraticRoots = this.solveQuadraticEquation(1, -r, -s);
      roots.push(...quadraticRoots.map((root) => this.formatComplex(root)));
      currentCoeffs = b.slice(0, currentCoeffs.length - 2);
      currentR = r;
      currentS = s;
    }

    if (currentCoeffs.length === 3) {
      const [a, bVal, cVal] = currentCoeffs;
      const quadraticRoots = this.solveQuadraticEquation(a, bVal, cVal);
      roots.push(...quadraticRoots.map((root) => this.formatComplex(root)));
    } else if (currentCoeffs.length === 2) {
      const root = this.solveLinearEquation(currentCoeffs[0], currentCoeffs[1]);
      roots.push(root.toFixed(10));
    }

    return {
      method: 'bairstow',
      converged: true,
      message: 'Bairstow completó la factorización polinómica con éxito.',
      roots,
      iterations,
      params: { coeffs, r0, s0, tol, maxIter },
    };
  }
}
