// Core: Monaco editors, documents, tabs, status bar, file operations, sessions.
import * as monaco from 'monaco-editor';
import { S, NGN, curView, curEd, curDoc, DEFAULT_PREFS } from './state.js';
import { LANGS, langForPath, monacoIdFor, labelFor } from './languages.js';

export { monaco };
const ngn = window.ngn;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'text') e.textContent = v; else if (v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
};
NGN.el = el; NGN.$ = $;

// ---- tiny event bus -------------------------------------------------------------
const handlers = {};
NGN.on = (ev, fn) => { (handlers[ev] ||= []).push(fn); };
NGN.emit = (ev, ...a) => (handlers[ev] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(ev, e); } });

let toastT;
NGN.toast = (msg, ms = 2200) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); };

// ---- Monaco environment -----------------------------------------------------------
self.MonacoEnvironment = {
  getWorkerUrl(_id, label) {
    const w = { json: 'json', css: 'css', scss: 'css', less: 'css', html: 'html', handlebars: 'html', razor: 'html', typescript: 'ts', javascript: 'ts' }[label] || 'editor';
    return `app://host/dist/${w}.worker.js`;
  },
};
try {
  for (const ns of [monaco.languages.typescript, monaco.typescript]) {
    if (!ns) continue;
    const o = { noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true };
    ns.javascriptDefaults?.setDiagnosticsOptions(o); ns.typescriptDefaults?.setDiagnosticsOptions(o);
  }
  (monaco.languages.json || monaco.json)?.jsonDefaults.setDiagnosticsOptions({ validate: false });
} catch (e) { console.warn('diagnostics setup', e); }

// ---- editor options from prefs -----------------------------------------------------------
export function editorOptions() {
  const p = S.prefs;
  const fontSize = Math.max(6, Math.min(60, p.fontSize + (p.zoom || 0)));
  return {
    fontFamily: p.fontName ? `"${p.fontName}", Menlo, monospace` : 'Menlo, "SF Mono", Monaco, "DejaVu Sans Mono", monospace',
    fontSize, lineHeight: Math.round(fontSize * 1.45), tabSize: p.tabSize, insertSpaces: !p.useTabs, detectIndentation: false,
    wordWrap: p.wordWrap ? 'on' : 'off', wrappingIndent: { aligned: 'same', indent: 'indent', default: 'none' }[p.wrapIndent] || 'same',
    renderWhitespace: p.allChars || p.whitespace ? 'all' : 'none', renderControlCharacters: !!(p.allChars || p.ctrlChars),
    guides: { indentation: !!p.indentGuide, bracketPairs: false }, lineNumbers: p.lineNumbers ? 'on' : 'off',
    lineNumbersMinChars: p.lineNumDynamic ? 3 : 6, glyphMargin: !!p.bookmarkMargin, folding: true,
    foldingHighlight: false, showFoldingControls: 'always',
    cursorWidth: p.caretWidth, cursorBlinking: p.caretBlink > 0 ? 'blink' : 'solid',
    renderLineHighlight: p.curLine === 'none' ? 'none' : p.curLine === 'frame' ? 'all' : 'line',
    fontLigatures: false, smoothScrolling: !!p.smoothFont, scrollBeyondLastLine: !!p.scrollBeyondLast,
    multiCursorModifier: 'ctrlCmd', multiCursorPaste: 'full', columnSelection: false,
    rulers: p.edge === 'line' ? [p.edgeColumn] : [], minimap: { enabled: !!p.panels.docMap, renderCharacters: false, showSlider: 'always', size: 'proportional', maxColumn: 120 },
    quickSuggestions: p.acEnable && p.acMode !== 'function', suggestOnTriggerCharacters: !!p.acEnable, wordBasedSuggestions: p.acMode === 'function' ? 'off' : 'currentDocument',
    parameterHints: { enabled: !!p.acParamHint }, tabCompletion: p.acInsert === 'tab' ? 'on' : 'off', acceptSuggestionOnEnter: p.acInsert === 'enter' ? 'on' : 'off',
    autoClosingBrackets: p.acPairs.paren || p.acPairs.bracket || p.acPairs.brace ? 'always' : 'never', autoClosingQuotes: p.acPairs.dquote || p.acPairs.squote ? 'always' : 'never',
    autoClosingOvertype: 'always', autoIndent: p.autoIndent === 'none' ? 'none' : p.autoIndent === 'basic' ? 'keep' : 'full',
    matchBrackets: 'always', occurrencesHighlight: p.smartHl ? 'singleFile' : 'off', selectionHighlight: !!p.smartHl,
    links: !!p.clickableLinks, contextmenu: false, unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false },
    stickyScroll: { enabled: false }, bracketPairColorization: { enabled: false }, dragAndDrop: true, mouseWheelZoom: false, copyWithSyntaxHighlighting: false,
    accessibilitySupport: 'off', padding: { top: 2 }, overviewRulerBorder: false, hideCursorInOverviewRuler: true, emptySelectionClipboard: !!p.copyLineNoSel,
    useTabStops: !!p.backspaceUnindent, wordSeparators: p.wordChars ? '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?'.split('').filter((c) => !p.wordChars.includes(c)).join('') : '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?', scrollbar: { useShadows: false, verticalScrollbarSize: 12, horizontalScrollbarSize: 12 }, fixedOverflowWidgets: true,
    'semanticHighlighting.enabled': false, renderFinalNewline: 'on', trimAutoWhitespace: false, readOnly: false,
  };
}
NGN.applyEditorOptions = () => { S.views.forEach((v) => v.ed && v.ed.updateOptions(editorOptions())); NGN.refreshEolMarks?.(); };

