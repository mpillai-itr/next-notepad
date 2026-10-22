// Editor effects: EOL symbols, auto-completion providers (from autoCompletion/*.xml), tag highlighting,
// clickable links, tab/language popups, and the native-menu checkmark sync.
import { monaco, activateDoc, renderTabs, isDirty, docEol, setLanguage, saveDoc, closeDoc, closeMany } from './core.js';
import { S, NGN, curEd, curDoc, curView } from './state.js';
import { LANGS, LANG_BY_MENU_ID, labelFor } from './languages.js';

const { el, $ } = NGN;
const ngn = window.ngn;

// ---- language display names (from the original Language menu) --------------------------------------------------
const LANG_LABEL = {};
NGN.initLangLabels = (menuTree) => {
  const walk = (list) => list.forEach((n) => { if (n.children) walk(n.children); else if (n.id && LANG_BY_MENU_ID[n.id] && !LANG_LABEL[LANG_BY_MENU_ID[n.id]]) LANG_LABEL[LANG_BY_MENU_ID[n.id]] = n.label; });
  const lang = menuTree.find((m) => m.label === 'Language'); if (lang) walk(lang.children);
};
NGN.langDisplay = (name) => LANG_LABEL[name] || name;
NGN.showLanguagePopup = (x, y) => {
  const names = Object.keys(LANG_BY_MENU_ID).map((id) => ({ id: +id, name: LANG_BY_MENU_ID[id] })).filter((l) => !S.prefs.langDisabled.includes(l.name));
  const sorted = names.sort((a, b) => (a.name === 'normal' ? -1 : b.name === 'normal' ? 1 : NGN.langDisplay(a.name).localeCompare(NGN.langDisplay(b.name))));
  NGN.popup(sorted.slice(0, 40).map((l) => ({ label: NGN.langDisplay(l.name), checked: curDoc()?.lang === l.name, fn: () => NGN.runCommand(l.id) })).concat([{ sep: true }, { label: 'More… (use Language menu)', disabled: true }]), x, Math.max(10, y));
};

// ---- tab context menu -------------------------------------------------------------------------------------------------
NGN.showTabMenu = (x, y, d) => {
  const run = (id) => () => { activateDoc(d.id); NGN.runCommand(id); };
  NGN.popup([
    { label: 'Close', fn: () => closeDoc(d) }, { label: 'Close All but This', fn: run(41005) }, { label: 'Close All to the Left', fn: run(41009) }, { label: 'Close All to the Right', fn: run(41018) }, { label: 'Close All Unchanged', fn: run(41024) },
    { sep: true }, { label: 'Save', fn: () => saveDoc(d) }, { label: 'Save As…', fn: run(41008) }, { label: 'Rename…', fn: run(41017) }, { label: 'Move to Trash', fn: run(41016), disabled: !d.path }, { label: 'Reload from Disk', fn: run(41014), disabled: !d.path }, { label: 'Print…', fn: run(41010) },
    { sep: true }, { label: 'Open Containing Folder in Finder', fn: run(41019), disabled: !d.path }, { label: 'Open in Terminal', fn: run(41020), disabled: !d.path }, { label: 'Open Folder as Workspace', fn: run(41025), disabled: !d.path },
    { sep: true }, { label: 'Read-Only', checked: d.readOnly, fn: run(42028) }, { label: d.pinned ? 'Unpin Tab' : 'Pin Tab', fn: () => { d.pinned = !d.pinned; renderTabs(S.views[d.view]); } },
    { label: 'Apply Color', children: [1, 2, 3, 4, 5].map((n) => ({ label: 'Color ' + n, fn: () => { d.color = n; renderTabs(S.views[d.view]); } })).concat([{ label: 'Remove Color', fn: () => { d.color = 0; renderTabs(S.views[d.view]); } }]) },
    { sep: true }, { label: 'Move to Other View', fn: run(10001) }, { label: 'Clone to Other View', fn: run(10002) }, { label: 'Move to New Instance', fn: run(10003) }, { label: 'Open in New Instance', fn: run(10004) },
    { sep: true }, { label: 'Copy Full Path', fn: run(42029) }, { label: 'Copy Filename', fn: run(42030) }, { label: 'Copy Directory Path', fn: run(42031) }], x, y);
};

