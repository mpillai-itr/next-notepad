// Language table. Menu ids (46002-46093) come from the original Language menu (REA: RT_MENU 1500).
// Keyword lists / comment markers / extensions come from the shipped langs.model.xml.
import * as monaco from 'monaco-editor';

export const LANG_BY_MENU_ID = {
  46016: 'normal', 46028: 'actionscript', 46042: 'ada', 46064: 'asn1', 46009: 'asp', 46033: 'asm', 46044: 'autoit', 46065: 'avs',
  46059: 'baanc', 46022: 'batch', 46066: 'blitzbasic', 46002: 'c', 46023: 'cs', 46003: 'cpp', 46040: 'caml', 46048: 'cmake',
  46050: 'cobol', 46069: 'csound', 46056: 'coffeescript', 46010: 'css', 46051: 'd', 46034: 'diff', 46070: 'erlang', 46093: 'errorlist',
  46071: 'escript', 46072: 'forth', 46026: 'fortran', 46058: 'fortran77', 46068: 'freebasic', 46087: 'gdscript', 46089: 'go',
  46052: 'gui4cli', 46046: 'haskell', 46088: 'hollywood', 46005: 'html', 46019: 'ini', 46047: 'inno', 46061: 'ihex', 46004: 'java',
  46007: 'javascript.js', 46057: 'json', 46085: 'json5', 46055: 'jsp', 46041: 'kix', 46073: 'latex', 46031: 'lisp', 46024: 'lua',
  46018: 'makefile', 46045: 'matlab', 46086: 'mssql', 46074: 'mmixal', 46015: 'nfo', 46075: 'nim', 46076: 'nncrontab', 46029: 'nsis',
  46014: 'objc', 46077: 'oscript', 46011: 'pascal', 46013: 'perl', 46008: 'php', 46036: 'postscript', 46053: 'powershell',
  46035: 'props', 46067: 'purebasic', 46012: 'python', 46054: 'r', 46090: 'raku', 46078: 'rebol', 46079: 'registry', 46017: 'rc',
  46037: 'ruby', 46080: 'rust', 46092: 'sas', 46027: 'bash', 46032: 'scheme', 46038: 'smalltalk', 46081: 'spice', 46020: 'sql',
  46063: 'swift', 46060: 'srec', 46030: 'tcl', 46062: 'tehex', 46025: 'tex', 46091: 'toml', 46082: 'txt2tags', 46084: 'typescript',
  46021: 'vb', 46083: 'visualprolog', 46039: 'vhdl', 46043: 'verilog', 46006: 'xml', 46049: 'yaml',
};

// Notepad++ lexer name -> built-in Monaco tokenizer, when Monaco ships one.
const MONACO_BUILTIN = {
  bash: 'shell', batch: 'bat', c: 'c', cpp: 'cpp', cs: 'csharp', css: 'css', go: 'go', html: 'html', ini: 'ini', java: 'java',
  'javascript.js': 'javascript', javascript: 'javascript', json: 'json', json5: 'json', lua: 'lua', objc: 'objective-c', pascal: 'pascal',
  perl: 'perl', php: 'php', powershell: 'powershell', python: 'python', r: 'r', ruby: 'ruby', rust: 'rust', scheme: 'scheme',
  sql: 'sql', mssql: 'sql', swift: 'swift', tcl: 'tcl', typescript: 'typescript', vb: 'vb', xml: 'xml', yaml: 'yaml', coffeescript: 'coffee',
  asp: 'html', jsp: 'html', props: 'ini', gdscript: 'python', raku: 'perl', kix: 'bat', toml: 'ini',
};

export const LANGS = {}; // nppName -> {name, exts, commentLine, commentStart, commentEnd, keywords:{instre1:..}, monaco}
const EXT_MAP = {};

const LABELS = {};
export function labelFor(name) { return LABELS[name] || name; }

function xmlAttr(el, a) { return el.getAttribute(a) || ''; }

