// Find / Replace / Mark / Find in Files / Incremental search / Go to / Find characters in range.
import { monaco } from './core.js';
import { S, NGN, curEd, curDoc, curView } from './state.js';

const { el, $ } = NGN;
const ngn = window.ngn;
const LF = monaco.editor.EndOfLinePreference.LF;

// ---- search engine ---------------------------------------------------------------------------
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
export function unescapeExtended(s) {
  return s.replace(/\\(\\|n|r|t|0|x[0-9a-fA-F]{2}|o[0-7]{3}|d\d{3}|u[0-9a-fA-F]{4})/g, (m, c) => {
    if (c === '\\') return '\\'; if (c === 'n') return '\n'; if (c === 'r') return '\r'; if (c === 't') return '\t'; if (c === '0') return '\0';
    if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16)); if (c[0] === 'o') return String.fromCharCode(parseInt(c.slice(1), 8));
    if (c[0] === 'd') return String.fromCharCode(parseInt(c.slice(1), 10)); return String.fromCharCode(parseInt(c.slice(1), 16));
  });
}
export function buildRegex(o, forceGlobal = true) {
  let src;
  if (o.mode === 'regex') src = o.what;
  else { src = escRe(o.mode === 'extended' ? unescapeExtended(o.what) : o.what); if (o.whole) src = `(?<![\\p{L}\\p{N}_])${src}(?![\\p{L}\\p{N}_])`; }
  const flags = (forceGlobal ? 'g' : '') + (o.matchCase ? '' : 'i') + 'm' + (o.mode === 'regex' && o.dotNL ? 's' : '') + 'u';
  try { return new RegExp(src, flags); } catch { return new RegExp(src, flags.replace('u', '')); }
}

// Offsets are relative to the LF-normalised text so CRLF documents behave the same.
class Index {
  constructor(text) { this.text = text; this.starts = [0]; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.starts.push(i + 1); }
  pos(off) { let lo = 0, hi = this.starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.starts[mid] <= off) lo = mid; else hi = mid - 1; } return { line: lo + 1, col: off - this.starts[lo] + 1 }; }
  off(line, col) { return (this.starts[line - 1] ?? this.text.length) + col - 1; }
  range(a, b) { const p = this.pos(a), q = this.pos(b); return new monaco.Range(p.line, p.col, q.line, q.col); }
}
export function findAllIn(doc, o, within) {
  const text = doc.model.getValue(LF); const ix = new Index(text); const re = buildRegex(o); const out = [];
  let from = 0, to = text.length;
  if (within) { from = ix.off(within.startLineNumber, within.startColumn); to = ix.off(within.endLineNumber, within.endColumn); }
  re.lastIndex = from; let m;
  while ((m = re.exec(text))) {
    if (m.index + m[0].length > to) break;
    if (m[0] === '') { re.lastIndex++; if (re.lastIndex > to) break; if (o.mode !== 'regex') continue; }
    out.push({ start: m.index, end: m.index + m[0].length, m: m, range: ix.range(m.index, m.index + m[0].length) });
    if (out.length > 200000) break;
  }
  return { hits: out, ix, text };
}
NGN.findAllIn = findAllIn;

function expandReplacement(rep, m, o) {
  if (o.mode === 'normal') return rep;
  let out = '';
  for (let i = 0; i < rep.length; i++) {
    const c = rep[i], n = rep[i + 1];
    if ((c === '\\' || c === '$') && n >= '0' && n <= '9' && o.mode === 'regex') { out += m[+n] ?? ''; i++; }
    else if (c === '$' && n === '&' && o.mode === 'regex') { out += m[0]; i++; }
    else if (c === '\\' && n === 'n') { out += '\n'; i++; } else if (c === '\\' && n === 'r') { out += '\r'; i++; } else if (c === '\\' && n === 't') { out += '\t'; i++; }
    else if (c === '\\' && n === '\\') { out += '\\'; i++; } else out += c;
  }
  return out;
}

const getOpts = () => ({ what: S.find.what, mode: S.find.mode, matchCase: S.find.matchCase, whole: S.find.whole, dotNL: S.find.dotNL });

