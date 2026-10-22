# Extraction Schema Check

A client-side QA check for LLM data-extraction pipelines, built with Datamint's problem in mind: crawling and extraction infra that feeds AI agents is only useful if the records coming out actually match the schema downstream consumers expect - without burning tokens on fields nobody asked for.

Paste a JSON Schema and extracted records (one JSON per line); the tool flags potential issues:

- **SCHEMA_VIOLATION** - a record that fails schema validation
- **TYPE_DRIFT** - the same field appearing with different types across records
- **UNDECLARED_FIELD** - extracted fields never declared in the schema (possible token waste)
- **HTML_RESIDUE** - extracted text that appears to still contain HTML tags
- **UNPARSED** - record lines that are not valid JSON

Plain HTML, CSS and JavaScript. No build step, no external services.

## Run

Open `index.html` in a browser, paste schema and records, click "Run extraction check".

## Test

```
npm test
```

## Limitations

This is a heuristic screen, not a full extraction audit:

- Only a JSON Schema subset is supported (type, required, properties, items, enum) - no formats, patterns or conditional schemas.
- The token-waste figure is a rough character-count estimate, not a tokenizer count.
- Type drift and HTML residue checks are pattern-based and can produce false positives and negatives.
- Tests verify the checks match their intended sample patterns; they do not prove real-world extraction quality.
