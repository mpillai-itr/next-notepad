## 1. Setup

- [x] 1.1 Add the `yaml` package to `dependencies` in `app/package.json` and run `npm install`
- [x] 1.2 Create `app/src/datatools.js` exporting the pure transform helpers (no Monaco/DOM access) and import it from `app/src/tools.js`
- [x] 1.3 Confirm `node build.mjs` bundles `yaml` into `dist/renderer.js` without errors

## 2. JSON Formatting (`json-formatting`)

- [x] 2.1 Implement `jsonFormat(text, indent)` for pretty print at 2 and 4 spaces, ignoring the tab preference
- [x] 2.2 Implement `jsonMinify(text)`
- [x] 2.3 Implement recursive `sortDeep` and `jsonSortKeys(text)` (2-space output, arrays keep order)
- [x] 2.4 Implement `jsonEscape(text)` (string-literal contents, no outer quotes, input need not be valid JSON)
- [x] 2.5 Implement `jsonUnescape(text)` accepting input with or without surrounding quotes
- [x] 2.6 Make JSON parse failures throw `Error('Invalid JSON: …')` so `mapSel` shows a toast and leaves that selection unchanged

## 3. JSON ⇄ YAML (`json-yaml-conversion`)

- [x] 3.1 Implement `jsonToYaml(text)` using `YAML.stringify` with 2-space indent
- [x] 3.2 Implement `yamlToJson(text)` using `YAML.parse` (first document only, aliases resolved) and 2-space JSON output
- [x] 3.3 Implement `yamlSortKeys(text)` using `sortMapEntries: true`
- [x] 3.4 Throw readable errors for invalid JSON and invalid YAML input

## 4. Base64 (`text-base64`)

- [x] 4.1 Implement `b64EncodeUtf8(text)` via `TextEncoder`, always padded, chunked for large input
- [x] 4.2 Implement `b64DecodeUtf8(text)` that strips whitespace, normalizes URL-safe characters, restores padding, and decodes with a fatal `TextDecoder`
- [x] 4.3 Throw readable errors for invalid Base64 characters and non-UTF-8 decoded bytes

## 5. Wiring and Menus

- [x] 5.1 Register `'Data Tools|<Command>'` handlers in `app/src/tools.js` that call the helpers through `mapSel`
- [x] 5.2 Add a `Data Tools` entry to `app/plugins.json` listing JSON, YAML and Base64 commands with separators between groups
- [x] 5.3 Add `Data Tools` to the plugin list used by the About/Debug Info output and the plugin enable/disable preference
- [x] 5.4 Leave the existing `JsonTools` and `MIME Tools` commands unchanged

## 6. Tests

- [x] 6.1 Add selftest cases for pretty print 2/4, minify, sort keys (nested, arrays) and invalid JSON in `app/src/selftest.js`
- [x] 6.2 Add selftest cases for escape/unescape, including newline handling and the escape → unescape round trip
- [x] 6.3 Add selftest cases for JSON→YAML, YAML→JSON (alias, multi-doc), YAML sort keys, and the JSON→YAML→JSON round trip
- [x] 6.4 Add selftest cases for Base64 (ASCII, non-ASCII, line-wrapped, URL-safe without padding, invalid input, non-UTF-8 bytes)
- [x] 6.5 Run the existing test suites and confirm no regressions

## 7. Verification and Docs

- [ ] 7.1 Launch the app and manually run each command on a selection, an empty selection (whole document) and multiple selections
- [x] 7.2 Verify undo restores the original text after a transform
- [x] 7.3 Update `docs/FEATURES.md` with the Data Tools menu and its commands
