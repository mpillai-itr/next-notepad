## ADDED Requirements

### Requirement: Base64 encode selected text
The system SHALL provide a "Base64 Encode" command that encodes the UTF-8 bytes of each selection (or the whole document when a selection is empty) as standard Base64 with `=` padding, replacing the selection with the result.

#### Scenario: Encode ASCII text
- **WHEN** the selection is `hello` and the user runs "Base64 Encode"
- **THEN** the selection is replaced by `aGVsbG8=`

#### Scenario: Encode non-ASCII text
- **WHEN** the selection contains non-ASCII characters such as `héllo ✓`
- **THEN** the output is the Base64 of the text's UTF-8 bytes

#### Scenario: Multiple selections
- **WHEN** several selections exist and the user runs "Base64 Encode"
- **THEN** each selection is encoded independently

### Requirement: Base64 decode selected text
The system SHALL provide a "Base64 Decode" command that decodes the Base64 in each selection into UTF-8 text, ignoring whitespace and line breaks inside the input, and accepting both standard (`+`, `/`) and URL-safe (`-`, `_`) alphabets, with or without padding.

#### Scenario: Decode valid Base64
- **WHEN** the selection is `aGVsbG8=` and the user runs "Base64 Decode"
- **THEN** the selection is replaced by `hello`

#### Scenario: Decode input wrapped across lines
- **WHEN** the selection is Base64 text split over several lines
- **THEN** the line breaks are ignored and the decoded text is produced

#### Scenario: Decode URL-safe input without padding
- **WHEN** the selection is a URL-safe Base64 string with no trailing `=`
- **THEN** it is decoded correctly

#### Scenario: Encode then decode round trip
- **WHEN** a user encodes a selection and then decodes the result
- **THEN** the text equals the original, including non-ASCII characters

### Requirement: Base64 error handling
The system SHALL show an error message and leave the text unchanged when the selection is not valid Base64 or when the decoded bytes are not valid UTF-8.

#### Scenario: Invalid Base64 characters
- **WHEN** the selection is `not*base64!` and the user runs "Base64 Decode"
- **THEN** an error message is shown and the text is not modified

#### Scenario: Decoded bytes are not UTF-8
- **WHEN** the selection is Base64 of bytes that are not valid UTF-8
- **THEN** an error message is shown and the text is not modified

### Requirement: Undoable edits
The system SHALL apply all Base64 transformations as a single undoable edit.

#### Scenario: Undo an encode
- **WHEN** the user runs "Base64 Encode" and then triggers undo
- **THEN** the original selection text is restored
