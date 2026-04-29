import { MathEvaluator } from './src/lib/mathEvaluator';

function test(expr: string, scope: any) {
  console.log(`Expr: "${expr}"`);
  try {
    const val = MathEvaluator.evaluateWithScope(expr, scope);
    console.log(`Value at ${JSON.stringify(scope)}: ${val}`);
    const dx = MathEvaluator.partialDerivative(expr, 'x', scope);
    console.log(`df/dx: ${dx}`);
    const dy = MathEvaluator.partialDerivative(expr, 'y', scope);
    console.log(`df/dy: ${dy}`);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
  console.log('---');
}

const scope = { x: 1.5, y: 3.5 };
test('x^2 + xy - 10 = 0', scope);
test('y + 3xy^2 - 57 = 0', scope);
test('x^2 + xy - 10', scope);
test('y + 3xy^2 - 57', scope);
