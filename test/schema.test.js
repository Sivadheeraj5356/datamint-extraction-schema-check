const test = require('node:test');
const assert = require('node:assert/strict');
const { check, validate } = require('../schema.js');

const SCHEMA = JSON.stringify({ type: 'object', required: ['title'], properties: { title: { type: 'string' }, price: { type: 'number' } } });
const codes = (r) => r.findings.map((f) => f.code);
const run = (recordsText) => check({ schemaText: SCHEMA, recordsText });

test('flags record missing required field', () => {
  assert.ok(codes(run('{"price": 10}')).includes('SCHEMA_VIOLATION'));
});

test('flags wrong-typed field', () => {
  assert.ok(codes(run('{"title": "x", "price": "ten"}')).includes('SCHEMA_VIOLATION'));
});

test('flags type drift across records', () => {
  const r = run('{"title": "a", "price": 1}\n{"title": "b", "price": "2"}');
  assert.ok(codes(r).includes('TYPE_DRIFT'));
});

test('flags undeclared extracted field as possible token waste', () => {
  const r = run('{"title": "a", "raw_html_blob": "xxxxx"}');
  assert.ok(codes(r).includes('UNDECLARED_FIELD'));
});

test('flags HTML residue in extracted text', () => {
  const r = run('{"title": "<b>Hello</b> world"}');
  assert.ok(codes(r).includes('HTML_RESIDUE'));
});

test('skips unparseable record lines with a warning', () => {
  const r = run('{"title": "a"}\nnot json');
  assert.ok(codes(r).includes('UNPARSED'));
});

test('clean extraction passes', () => {
  const r = run('{"title": "a", "price": 1}\n{"title": "b", "price": 2}');
  assert.deepEqual(codes(r), ['CLEAN_EXTRACTION']);
  assert.equal(r.stats.records, 2);
});
