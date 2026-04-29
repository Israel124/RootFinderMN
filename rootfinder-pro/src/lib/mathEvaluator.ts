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
    let expr = normalized;

    // Allow users to enter equations like "x^2 + y^2 = 4" and normalize them
    // as expressions of the form (left) - (right) = 0.
    if (expr.includes('=') && !expr.includes('==') && !expr.includes('<=') && !expr.includes('>=') && !expr.includes('!=')) {
      const [left, ...rightParts] = expr.split('=');
      const right = rightParts.join('=').trim();
      expr = `(${left.trim()})-(${right})`;
    }

    // Convert implicit multiplication like xy, 3x, x2, x y into explicit form
    // Add implicit multiplication: 
    // 3x -> 3*x, xy -> x*y, x3 -> x*3
    expr = expr.replace(/([0-9])\s*([a-z])/gi, '$1*$2');
    expr = expr.replace(/([a-z])\s*([a-z])/gi, '$1*$2');
    expr = expr.replace(/([a-z])\s*([0-9])/gi, '$1*$2');
    
    // Parentheses implicit multiplication: 3(x) -> 3*(x), (x)(y) -> (x)*(y), (x)3 -> (x)*3
    expr = expr.replace(/([0-9a-z])\s*\(/gi, '$1*(');
    expr = expr.replace(/\)\s*([0-9a-z])/gi, ')*$1');
    expr = expr.replace(/\)\s*\(/gi, ')*(');

    expr = expr.toLowerCase();
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