// ---- EOL markers (View ▸ Show Symbol ▸ Show End of Line) ----------------------------------------------------------------------
let eolT;
function applyEol(doc) {
  const m = doc.model; if (!S.prefs.eolVisible) { if (doc.eolDeco?.length) doc.eolDeco = m.deltaDecorations(doc.eolDeco, []); return; }
  const n = m.getLineCount(); if (n > 20000) return; const label = docEol(doc) === 'CRLF' ? 'CRLF' : docEol(doc) === 'CR' ? 'CR' : 'LF';
  const decs = []; for (let i = 1; i <= n; i++) { const c = m.getLineMaxColumn(i); decs.push({ range: new monaco.Range(i, c, i, c), options: { after: { content: i === n ? '' : label, inlineClassName: 'eol-mark' }, showIfCollapsed: true } }); }
  doc.eolDeco = m.deltaDecorations(doc.eolDeco || [], decs);
}
NGN.refreshEolMarks = () => { for (const d of S.docs.values()) applyEol(d); };
NGN.scheduleEolMarks = (doc) => { if (!S.prefs.eolVisible) return; clearTimeout(eolT); eolT = setTimeout(() => applyEol(doc), 150); };

// ---- auto-completion from autoCompletion/<lang>.xml ------------------------------------------------------------------------------------------------
const acCache = {};
async function loadAC(lang) {
  if (acCache[lang] !== undefined) return acCache[lang];
  const file = { 'javascript.js': 'javascript', bash: null, cs: 'cs', mssql: 'sql', batch: 'batch', props: null }[lang] ?? lang;
  if (!file) return (acCache[lang] = null);
  try {
    const xml = await ngn.file.readData(`autoCompletion/${file}.xml`); const doc = new DOMParser().parseFromString(xml, 'text/xml'); const items = [];
    doc.querySelectorAll('KeyWord').forEach((k) => { const ov = k.querySelector('Overload'); const params = [...k.querySelectorAll('Param')].map((p) => p.getAttribute('name')); items.push({ name: k.getAttribute('name'), func: k.getAttribute('func') === 'yes', ret: ov?.getAttribute('retVal') || '', descr: ov?.getAttribute('descr') || '', params }); });
    const env = doc.querySelector('Environment'); return (acCache[lang] = { items, ci: env?.getAttribute('ignoreCase') === 'yes' });
  } catch { return (acCache[lang] = null); }
}
function registerAC() {
  monaco.languages.registerCompletionItemProvider('*', {
    triggerCharacters: [], async provideCompletionItems(model, pos) {
      const d = [...S.docs.values()].find((x) => x.model === model); if (!d) return { suggestions: [] };
      if (!S.prefs.acEnable && !S.acForce) return { suggestions: [] };
      const mode = S.acForce || S.prefs.acMode; S.acForce = null;
      const w = model.getWordUntilPosition(pos); if (w.word.length < (S.prefs.acFromNth || 1) && mode !== 'function' && !S.manualAC) return { suggestions: [] };
      const range = new monaco.Range(pos.lineNumber, w.startColumn, pos.lineNumber, w.endColumn);
      const out = []; const ac = await loadAC(d.lang);
      if (ac && mode !== 'word') ac.items.forEach((i) => { if (S.prefs.acIgnoreNumbers && /^\d/.test(i.name)) return; out.push({ label: S.prefs.acBrief ? i.name : (i.func && i.params.length ? `${i.name}(${i.params.join(', ')})` : i.name), insertText: i.name + (i.func ? '(' : ''), kind: i.func ? monaco.languages.CompletionItemKind.Function : monaco.languages.CompletionItemKind.Keyword, detail: i.ret, documentation: i.descr, range, filterText: i.name }); });
      if (mode !== 'function') { const seen = new Set(out.map((o) => o.insertText)); const text = model.getValue(); (text.match(/[\p{L}_][\p{L}\p{N}_]{2,}/gu) || []).forEach((t) => { if (!seen.has(t) && t !== w.word) { seen.add(t); out.push({ label: t, insertText: t, kind: monaco.languages.CompletionItemKind.Text, range }); } }); }
      return { suggestions: out };
    },
  });
  monaco.languages.registerSignatureHelpProvider('*', {
    signatureHelpTriggerCharacters: ['(', ','], async provideSignatureHelp(model, pos) {
      if (!S.prefs.acParamHint) return null; const d = [...S.docs.values()].find((x) => x.model === model); const ac = d && await loadAC(d.lang); if (!ac) return null;
      const line = model.getLineContent(pos.lineNumber).slice(0, pos.column - 1); let depth = 0, i = line.length - 1, commas = 0; for (; i >= 0; i--) { const c = line[i]; if (c === ')') depth++; else if (c === '(') { if (depth === 0) break; depth--; } else if (c === ',' && depth === 0) commas++; } if (i < 0) return null;
      const name = (line.slice(0, i).match(/([\w.$]+)\s*$/) || [])[1]; if (!name) return null; const it = ac.items.find((x) => x.name === name || x.name === name.split('.').pop()); if (!it) return null;
      return { value: { signatures: [{ label: `${it.name}(${it.params.join(', ')})${it.ret ? ' → ' + it.ret : ''}`, documentation: it.descr, parameters: it.params.map((p) => ({ label: p })) }], activeSignature: 0, activeParameter: Math.min(commas, Math.max(0, it.params.length - 1)) }, dispose() {} };
    },
  });
}

