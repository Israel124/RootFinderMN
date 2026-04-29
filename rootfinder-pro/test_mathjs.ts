import * as math from 'mathjs';

console.log('x^2y:', math.parse('x^2y').toString());
console.log('evaluate x^2y with {x:2, y:3}:', math.evaluate('x^2y', {x:2, y:3}));
console.log('3xy^2:', math.parse('3xy^2').toString());
console.log('evaluate 3xy^2 with {x:2, y:3}:', math.evaluate('3xy^2', {x:2, y:3}));
