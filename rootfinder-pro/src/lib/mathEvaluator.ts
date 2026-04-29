import * as math from 'mathjs';

export class MathEvaluator {
  private static readonly compiledExpressionCache = new Map<string, math.EvalFunction>();
  private static readonly derivativeNodeCache = new Map<string, math.MathNode>();

  private static getDerivativeNode(expression: string, variable: string, order = 1) {
    const processed = this.preprocess(expression);
    const cacheKey = `${processed}::${variable}::${order}`;
    const cached = this.derivativeNodeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let node = math.parse(processed);

    for (let i = 0; i < order; i++) {
      node = math.derivative(node, variable);
    }

    this.derivativeNodeCache.set(cacheKey, node);
    return node;
  }

  private static preprocess(expression: string): string {
    const normalized = expression.trim();
    let expr = normalized.toLowerCase();

    expr = expr.replace(/\bsen\b/g, 'sin');
    expr = expr.replace(/\bln\b/g, 'log');

    return expr;
  }

  private static getCompiledExpression(expression: string) {
    const processed = this.preprocess(expression);
    const cached = this.compiledExpressionCache.get(processed);
    if (cached) {
      return cached;
    }

    const compiled = math.compile(processed);
    this.compiledExpressionCache.set(processed, compiled);
    return compiled;
  }

  static evaluate(expression: string, x: number): number {
    return this.evaluateWithScope(expression, { x });
  }

  static evaluateWithScope(expression: string, scope: Record<string, number>): number {
    try {
      const result = this.getCompiledExpression(expression).evaluate(scope);

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Resultado no finito');
      }

      return result;
    } catch {
      throw new Error('No se pudo evaluar la expresion');
    }
  }

  static derivative(expression: string, x: number): number {
    return this.partialDerivative(expression, 'x', { x });
  }

  static partialDerivative(
    expression: string,
    variable: string,
    scope: Record<string, number>
  ): number {
    try {
      const result = this.getDerivativeNode(expression, variable).evaluate(scope);

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Derivada no finita');
      }
      return result;
    } catch {
      // Fallback to numerical derivative if symbolic fails
      const h = 1e-7;
      const pivot = scope[variable];
      if (typeof pivot !== 'number' || Number.isNaN(pivot)) {
        throw new Error('Variable no encontrada en el alcance');
      }
      const plusScope = { ...scope, [variable]: pivot + h };
      const minusScope = { ...scope, [variable]: pivot - h };
      const f_plus = this.evaluateWithScope(expression, plusScope);
      const f_minus = this.evaluateWithScope(expression, minusScope);
      return (f_plus - f_minus) / (2 * h);
    }
  }

  static getDerivativeExpression(expression: string): string {
    try {
      return this.getDerivativeNode(expression, 'x', 1).toString();
    } catch {
      return 'No disponible';
    }
  }

  static getPartialDerivativeExpression(expression: string, variable: string): string {
    try {
      return this.getDerivativeNode(expression, variable, 1).toString();
    } catch {
      return 'No disponible';
    }
  }

  static getNthDerivativeExpression(expression: string, order: number, variable = 'x'): string {
    try {
      if (order === 0) return this.preprocess(expression);
      return this.getDerivativeNode(expression, variable, order).toString();
    } catch {
      return 'No disponible';
    }
  }

  static evaluateNthDerivative(
    expression: string,
    order: number,
    scope: Record<string, number>,
    variable = 'x'
  ): number {
    try {
      if (order === 0) {
        return this.evaluateWithScope(expression, scope);
      }

      const node = this.getDerivativeNode(expression, variable, order);
      const result = node.evaluate(scope);

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Derivada no finita');
      }

      return result;
    } catch {
      if (!Object.prototype.hasOwnProperty.call(scope, variable)) {
        throw new Error('Variable no encontrada en el alcance');
      }

      const pivot = scope[variable];
      const h = 1e-5;
      return (
        this.evaluateNthDerivative(expression, order - 1, { ...scope, [variable]: pivot + h }, variable) -
        this.evaluateNthDerivative(expression, order - 1, { ...scope, [variable]: pivot - h }, variable)
      ) / (2 * h);
    }
  }

  static isValid(expression: string): boolean {
    try {
      this.getCompiledExpression(expression);
      this.evaluate(expression, 1);
      return true;
    } catch {
      return false;
    }
  }
}