// close-tag auto insert for HTML/XML ("Auto-Insert html/xml close tag")
function wireCloseTag() {
  const each = (fn) => { S.views.forEach((v) => v.ed && fn(v.ed)); monaco.editor.onDidCreateEditor(fn); };
  each((ed) => ed.onDidType((t) => {
    if (t !== '>' || !S.prefs.acCloseHtml) return; const d = curDoc(); if (!d || !['html', 'xml', 'asp', 'jsp', 'php'].includes(d.lang)) return;
    const m = ed.getModel(), p = ed.getPosition(); const before = m.getLineContent(p.lineNumber).slice(0, p.column - 1); const mt = before.match(/<([A-Za-z][\w:-]*)(?:\s[^<>]*)?>$/); if (!mt || /\/>$/.test(before)) return;
    if (['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(mt[1].toLowerCase())) return;
    ed.executeEdits('close-tag', [{ range: new monaco.Range(p.lineNumber, p.column, p.lineNumber, p.column), text: `</${mt[1]}>` }]); ed.setPosition(p);
  }));
}

// matching tag highlight (Highlight Matching Tags)
function wireTagHighlight() {
  const each = (fn) => { S.views.forEach((v) => v.ed && fn(v.ed)); monaco.editor.onDidCreateEditor(fn); };
  each((ed) => {
    let ids = [];
    const upd = () => {
      const d = curDoc(); const m = ed.getModel(); if (!m) return; if (!S.prefs.tagHl || !d || !['html', 'xml', 'asp', 'jsp', 'php'].includes(d.lang)) { ids = ed.deltaDecorations(ids, []); return; }
      const text = m.getValue(monaco.editor.EndOfLinePreference.LF); if (text.length > 800000) return; const off = m.getOffsetAt(ed.getPosition()) - (m.getEOL() === '\r\n' ? ed.getPosition().lineNumber - 1 : 0);
      const re = /<(\/?)([A-Za-z][\w:.-]*)(\s[^<>]*?)?(\/?)>/g; const stack = []; const pairs = []; let mt;
      while ((mt = re.exec(text))) { if (mt[4] === '/' || /^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)$/i.test(mt[2])) continue; if (!mt[1]) stack.push({ name: mt[2], s: mt.index, e: mt.index + mt[0].length }); else { let i = stack.length - 1; while (i >= 0 && stack[i].name !== mt[2]) i--; if (i >= 0) { pairs.push([stack[i], { s: mt.index, e: mt.index + mt[0].length }]); stack.length = i; } } }
      const hit = pairs.filter(([a, b]) => (off >= a.s && off <= a.e) || (off >= b.s && off <= b.e)).sort((x, y) => (x[1].e - x[0].s) - (y[1].e - y[0].s))[0];
      const ix = []; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) ix.push(i + 1);
      const pos = (o) => { let lo = 0, hi = ix.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ix[mid] <= o) lo = mid + 1; else hi = mid; } return { l: lo + 1, c: o - (lo ? ix[lo - 1] : 0) + 1 }; };
      const decs = hit ? hit.map((t) => { const a = pos(t.s), b = pos(t.e); return { range: new monaco.Range(a.l, a.c, b.l, b.c), options: { inlineClassName: 'tag-hl' } }; }) : [];
      ids = ed.deltaDecorations(ids, decs);
    };
    let t; ed.onDidChangeCursorPosition(() => { clearTimeout(t); t = setTimeout(upd, 120); });
  });
}