// ---- results panel ------------------------------------------------------------------------------
export const results = { blocks: [], flat: [], cursor: -1 };
function renderResults() {
  const body = $('#res-body'); if (!body) return; body.innerHTML = ''; results.flat = [];
  results.blocks.forEach((b, bi) => {
    const hdr = el('div', { class: 'res-file', style: 'background:var(--ui-hot)', text: `Search "${b.query}" (${b.hits} hit${b.hits === 1 ? '' : 's'} in ${b.files.length} file${b.files.length === 1 ? '' : 's'}${b.scanned ? ' of ' + b.scanned + ' searched' : ''})` });
    body.append(hdr);
    b.files.forEach((f) => {
      body.append(el('div', { class: 'res-file', text: `${f.label} (${f.hits.length} hit${f.hits.length === 1 ? '' : 's'})` }));
      f.hits.forEach((h) => {
        const row = el('div', { class: 'res-line', 'data-i': results.flat.length }, el('span', { class: 'ln', text: `Line ${h.line}:` }), h.pre || '', el('b', { text: h.hit || '' }), h.post || '');
        row.addEventListener('dblclick', () => gotoResult(f, h)); row.addEventListener('click', () => { results.cursor = +row.dataset.i; row.parentElement.querySelectorAll('.res-line.sel').forEach((x) => x.classList.remove('sel')); row.classList.add('sel'); });
        results.flat.push({ f, h }); body.append(row);
      });
    });
  });
  body.scrollTop = 0;
}
async function gotoResult(f, h) {
  let doc = f.docId && S.docs.get(f.docId);
  if (!doc && f.path) doc = await NGN.openPath(f.path);
  if (!doc) return;
  NGN.activateDoc(doc.id);
  const ed = curEd(); const r = new monaco.Range(h.line, h.col + 1, h.line, h.col + 1 + (h.len || 0));
  ed.setSelection(r); ed.revealRangeInCenter(r); ed.focus();
}
function makeLine(text, col, len) { const pre = text.slice(Math.max(0, col - 60), col), hit = text.slice(col, col + len), post = text.slice(col + len, col + len + 120); return { pre, hit, post }; }
export function showResults(block) {
  if (S.prefs.purgeResults !== false && S.find.purge) results.blocks = [];
  results.blocks.unshift(block); if (results.blocks.length > 20) results.blocks.length = 20;
  NGN.showBottomPanel('results'); renderResults();
}
NGN.showResultsPanel = () => { NGN.showBottomPanel('results'); renderResults(); };
NGN.buildResultsPanel = (host) => {
  host.innerHTML = '';
  host.append(
    el('div', { class: 'panel-head' }, el('span', { class: 'grow', text: 'Search results' }),
      el('button', { text: 'Find in results…', onclick: () => findInResultsDialog() }), el('button', { text: 'Clear', onclick: () => { results.blocks = []; renderResults(); } }),
      el('span', { class: 'x', text: '✕', onclick: () => NGN.hideBottomPanel() })),
    el('div', { class: 'panel-body', id: 'res-body' }));
  renderResults();
};
NGN.gotoSearchResult = (dir) => {
  if (!results.flat.length) return; results.cursor = (results.cursor + dir + results.flat.length) % results.flat.length;
  const { f, h } = results.flat[results.cursor]; gotoResult(f, h);
  $('#res-body')?.querySelectorAll('.res-line').forEach((r) => r.classList.toggle('sel', +r.dataset.i === results.cursor));
  $('#res-body')?.querySelector('.res-line.sel')?.scrollIntoView({ block: 'nearest' });
};
function findInResultsDialog() {
  const what = el('input', { type: 'text', 'data-focus': true }), only = el('input', { type: 'checkbox' }); const mc = el('input', { type: 'checkbox' }), ww = el('input', { type: 'checkbox' });
  const mode = el('select', {}, el('option', { value: 'normal', text: 'Normal' }), el('option', { value: 'extended', text: 'Extended (\\n, \\r, \\t, \\0, \\x...)' }), el('option', { value: 'regex', text: 'Regular expression' }));
  const st = el('div', { class: 'status' });
  NGN.dialog({ key: 'find-in-results', title: 'Find in search results', width: 420, body: el('div', {}, el('div', { class: 'row' }, el('label', { class: 'f', text: 'Find what:' }), what), el('label', {}, only, 'Search only in found lines'), el('label', {}, ww, 'Match whole word only'), el('label', {}, mc, 'Match case'), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Search mode' }), mode), st),
    buttons: [{ label: 'Find All', primary: true, stay: true, fn: () => {
      const re = buildRegex({ what: what.value, mode: mode.value, matchCase: mc.checked, whole: ww.checked }, false); let n = 0;
      document.querySelectorAll('#res-body .res-line').forEach((r) => { const ok = re.test(r.textContent); r.style.display = ok || !only.checked ? '' : 'none'; if (ok) n++; });
      st.textContent = `${n} matching line(s) in search results`; } }, { label: 'Close' }] });
}

// ---- find / replace actions --------------------------------------------------------------------------------
let status = (msg, kind) => NGN.status(msg);
NGN.setFindStatus = (fn) => { status = fn; };

export function selectMatch(ed, r) { ed.setSelection(r); ed.revealRangeInCenterIfOutsideViewport(r, monaco.editor.ScrollType.Smooth); }

export function findNext(backward = false, opts = getOpts(), { quiet = false } = {}) {
  const ed = curEd(), doc = curDoc(); if (!doc || !opts.what) return false;
  if (S.macroRec && !S.macroPlaying) S.macroRec.push({ find: 'next', back: backward, opts: { ...opts } });
  const { hits, ix } = findAllIn(doc, opts); if (!hits.length) { status(`Find: Can't find the text: "${opts.what}"`, 'err'); return false; }
  const sel = ed.getSelection(); const from = ix.off(sel.startLineNumber, sel.startColumn), to = ix.off(sel.endLineNumber, sel.endColumn);
  let pick;
  if (!backward) { pick = hits.find((h) => h.start >= to) || hits.find((h) => h.start >= from && h.start !== from); if (!pick && S.find.wrap) { pick = hits[0]; status('Find: Found the 1st occurrence from the top. The end of the document has been reached.'); } }
  else { for (let i = hits.length - 1; i >= 0; i--) if (hits[i].end <= from) { pick = hits[i]; break; } if (!pick && S.find.wrap) { pick = hits[hits.length - 1]; status('Find: Found the 1st occurrence from the bottom. The beginning of the document has been reached.'); } }
  if (!pick) { status('Find: no more matches (wrap around is off)', 'err'); return false; }
  selectMatch(ed, pick.range);
  if (!quiet) status(`Find: ${hits.indexOf(pick) + 1} of ${hits.length} matches. Line ${pick.range.startLineNumber}`);
  return true;
}
NGN.findNext = findNext;

export function replaceCurrent() {
  const ed = curEd(), doc = curDoc(); if (!doc || !S.find.what) return;
  const o = getOpts(); const sel = ed.getSelection();
  if (!sel.isEmpty()) {
    const { hits } = findAllIn(doc, o, sel); const h = hits.find((x) => x.range.equalsRange(sel));
    if (h) { ed.pushUndoStop(); ed.executeEdits('replace', [{ range: sel, text: expandReplacement(S.find.repl, h.m, o) }]); ed.pushUndoStop(); }
  }
  findNext(false, o);
}

export function replaceAllIn(doc, o, rep, within) {
  if (S.macroRec && !S.macroPlaying) S.macroRec.push({ find: 'replaceAll', opts: { ...o }, rep });
  const { hits } = findAllIn(doc, o, within); if (!hits.length) return 0;
  const edits = hits.map((h) => ({ range: h.range, text: expandReplacement(rep, h.m, o) }));
  const ed = S.views[doc.view].ed;
  if (S.views[doc.view].active === doc.id) { ed.pushUndoStop(); ed.executeEdits('replaceAll', edits); ed.pushUndoStop(); } else doc.model.pushEditOperations([], edits, () => null);
  return hits.length;
}
NGN.replaceAllIn = replaceAllIn;

function collectDocs(scope) { return scope === 'all' ? [...S.docs.values()] : [curDoc()]; }

export function findAllToResults(scope = 'cur') {
  const o = getOpts(); if (!o.what) return; const files = []; let total = 0;
  for (const d of collectDocs(scope)) {
    const within = S.find.inSel && scope === 'cur' ? S.views[d.view].ed.getSelection() : null;
    const { hits, text } = findAllIn(d, o, within && !within.isEmpty() ? within : null); if (!hits.length) continue;
    const lines = text.split('\n');
    files.push({ label: d.path || d.name, docId: d.id, hits: hits.map((h) => { const l = h.range.startLineNumber; const col = h.range.startColumn - 1; const len = h.range.startLineNumber === h.range.endLineNumber ? h.range.endColumn - h.range.startColumn : (lines[l - 1] || '').length - col; return { line: l, col, len, ...makeLine(lines[l - 1] || '', col, len) }; }) });
    total += hits.length;
  }
  showResults({ query: o.what, hits: total, files, scanned: collectDocs(scope).length });
  status(`Find All: ${total} match(es)`);
}

export function countMatches() {
  const o = getOpts(); const d = curDoc(); const sel = curEd().getSelection();
  const { hits } = findAllIn(d, o, S.find.inSel && !sel.isEmpty() ? sel : null);
  return hits.length;
}

// ---- Mark ------------------------------------------------------------------------------------------------------
NGN.mark = {
  apply(doc, key, ranges) {
    doc.markDeco ||= {}; const cls = key === 'find' ? 'mark-find' : 'mark-' + key;
    const ids = doc.model.deltaDecorations([], ranges.map((r) => ({ range: r, options: { inlineClassName: cls, stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges } })));
    (doc.markDeco[key] ||= []).push(...ids);
  },
  clear(doc, key) { if (!doc.markDeco?.[key]) return; doc.model.deltaDecorations(doc.markDeco[key], []); doc.markDeco[key] = []; },
  clearAll(doc) { Object.keys(doc.markDeco || {}).forEach((k) => NGN.mark.clear(doc, k)); },
  ranges(doc, key) { return (doc.markDeco?.[key] || []).map((id) => doc.model.getDecorationRange(id)).filter(Boolean).sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn); },
};

