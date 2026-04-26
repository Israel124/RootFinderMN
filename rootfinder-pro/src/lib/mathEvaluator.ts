import * as math from 'mathjs';

export class MathEvaluator {
  private static preprocess(expression: string): string {
    let expr = expression.toLowerCase();
    
    // Replace 'sen' with 'sin'
    expr = expr.replace(/\bsen\b/g, 'sin');
    
    // Replace 'ln' with 'log' (natural log in mathjs)
    expr = expr.replace(/\bln\b/g, 'log');
    
    // Replace 'e^x' with 'exp(x)' or just ensure 'e' is handled
    // mathjs handles e^x fine, but let's be explicit if needed
    // Actually mathjs is very robust.
    
    return expr;
  }

  static evaluate(expression: string, x: number): number {
    return this.evaluateWithScope(expression, { x });
  }

  static evaluateWithScope(expression: string, scope: Record<string, number>): number {
    try {
      const processed = this.preprocess(expression);
      const result = math.evaluate(processed, scope);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Resultado no finito');
      }
      
      return result;
    } catch (error) {
      console.error('Error evaluating expression:', error);
      throw error;
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
      const processed = this.preprocess(expression);
      const derived = math.derivative(processed, variable);
      const result = derived.evaluate(scope);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Derivada no finita');
      }
      return result;
    } catch (error) {
      // Fallback to numerical derivative if symbolic fails
      const h = 1e-7;
      const pivot = scope[variable];
      const plusScope = { ...scope, [variable]: pivot + h };
      const minusScope = { ...scope, [variable]: pivot - h };
      const f_plus = this.evaluateWithScope(expression, plusScope);
      const f_minus = this.evaluateWithScope(expression, minusScope);
      return (f_plus - f_minus) / (2 * h);
    }
  }

  static getDerivativeExpression(expression: string): string {
    try {
      const processed = this.preprocess(expression);
      return math.derivative(processed, 'x').toString();
    } catch {
      return 'No disponible';
    }
  }

  static getPartialDerivativeExpression(expression: string, variable: string): string {
    try {
      const processed = this.preprocess(expression);
      return math.derivative(processed, variable).toString();
    } catch {
      return 'No disponible';
    }
  }

  static isValid(expression: string): boolean {
    try {
      const processed = this.preprocess(expression);
      math.parse(processed);
      // Test with a value
      this.evaluate(processed, 1);
      return true;
    } catch {
      return false;
    }
  }
}