// clickable links (Ctrl/Cmd+click)
NGN.openLinkAt = (ed, pos) => {
  if (!pos) return; const line = ed.getModel().getLineContent(pos.lineNumber); const re = new RegExp(`(?:${S.prefs.linkSchemes.split(/\s+/).filter(Boolean).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[^\\s<>"')]+`, 'g'); let m;
  while ((m = re.exec(line))) if (pos.column - 1 >= m.index && pos.column - 1 <= m.index + m[0].length) { ngn.file.openUrl(m[0]); return; }
};

// ---- menu checkmarks / enabled state ---------------------------------------------------------------------------------------------------------------
NGN.syncMenuState = () => {
  const d = curDoc(); if (!d) return; const p = S.prefs; const eol = docEol(d);
  const st = {
    44022: { checked: p.wordWrap }, 44025: { checked: p.whitespace }, 44026: { checked: p.eolVisible }, 44019: { checked: p.allChars }, 44020: { checked: p.indentGuide }, 44041: { checked: !!p.wrapSymbol }, 44131: { checked: p.ctrlChars }, 44130: { checked: false },
    44034: { checked: false }, 44032: { checked: false }, 44011: { checked: document.body.classList.contains('distraction') }, 44009: { checked: document.body.classList.contains('postit') },
    44080: { checked: !!p.panels.docMap }, 44070: { checked: NGN.panelOpen('doclist') }, 44084: { checked: NGN.panelOpen('funclist') }, 44085: { checked: NGN.panelOpen('workspace') }, 44081: { checked: NGN.panelOpen('project1') }, 44082: { checked: NGN.panelOpen('project2') }, 44083: { checked: NGN.panelOpen('project3') },
    44097: { checked: !!d.monitoring }, 42028: { checked: !!d.readOnly }, 42102: { checked: S.readOnlyAll }, 42033: { checked: !!d.roAttr }, 44035: { checked: S.syncV }, 44036: { checked: S.syncH }, 44072: { enabled: S.split }, 44042: { checked: false },
    45001: { checked: eol === 'CRLF' }, 45002: { checked: eol === 'LF' }, 45003: { checked: eol === 'CR' },
    45004: { checked: d.enc === 'ansi' }, 45008: { checked: d.enc === 'utf8' }, 45005: { checked: d.enc === 'utf8-bom' }, 45006: { checked: d.enc === 'utf16be-bom' }, 45007: { checked: d.enc === 'utf16le-bom' },
    41014: { enabled: !!d.path }, 41016: { enabled: !!d.path }, 41017: { enabled: true }, 41019: { enabled: !!d.path }, 41020: { enabled: !!d.path }, 41023: { enabled: !!d.path }, 41025: { enabled: !!d.path },
  };
  for (const [id, name] of Object.entries(LANG_BY_MENU_ID)) st[id] = { checked: d.lang === name };
  ngn.win.setMenuState(st);
  [[44022, p.wordWrap], [44019, p.allChars], [44020, p.indentGuide], [44080, p.panels.docMap], [44070, NGN.panelOpen('doclist')], [44084, NGN.panelOpen('funclist')], [44085, NGN.panelOpen('workspace')], [44035, S.syncV], [44036, S.syncH], [44097, d.monitoring]].forEach(([id, on]) => NGN.tbState(id, on));
};

NGN.initFx = () => { registerAC(); wireCloseTag(); wireTagHighlight(); };
