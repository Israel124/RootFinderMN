import { NumericalMethods } from './src/lib/numericalMethods';

const f1 = 'x^2 + xy - 10 = 0';
const f2 = 'y + 3xy^2 - 57 = 0';
const x0 = 1.5;
const y0 = 3.5;
const tol = 1e-6;
const maxIter = 10;

const result = NumericalMethods.newtonRaphsonSystem2x2(f1, f2, x0, y0, tol, maxIter);

console.log('Converged:', result.converged);
console.log('Solution:', result.solution);
console.log('Iterations:', result.iterations.length);
result.iterations.forEach(it => {
  console.log(`Iter ${it.iteration}: x=${it.x.toFixed(8)}, y=${it.y.toFixed(8)}, ea=${it.ea.toExponential(4)}`);
});
