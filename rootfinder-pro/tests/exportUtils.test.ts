import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvContent, escapeCsvValue } from '../src/lib/exportUtils';

test('escapeCsvValue protege comillas, comas y saltos de linea', () => {
  assert.equal(escapeCsvValue('a,b'), '"a,b"');
  assert.equal(escapeCsvValue('valor "entrecomillado"'), '"valor ""entrecomillado"""');
  assert.equal(escapeCsvValue('simple'), 'simple');
});

test('buildCsvContent genera filas consistentes', () => {
  const csv = buildCsvContent(['col1', 'col2'], [['uno', 'dos, tres']]);
  assert.equal(csv, 'col1,col2\nuno,"dos, tres"');
});
