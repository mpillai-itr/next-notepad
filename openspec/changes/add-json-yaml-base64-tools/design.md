## Context

NextGenNote is an Electron + Monaco editor. Plugin-style tools live in `app/src/tools.js` as a command map keyed `'<Plugin>|<Command>'`, and `app/plugins.json` lists which commands appear under each plugin menu. Most text tools go through `mapSel(fn)` (`tools.js:145`), which applies `fn` to every selection (or the whole document when a selection is empty), reports thrown errors via `NGN.toast`, and applies the edits as one undoable operation.

Current state:
- `JsonTools|Pretty-print…` indents using the global tab preference, and `Sort object keys` always indents with 2 spaces.
- There is no JSON escape/unescape and no YAML support.
- `MIME Tools|Base64 Encode/Decode` exists. Encode strips padding by default, and the `b64` helper (`tools.js:142`) is the only encoder/decoder.
- The renderer is bundled by esbuild (`app/build.mjs`), so a pure-JS YAML library can be imported with no main-process changes.

Constraints: no new IPC, no main-process code, and everything must work offline on the selection.

## Goals / Non-Goals

**Goals:**
- Add explicit, predictable commands: pretty print 2/4 spaces, minify, sort keys, escape/unescape JSON, JSON→YAML, YAML→JSON, sort YAML keys, Base64 encode/decode.
- Reuse `mapSel` so behavior (multi-selection, whole-doc fallback, undo, error toast) is identical to existing tools.
- Make Base64 UTF-8 safe and symmetric (encode then decode returns the original text).

**Non-Goals:**
- A new UI panel, dialog or side-by-side converter. These are menu commands only.
- JSON5/JSONC parsing, comment-preserving YAML round-trips, or YAML multi-document support beyond the first document.
- Changing the existing "by line", "strict" or padding-less Base64 variants, or the JSON tree viewer.
- Streaming or very large file optimization.

## Decisions

### 1. Group the new commands in one new plugin menu, "Data Tools"
Add a `Data Tools` entry to `plugins.json` (with commands for JSON, YAML, and Base64) and register handlers in `tools.js` under `'Data Tools|<Command>'`.
- *Why:* The existing `JsonTools` and `MIME Tools` entries mirror shipped Notepad++ plugins, and changing their command lists would break that parity and any user macros or shortcuts referencing them.
- *Alternatives:* Extending `JsonTools` and `MIME Tools` in place gives fewer menus, but it mixes custom features with the traced plugin set and risks behavior changes to existing commands.

### 2. Shared transform helpers; leave existing handlers untouched
Introduce small pure functions (`jsonFormat(text, indent, {sort})`, `sortDeep`, `jsonEscape`, `jsonUnescape`, `toYaml`, `fromYaml`) in `tools.js` (or a new `src/datatools.js` imported by it) and have handlers call them through `mapSel`. Pure functions are unit-testable in `selftest.js` without Monaco.
- *Why:* This keeps the transforms testable and avoids a third copy of the recursive sort already inlined in `JsonTools|Sort object keys`.
- *Alternatives:* Inline lambdas in the command map (existing style) are faster to write but harder to test, and the sort logic would be duplicated.

### 3. Indent and sort semantics
- *Pretty print 2 / 4:* `JSON.stringify(JSON.parse(t), null, 2|4)`, independent of the tab preference.
- *Minify:* `JSON.stringify(JSON.parse(t))`.
- *Sort keys (JSON):* recursive, ascending by code-unit order, arrays preserved in order. Output is pretty-printed with 2 spaces. We add 4-space sorted variants only if the spec demands it, so we keep one indent control: the user can run Sort Keys and then Pretty print 4.
- *Why:* Explicit 2/4 commands match the request and avoid hidden coupling to the editor prefs.
- *Alternative:* A single "Format" command honoring prefs is what exists today, and it is ambiguous for this use case.

### 4. Escape / Unescape JSON means string-literal escaping
- *Escape:* `JSON.stringify(text).slice(1, -1)`. This turns quotes, backslashes and newlines in the selection into escape sequences, so a JSON document can be embedded inside a JSON string value. It does not require the selection to be valid JSON.
- *Unescape:* wrap the input in quotes if it is not already a JSON string literal, run `JSON.parse`, and return the string. If the result is itself an object-like string, it is left as text and the user can then run Pretty print.
- *Why:* This is what "escape JSON" usually means in practice (logs, curl payloads, stringified JSON fields).
- *Alternatives:* Double-encoding with `JSON.stringify(JSON.stringify(x))` keeps the outer quotes, which is unwanted when pasting inside an existing string. Unicode `\uXXXX` escaping of non-ASCII characters is out of scope.

### 5. YAML via the `yaml` package, bundled into the renderer
Add `yaml` (eemeli/yaml, YAML 1.2, zero dependencies, ESM) to `dependencies`. Use `YAML.parse` / `YAML.stringify(value, { indent: 2, sortMapEntries })`.
- *JSON→YAML:* `YAML.stringify(JSON.parse(t), { indent: 2 })`.
- *YAML→JSON:* `JSON.stringify(YAML.parse(t), null, 2)`.
- *Sort keys (YAML):* parse, then `stringify` with `sortMapEntries: true`, which sorts nested maps recursively.
- *Why:* It is YAML 1.2 compliant, and has no native add-ons, so it works with esbuild and the electron-builder packaging as-is. Sorting is built in, so we don't hand-write it.
- *Alternatives:* `js-yaml` is also popular and small. It defaults to YAML 1.2 core schema too, but sorting needs a custom `sortKeys` option and its ESM story is weaker. A hand-rolled converter was rejected as error-prone.

### 6. Base64 handled via UTF-8, separate from MIME Tools
`encode`: `btoa(String.fromCharCode(...new TextEncoder().encode(t)))`, chunked for large inputs. `decode`: strip whitespace, `atob`, then `new TextDecoder('utf-8', { fatal: true })`. Padding is always emitted on encode. Accept URL-safe input (`-`/`_`) on decode by normalizing first.
- *Why:* This guarantees a lossless round trip for non-ASCII text (emoji, accented characters). The existing `MIME Tools` encode drops padding, which some consumers reject.
- *Alternatives:* Reusing the existing `b64` helper is less code, but its padding and non-strict behavior differ from the requirement, and changing it would alter existing menu behavior.

### 7. Error handling
Every handler throws `Error` with a human-readable message (for example `Invalid JSON: Unexpected token } at position 12`), which `mapSel` shows as a toast. A failing selection leaves its text unchanged, and other selections in a multi-select still apply.

## Risks / Trade-offs

- **[Large selections freeze the UI]** → Transforms run synchronously on the renderer thread. Accept for typical payloads (< a few MB), and chunk Base64 encoding to avoid `String.fromCharCode` argument limits.
- **[YAML→JSON loses YAML features]** (comments, anchors, multi-docs) → Document that only the first document is converted and that comments are dropped. Anchors and aliases are resolved by `yaml.parse`.
- **[JSON sort changes order, and big integers lose precision]** → `JSON.parse` loses precision above 2^53. This is the same limitation as the existing JSON tools, so it is noted in the spec and not solved here.
- **[Sorted-key output is always 2-space indented]** → Users wanting 4 spaces run Pretty print 4 afterward. Revisit if it proves annoying.
- **[Added dependency]** → `yaml` is small and dependency-free, so the bundle growth is modest. Pin to a caret range and run the existing selftests plus a packaging smoke build.
- **[Menu duplication with `JsonTools`/`MIME Tools`]** → Some commands overlap (pretty print, Base64). Accepted deliberately (Decision 1) to avoid regressions.