function markAll() {
  const doc = curDoc(), o = getOpts(); if (!o.what) return;
  if (S.find.purge) NGN.mark.clear(doc, 'find');
  const sel = curEd().getSelection(); const { hits } = findAllIn(doc, o, S.find.inSel && !sel.isEmpty() ? sel : null);
  NGN.mark.apply(doc, 'find', hits.map((h) => h.range));
  if (S.find.bookmarkLine) hits.forEach((h) => NGN.bm.add(doc, h.range.startLineNumber));
  status(`Mark: ${hits.length} match(es) marked`);
}

// ---- Find in Files ---------------------------------------------------------------------------------------------------
async function findInFiles(replace = false, projectsOnly = false) {
  const o = getOpts(); if (!o.what) return;
  const re = buildRegex(o, true);
  const dir = S.find.dir; if (!dir) { status('Find in Files: choose a directory', 'err'); return; }
  const filters = S.find.filters || '*.*';
  status('Searching…');
  const r = await ngn.findInFiles({ dir, filters, recursive: S.find.recursive, hidden: S.find.hidden, regex: re.source, flags: re.flags, multiline: o.mode === 'regex' && o.dotNL, replaceWith: replace ? expandSimple(S.find.repl, o) : undefined, apply: replace });
  const files = r.results.map((f) => ({ label: f.file, path: f.file, hits: f.hits.map((h) => ({ line: h.line, col: h.col, len: h.len, ...makeLine(h.text, h.col, h.len) })) }));
  showResults({ query: (replace ? 'Replace "' + o.what + '" → "' + S.find.repl + '" in files' : o.what), hits: r.hits, files, scanned: r.scanned });
  status(`${replace ? 'Replace' : 'Find'} in Files: ${r.hits} hit(s) in ${r.files} file(s) of ${r.scanned} searched (${r.ms} ms)`);
  if (replace) for (const d of S.docs.values()) if (d.path && files.some((f) => f.path === d.path) && !NGN.isDirty(d)) NGN.reloadFromDisk(d, false);
}
function expandSimple(rep, o) { if (o.mode === 'regex') return rep.replace(/\\(\d)/g, '$$$1').replace(/\\n/g, '\n').replace(/\\t/g, '\t'); if (o.mode === 'extended') return unescapeExtended(rep).replace(/\$/g, '$$$$'); return rep.replace(/\$/g, '$$$$'); }