function createEditor(view) {
  const ed = monaco.editor.create(view.hostEl, { model: null, automaticLayout: true, ...editorOptions() });
  view.ed = ed;
  ed.onDidFocusEditorText(() => { if (S.cur !== view.idx) { S.cur = view.idx; onActiveChanged(); } });
  ed.onDidChangeCursorSelection(() => { if (S.cur === view.idx) updateStatus(); NGN.emit('selection', view.idx); });
  ed.onDidScrollChange((e) => {
    if (S.cur !== view.idx || !S.split) return;
    const other = S.views[1 - view.idx].ed; if (!other) return;
    if (S.syncV && e.scrollTopChanged) other.setScrollTop(e.scrollTop);
    if (S.syncH && e.scrollLeftChanged) other.setScrollLeft(e.scrollLeft);
  });
  ed.onContextMenu((e) => { e.event.preventDefault(); NGN.showContextMenu?.(e.event.posx, e.event.posy, e.event.browserEvent); });
  ed.onMouseDown((e) => {
    // Ctrl/Cmd+click opens links under the cursor (Clickable Link Settings).
    if (e.event.leftButton && (e.event.ctrlKey || e.event.metaKey) && S.prefs.clickableLinks) NGN.openLinkAt?.(ed, e.target.position);
  });
  ed.onDidType((t) => NGN.macroType?.(t));
  ed.onKeyDown((e) => NGN.macroKey?.(e));
  return ed;
}

// ---- documents --------------------------------------------------------------------------
const EOL_NAMES = { CRLF: 'Windows (CR LF)', LF: 'Unix (LF)', CR: 'Macintosh (CR)' };
NGN.EOL_NAMES = EOL_NAMES;
const ENC_NAMES = { ansi: 'ANSI', utf8: 'UTF-8', 'utf8-bom': 'UTF-8-BOM', 'utf16be-bom': 'UTF-16 BE BOM', 'utf16le-bom': 'UTF-16 LE BOM' };
export const encLabel = (e) => ENC_NAMES[e] || (e.startsWith('cs:') ? e.slice(3).toUpperCase() : e.toUpperCase());
NGN.encLabel = encLabel;

