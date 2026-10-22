// Extraction schema QA for LLM data pipelines: validates extracted records against
// a JSON Schema subset and flags the failure modes that burn tokens and break
// downstream agents - schema violations, type drift across records, fields extracted
// but never declared (token waste), and HTML residue in extracted text.
// Pure functions, no DOM, no dependencies.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ExtractionSchemaCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v === 'object' ? 'object' : typeof v;
  }
  function validate(schema, value, path, errors) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value)))
      errors.push(`${path}: value not in enum`);
    const t = schema.type;
    if (t && typeOf(value) !== t) {
      errors.push(`${path}: expected ${t}, got ${typeOf(value)}`);
      return;
    }
    if (t === 'object' || schema.properties) {
      const props = schema.properties || {};
      for (const req of schema.required || [])
        if (!(req in value)) errors.push(`${path}: missing required field "${req}"`);
      for (const k of Object.keys(props))
        if (k in value) validate(props[k], value[k], path ? `${path}.${k}` : k, errors);
    }
    if ((t === 'array' || schema.items) && schema.items && Array.isArray(value))
      value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errors));
  }
  function parseRecords(input) {
    const records = [];
    const skipped = [];
    input.split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      try { records.push({ rec: JSON.parse(line), line: i + 1 }); }
      catch (e) { skipped.push(i + 1); }
    });
    return { records, skipped };
  }
  function check({ schemaText, recordsText }) {
    const findings = [];
    const push = (level, code, text) => findings.push({ level, code, text });
    let schema;
    try { schema = JSON.parse(schemaText); }
    catch (e) {
      push('error', 'SCHEMA_UNPARSEABLE', `Schema is not valid JSON: ${e.message}`);
      return { findings, stats: { records: 0 } };
    }
    const { records, skipped } = parseRecords(recordsText);
    if (skipped.length) push('warn', 'UNPARSED', `Record line(s) ${skipped.join(', ')} are not valid JSON and were skipped.`);
    const schemaFields = new Set(Object.keys(schema.properties || {}));
    const seenTypes = {};
    let violations = 0;
    records.forEach(({ rec, line }) => {
      const errors = [];
      validate(schema, rec, '', errors);
      if (errors.length) {
        violations++;
        push('error', 'SCHEMA_VIOLATION', `Record line ${line}: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`);
      }
      if (typeof rec === 'object' && rec !== null && !Array.isArray(rec)) {
        for (const k of Object.keys(rec)) {
          if (!schemaFields.has(k)) {
            const est = JSON.stringify(rec[k]).length;
            push('warn', 'UNDECLARED_FIELD', `Record line ${line}: field "${k}" extracted but not declared in the schema - roughly ${est} chars/record of possible token waste if unneeded.`);
          }
          const t = typeOf(rec[k]);
          if (seenTypes[k] && seenTypes[k] !== t)
            push('error', 'TYPE_DRIFT', `Record line ${line}: field "${k}" is ${t} here but ${seenTypes[k]} elsewhere - downstream parsers may break; verify intended type.`);
          seenTypes[k] = seenTypes[k] || t;
          if (typeof rec[k] === 'string' && /<\/?[a-z][^>]*>/i.test(rec[k]))
            push('warn', 'HTML_RESIDUE', `Record line ${line}: field "${k}" appears to contain HTML tags - extraction may not have fully cleaned the DOM.`);
        }
      }
    });
    if (!findings.length && records.length)
      push('ok', 'CLEAN_EXTRACTION', `All ${records.length} record(s) pass these checks - a heuristic screen over a JSON Schema subset, not a full extraction audit; see Limitations.`);
    return { findings, stats: { records: records.length, violations } };
  }
  return { validate, parseRecords, check, typeOf };
});