// ---- the Find dialog (tabs: Find, Replace, Find in Files, Find in Projects, Mark) ------------------------------------------
const TABS = ['Find', 'Replace', 'Find in Files', 'Find in Projects', 'Mark'];
export function openFindDialog(tab = 0) {
  const ed = curEd();
  // "When Find Dialog is Invoked": fill the Find field from the selection or word under the caret.
  if (S.prefs.searchFillSelected && ed) {
    const sel = ed.getSelection();
    if (!sel.isEmpty() && sel.startLineNumber === sel.endLineNumber) S.find.what = ed.getModel().getValueInRange(sel).slice(0, S.prefs.searchMaxFill);
    else if (sel.isEmpty() && S.prefs.searchWordUnderCaret) { const w = ed.getModel().getWordAtPosition(ed.getPosition()); if (w) S.find.what = w.word; }
    if (!sel.isEmpty() && sel.startLineNumber !== sel.endLineNumber) S.find.inSel = true;
  }
  if (S.prefs.searchFillDir && curDoc()?.path && !S.find.dir) S.find.dir = curDoc().path.replace(/\/[^/]*$/, '');
  const existing = NGN.dialogOpen('find');
  const d = NGN.dialog({ key: 'find', title: 'Find', width: 540, body: el('div', { id: 'find-body' }), x: Math.max(20, innerWidth - 580), y: 80, buttons: [] });
  const render = (idx) => {
    d.tab = idx; const b = d.body; b.innerHTML = '';
    const tabs = el('div', { class: 'tabs' }, TABS.map((t, i) => el('button', { text: t, class: i === idx ? 'on' : '', onclick: () => { sync(); render(i); } })));
    const what = el('input', { type: 'text', 'data-focus': true, value: S.find.what, style: 'flex:1' }); what.value = S.find.what;
    const rep = el('input', { type: 'text', style: 'flex:1' }); rep.value = S.find.repl;
    const filt = el('input', { type: 'text', style: 'flex:1' }); filt.value = S.find.filters || '*.*';
    const dir = el('input', { type: 'text', style: 'flex:1' }); dir.value = S.find.dir;
    const cb = (k, label, dis) => { const i = el('input', { type: 'checkbox' }); i.checked = !!S.find[k]; i.addEventListener('change', () => { S.find[k] = i.checked; NGN.saveCfgSoon(); updateModeDeps?.(); }); i.dataset.k = k; return el('label', {}, i, label); };
    const modeRadio = (v, label) => { const i = el('input', { type: 'radio', name: 'fmode' }); i.checked = S.find.mode === v; i.addEventListener('change', () => { S.find.mode = v; updateModeDeps(); }); return el('label', {}, i, label); };
    const st = el('div', { class: 'status', id: 'find-status' }); setFindStatusEl(st);
    let updateModeDeps = () => { const dot = b.querySelector('[data-k=dotNL]'); if (dot) dot.disabled = S.find.mode !== 'regex'; const w = b.querySelector('[data-k=whole]'); if (w) w.disabled = S.find.mode === 'regex'; };
    const rows = [el('div', { class: 'row' }, el('label', { class: 'f', text: 'Find what:' }), what)];
    if (idx === 1 || idx === 2) rows.push(el('div', { class: 'row' }, el('label', { class: 'f', text: 'Replace with:' }), rep));
    if (idx === 2) {
      rows.push(el('div', { class: 'row' }, el('label', { class: 'f', text: 'Filters:' }), filt));
      rows.push(el('div', { class: 'row' }, el('label', { class: 'f', text: 'Directory:' }), dir, el('button', { text: '…', onclick: async () => { const p = await ngn.dlg.open({ properties: ['openDirectory'] }); if (p[0]) { dir.value = p[0]; S.find.dir = p[0]; } } }),
        el('button', { text: '⇦ Follow doc', title: 'Use current document directory', onclick: () => { const p = curDoc()?.path; if (p) dir.value = p.replace(/\/[^/]*$/, ''); } })));
      rows.push(el('div', { class: 'cols' }, cb('recursive', 'In all sub-folders'), cb('hidden', 'In hidden folders')));
    }
    if (idx === 4) rows.push(el('div', { class: 'cols' }, cb('bookmarkLine', 'Bookmark line'), cb('purge', 'Purge for each search')));
    const opts = el('div', { class: 'cols' },
      el('div', {}, idx !== 3 && idx !== 2 ? cb('backward', 'Backward direction') : null, cb('whole', 'Match whole word only'), cb('matchCase', 'Match case'), idx < 2 ? cb('wrap', 'Wrap around') : null, (idx < 2 || idx === 4) ? cb('inSel', 'In selection') : null),
      el('fieldset', {}, el('legend', { text: 'Search Mode' }), modeRadio('normal', 'Normal'), modeRadio('extended', 'Extended (\\n, \\r, \\t, \\0, \\x...)'), modeRadio('regex', 'Regular expression'), cb('dotNL', '. matches newline')));
    const btnRow = (l) => el('button', { text: l[0], onclick: l[1], class: l[2] ? 'primary' : '' });
    const run = (fn) => () => { sync(); fn(); NGN.saveCfgSoon(); };
    const B = [];
    if (idx === 0) B.push(['Find Next', run(() => { findNext(S.find.backward); if (!S.prefs.searchStayOpen) { /* stays open like the original */ } }), 1], ['Count', run(() => status(`Count: ${countMatches()} match(es)`))], ['Find All in Current Document', run(() => findAllToResults('cur'))], ['Find All in All Opened Documents', run(() => findAllToResults('all'))]);
    if (idx === 1) B.push(['Find Next', run(() => findNext(S.find.backward)), 1], ['Replace', run(replaceCurrent)], ['Replace All', run(() => { const n = replaceAllIn(curDoc(), getOpts(), S.find.repl, S.find.inSel && !curEd().getSelection().isEmpty() ? curEd().getSelection() : null); status(`Replace All: ${n} occurrence(s) were replaced`); })],
      ['Replace All in All Opened Documents', run(() => { let n = 0; for (const x of S.docs.values()) n += replaceAllIn(x, getOpts(), S.find.repl); status(`Replace in Opened Docs: ${n} occurrence(s) were replaced`); })], ['Replace All in Selection', run(() => { const s = curEd().getSelection(); if (s.isEmpty()) return status('Nothing selected', 'err'); const n = replaceAllIn(curDoc(), getOpts(), S.find.repl, s); status(`Replace in Selection: ${n} occurrence(s)`); })]);
    if (idx === 2) B.push(['Find All', run(() => findInFiles(false)), 1], ['Replace in Files', run(async () => { if (await NGN.confirm('Replace in Files', `Are you sure you want to replace all occurrences in all matching files under\n${S.find.dir}?\nThis cannot be undone.`)) findInFiles(true); })]);
    if (idx === 3) B.push(['Find All', run(() => findInProjects(false)), 1], ['Replace in Projects', run(async () => { if (await NGN.confirm('Replace in Projects', 'Replace in all files of the selected project panels?')) findInProjects(true); })]);
    if (idx === 4) B.push(['Mark All', run(markAll), 1], ['Clear all marks', run(() => { NGN.mark.clear(curDoc(), 'find'); status('Marks cleared'); })], ['Copy Marked Text', run(() => { const r = NGN.mark.ranges(curDoc(), 'find'); ngn.clip.writeText(r.map((x) => curDoc().model.getValueInRange(x)).join('\n')); status(`Copied ${r.length} marked text(s)`); })]);
    B.push(['Close', () => d.close()]);
    const btns = el('div', { class: 'btns' }, B.map(btnRow));
    b.append(tabs, el('div', { class: 'cols' }, el('div', { style: 'flex:1.3' }, rows, opts), btns), st);
    function sync() { S.find.what = what.value; S.find.repl = rep.value; S.find.filters = filt.value; S.find.dir = dir.value; }
    updateModeDeps();
    what.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sync(); if (idx === 2) findInFiles(false); else if (idx === 4) markAll(); else findNext(e.shiftKey ? !S.find.backward : S.find.backward); } });
    setTimeout(() => { what.focus(); what.select(); }, 0);
    d.setTitle(TABS[idx]);
  };
  d.render = render; render(tab);
  return d;
}
function setFindStatusEl(st) { status = (msg, kind) => { st.textContent = msg; st.classList.toggle('err', kind === 'err'); NGN.status(msg); }; }
async function findInProjects(replace) {
  const files = NGN.projectFiles?.() || []; if (!files.length) return status('Find in Projects: no project files', 'err');
  const o = getOpts(); const re = buildRegex(o, true); const out = []; let total = 0;
  for (const p of files) { try { const r = await ngn.file.read(p); const lines = r.text.split(/\r\n|\n|\r/); const hits = []; lines.forEach((ln, i) => { re.lastIndex = 0; let m; while ((m = re.exec(ln))) { if (!m[0]) { re.lastIndex++; continue; } hits.push({ line: i + 1, col: m.index, len: m[0].length, ...makeLine(ln, m.index, m[0].length) }); } }); if (hits.length) { out.push({ label: p, path: p, hits }); total += hits.length; } } catch { /* unreadable */ } }
  showResults({ query: o.what, hits: total, files: out, scanned: files.length });
}
NGN.openFindDialog = openFindDialog;

