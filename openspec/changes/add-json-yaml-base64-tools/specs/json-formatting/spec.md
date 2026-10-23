## ADDED Requirements

### Requirement: Pretty print JSON with selectable indent
The system SHALL provide "Pretty print (2 spaces)" and "Pretty print (4 spaces)" commands that reformat JSON text using the chosen indent, independent of the editor's tab preference. Each command SHALL operate on every selection, or on the whole document when a selection is empty.

#### Scenario: Pretty print with 2 spaces
- **WHEN** the selection is `{"a":1,"b":[1,2]}` and the user runs "Pretty print (2 spaces)"
- **THEN** the selection is replaced by the JSON indented with 2 spaces per level

#### Scenario: Pretty print with 4 spaces
- **WHEN** the selection is `{"a":{"b":1}}` and the user runs "Pretty print (4 spaces)"
- **THEN** the selection is replaced by the JSON indented with 4 spaces per level

#### Scenario: Empty selection formats whole document
- **WHEN** nothing is selected and the user runs a pretty print command
- **THEN** the entire document content is formatted

#### Scenario: Tab preference is ignored
- **WHEN** the editor preference is set to use tabs and the user runs "Pretty print (4 spaces)"
- **THEN** the output is indented with 4 spaces, not tab characters

### Requirement: Minify JSON
The system SHALL provide a "Minify" command that removes all insignificant whitespace from JSON text.

#### Scenario: Minify formatted JSON
- **WHEN** the selection is a multi-line indented JSON object and the user runs "Minify"
- **THEN** the selection is replaced by the same JSON on a single line with no extra whitespace

### Requirement: Sort JSON keys
The system SHALL provide a "Sort keys" command that recursively sorts object keys in ascending order and preserves array element order. The output SHALL be pretty printed with 2 spaces.

#### Scenario: Nested keys are sorted
- **WHEN** the selection is `{"b":1,"a":{"d":1,"c":2}}` and the user runs "Sort keys"
- **THEN** the output has `a` before `b`, and `c` before `d` inside `a`

#### Scenario: Array order is preserved
- **WHEN** the selection contains an array `[3,1,2]` and the user runs "Sort keys"
- **THEN** the array elements remain in the order 3, 1, 2, and objects inside the array have their keys sorted

### Requirement: Escape JSON
The system SHALL provide an "Escape JSON" command that converts the selected text into the contents of a JSON string literal, escaping quotes, backslashes and control characters (newline, tab, etc.), without surrounding quotes. The selection SHALL NOT be required to be valid JSON.

#### Scenario: Escape a JSON document
- **WHEN** the selection is `{"a":"x"}` and the user runs "Escape JSON"
- **THEN** the selection is replaced by `{\"a\":\"x\"}`

#### Scenario: Escape newlines
- **WHEN** the selection contains a line break and the user runs "Escape JSON"
- **THEN** the line break is replaced by the two characters `\n`

### Requirement: Unescape JSON
The system SHALL provide an "Unescape JSON" command that converts an escaped JSON string back to plain text, accepting input with or without surrounding double quotes.

#### Scenario: Unescape without surrounding quotes
- **WHEN** the selection is `{\"a\":\"x\"}` and the user runs "Unescape JSON"
- **THEN** the selection is replaced by `{"a":"x"}`

#### Scenario: Unescape with surrounding quotes
- **WHEN** the selection is `"line1\nline2"` and the user runs "Unescape JSON"
- **THEN** the selection is replaced by two lines, `line1` and `line2`, without the surrounding quotes

#### Scenario: Escape then unescape round trip
- **WHEN** a user runs "Escape JSON" and then "Unescape JSON" on the result
- **THEN** the text equals the original selection

### Requirement: Invalid JSON handling
The system SHALL show an error message that describes the parse failure when a JSON command (pretty print, minify, sort keys) is run on invalid JSON, and SHALL leave that selection's text unchanged. Selections processed successfully in the same operation SHALL still be applied.

#### Scenario: Invalid JSON is rejected
- **WHEN** the selection is `{"a":` and the user runs "Pretty print (2 spaces)"
- **THEN** an error toast is shown naming the JSON error and the text is not modified

#### Scenario: Multi-selection partial failure
- **WHEN** two selections are made, one valid and one invalid, and the user runs "Minify"
- **THEN** the valid selection is minified and the invalid selection is unchanged with an error shown