export function createDoc({ path = null, name = null, text = '', enc, eol, lang, readOnly = false, mtime = 0, view = S.cur, activate = true, forceDirty = false, id } = {}) {
  enc = enc || S.prefs.newEncoding;
  let useEol = eol;
  if (!useEol) {
    if (/\r\n/.test(text)) useEol = 'CRLF'; else if (/\r/.test(text)) useEol = 'CR'; else if (/\n/.test(text)) useEol = 'LF'; else useEol = S.prefs.newEOL;
  }
  if (useEol === 'CR') text = text.replace(/\r/g, '\n');
  const first = text.slice(0, 200).split(/\r?\n/)[0];
  lang = lang || (path ? langForPath(path, first) : S.prefs.newLang);
  const big = S.prefs.largeFile && text.length > S.prefs.largeFileMB * 1024 * 1024;
  const model = monaco.editor.createModel(text, big ? 'plaintext' : monacoIdFor(lang));
  model.setEOL(useEol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
  const doc = {
    id: id || S.nextId++, path, name: name || (path ? path.split('/').pop() : null), model, enc, crOnly: useEol === 'CR', lang, readOnly, roAttr: false, pinned: false, color: 0,
    mtime, savedVer: model.getAlternativeVersionId(), forceDirty, bookmarks: [], marks: { 1: [], 2: [], 3: [], 4: [], 5: [] }, ch: new Map(), chDeco: [],
    viewState: null, view, big, untitledNo: 0, hiddenAreas: [], monitoring: false, created: Date.now(),
  };
  if (!doc.name) { doc.untitledNo = ++S.untitledN; doc.name = 'new ' + doc.untitledNo; }
  S.docs.set(doc.id, doc);
  S.views[view].order.push(doc.id);
  model.onDidChangeContent((e) => onModelChanged(doc, e));
  if (activate) activateDoc(doc.id);
  else renderTabs(S.views[view]);
  return doc;
}

export const docEol = (doc) => (doc.crOnly ? 'CR' : doc.model.getEOL() === '\r\n' ? 'CRLF' : 'LF');
export const isDirty = (doc) => doc.forceDirty || doc.model.getAlternativeVersionId() !== doc.savedVer;
export const docText = (doc) => { const t = doc.model.getValue(); return doc.crOnly ? t.replace(/\n/g, '\r') : t; };
NGN.docEol = docEol; NGN.isDirty = isDirty; NGN.docText = docText;

function onModelChanged(doc, e) {
  // Change History margin: mark touched lines as "modified" until the next save.
  if (S.prefs.changeHistory !== 'none' && !e.isFlush && doc.ch.size < 4000) {
    const adds = [];
    for (const c of e.changes) {
      const start = c.range.startLineNumber; const end = start + (c.text.match(/\n/g) || []).length;
      adds.push({ range: new monaco.Range(start, 1, end, 1), options: { isWholeLine: true, linesDecorationsClassName: 'ch-modified', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } });
    }
    const ids = doc.model.deltaDecorations([], adds);
    ids.forEach((id) => doc.ch.set(id, 'm'));
  }
  if (doc.crOnly === undefined) doc.crOnly = false;
  updateTab(doc);
  if (S.cur === doc.view && S.views[doc.view].active === doc.id) { updateStatus(); NGN.emit('content', doc); }
  scheduleSessionSnapshot();
  NGN.scheduleEolMarks?.(doc);
}

NGN.markSaved = (doc) => {
  const model = doc.model;
  for (const [id, kind] of [...doc.ch]) {
    if (kind !== 'm') continue;
    const r = model.getDecorationRange(id); model.deltaDecorations([id], []); doc.ch.delete(id);
    if (r) { const nid = model.deltaDecorations([], [{ range: r, options: { isWholeLine: true, linesDecorationsClassName: 'ch-saved', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } }])[0]; doc.ch.set(nid, 's'); }
  }
};

NGN.clearChangeHistory = (doc) => { doc.model.deltaDecorations([...doc.ch.keys()], []); doc.ch.clear(); };

// ---- activation / tabs ----------------------------------------------------------------------
export function activateDoc(id, { focus = true } = {}) {
  const doc = S.docs.get(id); if (!doc) return;
  const view = S.views[doc.view];
  if (doc.view === 1 && !S.split) showSecondView(true);
  const prev = view.active && S.docs.get(view.active);
  if (prev && prev !== doc) prev.viewState = view.ed.saveViewState();
  view.active = id; S.cur = doc.view;
  view.ed.setModel(doc.model);
  if (doc.viewState) view.ed.restoreViewState(doc.viewState);
  view.ed.updateOptions({ readOnly: doc.readOnly || S.readOnlyAll || !!doc.roForced, ...(doc.big ? { wordWrap: 'off', occurrencesHighlight: 'off' } : { wordWrap: S.prefs.wordWrap ? 'on' : 'off' }) });
  applyLangConfig(doc);
  renderTabs(view);
  onActiveChanged();
  if (focus) view.ed.focus();
}

function applyLangConfig(doc) {
  const L = LANGS[doc.lang];
  if (L?.tabSettings) { /* tabSettings="132": width 4 + space flag; applied below */ const w = parseInt(L.tabSettings[1] || '4', 10); const sp = L.tabSettings[2] === '2' || L.tabSettings === '132'; doc.model.updateOptions({ tabSize: w || S.prefs.tabSize, insertSpaces: sp }); } else doc.model.updateOptions({ tabSize: S.prefs.tabSize, insertSpaces: !S.prefs.useTabs });
}

export function onActiveChanged() {
  const doc = curDoc();
  updateStatus(); updateTitle(); NGN.syncMenuState?.(); NGN.emit('doc-activated', doc);
  S.views.forEach((v) => v.hostEl.parentElement.style.outline = '');
}

export function setLanguage(doc, name) {
  doc.lang = name;
  monaco.editor.setModelLanguage(doc.model, monacoIdFor(name));
  applyLangConfig(doc);
  updateStatus(); NGN.emit('lang-changed', doc);
}
NGN.setLanguage = setLanguage;

function tabLabel(doc) {
  const max = S.prefs.tabMaxLabel || 40; let n = doc.name;
  if (S.prefs.tabReduce) n = n.length > 14 ? n.slice(0, 13) + '…' : n;
  if (n.length > max) n = n.slice(0, max - 1) + '…';
  return n;
}

export function renderTabs(view) {
  const bar = view.tabsEl; bar.innerHTML = '';
  const p = S.prefs;
  bar.classList.toggle('multiline', !!p.tabMultiline); bar.classList.toggle('vertical', !!p.tabVertical); bar.classList.toggle('nobar', !p.tabActiveBar);
  bar.classList.toggle('hidden', !!p.tabHide);
  for (const id of view.order) {
    const doc = S.docs.get(id);
    const dirty = isDirty(doc);
    const t = el('div', { class: `tab ${view.active === id ? 'active' : ''} ${doc.pinned ? 'pinned' : ''} ${p.tabInactiveColor && doc.color ? 'c' + doc.color : ''} ${p.tabReduce ? 'small' : ''}`, 'data-id': id, draggable: p.tabLock ? undefined : true, title: doc.path || doc.name },
      el('span', { class: 'ico ' + (doc.readOnly || S.readOnlyAll ? 'ro' : dirty ? 'dirty' : 'saved'), text: doc.readOnly || S.readOnlyAll ? '🔒' : p.tabAltIcons ? (dirty ? '✎' : '✓') : '●' }),
      doc.pinned && p.tabPin ? el('span', { class: 'pin', text: '📌' }) : null,
      el('span', { class: 'name', text: tabLabel(doc) }),
      p.tabCloseButton ? el('span', { class: 'close', text: '✕', title: 'Close', onclick: (e) => { e.stopPropagation(); NGN.closeDoc(doc); } }) : null);
    t.addEventListener('mousedown', (e) => { if (e.button === 0) activateDoc(id); if (e.button === 1) { e.preventDefault(); NGN.closeDoc(doc); } });
    t.addEventListener('dblclick', () => { if (p.tabDblClickClose) NGN.closeDoc(doc); });
    t.addEventListener('contextmenu', (e) => { e.preventDefault(); activateDoc(id, { focus: false }); NGN.showTabMenu?.(e.clientX, e.clientY, doc); });
    t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-ngn-tab', String(id)); e.dataTransfer.effectAllowed = 'move'; });
    t.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-ngn-tab')) { e.preventDefault(); t.classList.add('drop-before'); } });
    t.addEventListener('dragleave', () => t.classList.remove('drop-before'));
    t.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); t.classList.remove('drop-before'); moveTabTo(parseInt(e.dataTransfer.getData('text/x-ngn-tab'), 10), view.idx, id); });
    bar.append(t);
  }
  bar.ondragover = (e) => { if (e.dataTransfer.types.includes('text/x-ngn-tab')) e.preventDefault(); };
  bar.ondrop = (e) => { e.preventDefault(); moveTabTo(parseInt(e.dataTransfer.getData('text/x-ngn-tab'), 10), view.idx, null); };
  bar.ondblclick = (e) => { if (e.target === bar) NGN.runCommand(41001); };
  const act = bar.querySelector('.tab.active'); act?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