// ---- incremental search bar ----------------------------------------------------------------------------------------------------
export function openIncremental() {
  const bar = $('#incsearch'); bar.classList.remove('hidden'); bar.innerHTML = '';
  const inp = el('input', { type: 'text', placeholder: 'Incremental search', 'data-focus': true });
  const hl = el('input', { type: 'checkbox' }), mc = el('input', { type: 'checkbox' });
  const doc = () => curDoc();
  const clear = () => { const d = doc(); if (d?.incDeco) d.model.deltaDecorations(d.incDeco, []), d.incDeco = []; };
  const go = (backward, fromStart) => {
    const o = { what: inp.value, mode: 'normal', matchCase: mc.checked, whole: false }; clear(); if (!o.what) { inp.classList.remove('nf'); return; }
    const ed = curEd(); if (fromStart) { const s = ed.getSelection(); ed.setPosition(backward ? s.getEndPosition() : s.getStartPosition()); }
    const ok = findNext(backward, o, { quiet: true }); inp.classList.toggle('nf', !ok);
    if (hl.checked && ok) { const d = doc(); const { hits } = findAllIn(d, o); d.incDeco = d.model.deltaDecorations([], hits.map((h) => ({ range: h.range, options: { inlineClassName: 'inc-hl' } }))); }
  };
  inp.addEventListener('input', () => go(false, true));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e.shiftKey); if (e.key === 'Escape') { clear(); bar.classList.add('hidden'); curEd().focus(); } });
  hl.addEventListener('change', () => go(false, true)); mc.addEventListener('change', () => go(false, true));
  bar.append(el('b', { text: 'Incremental Search:' }), inp, el('button', { text: '▲', onclick: () => go(true) }), el('button', { text: '▼', onclick: () => go(false) }), el('label', {}, hl, 'Highlight all'), el('label', {}, mc, 'Match case'), el('span', { class: 'grow', style: 'flex:1' }), el('button', { text: '✕', onclick: () => { clear(); bar.classList.add('hidden'); } }));
  const sel = curEd().getSelection(); if (!sel.isEmpty()) inp.value = curDoc().model.getValueInRange(sel);
  inp.focus(); inp.select();
}
NGN.openIncremental = openIncremental;

