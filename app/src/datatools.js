// Pure text transforms behind the "Data Tools" plugin menu (JSON / YAML / Base64). No Monaco or DOM access, so they can be unit-tested directly.
import * as YAML from 'yaml';

const parseJson = (t) => { try { return JSON.parse(t); } catch (e) { throw new Error('Invalid JSON: ' + e.message); } };
const sortDeep = (v) => (Array.isArray(v) ? v.map(sortDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])])) : v);

export const jsonFormat = (t, indent) => JSON.stringify(parseJson(t), null, indent);
export const jsonMinify = (t) => JSON.stringify(parseJson(t));
export const jsonSortKeys = (t) => JSON.stringify(sortDeep(parseJson(t)), null, 2);

// Contents of a JSON string literal, without the surrounding quotes.
export const jsonEscape = (t) => JSON.stringify(t).slice(1, -1);
export const jsonUnescape = (t) => {
  const s = t.trim();
  // Raw line breaks are illegal inside a JSON string, but are common when a selection spans lines, so tolerate them.
  const body = /^"[\s\S]*"$/.test(s) && s.length >= 2 ? s.slice(1, -1) : t;
  try { return JSON.parse('"' + body.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"'); } catch (e) { throw new Error('Invalid escaped JSON string: ' + e.message); }
};

const firstYamlDoc = (t) => {
  const doc = YAML.parseAllDocuments(t)[0];
  if (!doc) return null;
  if (doc.errors.length) throw new Error('Invalid YAML: ' + doc.errors[0].message);
  return doc.toJS();
};
export const jsonToYaml = (t) => YAML.stringify(parseJson(t), { indent: 2 });
export const yamlToJson = (t) => JSON.stringify(firstYamlDoc(t) ?? null, null, 2);
export const yamlSortKeys = (t) => YAML.stringify(firstYamlDoc(t), { indent: 2, sortMapEntries: true });

export const b64Encode = (t) => {
  const bytes = new TextEncoder().encode(t); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
export const b64Decode = (t) => {
  const s = t.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(s)) throw new Error('Input is not valid Base64');
  const raw = s.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  if (raw.length % 4 === 1) throw new Error('Input is not valid Base64 (bad length)');
  const bin = atob(raw + '='.repeat((4 - (raw.length % 4)) % 4));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); } catch (e) { throw new Error('Decoded bytes are not valid UTF-8 text'); }
};