export const updateTab = (doc) => renderTabs(S.views[doc.view]);
NGN.renderTabs = renderTabs;

export function moveTabTo(id, viewIdx, beforeId) {
  const doc = S.docs.get(id); if (!doc) return;
  const from = S.views[doc.view], to = S.views[viewIdx];
  if (doc.view !== viewIdx) {
    if (from.order.length <= 1 && false) return;
    from.order = from.order.filter((x) => x !== id);
    if (from.ed) doc.viewState = from.ed.saveViewState();
    if (from.active === id) { from.active = from.order[from.order.length - 1] ?? null; if (from.active) { const d = S.docs.get(from.active); from.ed.setModel(d.model); } else from.ed.setModel(null); }
    doc.view = viewIdx;
    if (viewIdx === 1 && !S.split) showSecondView(true);
  } else to.order = to.order.filter((x) => x !== id);
  const at = beforeId ? to.order.indexOf(beforeId) : -1;
  if (at >= 0) to.order.splice(at, 0, id); else to.order.push(id);
  activateDoc(id);
  renderTabs(from);
  if (!S.views[0].order.length || !S.views[1].order.length) { if (S.split && S.views[1].order.length === 0) showSecondView(false); }
}
NGN.moveTabTo = moveTabTo;

export function showSecondView(show) {
  S.split = show;
  $('#view1').classList.toggle('hidden', !show); $('#split-views').classList.toggle('hidden', !show);
  if (show && !S.views[1].ed) createEditor(S.views[1]);
  if (!show) { S.cur = 0; const o = S.views[1].order.slice(); o.forEach((id) => { const d = S.docs.get(id); d.view = 0; S.views[0].order.push(id); }); S.views[1].order = []; S.views[1].active = null; S.views[1].ed?.setModel(null); renderTabs(S.views[0]); }
  setTimeout(() => S.views.forEach((v) => v.ed?.layout()), 0);
  NGN.syncMenuState?.();
}
NGN.showSecondView = showSecondView;