// ---- Go to / Find characters in range --------------------------------------------------------------------------------------------
NGN.openGoTo = () => {
  const ed = curEd(), doc = curDoc(); const m = doc.model;
  const pos = ed.getPosition(); let mode = 'line';
  const info = el('div', {}); const inp = el('input', { type: 'text', 'data-focus': true, style: 'width:100%' });
  const r1 = el('input', { type: 'radio', name: 'gt', checked: true }), r2 = el('input', { type: 'radio', name: 'gt' });
  const upd = () => { mode = r1.checked ? 'line' : 'offset'; info.innerHTML = ''; const here = mode === 'line' ? pos.lineNumber : m.getOffsetAt(pos); const max = mode === 'line' ? m.getLineCount() : m.getValueLength(); info.append(el('div', { text: `You are here: ${here}` }), el('div', { text: `You can't go further than: ${max}` })); };
  r1.addEventListener('change', upd); r2.addEventListener('change', upd); upd();
  const go = () => { const n = parseInt(inp.value, 10); if (isNaN(n)) return; if (mode === 'line') { const l = Math.max(1, Math.min(n, m.getLineCount())); ed.setPosition({ lineNumber: l, column: 1 }); ed.revealLineInCenter(l); } else { const p = m.getPositionAt(Math.max(0, Math.min(n, m.getValueLength()))); ed.setPosition(p); ed.revealPositionInCenter(p); } };
  NGN.dialog({ key: 'goto', title: 'Go To...', width: 300, body: el('div', {}, el('div', { class: 'cols' }, el('label', {}, r1, 'Line'), el('label', {}, r2, 'Offset')), info, el('div', { text: 'You want to go to:', style: 'margin-top:8px' }), inp),
    buttons: [{ label: 'Go', primary: true, fn: go }, { label: 'Cancel' }] });
};

