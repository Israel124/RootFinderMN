import * as math from 'mathjs';

class LruCache<TKey, TValue> {
  private readonly maxSize: number;
  private readonly store = new Map<TKey, TValue>();

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: TKey): TValue | undefined {
    const value = this.store.get(key);
    if (value === undefined) {
      return undefined;
    }

    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: TKey, value: TValue): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, value);
    if (this.store.size <= this.maxSize) {
      return;
    }

    const oldestKey = this.store.keys().next().value as TKey | undefined;
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}

/**
 * Evaluador matemático central con soporte de derivación simbólica y aproximación numérica estable.
 */
export class MathEvaluator {
  private static readonly compiledExpressionCache = new LruCache<string, math.EvalFunction>(150);
  private static readonly derivativeNodeCache = new LruCache<string, math.MathNode>(200);

  /**
   * Evalúa una expresión univariada en `x`.
   */
  static evaluate(expression: string, x: number): number {
    return this.evaluateWithScope(expression, { x });
  }

  /**
   * Evalúa una expresión con un alcance arbitrario de variables.
   */
  static evaluateWithScope(expression: string, scope: Record<string, number>): number {
    try {
      const result = this.getCompiledExpression(expression).evaluate(scope);

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error(`La función no está definida en ${this.formatScope(scope)}`);
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('La función no está definida en ')) {
        throw error;
      }

      throw new Error('No se pudo evaluar la expresion');
    }
  }

  /**
   * Calcula la derivada respecto a `x`.
   */
  static derivative(expression: string, x: number): number {
    return this.partialDerivative(expression, 'x', { x });
  }

  /**
   * Calcula la derivada parcial respecto a una variable dada.
   */
  static partialDerivative(expression: string, variable: string, scope: Record<string, number>): number {
    try {
      const result = this.getDerivativeNode(expression, variable, 1).evaluate(scope);

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('Derivada no finita');
      }

      return result;
    } catch {
      const pivot = scope[variable];
      if (typeof pivot !== 'number' || Number.isNaN(pivot)) {
        throw new Error('Variable no encontrada en el alcance');
      }

      const h = this.adaptiveH(pivot);
      const plusScope = { ...scope, [variable]: pivot + h };
      const minusScope = { ...scope, [variable]: pivot - h };
      const plusValue = this.evaluateWithScope(expression, plusScope);
      const minusValue = this.evaluateWithScope(expression, minusScope);
      const derivative = (plusValue - minusValue) / (2 * h);

      if (!Number.isFinite(derivative)) {
        throw new Error('Derivada no finita');
      }

      return derivative;
    }
  }

  /**
   * Devuelve la derivada simbólica de primer orden respecto a `x`.
   */
  static getDerivativeExpression(expression: string): string {
    try {
      return this.getDerivativeNode(expression, 'x', 1).toString();
    } catch {
      return 'No disponible';
    }
  }

  /**
   * Devuelve la derivada parcial simbólica respecto a una variable.
   */
  static getPartialDerivativeExpression(expression: string, variable: string): string {
    try {
      return this.getDerivativeNode(expression, variable, 1).toString();
    } catch {
      return 'No disponible';
    }
  }

  /**
   * Devuelve la expresión simbólica de la derivada de orden `n`.
   */
  static getNthDerivativeExpression(expression: string, order: number, variable = 'x'): string {
    try {
      if (order === 0) {
        return this.preprocess(expression);
      }

      return this.getDerivativeNode(expression, variable, order).toString();
    } catch {
      return 'No disponible';
    }
  }

  /**
   * Evalúa la derivada de orden `n` en un punto del alcance dado.
   */
  static evaluateNthDerivative(
    expression: string,
    order: number,
    scope: Record<string, number>,
    variable = 'x',
  ): number {
    if (!Object.prototype.hasOwnProperty.call(scope, variable)) {
      throw new Error('Variable no encontrada en el alcance');
    }

    try {
      if (order === 0) {
        return this.evaluateWithScope(expression, scope);
      }

      const result = this.getDerivativeNode(expression, variable, order).evaluate(scope);
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('Derivada no finita');
      }

      return result;
    } catch {
      return this.evaluateNthDerivativeNumerically(expression, order, scope, variable);
    }
  }

  /**
   * Indica si una expresión es sintácticamente válida.
   */
  static isValid(expression: string): boolean {
    try {
      this.getCompiledExpression(expression);
      return true;
    } catch {
      return false;
    }
  }

  private static adaptiveH(x: number): number {
    return Math.max(1e-7, Math.abs(x) * 1e-7);
  }

  private static formatScope(scope: Record<string, number>): string {
    const entries = Object.entries(scope);
    if (entries.length === 1 && entries[0]?.[0] === 'x') {
      return `x = ${entries[0][1]}`;
    }

    return entries.map(([key, value]) => `${key} = ${value}`).join(', ');
  }

  private static getDerivativeNode(expression: string, variable: string, order: number): math.MathNode {
    const processed = this.preprocess(expression);
    const cacheKey = `${processed}::${variable}::${order}`;
    const cached = this.derivativeNodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let node = math.parse(processed);
    for (let index = 0; index < order; index += 1) {
      node = math.derivative(node, variable);
    }

    this.derivativeNodeCache.set(cacheKey, node);
    return node;
  }

  private static preprocess(expression: string): string {
    const normalized = expression.trim().toLowerCase();
    let expr = normalized;

    if (expr.includes('=') && !expr.includes('==') && !expr.includes('<=') && !expr.includes('>=') && !expr.includes('!=')) {
      const [left, ...rightParts] = expr.split('=');
      const right = rightParts.join('=').trim();
      expr = `(${left.trim()})-(${right})`;
    }

    expr = expr
      .replace(/√/g, 'sqrt')
      .replace(/\braiz\s*cuadrada\b/g, 'sqrt')
      .replace(/\braíz\s*cuadrada\b/g, 'sqrt')
      .replace(/\braiz\b/g, 'sqrt')
      .replace(/\braíz\b/g, 'sqrt')
      .replace(/\bseno\b/g, 'sin')
      .replace(/\bsen\b/g, 'sin')
      .replace(/\bcoseno\b/g, 'cos')
      .replace(/\btangente\b/g, 'tan')
      .replace(/\btan(?:g)?\b/g, 'tan')
      .replace(/\bln\b/g, 'log');

    expr = expr.replace(/(\d(?:\.\d+)?)\s*([a-zA-Z(])/g, '$1*$2');
    expr = expr.replace(/\b([xyz])\s*([xyz])\b/g, '$1*$2');
    expr = expr.replace(/\b([xyz])\s+(\d)/g, '$1*$2');
    expr = expr.replace(/(\d|[xyz])\s*\(/g, '$1*(');
    expr = expr.replace(/\)\s*(\d|[xyz])/g, ')*$1');
    expr = expr.replace(/\)\s*\(/g, ')*(');

    return expr;
  }

  private static getCompiledExpression(expression: string): math.EvalFunction {
    const processed = this.preprocess(expression);
    const cached = this.compiledExpressionCache.get(processed);
    if (cached) {
      return cached;
    }

    const compiled = math.compile(processed);
    this.compiledExpressionCache.set(processed, compiled);
    return compiled;
  }

  private static evaluateNthDerivativeNumerically(
    expression: string,
    order: number,
    scope: Record<string, number>,
    variable: string,
  ): number {
    const pivot = scope[variable];
    if (typeof pivot !== 'number' || Number.isNaN(pivot)) {
      throw new Error('Variable no encontrada en el alcance');
    }

    const h = this.adaptiveH(pivot);
    const derivativeAt = (currentOrder: number, currentPivot: number, depth: number): number => {
      if (depth > 24) {
        throw new Error('La derivada no se pudo aproximar numericamente');
      }

      if (currentOrder === 0) {
        return this.evaluateWithScope(expression, { ...scope, [variable]: currentPivot });
      }

      const currentH = this.adaptiveH(currentPivot || h);
      const plus = derivativeAt(currentOrder - 1, currentPivot + currentH, depth + 1);
      const minus = derivativeAt(currentOrder - 1, currentPivot - currentH, depth + 1);
      const value = (plus - minus) / (2 * currentH);

      if (!Number.isFinite(value)) {
        throw new Error('Derivada no finita');
      }

      return value;
    };

    return derivativeAt(order, pivot, 0);
  }
}
