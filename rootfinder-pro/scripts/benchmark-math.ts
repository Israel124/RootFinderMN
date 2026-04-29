import { performance } from 'node:perf_hooks';
import * as math from 'mathjs';
import { MathEvaluator } from '../src/lib/mathEvaluator';

const rawExpression = 'sin(x)^2 + cos(x)^2 + exp(x / 5) - ln(x + 6)';
const uncachedExpression = rawExpression.replace(/\bln\b/g, 'log');
const iterations = 4000;

function measure(label: string, fn: () => void) {
  const start = performance.now();
  fn();
  const total = performance.now() - start;
  return { label, total };
}

const uncached = measure('uncached-mathjs', () => {
  for (let i = 0; i < iterations; i += 1) {
    const x = (i % 100) / 10;
    math.evaluate(uncachedExpression, { x });
  }
});

MathEvaluator.evaluate(rawExpression, 0);
const cached = measure('cached-math-evaluator', () => {
  for (let i = 0; i < iterations; i += 1) {
    const x = (i % 100) / 10;
    MathEvaluator.evaluate(rawExpression, x);
  }
});

const improvement = ((uncached.total - cached.total) / uncached.total) * 100;

console.log(JSON.stringify({
  iterations,
  uncachedMs: Number(uncached.total.toFixed(2)),
  cachedMs: Number(cached.total.toFixed(2)),
  improvementPercent: Number(improvement.toFixed(2)),
}, null, 2));