NGN.openFindChars = () => {
  let mode = 'non-ascii'; const lo = el('input', { type: 'number', value: 0, style: 'width:70px' }), hi = el('input', { type: 'number', value: 255, style: 'width:70px' }); let dir = 'down'; let wrap = true;
  const st = el('div', { class: 'status' });
  const R = (v, l, ch) => { const i = el('input', { type: 'radio', name: 'fcr', checked: ch }); i.addEventListener('change', () => { mode = v; }); return el('label', {}, i, l); };
  const D = (v, l, ch) => { const i = el('input', { type: 'radio', name: 'fcd', checked: ch }); i.addEventListener('change', () => { dir = v; }); return el('label', {}, i, l); };
  const w = el('input', { type: 'checkbox', checked: true }); w.addEventListener('change', () => { wrap = w.checked; });
  const find = () => {
    const ed = curEd(), m = curDoc().model; const text = m.getValue(LF); const ix = new Index(text);
    const [a, b] = mode === 'non-ascii' ? [128, 0x10ffff] : mode === 'ascii' ? [0, 127] : [+lo.value, +hi.value]; const test = (c) => c >= a && c <= b;
    const sel = ed.getSelection(); const cur = dir === 'down' ? ix.off(sel.endLineNumber, sel.endColumn) : ix.off(sel.startLineNumber, sel.startColumn) - 1;
    let i = cur, found = -1; const n = text.length;
    for (let k = 0; k < n; k++) { if (dir === 'down') { if (i >= n) { if (!wrap) break; i = 0; } } else if (i < 0) { if (!wrap) break; i = n - 1; } if (test(text.codePointAt(i))) { found = i; break; } i += dir === 'down' ? 1 : -1; }
    if (found < 0) st.textContent = 'Find characters in range: none found'; else { selectMatch(ed, ix.range(found, found + 1)); st.textContent = `Found U+${text.codePointAt(found).toString(16).toUpperCase().padStart(4, '0')}`; }
  };
  NGN.dialog({ key: 'findchars', title: 'Find Characters in Range...', width: 400, body: el('div', {}, R('non-ascii', 'Non-ASCII characters (128-255 and above)', true), R('ascii', 'ASCII characters (0-127)'), el('div', { class: 'row' }, R('custom', 'Custom range (0-255):'), lo, '–', hi), el('fieldset', {}, el('legend', { text: 'Direction' }), D('down', 'Down', true), D('up', 'Up')), el('label', {}, w, 'Wrap around'), st),
    buttons: [{ label: 'Find', primary: true, stay: true, fn: find }, { label: 'Close' }] });
};
