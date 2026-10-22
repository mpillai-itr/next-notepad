// Command table: every menu id recovered from the original RT_MENU resource maps to a handler here.
import { monaco, activateDoc, createDoc, saveDoc, saveAll, closeDoc, closeMany, closeDocNow, setLanguage, renderTabs, reloadFromDisk, reloadWithEncoding, isDirty, docEol, docText, updateStatus, openPath } from './core.js';
import { S, NGN, curEd, curDoc, curView } from './state.js';
import { LANG_BY_MENU_ID, LANGS } from './languages.js';

const { el, $ } = NGN;
const ngn = window.ngn;
const C = {}; // id -> fn
NGN.C = C;
const def = (ids, fn) => [].concat(ids).forEach((id) => { C[id] = fn; });
const LF = monaco.editor.EndOfLinePreference.LF;
const trig = (action, payload) => { const ed = curEd(); ed.focus(); ed.trigger('menu', action, payload); };
const act = (id) => { const ed = curEd(); ed.focus(); const a = ed.getAction(id); return a ? a.run() : ed.trigger('menu', id, {}); };

export async function runCommand(id, ...args) {
  const fn = C[id];
  if (!fn) { if (typeof id === 'string' && id.startsWith('dyn:')) return NGN.runDynamic?.(id.slice(4)); if (typeof id === 'string' && id.startsWith('plugin:')) return NGN.runPlugin?.(id.slice(7)); NGN.toast('Command not available: ' + id); return; }
  if (S.macroRec && NGN.macroRecordable?.(id)) S.macroRec.push({ cmd: id });
  try { return await fn(...args); } catch (e) { console.error('command', id, e); NGN.toast('Error: ' + (e.message || e), 4000); }
}
NGN.runCommand = runCommand;

// ===== helpers ========================================================================================================
function focusIsInput() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && !a.closest('.monaco-editor'); }
export function selText(ed = curEd()) { const s = ed.getSelection(); return s.isEmpty() ? '' : ed.getModel().getValueInRange(s); }
export function wordOrSel(ed = curEd()) {
  const s = ed.getSelection(); if (!s.isEmpty()) return { text: ed.getModel().getValueInRange(s), range: s };
  const w = ed.getModel().getWordAtPosition(ed.getPosition()); if (!w) return null;
  return { text: w.word, range: new monaco.Range(ed.getPosition().lineNumber, w.startColumn, ed.getPosition().lineNumber, w.endColumn) };
}
function editRanges(ed, pairs, label = 'cmd') { ed.pushUndoStop(); ed.executeEdits(label, pairs.map(([range, text]) => ({ range, text }))); ed.pushUndoStop(); }
// Applies fn to each selection (or the word under the caret when empty).
function transformSelections(fn) {
  const ed = curEd(), m = ed.getModel(); const edits = [];
  ed.getSelections().forEach((s) => {
    let r = s; if (s.isEmpty()) { const w = m.getWordAtPosition(s.getPosition()); if (!w) return; r = new monaco.Range(s.startLineNumber, w.startColumn, s.startLineNumber, w.endColumn); }
    const t = m.getValueInRange(r); const n = fn(t); if (n !== t) edits.push([r, n]);
  });
  editRanges(ed, edits);
}
// Line operations act on the selected lines, or on the whole document when nothing spans lines.
function lineScope() {
  const ed = curEd(), m = ed.getModel(), s = ed.getSelection();
  if (!s.isEmpty() && s.startLineNumber !== s.endLineNumber || (!s.isEmpty() && s.endColumn > 1)) { const end = s.endColumn === 1 && s.endLineNumber > s.startLineNumber ? s.endLineNumber - 1 : s.endLineNumber; return { a: s.startLineNumber, b: end, whole: false }; }
  return { a: 1, b: m.getLineCount(), whole: true };
}
function mapLines(fn, { all = false } = {}) {
  const ed = curEd(), m = ed.getModel(); const { a, b } = all ? { a: 1, b: m.getLineCount() } : lineScope();
  const lines = []; for (let i = a; i <= b; i++) lines.push(m.getLineContent(i));
  const out = fn(lines); const range = new monaco.Range(a, 1, b, m.getLineMaxColumn(b));
  if (out.join('\n') !== lines.join('\n')) editRanges(ed, [[range, out.join(m.getEOL())]]);
}
const cpLine = (line) => line; // placeholder for future per-line hooks

// ===== FILE ===========================================================================================================
def(41001, () => createDoc({ view: S.cur }));
def(41002, async () => {
  const dir = S.prefs.dirMode === 'custom' && S.prefs.dirCustom ? S.prefs.dirCustom : (S.prefs.dirMode === 'follow' ? curDoc()?.path?.replace(/\/[^/]*$/, '') : S.lastDir);
  const files = await ngn.dlg.open({ title: 'Open', defaultPath: dir || S.paths.documents, properties: ['openFile', 'multiSelections', 'showHiddenFiles'] });
  for (const f of files) { S.lastDir = f.replace(/\/[^/]*$/, ''); await openPath(f); }
});
def(41019, () => curDoc()?.path && ngn.file.reveal(curDoc().path));
def(41020, () => curDoc()?.path && ngn.file.terminalAt(curDoc().path.replace(/\/[^/]*$/, '')));
def(41025, () => { const p = curDoc()?.path; if (p) NGN.openWorkspaceFolder(p.replace(/\/[^/]*$/, '')); });
def(41023, () => curDoc()?.path && ngn.file.openDefault(curDoc().path));
def(41022, async () => { const p = await ngn.dlg.open({ properties: ['openDirectory'] }); if (p[0]) NGN.openWorkspaceFolder(p[0]); });
def(41014, () => reloadFromDisk(curDoc()));
def(41006, () => saveDoc(curDoc()));
def(41008, () => saveDoc(curDoc(), { as: true }));
def(41015, () => saveDoc(curDoc(), { copy: true }));
def(41007, () => saveAll());
def(41017, async () => {
  const d = curDoc(); const n = await NGN.prompt('Rename', 'New file name:', d.name); if (!n || n === d.name) return;
  if (d.path) { const np = d.path.replace(/[^/]*$/, n); if (await ngn.file.exists(np)) return NGN.toast('A file with this name already exists.'); await ngn.file.rename(d.path, np); d.path = np; NGN.addRecent?.(np); }
  d.name = n; renderTabs(S.views[d.view]); NGN.updateTitle();
});
def(41003, () => closeDoc(curDoc()));
def(41004, () => closeMany([...S.docs.values()]));
def(41005, () => closeMany([...S.docs.values()].filter((d) => d !== curDoc())));
def(41026, () => closeMany([...S.docs.values()].filter((d) => !d.pinned)));
def(41009, () => { const v = curView(), d = curDoc(); closeMany(v.order.slice(0, v.order.indexOf(d.id)).map((i) => S.docs.get(i))); });
def(41018, () => { const v = curView(), d = curDoc(); closeMany(v.order.slice(v.order.indexOf(d.id) + 1).map((i) => S.docs.get(i))); });
def(41024, () => closeMany([...S.docs.values()].filter((d) => !isDirty(d))));
def(41016, async () => { const d = curDoc(); if (!d.path) return NGN.toast('Document has no file on disk.'); if (!(await NGN.confirm('Move to Recycle Bin', `Move "${d.name}" to the Trash?`))) return; await ngn.file.trash(d.path); closeDocNow(d, { remember: false }); });
def(41012, async () => { const f = await ngn.dlg.open({ title: 'Load Session', properties: ['openFile'], filters: [{ name: 'Session', extensions: ['json', 'session'] }] }); if (f[0]) { const s = await ngn.session.readFile(f[0]); if (s) await NGN.restoreSession(s, { onlyExplicit: true }); } });
def(41013, async () => { const p = await ngn.dlg.save({ title: 'Save Session', defaultPath: S.paths.documents + '/session.json' }); if (p) { await ngn.file.write(p, JSON.stringify(await NGN.sessionData(true), null, 1), 'utf8'); NGN.toast('Session saved'); } });
def(41010, () => NGN.printDoc(false));
def(1001, () => NGN.printDoc(true));
def(41011, () => NGN.quit());
C['restore-closed'] = async () => { const p = S.closedStack.shift(); if (p) await openPath(p); };
C['open-all-recent'] = async () => { for (const p of [...S.recent]) await openPath(p, { activate: false }); };
C['clear-recent'] = () => { S.recent = []; NGN.refreshRecentMenu(); NGN.saveCfgSoon(); };