// ---- status bar & title -------------------------------------------------------------------------
function buildStatusBar() {
  const sb = $('#statusbar'); sb.innerHTML = '';
  const seg = (id, cls = '', fn) => { const s = el('div', { class: 'seg ' + cls, id }); if (fn) s.addEventListener('click', fn); sb.append(s); };
  seg('st-lang', 'click', (e) => NGN.showLanguagePopup?.(e.clientX, e.clientY - 200));
  seg('st-len'); seg('st-pos'); seg('st-sel');
  seg('st-eol', 'click', (e) => NGN.popup([
    { label: 'Windows (CR LF)', fn: () => NGN.runCommand(45001) }, { label: 'Unix (LF)', fn: () => NGN.runCommand(45002) }, { label: 'Macintosh (CR)', fn: () => NGN.runCommand(45003) }], e.clientX, e.clientY - 80));
  seg('st-enc', 'click', (e) => NGN.popup([
    { label: 'ANSI', fn: () => NGN.runCommand(45004) }, { label: 'UTF-8', fn: () => NGN.runCommand(45008) }, { label: 'UTF-8-BOM', fn: () => NGN.runCommand(45005) },
    { label: 'UTF-16 BE BOM', fn: () => NGN.runCommand(45006) }, { label: 'UTF-16 LE BOM', fn: () => NGN.runCommand(45007) }], e.clientX, e.clientY - 120));
  seg('st-ins', 'click', () => NGN.runCommand('toggle-overtype'));
  sb.append(el('div', { class: 'seg grow', id: 'st-msg' }));
}

export function updateStatus() {
  const doc = curDoc(), ed = curEd();
  if (!doc || !ed) return;
  const m = doc.model, sel = ed.getSelection(), pos = ed.getPosition();
  const L = LANGS[doc.lang];
  const langLabel = doc.lang === 'normal' ? 'Normal text file' : (L ? NGN.langDisplay?.(doc.lang) || doc.lang : doc.lang) + ' file';
  $('#st-lang').textContent = langLabel;
  $('#st-len').textContent = `length: ${m.getValueLength().toLocaleString()}   lines: ${m.getLineCount().toLocaleString()}`;
  $('#st-pos').textContent = `Ln: ${pos.lineNumber}   Col: ${pos.column}   Pos: ${m.getOffsetAt(pos) + 1}`;
  let selTxt = 'Sel: 0 | 0';
  const sels = ed.getSelections() || [];
  if (sels.some((s) => !s.isEmpty())) {
    let chars = 0, lines = 0;
    sels.forEach((s) => { if (!s.isEmpty()) { chars += m.getValueInRange(s).length; lines += s.endLineNumber - s.startLineNumber + 1; } });
    selTxt = `Sel: ${chars.toLocaleString()} | ${lines.toLocaleString()}`;
  }
  $('#st-sel').textContent = selTxt;
  $('#st-eol').textContent = EOL_NAMES[docEol(doc)];
  $('#st-enc').textContent = encLabel(doc.enc);
  $('#st-ins').textContent = NGN.overtype ? 'OVR' : 'INS';
}
NGN.updateStatus = updateStatus;
NGN.status = (t) => { const e = $('#st-msg'); if (e) e.textContent = t; };

export function updateTitle() {
  const doc = curDoc(); if (!doc) return;
  const dirty = isDirty(doc);
  const shown = S.prefs.titleOnlyFilename || !doc.path ? doc.name : doc.path;
  const t = `${dirty ? '*' : ''}${shown} - NextGenNote`;
  document.title = t; ngn.win.title(t); ngn.win.represented(doc.path || ''); ngn.win.edited(dirty);
}
NGN.updateTitle = updateTitle;
NGN.on('content', () => updateTitle());

