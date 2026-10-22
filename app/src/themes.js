// Style themes: parses the shipped Notepad++ theme XML files (themes/*.xml, stylers.model.xml)
// into Monaco themes plus CSS variables for the surrounding UI chrome.
import * as monaco from 'monaco-editor';

export const THEME_FILES = {}; // display name -> relative data path
const cache = {};

export async function listThemes() {
  THEME_FILES['Default (stylers.xml)'] = 'stylers.model.xml';
  const files = await window.ngn.file.listData('themes');
  files.filter((f) => f.endsWith('.xml')).sort((a, b) => a.localeCompare(b)).forEach((f) => { THEME_FILES[f.replace(/\.xml$/, '')] = 'themes/' + f; });
  return Object.keys(THEME_FILES);
}

const hex = (c) => (c ? '#' + c.toUpperCase() : undefined);
const fs2 = (n) => ({ 1: 'bold', 2: 'italic', 3: 'bold italic', 4: 'underline' }[parseInt(n, 10)] || '');

function lexerStyle(doc, lexer, name) {
  const lx = [...doc.querySelectorAll('LexerType')].find((l) => l.getAttribute('name') === lexer);
  if (!lx) return null;
  const w = [...lx.querySelectorAll('WordsStyle')].find((s) => s.getAttribute('name') === name);
  return w ? { fg: w.getAttribute('fgColor'), fs: w.getAttribute('fontStyle') } : null;
}

