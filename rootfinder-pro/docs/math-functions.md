# Funciones matematicas soportadas

El parser de `MathEvaluator` evalua expresiones reales con `mathjs` y rechaza resultados que no sean numeros finitos. El margen de error usado por las pruebas unitarias es `1e-10` para operaciones generales y `1e-12` para casos exactos o muy estables.

## Funciones y restricciones

| Categoria | Sintaxis | Rango de entrada real | Restricciones y notas |
| --- | --- | --- | --- |
| Trigonometricas | `sin(x)`, `cos(x)`, `tan(x)` | Cualquier numero real finito | `tan(x)` esta indefinida en `pi/2 + k*pi`; por redondeo de punto flotante puede devolver valores finitos muy grandes cerca de la asintota. |
| Inversas | `asin(x)`, `acos(x)`, `atan(x)` | `asin` y `acos`: `-1 <= x <= 1`; `atan`: cualquier real finito | Entradas fuera del dominio real se rechazan porque producirian resultados complejos. |
| Exponencial / log | `exp(x)`, `ln(x)`, `log(x)` | `exp`: limitado por overflow numerico; `ln` y `log`: `x > 0` | `ln(x)` se normaliza a `log(x)`. En `mathjs`, `log(x)` sin base es logaritmo natural. Resultados infinitos se rechazan. |
| Raices / modulo | `sqrt(x)`, `cbrt(x)`, `abs(x)` | `sqrt`: `x >= 0`; `cbrt` y `abs`: cualquier real finito | `sqrt` de negativos se rechaza porque produciria un complejo. `cbrt` acepta negativos reales. |
| Constantes y potencia | `pi`, `e`, `x^n` | Numeros reales finitos | Potencias con exponentes no enteros sobre bases negativas pueden producir complejos y se rechazan. |
| Multiplicacion implicita | `2x`, `3sin(x)`, `(x+1)(x-1)`, `xy` | Numeros reales finitos dentro del dominio de cada subexpresion | Se soporta para coeficientes numericos, variables `x`/`y`, funciones y parentesis. |

## Casos extremos

- Division por cero: se rechaza porque el resultado es infinito o no finito.
- Raices cuadradas de negativos: se rechazan en evaluacion real.
- Logaritmos de cero o negativos: se rechazan en evaluacion real.
- `asin` y `acos` fuera de `[-1, 1]`: se rechazan en evaluacion real.
- Entradas extremadamente grandes pueden exceder el rango seguro de `number` de JavaScript; si el resultado es `Infinity`, `-Infinity`, `NaN` o complejo, la evaluacion falla con `No se pudo evaluar la expresion`.