// ---- file operations -----------------------------------------------------------------------------------
export async function openPath(p, { enc, view = S.cur, activate = true, silent = false } = {}) {
  const existing = [...S.docs.values()].find((d) => d.path === p);
  if (existing) { if (enc) return reloadWithEncoding(existing, enc); activateDoc(existing.id); return existing; }
  try {
    const st = await ngn.file.stat(p);
    if (st?.isDir) { NGN.openWorkspaceFolder?.(p); return null; }
    if (S.prefs.largeFile && st && st.size > 2 * 1024 * 1024 * 1024 && !S.prefs.suppress2GB) { NGN.toast('Files above 2 GB are not supported.'); return null; }
    const r = await ngn.file.read(p, enc || (S.prefs.autoDetectEncoding ? undefined : 'utf8'));
    // A lone untitled, unmodified, empty document is replaced by the opened file (original behavior).
    const only = S.views[view].order.length === 1 && S.docs.get(S.views[view].order[0]);
    const doc = createDoc({ path: p, text: r.text, enc: r.enc, readOnly: r.readOnly, mtime: r.mtime, view, activate });
    if (only && !only.path && !isDirty(only) && only.model.getValueLength() === 0) closeDocNow(only);
    addRecent(p);
    ngn.watch.add(doc.id, p);
    NGN.emit('opened', doc);
    return doc;
  } catch (e) {
    if (!silent) NGN.toast('Cannot open: ' + (e.message || e).toString().replace(/^Error invoking remote method '[^']*': /, ''), 4000);
    return null;
  }
}
NGN.openPath = openPath;

export async function reloadWithEncoding(doc, enc) {
  if (!doc.path) { doc.enc = enc; updateStatus(); return; }
  const r = await ngn.file.read(doc.path, enc);
  doc.model.setValue(r.text); doc.enc = r.enc; doc.mtime = r.mtime; doc.savedVer = doc.model.getAlternativeVersionId(); doc.forceDirty = false;
  updateTab(doc); updateStatus();
  return doc;
}

export async function reloadFromDisk(doc, ask = true) {
  if (!doc.path) return;
  if (ask && isDirty(doc)) { const a = await NGN.confirm('Reload', `"${doc.name}" has unsaved changes.\nReload from disk and lose them?`); if (!a) return; }
  const r = await ngn.file.read(doc.path, doc.enc);
  const pos = curEd().getPosition();
  doc.model.setValue(r.text); doc.mtime = r.mtime; doc.savedVer = doc.model.getAlternativeVersionId(); doc.forceDirty = false;
  NGN.clearChangeHistory(doc); updateTab(doc); updateStatus();
  if (S.views[doc.view].active === doc.id && pos) curEd().setPosition(pos);
}

export async function saveDoc(doc, { as = false, copy = false } = {}) {
  let p = doc.path;
  if (!p || as || copy) {
    const dflt = p || (S.paths.documents + '/' + doc.name + (doc.name.includes('.') ? '' : '.txt'));
    p = await ngn.dlg.save({ title: copy ? 'Save a Copy As' : 'Save As', defaultPath: dflt, filters: [{ name: 'All files', extensions: ['*'] }] });
    if (!p) return false;
  }
  try {
    const opts = {}; const bm = S.prefs.backupOnSave; if (bm !== 'none' && p === doc.path) { opts.backup = bm; opts.backupDir = S.prefs.backupDir || undefined; }
    const r = await ngn.file.write(p, docText(doc), doc.enc, opts);
    if (copy) { NGN.toast('Saved a copy to ' + p); return true; }
    const wasUntitled = !doc.path;
    doc.path = p; doc.name = p.split('/').pop(); doc.mtime = r.mtime; doc.savedVer = doc.model.getAlternativeVersionId(); doc.forceDirty = false;
    if (doc.lang === 'normal' || as) { const nl = langForPath(p, doc.model.getLineContent(1)); if (nl !== 'normal' && (wasUntitled || as)) setLanguage(doc, nl); }
    if (doc.untitledBackup) { ngn.file.deleteBackup(doc.untitledBackup); doc.untitledBackup = null; }
    NGN.markSaved(doc); addRecent(p); ngn.watch.add(doc.id, p);
    updateTab(doc); updateTitle(); NGN.emit('saved', doc);
    NGN.toast('Saved ' + doc.name);
    return true;
  } catch (e) { NGN.toast('Save failed: ' + e.message, 5000); return false; }
}
NGN.saveDoc = saveDoc;

export async function saveAll() {
  if (S.prefs.saveAllConfirm) { const dirtyDocs = [...S.docs.values()].filter((d) => isDirty(d)); if (dirtyDocs.length > 1 && !(await NGN.confirm('Save All', `Save ${dirtyDocs.length} modified documents?`))) return; }
  for (const d of S.docs.values()) if (isDirty(d) && d.path) await saveDoc(d);
  for (const d of S.docs.values()) if (isDirty(d) && !d.path) { activateDoc(d.id); if (!(await saveDoc(d))) break; }
}
NGN.saveAll = saveAll;

function pickNeighbor(view, idx) {
  const o = view.order; return o[Math.min(idx, o.length - 1)] ?? null;
}

export function closeDocNow(doc, { remember = true } = {}) {
  const view = S.views[doc.view]; const idx = view.order.indexOf(doc.id);
  if (doc.path && remember) { S.closedStack.unshift(doc.path); S.closedStack.length = Math.min(S.closedStack.length, 20); }
  if (doc.untitledBackup) ngn.file.deleteBackup(doc.untitledBackup);
  ngn.watch.remove(doc.id);
  view.order.splice(idx, 1);
  if (S.macroRec) { /* closing documents is recorded as a command */ }
  const wasActive = view.active === doc.id;
  S.docs.delete(doc.id);
  if (wasActive) { view.active = null; const nid = pickNeighbor(view, idx); if (nid) activateDoc(nid); else view.ed?.setModel(null); }
  doc.model.dispose();
  renderTabs(view);
  if (view.idx === 1 && !view.order.length) showSecondView(false);
  if (!S.views[0].order.length && !S.views[1].order.length) {
    if (S.prefs.exitOnLastTab) { ngn.win.quit(); return; }
    createDoc({ view: 0 });
  } else if (!curDoc()) { const other = S.views.find((v) => v.order.length); if (other) activateDoc(other.order[0]); }
  NGN.emit('closed', doc);
}

export async function confirmSave(doc, multi = false) {
  activateDoc(doc.id);
  return NGN.askSave(doc, multi);
}

export async function closeDoc(doc, opts = {}) {
  if (!doc || (doc.pinned && !opts.force)) return true;
  if (isDirty(doc) && !opts.discard) {
    const r = await confirmSave(doc, !!opts.multi);
    if (r === 'cancel') return false;
    if (r === 'yes' || r === 'yesall') { if (!(await saveDoc(doc))) return false; }
    if (r === 'noall' || r === 'yesall') opts.sticky = r;
  }
  closeDocNow(doc);
  return true;
}
NGN.closeDoc = closeDoc;

// Closes several docs with a shared "yes to all / no to all" memory.
export async function closeMany(docs) {
  let sticky = null;
  for (const d of docs) {
    if (!S.docs.has(d.id) || d.pinned) continue;
    if (isDirty(d)) {
      if (sticky === 'noall') { closeDocNow(d); continue; }
      if (sticky === 'yesall') { if (!(await saveDoc(d))) return false; closeDocNow(d); continue; }
      const r = await confirmSave(d, true);
      if (r === 'cancel') return false;
      if (r === 'yes' || r === 'yesall') { if (!(await saveDoc(d))) return false; }
      if (r === 'yesall' || r === 'noall') sticky = r;
    }
    closeDocNow(d);
  }
  return true;
}
NGN.closeMany = closeMany;

// ---- recent files ----------------------------------------------------------------------------------------------
export function addRecent(p) {
  S.recent = [p, ...S.recent.filter((x) => x !== p)].slice(0, Math.max(0, S.prefs.recentMax));
  refreshRecentMenu(); saveCfgSoon();
}
export function refreshRecentMenu() {
  const fmt = (p) => (S.prefs.recentDisplay === 'name' ? p.split('/').pop() : p.length > S.prefs.recentLen ? '…' + p.slice(-S.prefs.recentLen) : p);
  ngn.win.setRecent(S.recent.map((p) => ({ path: p, label: fmt(p) })));
}
NGN.refreshRecentMenu = refreshRecentMenu;

// ---- config persistence ---------------------------------------------------------------------------------------------------
let cfgT;
export function saveCfgSoon() {
  clearTimeout(cfgT);
  cfgT = setTimeout(() => ngn.cfg.set({ prefs: S.prefs, recent: S.recent, macros: S.macros, runList: S.runList, clipHist: [], find: { ...S.find }, userProjects: NGN.projects || null }), 400);
}
NGN.saveCfgSoon = saveCfgSoon;

// ---- sessions (Session snapshot + periodic backup) ----------------------------------------------------------------------------------------------
let snapT;
export function scheduleSessionSnapshot() {
  if (!S.prefs.snapshot) return;
  clearTimeout(snapT); snapT = setTimeout(() => NGN.saveSession(), Math.max(1, S.prefs.snapshotInterval) * 1000);
}

export async function sessionData(forExplicitFile = false) {
  const docs = [];
  for (const v of S.views) {
    for (const id of v.order) {
      const d = S.docs.get(id);
      const entry = { path: d.path, name: d.name, view: v.idx, lang: d.lang, enc: d.enc, pinned: d.pinned, color: d.color, active: v.active === id, eol: docEol(d), untitledNo: d.untitledNo, readOnly: d.readOnly, bookmarks: NGN.bm?.lines(d) || [] };
      // Full Monaco view state: selections, scroll position and folded regions.
      const st = (v.active === id ? v.ed.saveViewState() : d.viewState);
      if (st) entry.vs = st;
      // Untitled tabs with content are always snapshotted, even if never edited since creation (e.g. pasted text).
      if ((isDirty(d) || (!d.path && d.model.getValueLength() > 0)) && !forExplicitFile) {
        const file = 'doc-' + d.id + '.txt'; await ngn.file.writeBackup(file, d.model.getValue()); entry.backup = file; d.untitledBackup = d.path ? d.untitledBackup : file;
      }
      docs.push(entry);
    }
  }
  return { docs, split: S.split, cur: S.cur, theme: S.prefs.theme, savedAt: Date.now(), untitledN: S.untitledN, closedStack: S.closedStack.slice(0, 20), mru: S.mru || [] };
}
NGN.saveSession = async () => { if (!S.prefs.rememberSession) return; try { await ngn.session.set(await sessionData()); } catch (e) { console.warn('session save', e); } };

export async function restoreSession(sess, { onlyExplicit = false } = {}) {
  if (!sess || !sess.docs?.length) return false;
  let first = true;
  for (const e of sess.docs) {
    let doc = null;
    if (e.path && await ngn.file.exists(e.path)) {
      doc = await openPath(e.path, { view: e.view, activate: false, silent: true });
      if (doc && e.backup) { const t = await ngn.file.readBackup(e.backup); if (t != null && t !== doc.model.getValue()) { doc.model.setValue(t); doc.forceDirty = true; } }
    } else if (e.backup) {
      const t = await ngn.file.readBackup(e.backup);
      doc = createDoc({ path: e.path || null, name: e.name, text: t ?? '', enc: e.enc, eol: e.eol, lang: e.lang, view: e.view, activate: false, forceDirty: true });
      if (!e.path && e.untitledNo) { doc.untitledNo = e.untitledNo; S.untitledN = Math.max(S.untitledN, e.untitledNo); }
    } else if (!e.path && !onlyExplicit) continue;
    if (!doc) continue;
    doc.pinned = !!e.pinned; doc.color = e.color || 0; if (e.lang && e.lang !== doc.lang) setLanguage(doc, e.lang);
    if (e.readOnly) doc.readOnly = true;
    (e.bookmarks || []).forEach((l) => NGN.bm?.add(doc, l));
    if (e.vs) doc.viewState = e.vs;
    else if (e.caret) doc.viewState = { cursorState: [{ inSelectionMode: false, selectionStart: { lineNumber: e.caret[0], column: e.caret[1] }, position: { lineNumber: e.caret[0], column: e.caret[1] } }], viewState: { scrollLeft: 0, firstPosition: { lineNumber: Math.max(1, e.caret[0] - 5), column: 1 }, firstPositionDeltaTop: 0 }, contributionsState: {} };
    if (e.active) { S.views[e.view].active = doc.id; }
  }
  for (const v of S.views) { if (v.order.length) { if (!v.active || !S.docs.has(v.active)) v.active = v.order[0]; } renderTabs(v); }
  if (S.views[1].order.length) showSecondView(true);
  S.untitledN = Math.max(S.untitledN, sess.untitledN || 0);
  if (!onlyExplicit && sess.closedStack) S.closedStack = sess.closedStack;
  // Every split view needs its own active document shown, not just the focused one.
  for (const v of S.views) if (v.order.length && v.active && v.idx !== (sess.cur ?? 0)) activateDoc(v.active, { focus: false });
  const target = S.views[sess.cur ?? 0].active ?? S.views[0].active;
  if (target) activateDoc(target);
  return true;
}
NGN.restoreSession = restoreSession;

// ---- layout: splitters --------------------------------------------------------------------------------------
function wireSplitter(sp, getTarget, axis, dirSign) {
  sp.addEventListener('mousedown', (e) => {
    e.preventDefault(); const t = getTarget(); const start = axis === 'x' ? e.clientX : e.clientY; const size0 = axis === 'x' ? t.offsetWidth : t.offsetHeight;
    const mv = (ev) => { const d = ((axis === 'x' ? ev.clientX : ev.clientY) - start) * dirSign; const v = Math.max(80, size0 + d); if (axis === 'x') t.style.width = v + 'px'; else t.style.height = v + 'px'; };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); S.views.forEach((v) => v.ed?.layout()); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
}

NGN.initCore = async function initCore() {
  S.paths = await ngn.app.paths();
  const cfg = (await ngn.cfg.get()) || {};
  S.prefs = { ...DEFAULT_PREFS, ...(cfg.prefs || {}) }; S.prefs.panels = { ...(cfg.prefs?.panels || {}) };
  S.recent = cfg.recent || []; S.macros = cfg.macros || []; S.runList = cfg.runList || []; Object.assign(S.find, cfg.find || {}); NGN.projects = cfg.userProjects || null;
  S.views.forEach((v, i) => { v.hostEl = $('#ed' + i); v.tabsEl = $('#tabs' + i); });
  createEditor(S.views[0]);
  buildStatusBar();
  wireSplitter($('#split-left'), () => $('#panel-left'), 'x', 1);
  wireSplitter($('#split-right'), () => $('#panel-right'), 'x', -1);
  wireSplitter($('#split-bottom'), () => $('#panel-bottom'), 'y', -1);
  S.views[0].hostEl.closest('.view').addEventListener('mousedown', () => { if (S.cur !== 0) { S.cur = 0; onActiveChanged(); } }, true);
  $('#view1').addEventListener('mousedown', () => { if (S.cur !== 1) { S.cur = 1; onActiveChanged(); } }, true);
};

NGN.after = (fn) => setTimeout(fn, 0);

NGN.activateDoc = activateDoc; NGN.createDoc = createDoc; NGN.addRecent = addRecent; NGN.sessionData = sessionData; NGN.reloadFromDisk = reloadFromDisk;
NGN.closeDocNow = closeDocNow; NGN.setLanguageDoc = setLanguage; NGN.monaco = monaco;