NGN.quit = async () => {
  // Session snapshot: unsaved work (including untitled tabs) is written to the backup folder and restored on the
  // next launch, exactly like the original's "Remember current session" + "Enable session snapshot". No prompts.
  if (S.prefs.rememberSession && S.prefs.snapshot) { await NGN.saveSession(); await NGN.saveCfgNow(); ngn.win.quit(); return; }
  const ok = await closeMany([...S.docs.values()].filter(isDirty)); if (!ok) return;
  if (S.prefs.rememberSession) await NGN.saveSession();
  await NGN.saveCfgNow(); ngn.win.quit();
};

// ===== EDIT ===========================================================================================================
def(42003, () => { if (focusIsInput()) document.execCommand('undo'); else trig('undo'); });
def(42004, () => { if (focusIsInput()) document.execCommand('redo'); else trig('redo'); });
def(42001, async () => { if (focusIsInput()) return document.execCommand('cut'); const ed = curEd(); const s = ed.getSelection(); const t = s.isEmpty() ? ed.getModel().getLineContent(s.startLineNumber) + '\n' : ed.getModel().getValueInRange(s); await ngn.clip.writeText(t); NGN.noteClip(t); editRanges(ed, [[s.isEmpty() ? new monaco.Range(s.startLineNumber, 1, s.startLineNumber + 1, 1) : s, '']]); });
def(42002, async () => { if (focusIsInput()) return document.execCommand('copy'); const ed = curEd(); const s = ed.getSelection(); const t = s.isEmpty() ? ed.getModel().getLineContent(s.startLineNumber) + '\n' : ed.getModel().getValueInRange(s); await ngn.clip.writeText(t); NGN.noteClip(t); });
def(42005, async () => { if (focusIsInput()) return; const t = await ngn.clip.readText(); if (t) { curEd().focus(); curEd().trigger('clipboard', 'paste', { text: t }); } });
def(42006, () => { const ed = curEd(); const s = ed.getSelection(); if (!s.isEmpty()) editRanges(ed, [[s, '']]); else ed.trigger('menu', 'deleteRight'); });
def(42007, () => { if (focusIsInput()) return document.activeElement.select(); const ed = curEd(); ed.focus(); ed.setSelection(ed.getModel().getFullModelRange()); });
let anchor = null;
def(42020, () => { const ed = curEd(); if (!anchor) { anchor = ed.getPosition(); NGN.status('Begin Select'); } else { const p = ed.getPosition(); ed.setSelection(new monaco.Selection(anchor.lineNumber, anchor.column, p.lineNumber, p.column)); anchor = null; NGN.status('End Select'); } });
def(42089, () => { const ed = curEd(); if (!anchor) { anchor = ed.getPosition(); NGN.status('Begin Select (column mode)'); } else { const p = ed.getPosition(); const sels = []; const l1 = Math.min(anchor.lineNumber, p.lineNumber), l2 = Math.max(anchor.lineNumber, p.lineNumber); const c1 = Math.min(anchor.column, p.column), c2 = Math.max(anchor.column, p.column); for (let l = l1; l <= l2; l++) sels.push(new monaco.Selection(l, c1, l, c2)); ed.setSelections(sels); anchor = null; } });

// date/time
const pad = (n, w = 2) => String(n).padStart(w, '0');
export function fmtDate(fmt, d = new Date()) {
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const h12 = d.getHours() % 12 || 12;
  return fmt.replace(/yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|tt/g, (t) => ({ yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(2), MMMM: M[d.getMonth()], MMM: M[d.getMonth()].slice(0, 3), MM: pad(d.getMonth() + 1), M: d.getMonth() + 1, dddd: D[d.getDay()], ddd: D[d.getDay()].slice(0, 3), dd: pad(d.getDate()), d: d.getDate(), HH: pad(d.getHours()), H: d.getHours(), hh: pad(h12), h: h12, mm: pad(d.getMinutes()), m: d.getMinutes(), ss: pad(d.getSeconds()), s: d.getSeconds(), tt: d.getHours() < 12 ? 'AM' : 'PM' }[t]));
}
const insertText = (t) => { const ed = curEd(); ed.focus(); ed.trigger('menu', 'type', { text: t }); };
NGN.insertText = insertText;
def(42084, () => { const d = new Date(); const a = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), b = d.toLocaleDateString(); insertText(S.prefs.dateFormatReverse ? `${b} ${a}` : `${a} ${b}`); });
def(42085, () => { const d = new Date(); const a = d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), b = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); insertText(S.prefs.dateFormatReverse ? `${b} ${a}` : `${a} ${b}`); });
def(42086, () => insertText(fmtDate(S.prefs.dateCustom || 'yyyy-MM-dd HH:mm:ss')));

// copy to clipboard
const cp = async (t) => { await ngn.clip.writeText(t); NGN.noteClip(t); NGN.toast('Copied to clipboard'); };
def(42029, () => cp(curDoc().path || curDoc().name)); def(42030, () => cp(curDoc().name)); def(42031, () => cp((curDoc().path || '').replace(/\/[^/]*$/, '')));
def(42087, () => cp([...S.docs.values()].map((d) => d.name).join('\n'))); def(42088, () => cp([...S.docs.values()].map((d) => d.path || d.name).join('\n')));

