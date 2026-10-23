## ADDED Requirements

### Requirement: Convert JSON to YAML
The system SHALL provide a "JSON to YAML" command that parses the selected JSON and replaces it with equivalent YAML text indented with 2 spaces. It SHALL operate on every selection, or on the whole document when a selection is empty.

#### Scenario: Convert an object
- **WHEN** the selection is `{"name":"app","ports":[80,443]}` and the user runs "JSON to YAML"
- **THEN** the selection is replaced by YAML with a `name: app` entry and a `ports` list containing 80 and 443

#### Scenario: Invalid JSON input
- **WHEN** the selection is not valid JSON and the user runs "JSON to YAML"
- **THEN** an error message is shown and the text is not modified

### Requirement: Convert YAML to JSON
The system SHALL provide a "YAML to JSON" command that parses the selected YAML and replaces it with equivalent JSON pretty printed with 2 spaces. When the input contains multiple YAML documents, only the first SHALL be converted. Anchors and aliases SHALL be resolved to their values.

#### Scenario: Convert a mapping
- **WHEN** the selection is the YAML `name: app` followed by a `ports` list of 80 and 443, and the user runs "YAML to JSON"
- **THEN** the selection is replaced by JSON `{"name":"app","ports":[80,443]}` formatted with 2-space indentation

#### Scenario: Aliases are resolved
- **WHEN** the YAML defines an anchor and references it with an alias
- **THEN** the JSON output contains the anchored value at the alias location

#### Scenario: Invalid YAML input
- **WHEN** the selection is not valid YAML and the user runs "YAML to JSON"
- **THEN** an error message including the parse error is shown and the text is not modified

### Requirement: Sort YAML keys
The system SHALL provide a "Sort keys (YAML)" command that parses the selected YAML and re-emits it with mapping keys sorted ascending at every nesting level, preserving sequence order.

#### Scenario: Nested YAML keys are sorted
- **WHEN** the selection is YAML with top-level keys `b` and `a`, where `a` contains keys `d` and `c`
- **THEN** the output lists `a` before `b`, and `c` before `d` inside `a`

#### Scenario: Sequence order is preserved
- **WHEN** the YAML contains a list of three scalar items and the user runs "Sort keys (YAML)"
- **THEN** the list items remain in their original order

### Requirement: Round-trip fidelity of data
The system SHALL preserve data values (strings, numbers, booleans, null, nested objects and arrays) when converting JSON to YAML and back to JSON.

#### Scenario: JSON to YAML to JSON
- **WHEN** a user converts a JSON document to YAML and then converts the result back to JSON
- **THEN** the resulting JSON is data-equal to the original document