export async function parseTheme(name) {
  if (cache[name]) return cache[name];
  const xml = await window.ngn.file.readData(THEME_FILES[name]);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const g = {};
  doc.querySelectorAll('GlobalStyles > WidgetStyle').forEach((w) => { g[w.getAttribute('name')] = { fg: w.getAttribute('fgColor'), bg: w.getAttribute('bgColor'), font: w.getAttribute('fontName'), fs: w.getAttribute('fontStyle'), size: w.getAttribute('fontSize') }; });
  const def = g['Default Style'] || { fg: '000000', bg: 'FFFFFF' };
  const bg = def.bg || 'FFFFFF', fg = def.fg || '000000';
  const lum = (h) => { const n = parseInt(h, 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)); };
  const dark = lum(bg) < 110;
  const pick = (lex, nm, fallback) => lexerStyle(doc, lex, nm) || lexerStyle(doc, 'cpp', nm) || lexerStyle(doc, 'c', nm) || { fg: fallback, fs: '0' };
  const kw = pick('cpp', 'INSTRUCTION WORD', fg), ty = pick('cpp', 'TYPE WORD', fg), num = pick('cpp', 'NUMBER', fg), str = pick('cpp', 'STRING', fg),
    op = pick('cpp', 'OPERATOR', fg), cm = pick('cpp', 'COMMENT LINE', fg), pre = pick('cpp', 'PREPROCESSOR', fg);
  const tag = lexerStyle(doc, 'xml', 'XMLSTART') || kw, attr = lexerStyle(doc, 'xml', 'ATTRIBUTE') || ty, val = lexerStyle(doc, 'xml', 'DOUBLESTRING') || str;
  const rules = [
    ['', fg], ['comment', cm], ['keyword', kw], ['keyword.other', ty], ['type', ty], ['type.identifier', ty], ['number', num], ['number.hex', num],
    ['string', str], ['string.escape', str], ['string.invalid', str], ['operator', op], ['delimiter', op], ['delimiter.bracket', op],
    ['tag', tag], ['metatag', pre], ['attribute.name', attr], ['attribute.value', val], ['regexp', str], ['predefined', ty], ['annotation', pre], ['variable', fg],
    ['constant', num], ['identifier', fg],
  ].map(([token, s]) => ({ token, foreground: (s.fg || s || fg).toString().replace('#', ''), fontStyle: s.fs ? fs2(s.fs) : '' }));
  const colors = {
    'editor.background': hex(bg), 'editor.foreground': hex(fg),
    'editor.lineHighlightBackground': hex(g['Current line background colour']?.bg || bg),
    'editor.selectionBackground': hex(g['Selected text colour']?.bg || (dark ? '49483E' : 'C0C0C0')),
    'editor.inactiveSelectionBackground': hex(g['Selected text colour']?.bg || (dark ? '49483E' : 'C0C0C0')) + '88',
    'editorCursor.foreground': hex(g['Caret colour']?.fg || fg),
    'editorLineNumber.foreground': hex(g['Line number margin']?.fg || '808080'), 'editorLineNumber.activeForeground': hex(fg),
    'editorGutter.background': hex(g['Line number margin']?.bg || bg),
    'editorIndentGuide.background1': hex(g['Indent guideline style']?.fg || '888888') + '55',
    'editorWhitespace.foreground': hex(g['White space symbol']?.fg || '888888'),
    'editorBracketMatch.background': hex(g['Brace highlight style']?.fg || 'FCE94F') + '44',
    'editorBracketMatch.border': hex(g['Brace highlight style']?.fg || 'FCE94F'),
    'minimap.background': hex(g['Document map']?.bg || bg),
  };
  Object.keys(colors).forEach((k) => { if (!colors[k] || colors[k].includes('undefined')) delete colors[k]; });
  const t = {
    name, dark, bg, fg, font: def.font || '', size: parseInt(def.size, 10) || 10, g,
    monaco: { base: dark ? 'vs-dark' : 'vs', inherit: false, rules, colors },
    css: {
      '--ed-bg': hex(bg), '--ed-fg': hex(fg), '--margin-bg': hex(g['Line number margin']?.bg || bg), '--margin-fg': hex(g['Line number margin']?.fg || '808080'),
      '--bookmark': '#2a6fd6', '--mark1': hex(g['Mark Style 1']?.bg || '00FFFF'), '--mark2': hex(g['Mark Style 2']?.bg || 'FF8000'),
      '--mark3': hex(g['Mark Style 3']?.bg || 'FFFF00'), '--mark4': hex(g['Mark Style 4']?.bg || '8000FF'), '--mark5': hex(g['Mark Style 5']?.bg || '008000'),
      '--find-mark': hex(g['Find Mark Style']?.bg || 'FF0000'), '--smart-hl': hex(g['Smart Highlighting']?.bg || '00FF00'),
      '--inc-hl': hex(g['Incremental highlight all']?.bg || '0080FF'), '--tag-hl': hex(g['Tags match highlighting']?.bg || '8000FF'),
      '--tag-attr': hex(g['Tags attribute']?.bg || 'FFFF00'),
      '--ch-modified': hex(g['Change History modified']?.bg || 'FF8000'), '--ch-saved': hex(g['Change History saved']?.bg || '00A000'),
      '--ch-revert': hex(g['Change History revert modified']?.bg || 'A0C000'), '--ch-origin': hex(g['Change History revert origin']?.bg || '40A0BF'),
      '--eol-color': hex(g['EOL custom color']?.fg || '808080'),
      '--tab-active-bar': hex(g['Active tab focused indicator']?.fg || 'FAAA3C'),
      '--tabc1': hex(g[dark ? 'Tab color dark mode 1' : 'Tab color 1']?.bg || 'F3F0CB'), '--tabc2': hex(g[dark ? 'Tab color dark mode 2' : 'Tab color 2']?.bg || 'DBF3CB'),
      '--tabc3': hex(g[dark ? 'Tab color dark mode 3' : 'Tab color 3']?.bg || 'CBDBF3'), '--tabc4': hex(g[dark ? 'Tab color dark mode 4' : 'Tab color 4']?.bg || 'F3DBCB'),
      '--tabc5': hex(g[dark ? 'Tab color dark mode 5' : 'Tab color 5']?.bg || 'F3CBEE'),
    },
  };
  cache[name] = t;
  return t;
}

export async function applyTheme(name) {
  const t = await parseTheme(name);
  const id = 'ngn-' + name.replace(/[^a-zA-Z0-9]+/g, '-');
  monaco.editor.defineTheme(id, t.monaco);
  monaco.editor.setTheme(id);
  const root = document.documentElement.style;
  Object.entries(t.css).forEach(([k, v]) => root.setProperty(k, v));
  return t;
}
