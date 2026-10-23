## Why

Developers constantly reshape JSON/YAML payloads and Base64 strings while working in the editor. Today NextGenNote only offers a minimal set (`JsonTools` pretty-print follows the global tab preference, key sorting is hard-wired to 2 spaces, and there is no escape/unescape, YAML conversion, or consistent Base64 menu entry). Making these first-class, predictable selection-based tools removes the need to paste data into external websites.

## What Changes

- Add explicit JSON formatting commands operating on the selection (or whole document when nothing is selected): **Pretty print (2 spaces)**, **Pretty print (4 spaces)**, **Minify**, **Sort keys** (recursive, honoring the chosen indent), **Escape JSON** and **Unescape JSON**.
- Add JSON ⇄ YAML conversion commands: **JSON to YAML**, **YAML to JSON**, and **Sort keys (YAML)**.
- Add text Base64 commands that act on the current selection: **Base64 Encode** and **Base64 Decode** (UTF-8 safe), with clear error messages on invalid input.
- Expose all commands in the plugin menus (and command palette, if applicable) with error toasts/dialogs instead of silent failures.
- Add a YAML parsing/serializing dependency to the renderer bundle.
- Existing `JsonTools|Pretty-print…`, `Sort object keys` and `MIME Tools|Base64 …` entries keep working; they are reconciled with the new commands rather than duplicated.

## Capabilities

### New Capabilities
- `json-formatting`: Pretty print (2/4 spaces), minify, recursive key sort, and escape/unescape of JSON text on the selection or whole document.
- `json-yaml-conversion`: Bidirectional JSON ⇄ YAML conversion, plus key-sorted YAML output.
- `text-base64`: Base64 encode/decode of the selected text, UTF-8 safe, with error handling.

### Modified Capabilities
<!-- None: no existing specs in openspec/specs/ -->

## Impact

- Code: `app/src/tools.js` (command handlers, currently holds `JsonTools` / `MIME Tools` entries), `app/menu.json` / `app/plugins.json` (menu entries), `app/src/selftest.js` (tests).
- Dependencies: a YAML library (e.g. `yaml` or `js-yaml`) added to `app/package.json` and bundled via `app/build.mjs` (esbuild).
- Docs: `docs/FEATURES.md` updated with the new tools.
- No breaking changes; no data or config migration.