export async function loadLanguages() {
  const xml = await window.ngn.file.readData('langs.model.xml');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  for (const el of doc.querySelectorAll('Languages > Language')) {
    const name = xmlAttr(el, 'name');
    const kw = {};
    el.querySelectorAll('Keywords').forEach((k) => { const t = k.textContent.trim(); if (t) kw[xmlAttr(k, 'name')] = t.split(/\s+/); });
    const L = {
      name, exts: xmlAttr(el, 'ext').split(/\s+/).filter(Boolean), commentLine: xmlAttr(el, 'commentLine'),
      commentStart: xmlAttr(el, 'commentStart'), commentEnd: xmlAttr(el, 'commentEnd'), keywords: kw,
      tabSettings: xmlAttr(el, 'tabSettings'),
    };
    L.monaco = registerMonaco(L);
    LANGS[name] = L;
    L.exts.forEach((e) => { (EXT_MAP[e.toLowerCase()] ||= name); });
  }
  EXT_MAP.md ||= 'normal';
  EXT_MAP.ts = 'typescript';
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

function registerMonaco(L) {
  if (L.name === 'normal') return 'plaintext';
  if (MONACO_BUILTIN[L.name]) return MONACO_BUILTIN[L.name];
  // Generate a tokenizer from the language's keyword groups and comment markers.
  const id = 'ngn-' + L.name;
  monaco.languages.register({ id });
  const kw1 = L.keywords.instre1 || [], kw2 = L.keywords.instre2 || [];
  const others = Object.entries(L.keywords).filter(([k]) => /^type|^substyle|^instre/.test(k) && k !== 'instre1' && k !== 'instre2').flatMap(([, v]) => v);
  const ci = ['batch', 'basic', 'vb', 'pascal', 'sql', 'blitzbasic', 'purebasic', 'freebasic', 'asm', 'ada', 'vhdl', 'cobol', 'fortran', 'baanc', 'kix'].some((x) => L.name.includes(x));
  const root = [];
  if (L.commentStart && L.commentEnd) root.push([new RegExp('^' + esc(L.commentStart)), 'comment', '@blockComment']);
  if (L.commentLine) root.push([new RegExp('^' + esc(L.commentLine) + '.*'), 'comment']);
  root.push([/"([^"\\]|\\.)*$/, 'string.invalid']);
  root.push([/"/, 'string', '@dq']);
  root.push([/'/, 'string', '@sq']);
  root.push([/\d+(\.\d+)?([eE][+-]?\d+)?|0[xX][0-9a-fA-F]+/, 'number']);
  root.push([/[a-zA-Z_$][\w$]*/, { cases: { '@kw1': 'keyword', '@kw2': 'type', '@kw3': 'keyword.other', '@default': 'identifier' } }]);
  root.push([/[{}()\[\]]/, '@brackets']);
  root.push([/[-+*/=<>!&|^~%?:;,.#@\\]/, 'operator']);
  const lower = (a) => (ci ? a.map((w) => w.toLowerCase()) : a);
  monaco.languages.setMonarchTokensProvider(id, {
    ignoreCase: ci, kw1: lower(kw1), kw2: lower(kw2), kw3: lower(others),
    tokenizer: {
      root,
      blockComment: [[new RegExp(L.commentEnd ? esc(L.commentEnd) : '$'), 'comment', '@pop'], [/./, 'comment']],
      dq: [[/[^\\"]+/, 'string'], [/\\./, 'string.escape'], [/"/, 'string', '@pop']],
      sq: [[/[^\\']+/, 'string'], [/\\./, 'string.escape'], [/'/, 'string', '@pop']],
    },
  });
  monaco.languages.setLanguageConfiguration(id, {
    comments: { lineComment: L.commentLine || undefined, blockComment: L.commentStart && L.commentEnd ? [L.commentStart, L.commentEnd] : undefined },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']], autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] }],
  });
  return id;
}

export function langForPath(p, firstLine = '') {
  const base = (p || '').split('/').pop().toLowerCase();
  const ext = base.includes('.') ? base.split('.').pop() : base;
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  if (base === 'makefile' || base === 'gnumakefile') return 'makefile';
  if (/^#!.*\b(bash|sh|zsh)\b/.test(firstLine)) return 'bash';
  if (/^#!.*\bpython/.test(firstLine)) return 'python';
  if (/^#!.*\bnode/.test(firstLine)) return 'javascript.js';
  if (/^#!.*\bperl/.test(firstLine)) return 'perl';
  if (/^#!.*\bruby/.test(firstLine)) return 'ruby';
  if (/^<\?xml/.test(firstLine)) return 'xml';
  if (/^<\?php/.test(firstLine)) return 'php';
  if (/^<!doctype html/i.test(firstLine)) return 'html';
  return 'normal';
}

export const monacoIdFor = (name) => (LANGS[name] ? LANGS[name].monaco : 'plaintext');