// indent
def(42008, () => act('editor.action.indentLines')); def(42009, () => act('editor.action.outdentLines'));

// case conversion
const wordStart = /(^|[^\p{L}\p{N}'’])(\p{L})/gu;
const CASE = {
  42016: (s) => s.toUpperCase(), 42017: (s) => s.toLowerCase(),
  42067: (s) => s.toLowerCase().replace(wordStart, (m, a, b) => a + b.toUpperCase()), 42068: (s) => s.replace(wordStart, (m, a, b) => a + b.toUpperCase()),
  42069: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()), 42070: (s) => s.replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  42071: (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''), 42072: (s) => [...s].map((c) => (Math.random() < 0.5 ? c.toUpperCase() : c.toLowerCase())).join(''),
};
Object.entries(CASE).forEach(([id, fn]) => def(+id, () => transformSelections(fn)));

// line operations
def(42010, () => act('editor.action.copyLinesDownAction'));
def(42079, () => mapLines((l) => { const seen = new Set(); return l.filter((x) => (seen.has(x) ? false : (seen.add(x), true))); }));
def(42077, () => mapLines((l) => l.filter((x, i) => i === 0 || x !== l[i - 1])));
def(42012, () => { const w = S.prefs.edge === 'line' ? S.prefs.edgeColumn : 80; const ed = curEd(), m = ed.getModel(); const s = ed.getSelection();
  const range = s.isEmpty() ? m.getFullModelRange() : s; const t = m.getValueInRange(range); const out = t.split(/\r?\n/).map((ln) => { const parts = []; for (let i = 0; i < ln.length; i += w) parts.push(ln.slice(i, i + w)); return parts.length ? parts.join(m.getEOL()) : ''; }).join(m.getEOL()); editRanges(ed, [[range, out]]); });
def(42013, () => { const ed = curEd(), m = ed.getModel(); const s = ed.getSelection(); let a = s.startLineNumber, b = s.endLineNumber; if (a === b) b = Math.min(m.getLineCount(), a + 1); if (a === b) return;
  const joined = []; for (let i = a; i <= b; i++) joined.push(i === a ? m.getLineContent(i).replace(/\s+$/, '') : m.getLineContent(i).replace(/^\s+|\s+$/g, '')); editRanges(ed, [[new monaco.Range(a, 1, b, m.getLineMaxColumn(b)), joined.join(' ')]]); });
def(42014, () => act('editor.action.moveLinesUpAction')); def(42015, () => act('editor.action.moveLinesDownAction'));
def(42055, () => mapLines((l) => l.filter((x) => x !== ''))); def(42056, () => mapLines((l) => l.filter((x) => x.trim() !== '')));
def(42057, () => act('editor.action.insertLineBefore')); def(42058, () => act('editor.action.insertLineAfter'));
def(42083, () => mapLines((l) => l.slice().reverse()));
def(42078, () => mapLines((l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }));
const num = (s, dec) => { let t = s.trim(); if (dec === ',') t = t.replace(/\./g, '').replace(',', '.'); const m = t.match(/^[+-]?(\d+(\.\d+)?|\.\d+)/); return m ? parseFloat(m[0]) : null; };
const intKey = (s) => { const m = s.trim().match(/^[+-]?\d+/); return m ? parseInt(m[0], 10) : null; };
const stable = (l, cmp) => l.map((v, i) => [v, i]).sort((x, y) => cmp(x[0], y[0]) || x[1] - y[1]).map((x) => x[0]);
const numCmp = (key, dir) => (x, y) => { const a = key(x), b = key(y); if (a === null && b === null) return 0; if (a === null) return -dir; if (b === null) return dir; return (a - b) * dir; };
const loc = new Intl.Collator(undefined, { numeric: false });
const SORTS = {
  42059: [(a, b) => (a < b ? -1 : a > b ? 1 : 0)], 42060: [(a, b) => (a < b ? 1 : a > b ? -1 : 0)],
  42080: [(a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }], 42081: [(a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? 1 : x > y ? -1 : 0; }],
  42100: [(a, b) => loc.compare(a, b)], 42101: [(a, b) => loc.compare(b, a)],
  42061: [numCmp(intKey, 1)], 42062: [numCmp(intKey, -1)], 42063: [numCmp((s) => num(s, ','), 1)], 42064: [numCmp((s) => num(s, ','), -1)],
  42065: [numCmp((s) => num(s, '.'), 1)], 42066: [numCmp((s) => num(s, '.'), -1)], 42104: [(a, b) => a.length - b.length], 42105: [(a, b) => b.length - a.length],
};
Object.entries(SORTS).forEach(([id, [cmp]]) => def(+id, () => mapLines((l) => stable(l, cmp))));

// comments (driven by the language's markers from langs.model.xml)
function langMarks(doc) { const L = LANGS[doc.lang] || {}; return { line: L.commentLine, start: L.commentStart, end: L.commentEnd }; }
function toggleLine(mode) { // mode: 'toggle' | 'comment' | 'uncomment'
  const ed = curEd(), doc = curDoc(), m = ed.getModel(); const { line, start, end } = langMarks(doc);
  if (!line && !(start && end)) return NGN.toast('This language has no comment syntax.');
  const s = ed.getSelection(); const a = s.startLineNumber, b = s.endColumn === 1 && s.endLineNumber > a ? s.endLineNumber - 1 : s.endLineNumber;
  const lines = []; for (let i = a; i <= b; i++) lines.push(m.getLineContent(i));
  const L = line || start; const wrapEnd = line ? '' : end;
  const isC = (x) => { const t = x.trim(); return t.startsWith(L) && (!wrapEnd || t.endsWith(wrapEnd)); };
  const nonEmpty = lines.filter((x) => x.trim()); const un = mode === 'uncomment' || (mode === 'toggle' && nonEmpty.length && nonEmpty.every(isC));
  const out = lines.map((x) => {
    if (!x.trim()) return x; const ind = x.match(/^\s*/)[0];
    if (un) { let t = x.slice(ind.length); if (t.startsWith(L)) t = t.slice(L.length); if (t.startsWith(' ') && line) t = t.slice(1); if (wrapEnd && t.trimEnd().endsWith(wrapEnd)) t = t.trimEnd().slice(0, -wrapEnd.length).trimEnd(); return ind + t; }
    return ind + L + (line ? ' ' : ' ') + x.slice(ind.length) + (wrapEnd ? ' ' + wrapEnd : '');
  });
  editRanges(ed, [[new monaco.Range(a, 1, b, m.getLineMaxColumn(b)), out.join(m.getEOL())]]);
}
def(42022, () => toggleLine('toggle')); def(42035, () => toggleLine('comment')); def(42036, () => toggleLine('uncomment'));
def(42023, () => { const ed = curEd(), m = ed.getModel(); const { start, end, line } = langMarks(curDoc()); const s = ed.getSelection(); const S0 = start || line, E0 = end || ''; if (!S0) return NGN.toast('This language has no comment syntax.'); editRanges(ed, [[s, S0 + m.getValueInRange(s) + E0]]); });
def(42047, () => { const ed = curEd(), m = ed.getModel(); const { start, end } = langMarks(curDoc()); const s = ed.getSelection(); if (!start || !end) return; let t = m.getValueInRange(s); if (!t.trim().startsWith(start)) { const w = m.getFullModelRange(); const full = m.getValueInRange(w); const i = full.lastIndexOf(start, m.getOffsetAt(s.getStartPosition())); const j = full.indexOf(end, m.getOffsetAt(s.getStartPosition())); if (i < 0 || j < 0) return; const r = new monaco.Range(...[m.getPositionAt(i), m.getPositionAt(j + end.length)].flatMap((p) => [p.lineNumber, p.column])); t = m.getValueInRange(r); editRanges(ed, [[r, t.slice(start.length, t.length - end.length)]]); return; } editRanges(ed, [[s, t.trim().slice(start.length, t.trim().length - end.length)]]); });

// auto-completion
def(50000, () => { S.acForce = 'function'; act('editor.action.triggerSuggest'); }); def(50001, () => { S.acForce = 'word'; act('editor.action.triggerSuggest'); });
def(50002, () => act('editor.action.triggerParameterHints')); def(50010, () => trig('showPrevParameterHint')); def(50011, () => trig('showNextParameterHint'));
def(50006, async () => {
  const ed = curEd(), m = ed.getModel(), p = ed.getPosition(); const before = m.getLineContent(p.lineNumber).slice(0, p.column - 1); const mm = before.match(/([~\/.\w\-\\:]+[\/])([\w.\-]*)$/); if (!mm) return NGN.toast('Type a path ending in "/" first.');
  let dir = mm[1].replace(/^~/, S.paths.home); if (!dir.startsWith('/')) dir = (curDoc().path ? curDoc().path.replace(/\/[^/]*$/, '/') : S.paths.home + '/') + dir;
  try { const ents = (await ngn.file.listDir(dir)).filter((e) => e.name.toLowerCase().startsWith(mm[2].toLowerCase())); const pos = ed.getScrolledVisiblePosition(p); const r = ed.getDomNode().getBoundingClientRect();
    NGN.popup(ents.slice(0, 40).map((e) => ({ label: e.name + (e.dir ? '/' : ''), fn: () => { editRanges(ed, [[new monaco.Range(p.lineNumber, p.column - mm[2].length, p.lineNumber, p.column), e.name + (e.dir ? '/' : '')]]); ed.focus(); } })), r.left + pos.left, r.top + pos.top + 20); } catch { NGN.toast('Cannot read ' + dir); }
});

// EOL conversion
function setEol(kind) { const d = curDoc(); d.crOnly = kind === 'CR'; if (kind === 'CR') { d.model.setEOL(monaco.editor.EndOfLineSequence.LF); d.forceDirty = true; } else d.model.setEOL(kind === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF); renderTabs(S.views[d.view]); updateStatus(); NGN.updateTitle(); }
def(45001, () => setEol('CRLF')); def(45002, () => setEol('LF')); def(45003, () => setEol('CR'));

// blank operations
const regexEdit = (re, rep) => mapLines((l) => l.map((x) => x.replace(re, rep)));
def(42024, () => regexEdit(/[ \t]+$/, '')); def(42042, () => regexEdit(/^[ \t]+/, '')); def(42043, () => regexEdit(/^[ \t]+|[ \t]+$/g, ''));
function eolToSpace(trim) { const ed = curEd(), m = ed.getModel(); const s = ed.getSelection(); const r = s.isEmpty() ? m.getFullModelRange() : s; let t = m.getValueInRange(r); if (trim) t = t.split(/\r?\n/).map((x) => x.trim()).join(' '); else t = t.replace(/\r?\n/g, ' '); editRanges(ed, [[r, t]]); }
def(42044, () => eolToSpace(false)); def(42045, () => eolToSpace(true));
def(42046, () => regexEdit(/\t/g, ' '.repeat(S.prefs.tabSize)));
def(42054, () => { const n = S.prefs.tabSize; mapLines((l) => l.map((x) => x.replace(new RegExp(' {' + n + '}', 'g'), '\t'))); });
def(42053, () => { const n = S.prefs.tabSize; mapLines((l) => l.map((x) => x.replace(/^ +/, (sp) => '\t'.repeat(Math.floor(sp.length / n)) + ' '.repeat(sp.length % n)))); });

// paste special
def(42038, async () => { const h = await ngn.clip.readHTML(); if (h) insertText(h); else NGN.toast('No HTML content on the clipboard.'); });
def(42039, async () => { const r = await ngn.clip.readRTF?.(); if (r) insertText(r); else NGN.toast('No RTF content on the clipboard.'); });
def(42048, async () => { const t = selText(); if (!t) return; await ngn.clip.writeBinary(btoa(unescape(encodeURIComponent(t)))); NGN.toast('Binary content copied'); });
def(42049, async () => { await C[42048](); const ed = curEd(); const s = ed.getSelection(); if (!s.isEmpty()) editRanges(ed, [[s, '']]); });
def(42050, async () => { const b = await ngn.clip.readBinary(); if (b) insertText(decodeURIComponent(escape(atob(b)))); });

// on selection
def(42073, async () => { let t = (selText() || wordOrSel()?.text || '').trim().replace(/^["']|["']$/g, ''); if (!t) return; const base = curDoc().path?.replace(/\/[^/]*$/, '') || S.paths.home; const cand = t.startsWith('/') ? [t] : [base + '/' + t, t]; for (const c of cand) if (await ngn.file.exists(c)) return openPath(c); NGN.toast('File not found: ' + t); });
def(42074, async () => { const t = selText().trim(); if (!t) return; const p = t.startsWith('/') ? t : (curDoc().path?.replace(/\/[^/]*$/, '') || '') + '/' + t; if (await ngn.file.exists(p)) ngn.file.reveal(p); else NGN.toast('Path not found: ' + p); });
def(42075, () => { const t = selText() || wordOrSel()?.text; if (!t) return; ngn.file.openUrl(S.prefs.searchEngine.replace('$(CURRENT_WORD)', encodeURIComponent(t))); });
def(42076, () => NGN.openPrefs('Search Engine'));

// multi-select
let msStack = [];
function msOpts(id) { const base = id < 42094 ? 42090 : 42094; const i = id - base; return { matchCase: i === 1 || i === 3, whole: i === 2 || i === 3 }; }
function msAll(o) { const ed = curEd(), doc = curDoc(); const w = wordOrSel(ed); if (!w) return; const { hits } = NGN.findAllIn(doc, { what: w.text, mode: 'normal', ...o }); ed.setSelections(hits.map((h) => new monaco.Selection(h.range.startLineNumber, h.range.startColumn, h.range.endLineNumber, h.range.endColumn))); NGN.status(`Multi-select: ${hits.length} occurrence(s)`); }
function msNext(o) { const ed = curEd(), doc = curDoc(); const sels = ed.getSelections(); if (sels.every((s) => s.isEmpty())) { const w = wordOrSel(ed); if (!w) return; ed.setSelection(w.range); msStack = [ed.getSelections()]; return; } const text = ed.getModel().getValueInRange(sels[0]); const { hits } = NGN.findAllIn(doc, { what: text, mode: 'normal', ...o }); const last = sels[sels.length - 1]; let h = hits.find((x) => x.range.getStartPosition().isBefore(last.getStartPosition()) === false && !sels.some((s) => s.equalsRange(x.range))); if (!h) h = hits.find((x) => !sels.some((s) => s.equalsRange(x.range))); if (!h) return; msStack.push(sels); const ns = sels.concat([new monaco.Selection(h.range.startLineNumber, h.range.startColumn, h.range.endLineNumber, h.range.endColumn)]); ed.setSelections(ns); ed.revealRangeInCenterIfOutsideViewport(h.range); }
[42090, 42091, 42092, 42093].forEach((id) => def(id, () => msAll(msOpts(id)))); [42094, 42095, 42096, 42097].forEach((id) => def(id, () => msNext(msOpts(id))));
def(42098, () => { const prev = msStack.pop(); if (prev) curEd().setSelections(prev); });
def(42099, () => { const ed = curEd(); const sels = ed.getSelections(); if (sels.length < 1) return; const prev = sels.slice(0, -1); ed.setSelections(prev.length ? prev : sels); msNext({ matchCase: false, whole: false }); });

def(42037, () => NGN.alert('Column Mode', 'Hold Alt+Shift while dragging (or use Shift+Alt+Arrow keys) to make a rectangular selection.\nUse Cmd+click to add extra carets for multi-editing.\nThen type to edit every line at once, or use Column Editor (Alt+C) to insert text / numbers.'));
def(42034, () => NGN.openColumnEditor());
def(42051, () => NGN.togglePanel('chars')); def(42052, () => NGN.togglePanel('clip'));
def(42028, () => { const d = curDoc(); d.readOnly = !d.readOnly; curEd().updateOptions({ readOnly: d.readOnly || S.readOnlyAll }); renderTabs(S.views[d.view]); NGN.syncMenuState(); });
def(42102, () => { S.readOnlyAll = true; S.views.forEach((v) => v.ed?.updateOptions({ readOnly: true })); S.views.forEach(renderTabs); NGN.syncMenuState(); });
def(42103, () => { S.readOnlyAll = false; for (const d of S.docs.values()) d.readOnly = false; S.views.forEach((v) => v.ed?.updateOptions({ readOnly: false })); S.views.forEach(renderTabs); NGN.syncMenuState(); });
def(42033, async () => { const d = curDoc(); if (!d.path) return; d.roAttr = !d.roAttr; await ngn.file.setReadOnly(d.path, d.roAttr); NGN.toast(d.roAttr ? 'File is now read-only on disk' : 'File is writable on disk'); NGN.syncMenuState(); });
def('toggle-overtype', () => { const ed = curEd(); NGN.overtype = !NGN.overtype; try { ed.trigger('menu', 'editor.action.toggleOvertype'); } catch { /* not available */ } updateStatus(); });

// ===== SEARCH =========================================================================================================
def(43001, () => NGN.openFindDialog(0)); def(43013, () => NGN.openFindDialog(2)); def(43003, () => NGN.openFindDialog(1)); def(43054, () => NGN.openFindDialog(4));
def(43002, () => { if (!S.find.what) return NGN.openFindDialog(0); NGN.findNext(false); }); def(43010, () => { if (!S.find.what) return NGN.openFindDialog(0); NGN.findNext(true); });
function selectAndFind(back) { const w = wordOrSel(); if (!w) return; S.find.what = w.text; const ed = curEd(); if (ed.getSelection().isEmpty()) ed.setSelection(w.range); NGN.findNext(back); }
def(43048, () => selectAndFind(false)); def(43049, () => selectAndFind(true));
const volatile = (back) => { const w = wordOrSel(); if (!w) return; NGN.findNext(back, { what: w.text, mode: 'normal', matchCase: false, whole: false }); };
def(43014, () => volatile(false)); def(43015, () => volatile(true));
def(43011, () => NGN.openIncremental());
def(43045, () => { if (!$('#panel-bottom').classList.contains('hidden') && NGN.bottomPanel === 'results') NGN.hideBottomPanel(); else NGN.showResultsPanel(); });
def(43046, () => NGN.gotoSearchResult(1)); def(43047, () => NGN.gotoSearchResult(-1));
def(43004, () => NGN.openGoTo());
def(43009, () => act('editor.action.jumpToBracket')); def(43053, () => act('editor.action.selectToBracket'));
def(43052, () => NGN.openFindChars());

// change history
const chLines = (doc) => [...doc.ch.keys()].map((id) => doc.model.getDecorationRange(id)?.startLineNumber).filter(Boolean).sort((a, b) => a - b);
def(43067, () => { const ed = curEd(), l = chLines(curDoc()), cur = ed.getPosition().lineNumber; const n = l.find((x) => x > cur) ?? l[0]; if (n) { ed.setPosition({ lineNumber: n, column: 1 }); ed.revealLineInCenter(n); } });
def(43068, () => { const ed = curEd(), l = chLines(curDoc()), cur = ed.getPosition().lineNumber; const n = [...l].reverse().find((x) => x < cur) ?? l[l.length - 1]; if (n) { ed.setPosition({ lineNumber: n, column: 1 }); ed.revealLineInCenter(n); } });
def(43069, () => NGN.clearChangeHistory(curDoc()));

// styles (mark colors 1-5)
const STYLE_ALL = [43022, 43024, 43026, 43028, 43030], STYLE_ONE = [43062, 43063, 43064, 43065, 43066], STYLE_CLR = [43023, 43025, 43027, 43029, 43031];
STYLE_ALL.forEach((id, i) => def(id, () => { const w = wordOrSel(); if (!w) return; const { hits } = NGN.findAllIn(curDoc(), { what: w.text, mode: 'normal', matchCase: S.prefs.styleTokenCase, whole: S.prefs.styleTokenWord && !/\s/.test(w.text) }); NGN.mark.apply(curDoc(), i + 1, hits.map((h) => h.range)); }));
STYLE_ONE.forEach((id, i) => def(id, () => { const w = wordOrSel(); if (w) NGN.mark.apply(curDoc(), i + 1, [w.range]); }));
STYLE_CLR.forEach((id, i) => def(id, () => NGN.mark.clear(curDoc(), i + 1)));
def(43032, () => NGN.mark.clearAll(curDoc()));
const KEYS = [1, 2, 3, 4, 5, 'find'];
function jump(key, dir) { const ed = curEd(), r = NGN.mark.ranges(curDoc(), key); if (!r.length) return NGN.toast('No marks of that style.'); const p = ed.getPosition(); let t; if (dir > 0) t = r.find((x) => x.getStartPosition().isBefore(p) === false && !x.getStartPosition().equals(p)) || r[0]; else t = [...r].reverse().find((x) => x.getStartPosition().isBefore(p)) || r[r.length - 1]; ed.setSelection(t); ed.revealRangeInCenterIfOutsideViewport(t); }
[43033, 43034, 43035, 43036, 43037, 43038].forEach((id, i) => def(id, () => jump(KEYS[i], -1))); [43039, 43040, 43041, 43042, 43043, 43044].forEach((id, i) => def(id, () => jump(KEYS[i], 1)));
[43055, 43056, 43057, 43058, 43059, 43061].forEach((id, i) => def(id, () => { const d = curDoc(); cp(NGN.mark.ranges(d, KEYS[i]).map((r) => d.model.getValueInRange(r)).join('\n')); }));
def(43060, () => { const d = curDoc(); const all = KEYS.flatMap((k) => NGN.mark.ranges(d, k)).sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn); cp(all.map((r) => d.model.getValueInRange(r)).join('\n')); });

// bookmarks
NGN.bm = {
  lines(doc) { return (doc.bmIds || []).map((id) => doc.model.getDecorationRange(id)?.startLineNumber).filter(Boolean).sort((a, b) => a - b); },
  has(doc, line) { return NGN.bm.lines(doc).includes(line); },
  add(doc, line) { if (NGN.bm.has(doc, line)) return; (doc.bmIds ||= []).push(...doc.model.deltaDecorations([], [{ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, glyphMarginClassName: 'bm-glyph', stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } }])); },
  remove(doc, line) { const keep = []; const del = []; (doc.bmIds || []).forEach((id) => { (doc.model.getDecorationRange(id)?.startLineNumber === line ? del : keep).push(id); }); doc.model.deltaDecorations(del, []); doc.bmIds = keep; },
  clear(doc) { doc.model.deltaDecorations(doc.bmIds || [], []); doc.bmIds = []; },
};
def(43005, () => { const d = curDoc(), l = curEd().getPosition().lineNumber; NGN.bm.has(d, l) ? NGN.bm.remove(d, l) : NGN.bm.add(d, l); });
def(43006, () => { const ed = curEd(), l = NGN.bm.lines(curDoc()), cur = ed.getPosition().lineNumber; const n = l.find((x) => x > cur) ?? l[0]; if (n) { ed.setPosition({ lineNumber: n, column: 1 }); ed.revealLineInCenter(n); } });
def(43007, () => { const ed = curEd(), l = NGN.bm.lines(curDoc()), cur = ed.getPosition().lineNumber; const n = [...l].reverse().find((x) => x < cur) ?? l[l.length - 1]; if (n) { ed.setPosition({ lineNumber: n, column: 1 }); ed.revealLineInCenter(n); } });
def(43008, () => NGN.bm.clear(curDoc()));
const bmText = (doc, inv = false) => { const set = new Set(NGN.bm.lines(doc)); const lines = []; for (let i = 1; i <= doc.model.getLineCount(); i++) if (set.has(i) !== inv) lines.push(i); return lines; };
const joinLines = (doc, ls) => ls.map((i) => doc.model.getLineContent(i)).join(doc.model.getEOL()) + (ls.length ? doc.model.getEOL() : '');
def(43018, async () => { const d = curDoc(), ls = bmText(d); if (!ls.length) return; await cp(joinLines(d, ls)); removeLines(d, ls); });
def(43019, () => { const d = curDoc(); cp(joinLines(d, bmText(d))); });
function removeLines(d, ls) {
  const ed = S.views[d.view].ed, m = d.model, n = m.getLineCount(); const runs = [];
  [...ls].sort((a, b) => a - b).forEach((l) => { const r = runs[runs.length - 1]; if (r && l === r[1] + 1) r[1] = l; else runs.push([l, l]); });
  const edits = runs.reverse().map(([a, b]) => ({ range: b < n ? new monaco.Range(a, 1, b + 1, 1) : a > 1 ? new monaco.Range(a - 1, m.getLineMaxColumn(a - 1), b, m.getLineMaxColumn(b)) : new monaco.Range(1, 1, b, m.getLineMaxColumn(b)), text: '' }));
  ed.pushUndoStop(); ed.executeEdits('rm', edits); ed.pushUndoStop();
}
def(43020, async () => { const d = curDoc(), ls = bmText(d); const t = (await ngn.clip.readText()).replace(/\r?\n$/, ''); const ed = curEd(); const edits = ls.map((i) => ({ range: new monaco.Range(i, 1, i, d.model.getLineMaxColumn(i)), text: t })); ed.pushUndoStop(); ed.executeEdits('bm', edits); ed.pushUndoStop(); });
def(43021, () => { const d = curDoc(); removeLines(d, bmText(d)); });
def(43051, () => { const d = curDoc(); removeLines(d, bmText(d, true)); });
def(43050, () => { const d = curDoc(); const set = new Set(NGN.bm.lines(d)); NGN.bm.clear(d); for (let i = 1; i <= d.model.getLineCount(); i++) if (!set.has(i)) NGN.bm.add(d, i); });

// ===== VIEW ===========================================================================================================
const toggles = {};
def(44034, () => { toggles.top = !toggles.top; ngn.win.alwaysOnTop(toggles.top); NGN.syncMenuState(); });
def(44032, async () => { const f = await ngn.win.isFullScreen(); await ngn.win.fullScreen(!f); NGN.syncMenuState(); });
def(44009, () => { document.body.classList.toggle('postit'); toggles.postit = document.body.classList.contains('postit'); ngn.win.setMenuVisible(!toggles.postit); ngn.win.alwaysOnTop(toggles.postit && toggles.top); NGN.syncMenuState(); setTimeout(() => S.views.forEach((v) => v.ed?.layout()), 50); });
def(44011, () => { const on = document.body.classList.toggle('distraction'); toggles.distraction = on; curEd().updateOptions({ lineNumbers: on ? 'off' : (S.prefs.lineNumbers ? 'on' : 'off'), glyphMargin: !on && S.prefs.bookmarkMargin, folding: !on }); ngn.win.fullScreen(on); NGN.syncMenuState(); setTimeout(() => S.views.forEach((v) => v.ed?.layout()), 100); });
const viewIn = (appName) => () => curDoc()?.path ? ngn.file.openIn(appName, curDoc().path) : NGN.toast('Save the file first.');
def(44100, viewIn('Firefox')); def(44101, viewIn('Google Chrome')); def(44102, viewIn('Microsoft Edge')); def(44103, viewIn('Safari'));
const setPref = (k, v) => { S.prefs[k] = v; NGN.applyEditorOptions(); NGN.saveCfgSoon(); NGN.syncMenuState(); };
def(44025, () => setPref('whitespace', !S.prefs.whitespace));
def(44026, () => { S.prefs.eolVisible = !S.prefs.eolVisible; NGN.refreshEolMarks(); NGN.saveCfgSoon(); NGN.syncMenuState(); });
def(44130, () => { S.prefs.whitespace = S.prefs.eolVisible = true; NGN.applyEditorOptions(); NGN.refreshEolMarks(); NGN.syncMenuState(); });
def(44131, () => setPref('ctrlChars', !S.prefs.ctrlChars));
def(44019, () => { const on = !S.prefs.allChars; S.prefs.allChars = on; S.prefs.whitespace = on; S.prefs.eolVisible = on; S.prefs.ctrlChars = on; NGN.applyEditorOptions(); NGN.refreshEolMarks(); NGN.saveCfgSoon(); NGN.syncMenuState(); });
def(44020, () => setPref('indentGuide', !S.prefs.indentGuide));
def(44041, () => { S.prefs.wrapSymbol = !S.prefs.wrapSymbol; document.body.classList.toggle('wrap-sym', S.prefs.wrapSymbol); NGN.syncMenuState(); });
const zoom = (d) => { S.prefs.zoom = d === 0 ? 0 : Math.max(-6, Math.min(40, (S.prefs.zoom || 0) + d)); NGN.applyEditorOptions(); };
def(44023, () => zoom(1)); def(44024, () => zoom(-1)); def(44033, () => zoom(0));
def(44022, () => setPref('wordWrap', !S.prefs.wordWrap));
def(10001, () => { const d = curDoc(); NGN.moveTabTo(d.id, 1 - d.view, null); });
def(10002, () => { const d = curDoc(); const c = createDoc({ path: null, name: d.name + ' (clone)', text: d.model.getValue(), enc: d.enc, eol: docEol(d), lang: d.lang, view: 1 - d.view }); c.cloneOf = d.id; });
def(10003, async () => { const d = curDoc(); if (!d.path) return NGN.toast('Save the file first.'); await ngn.file.newInstance(d.path); closeDoc(d, { discard: true }); });
def(10004, () => { const d = curDoc(); if (!d.path) return NGN.toast('Save the file first.'); ngn.file.newInstance(d.path); });
[44086, 44087, 44088, 44089, 44090, 44091, 44092, 44093, 44094].forEach((id, i) => def(id, () => { const v = curView(); const t = v.order[i]; if (t) activateDoc(t); }));
def(44116, () => { const v = curView(); activateDoc(v.order[0]); }); def(44117, () => { const v = curView(); activateDoc(v.order[v.order.length - 1]); });
def(44095, () => { const v = curView(); const i = v.order.indexOf(v.active); activateDoc(v.order[(i + 1) % v.order.length]); }); def(44096, () => { const v = curView(); const i = v.order.indexOf(v.active); activateDoc(v.order[(i - 1 + v.order.length) % v.order.length]); });
def(10005, () => { const v = curView(); const id = v.active; v.order = [id, ...v.order.filter((x) => x !== id)]; renderTabs(v); }); def(10006, () => { const v = curView(); const id = v.active; v.order = [...v.order.filter((x) => x !== id), id]; renderTabs(v); });
def(44098, () => { const v = curView(); const i = v.order.indexOf(v.active); if (i < v.order.length - 1) { [v.order[i], v.order[i + 1]] = [v.order[i + 1], v.order[i]]; renderTabs(v); } }); def(44099, () => { const v = curView(); const i = v.order.indexOf(v.active); if (i > 0) { [v.order[i], v.order[i - 1]] = [v.order[i - 1], v.order[i]]; renderTabs(v); } });
[44111, 44112, 44113, 44114, 44115].forEach((id, i) => def(id, () => { curDoc().color = i + 1; renderTabs(curView()); })); def(44110, () => { curDoc().color = 0; renderTabs(curView()); });
def(44072, () => { if (!S.split) return NGN.toast('Open a second view first (Move/Clone Current Document).'); S.cur = 1 - S.cur; curEd().focus(); });
def(44042, () => NGN.hideLines());
def(44010, () => act('editor.foldAll')); def(44029, () => act('editor.unfoldAll')); def(44030, () => act('editor.fold')); def(44031, () => act('editor.unfold'));
[44051, 44052, 44053, 44054, 44055, 44056, 44057, 44058].forEach((id, i) => def(id, () => act('editor.foldLevel' + Math.min(i + 1, 7))));
[44061, 44062, 44063, 44064, 44065, 44066, 44067, 44068].forEach((id, i) => def(id, async () => { await act('editor.unfoldAll'); if (i < 6) await act('editor.foldLevel' + (i + 2)); }));
def(44049, () => NGN.openSummary());
def(44081, () => NGN.togglePanel('project1')); def(44082, () => NGN.togglePanel('project2')); def(44083, () => NGN.togglePanel('project3'));
def(44085, () => NGN.togglePanel('workspace')); def(44080, () => NGN.togglePanel('docmap')); def(44070, () => NGN.togglePanel('doclist')); def(44084, () => NGN.togglePanel('funclist'));
def(44035, () => { S.syncV = !S.syncV; NGN.syncMenuState(); }); def(44036, () => { S.syncH = !S.syncH; NGN.syncMenuState(); });
def(42026, () => { document.body.classList.add('dm-rtl'); curEd().getDomNode().style.direction = 'rtl'; }); def(42027, () => { document.body.classList.remove('dm-rtl'); curEd().getDomNode().style.direction = 'ltr'; });
def(44097, () => { const d = curDoc(); d.monitoring = !d.monitoring; NGN.setMonitoring(d, d.monitoring); NGN.syncMenuState(); });

// ===== ENCODING =======================================================================================================
const ENC_IDS = { 45004: 'ansi', 45008: 'utf8', 45005: 'utf8-bom', 45006: 'utf16be-bom', 45007: 'utf16le-bom' };
const CS = { 45029: 'iso-8859-1', 45030: 'iso-8859-2', 45031: 'iso-8859-3', 45032: 'iso-8859-4', 45033: 'iso-8859-5', 45034: 'iso-8859-6', 45035: 'iso-8859-7', 45036: 'iso-8859-8', 45037: 'iso-8859-9', 45040: 'iso-8859-13', 45041: 'iso-8859-14', 45042: 'iso-8859-15', 45020: 'windows-1250', 45021: 'windows-1251', 45022: 'windows-1252', 45023: 'windows-1253', 45024: 'windows-1254', 45025: 'windows-1255', 45026: 'windows-1256', 45027: 'windows-1257', 45028: 'windows-1258', 45044: 'cp437', 45045: 'cp720', 45046: 'cp737', 45047: 'cp775', 45048: 'cp850', 45049: 'cp852', 45050: 'cp855', 45051: 'cp857', 45052: 'cp858', 45053: 'cp860', 45054: 'cp861', 45055: 'cp862', 45056: 'cp863', 45057: 'cp865', 45058: 'cp866', 45059: 'cp869', 45060: 'big5', 45061: 'gb2312', 45062: 'shift_jis', 45063: 'cp949', 45064: 'euc-kr', 45065: 'tis620', 45066: 'macintosh', 45067: 'koi8-u', 45068: 'koi8-r' };
Object.entries(ENC_IDS).forEach(([id, e]) => def(+id, async () => { const d = curDoc(); if (d.path && !isDirty(d)) await reloadWithEncoding(d, e); else { d.enc = e; updateStatus(); } }));
Object.entries(CS).forEach(([id, e]) => def(+id, async () => { const d = curDoc(); const enc = 'cs:' + e; if (d.path && !isDirty(d)) await reloadWithEncoding(d, enc); else { d.enc = enc; updateStatus(); } }));
[[45009, 'ansi'], [45010, 'utf8'], [45011, 'utf8-bom'], [45012, 'utf16be-bom'], [45013, 'utf16le-bom']].forEach(([id, e]) => def(id, () => { const d = curDoc(); d.enc = e; d.forceDirty = true; renderTabs(curView()); updateStatus(); NGN.updateTitle(); }));

// ===== LANGUAGE =======================================================================================================
Object.entries(LANG_BY_MENU_ID).forEach(([id, name]) => def(+id, () => setLanguage(curDoc(), name)));
def(46250, () => NGN.openUDL()); def(46300, () => ngn.file.reveal(S.paths.userData)); def(46301, () => ngn.file.openUrl('https://github.com/notepad-plus-plus/userDefinedLanguages')); def(46180, () => NGN.openUDL());

// ===== SETTINGS / TOOLS / MACRO / RUN / PLUGINS / WINDOW / HELP ====================================================
def(48011, () => NGN.openPrefs()); def(46001, () => NGN.openStyleConfigurator()); def(48009, () => NGN.openShortcutMapper());
def(48005, async () => { NGN.alert('Import plugin(s)', 'Plugins for this build are bundled (MIME Tools, Converter, NppExport, JSON Viewer). Native Windows .dll plugins cannot be loaded on macOS.'); });
def(48006, async () => { const f = await ngn.dlg.open({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Theme XML', extensions: ['xml'] }] }); if (f.length) NGN.importThemes(f); });
def(48018, async () => { const p = S.paths.userData + '/contextMenu.xml'; if (!(await ngn.file.exists(p))) { await ngn.file.write(p, await ngn.file.readData('contextMenu.xml'), 'utf8'); } await openPath(p); NGN.toast('Save this file, then it applies after Reload'); });
const HASH = { 48501: ['md5', 'MD5'], 48507: ['sha1', 'SHA-1'], 48504: ['sha256', 'SHA-256'], 48510: ['sha512', 'SHA-512'] };
Object.entries(HASH).forEach(([id, [a, n]]) => { def(+id, () => NGN.hashDialog(a, n, 'text')); def(+id + 1, () => NGN.hashDialog(a, n, 'files')); def(+id + 2, async () => { const t = selText(); if (!t) return NGN.toast('Nothing selected.'); const h = await ngn.hash(t, a); await cp(h); }); });
def(42018, () => NGN.macroStart()); def(42019, () => NGN.macroStop()); def(42021, () => NGN.macroPlay(1)); def(42025, () => NGN.macroSave()); def(42032, () => NGN.macroRunMultiple());
def(49000, () => NGN.openRunDialog());
def(48014, () => ngn.file.reveal(S.paths.root + '/plugins'));
def(11001, () => NGN.openWindowsDialog());
const SORTBY = { 11002: (a, b) => a.name.localeCompare(b.name), 11003: (a, b) => b.name.localeCompare(a.name), 11004: (a, b) => (a.path || '').localeCompare(b.path || ''), 11005: (a, b) => (b.path || '').localeCompare(a.path || ''), 11006: (a, b) => ext(a).localeCompare(ext(b)), 11007: (a, b) => ext(b).localeCompare(ext(a)), 11008: (a, b) => a.model.getValueLength() - b.model.getValueLength(), 11009: (a, b) => b.model.getValueLength() - a.model.getValueLength(), 11010: (a, b) => a.mtime - b.mtime, 11011: (a, b) => b.mtime - a.mtime };
const ext = (d) => (d.name.includes('.') ? d.name.split('.').pop() : '');
Object.entries(SORTBY).forEach(([id, cmp]) => def(+id, () => { const v = curView(); v.order = v.order.map((i) => S.docs.get(i)).sort(cmp).map((d) => d.id); renderTabs(v); }));
def(11020, () => { const v = curView(); if (S.mru?.length > 1) activateDoc(S.mru[1]); });
def(47010, () => NGN.alert('Command Line Arguments', 'Usage: NextGenNote [file ...]\nFiles passed on the command line are opened as tabs.\nOn macOS: open -a NextGenNote file.txt'));
def(47001, () => ngn.file.openUrl('https://notepad-plus-plus.org/')); def(47002, () => ngn.file.openUrl('https://github.com/notepad-plus-plus/notepad-plus-plus/')); def(47003, () => ngn.file.openUrl('https://npp-user-manual.org/')); def(47004, () => ngn.file.openUrl('https://community.notepad-plus-plus.org/'));
def(47006, () => ngn.file.openUrl('https://notepad-plus-plus.org/downloads/'));
def(47009, () => NGN.openPrefs('Updater')); def(47012, () => NGN.openDebugInfo()); def(47000, () => NGN.openAbout());
def('plugins-admin', () => NGN.openPluginsAdmin());

// misc: nth-tab movement is keyed by menu ids above. MRU list for "Recent Window"
S.mru = [];
NGN.on('doc-activated', (d) => { if (!d) return; S.mru = [d.id, ...S.mru.filter((x) => x !== d.id && S.docs.has(x))].slice(0, 30); });
