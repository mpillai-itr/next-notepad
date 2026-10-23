// Tools: hashes, column editor, summary, windows list, run dialog, macros, plugins, print, about/debug.
import { monaco, activateDoc, closeDoc, closeMany, saveDoc, isDirty, docEol, renderTabs } from './core.js';
import * as DT from './datatools.js';
import { S, NGN, curEd, curDoc } from './state.js';
import { LANGS } from './languages.js';

const { el, $ } = NGN;
const ngn = window.ngn;
const LF = monaco.editor.EndOfLinePreference.LF;
const edit = (ed, pairs) => { ed.pushUndoStop(); ed.executeEdits('tool', pairs.map(([range, text]) => ({ range, text }))); ed.pushUndoStop(); };

// Data Tools transforms: small inputs run inline (instant, one undo step); big ones go to a worker so the UI never freezes.
// A transform that rewrites the whole document also switches its language (JSON to YAML leaves a YAML document, not JSON).
const DT_WORKER_MIN = 200 * 1024;
let dtWorker, dtSeq = 0; const dtPending = new Map();
const dtRun = (op, args, text) => new Promise((resolve, reject) => {
  if (!dtWorker) {
    dtWorker = new Worker('app://host/dist/datatools.worker.js');
    dtWorker.onmessage = ({ data: { id, text: out, error } }) => { const p = dtPending.get(id); dtPending.delete(id); error ? p.reject(new Error(error)) : p.resolve(out); };
    dtWorker.onerror = (e) => { dtPending.forEach((p) => p.reject(new Error(e.message))); dtPending.clear(); dtWorker.terminate(); dtWorker = null; };
  }
  const id = ++dtSeq; dtPending.set(id, { resolve, reject }); dtWorker.postMessage({ id, op, args, text });
});
const DT_LANG = { jsonToYaml: 'yaml', yamlToJson: 'json' };
function mapDT(op, ...args) {
  const ed = curEd(), m = ed.getModel(), doc = curDoc(); const full = m.getFullModelRange();
  const sels = ed.getSelections().map((s) => (s.isEmpty() ? full : s));
  const texts = sels.map((r) => m.getValueInRange(r));
  const wholeDoc = sels.length === 1 && sels[0].equalsRange(full);
  const finish = (outs) => { edit(ed, sels.map((r, i) => [r, outs[i]])); if (wholeDoc && DT_LANG[op]) NGN.setLanguage(doc, DT_LANG[op]); };
  if (texts.reduce((n, t) => n + t.length, 0) < DT_WORKER_MIN) {
    try { finish(texts.map((t) => DT[op](t, ...args))); } catch (e) { NGN.toast('Error: ' + e.message); }
    return;
  }
  const ver = m.getVersionId(); NGN.toast('Converting…', 60000);
  return Promise.all(texts.map((t) => dtRun(op, args, t))).then((outs) => {
    if (m.isDisposed() || m.getVersionId() !== ver) return NGN.toast('Document changed while converting — cancelled');
    finish(outs); NGN.toast('Done');
  }).catch((e) => NGN.toast('Error: ' + e.message));
}

// ---- hashes ---------------------------------------------------------------------------------------------------
NGN.hashDialog = (algo, name, mode) => {
  const out = el('textarea', { rows: 8, readonly: true, style: 'width:100%;font-family:var(--mono)' });
  if (mode === 'text') {
    const inp = el('textarea', { rows: 6, style: 'width:100%;font-family:var(--mono)', 'data-focus': true }); inp.value = curEd().getModel().getValueInRange(curEd().getSelection());
    const sep = el('input', { type: 'checkbox' });
    const calc = async () => { const parts = sep.checked ? inp.value.split(/\r?\n/) : [inp.value]; const r = []; for (const p of parts) r.push(await ngn.hash(p, algo)); out.value = r.join('\n'); };
    inp.addEventListener('input', calc); sep.addEventListener('change', calc); calc();
    NGN.dialog({ key: 'hash-text', title: `Generate ${name} digest`, width: 520, body: el('div', {}, el('div', { text: 'Text:' }), inp, el('label', {}, sep, 'Treat each line as a separate string'), el('div', { text: 'Digest:' }), out),
      buttons: [{ label: 'Copy to Clipboard', stay: true, fn: () => ngn.clip.writeText(out.value) }, { label: 'Close' }] });
  } else {
    const choose = async () => { const f = await ngn.dlg.open({ properties: ['openFile', 'multiSelections'] }); const r = []; for (const p of f) { try { r.push(`${await ngn.file.hashFile(p, algo)}  ${p}`); } catch (e) { r.push(`(error)  ${p}: ${e.message}`); } } out.value = r.join('\n'); };
    NGN.dialog({ key: 'hash-files', title: `Generate ${name} digest from files`, width: 640, body: el('div', {}, el('button', { text: `Choose files to generate ${name}...`, onclick: choose }), el('div', { text: 'Digest:', style: 'margin-top:8px' }), out),
      buttons: [{ label: 'Copy to Clipboard', stay: true, fn: () => ngn.clip.writeText(out.value) }, { label: 'Close' }] });
  }
};

// ---- Column / Multi-selection editor ----------------------------------------------------------------------------------
NGN.openColumnEditor = () => {
  let kind = 'text';
  const radio = (v, label, ch) => { const i = el('input', { type: 'radio', name: 'ck', checked: ch }); i.addEventListener('change', () => { kind = v; upd(); }); return el('label', {}, i, label); };
  const txt = el('input', { type: 'text', 'data-focus': true, style: 'width:100%' }), init = el('input', { type: 'number', value: 0, style: 'width:90px' }), step = el('input', { type: 'number', value: 1, style: 'width:90px' }), rep = el('input', { type: 'number', value: 1, min: 1, style: 'width:90px' });
  const lead = el('select', {}, el('option', { value: 'none', text: 'None' }), el('option', { value: 'zeros', text: 'Zeros' }), el('option', { value: 'spaces', text: 'Spaces' }));
  const fmt = (v, t, ch) => { const i = el('input', { type: 'radio', name: 'cf', checked: ch }); i.addEventListener('change', () => { base = v; }); return el('label', {}, i, t); }; let base = 10;
  const upd = () => { [init, step, rep, lead].forEach((x) => (x.disabled = kind !== 'number')); txt.disabled = kind !== 'text'; }; upd();
  const run = () => {
    const ed = curEd(), m = ed.getModel(); const sels = ed.getSelections(); let targets = [];
    if (sels.length > 1) targets = sels.map((s) => ({ line: s.startLineNumber, col: s.startColumn, range: s }));
    else { const s = sels[0]; if (s.startLineNumber !== s.endLineNumber) { for (let l = s.startLineNumber; l <= s.endLineNumber; l++) targets.push({ line: l, col: s.startColumn }); } else targets.push({ line: s.startLineNumber, col: s.startColumn, range: s.isEmpty() ? null : s }); }
    let vals;
    if (kind === 'text') vals = targets.map(() => txt.value);
    else {
      const raw = targets.map((_, i) => parseInt(init.value, 10) + Math.floor(i / Math.max(1, +rep.value)) * parseInt(step.value, 10));
      const strs = raw.map((v) => (v < 0 ? '-' : '') + Math.abs(v).toString(base).toUpperCase()); const w = Math.max(...strs.map((s) => s.length));
      vals = strs.map((s) => (lead.value === 'zeros' ? s.padStart(w, '0') : lead.value === 'spaces' ? s.padStart(w, ' ') : s));
    }
    const edits = targets.map((t, i) => { const len = m.getLineMaxColumn(t.line) - 1; let pad = ''; let col = t.col; if (col - 1 > len) { pad = ' '.repeat(col - 1 - len); col = len + 1; } return [t.range && t.range.startLineNumber === t.range.endLineNumber ? t.range : new monaco.Range(t.line, col, t.line, col), pad + vals[i]]; });
    edit(ed, edits);
  };
  NGN.dialog({ key: 'coledit', title: 'Column / Multi-Selection Editor', width: 420, body: el('div', {},
    radio('text', 'Text to Insert', true), txt, radio('number', 'Number to Insert'),
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'Initial number:' }), init, el('label', { text: 'Format' }), fmt(10, 'Dec', true), fmt(16, 'Hex'), fmt(8, 'Oct'), fmt(2, 'Bin')),
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'Increase by:' }), step), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Repeat:' }), rep), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Leading:' }), lead)),
    buttons: [{ label: 'OK', primary: true, fn: run }, { label: 'Cancel' }] });
};

// ---- Summary ------------------------------------------------------------------------------------------------------------
NGN.openSummary = async () => {
  const d = curDoc(), ed = curEd(), m = d.model; const text = m.getValue(LF);
  const words = (text.match(/[\p{L}\p{N}_'’-]+/gu) || []).length; const noEol = text.replace(/\n/g, '').length;
  const sels = ed.getSelections().filter((s) => !s.isEmpty()); const selChars = sels.reduce((a, s) => a + m.getValueInRange(s).length, 0);
  const st = d.path ? await ngn.file.stat(d.path) : null; const rows = [
    ['Full file path', d.path || '(unsaved)'], ['Created', new Date(d.created).toLocaleString()], ['Modified', st ? new Date(st.mtime).toLocaleString() : '—'],
    ['Characters (without line endings)', noEol.toLocaleString()], ['Words', words.toLocaleString()], ['Lines', m.getLineCount().toLocaleString()], ['Current document length', text.length.toLocaleString()],
    ['Encoding', NGN.encLabel(d.enc)], ['Line ending', NGN.EOL_NAMES[docEol(d)]], ['Selection: characters', selChars.toLocaleString()], ['Selection: lines', sels.reduce((a, s) => a + s.endLineNumber - s.startLineNumber + 1, 0).toLocaleString()]];
  NGN.dialog({ title: 'Summary', width: 520, body: el('table', {}, rows.map(([a, b]) => el('tr', {}, el('td', { text: a, style: 'color:var(--ui-dim);white-space:nowrap' }), el('td', { text: b, style: 'user-select:text' })))), buttons: [{ label: 'Copy', stay: true, fn: () => ngn.clip.writeText(rows.map((r) => r.join(': ')).join('\n')) }, { label: 'OK', primary: true }] });
};

// ---- Windows... dialog ------------------------------------------------------------------------------------------------------
NGN.openWindowsDialog = () => {
  const sel = new Set(); const tbl = el('table'); let docs = [];
  const draw = () => { docs = [...S.docs.values()]; tbl.innerHTML = ''; tbl.append(el('tr', {}, ['Name', 'Path', 'Type', 'Size'].map((h) => el('th', { text: h })))); docs.forEach((d) => { const tr = el('tr', { style: sel.has(d.id) ? 'background:var(--ui-accent);color:#fff' : '', onclick: (e) => { if (!e.metaKey && !e.shiftKey) sel.clear(); sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id); draw(); }, ondblclick: () => { activateDoc(d.id); dlg.close(); } }, el('td', { text: (isDirty(d) ? '* ' : '') + d.name }), el('td', { text: d.path || '' }), el('td', { text: d.name.includes('.') ? d.name.split('.').pop() : '' }), el('td', { text: d.model.getValueLength().toLocaleString() })); tbl.append(tr); }); };
  draw();
  const dlg = NGN.dialog({ key: 'windows', title: 'Windows', width: 640, body: el('div', { style: 'max-height:50vh;overflow:auto' }, tbl),
    buttons: [{ label: 'Activate', stay: false, fn: () => { const id = [...sel][0]; if (id) activateDoc(id); } }, { label: 'Save', stay: true, fn: async () => { for (const id of sel) await saveDoc(S.docs.get(id)); draw(); } }, { label: 'Close window(s)', stay: true, fn: async () => { await closeMany([...sel].map((id) => S.docs.get(id))); sel.clear(); draw(); } }, { label: 'Sort tabs by name', stay: true, fn: () => { NGN.runCommand(11002); draw(); } }, { label: 'Close' }] });
};

// ---- Run dialog ----------------------------------------------------------------------------------------------------------------
export function expandVars(s) {
  const d = curDoc(), ed = curEd(); const p = d?.path || ''; const dir = p.replace(/\/[^/]*$/, ''); const file = p.split('/').pop() || d?.name || ''; const w = ed.getModel().getWordAtPosition(ed.getPosition());
  const map = { FULL_CURRENT_PATH: p, CURRENT_DIRECTORY: dir, FILE_NAME: file, NAME_PART: file.replace(/\.[^.]*$/, ''), EXT_PART: file.includes('.') ? '.' + file.split('.').pop() : '', CURRENT_WORD: ed.getModel().getValueInRange(ed.getSelection()) || w?.word || '', NPP_DIRECTORY: S.paths.root, NPP_FULL_FILE_PATH: S.paths.root + '/main.js', CURRENT_LINE: ed.getPosition().lineNumber, CURRENT_COLUMN: ed.getPosition().column, NPP_PID: '' };
  return s.replace(/\$\((\w+)\)/g, (m, k) => (k in map ? map[k] : m));
}
NGN.expandVars = expandVars;
NGN.openRunDialog = () => {
  const cmd = el('textarea', { rows: 3, style: 'width:100%;font-family:var(--mono)', 'data-focus': true, placeholder: 'e.g. open -a Safari "$(FULL_CURRENT_PATH)"' }); cmd.value = S.lastRun || '';
  const out = el('pre', { style: 'max-height:140px;overflow:auto;margin-top:6px' });
  const run = async () => { S.lastRun = cmd.value; out.textContent = 'Running…'; const r = await ngn.run(expandVars(cmd.value), curDoc()?.path?.replace(/\/[^/]*$/, '')); out.textContent = r.out || `(exit ${r.code})`; };
  const save = async () => { const n = await NGN.prompt('Save command', 'Name for the Run menu entry:', cmd.value.slice(0, 30)); if (!n) return; S.runList.push({ name: n, cmd: cmd.value }); NGN.saveCfgSoon(); NGN.refreshDynamicMenus(); };
  NGN.dialog({ key: 'run', title: 'Run...', width: 540, body: el('div', {}, el('div', { text: 'The Program to Run (shell command):' }), cmd, el('div', { style: 'color:var(--ui-dim);font-size:11px;margin-top:4px', text: 'Variables: $(FULL_CURRENT_PATH) $(CURRENT_DIRECTORY) $(FILE_NAME) $(NAME_PART) $(EXT_PART) $(CURRENT_WORD) $(CURRENT_LINE) $(CURRENT_COLUMN) $(NPP_DIRECTORY)' }), out),
    buttons: [{ label: 'Run', primary: true, stay: true, fn: run }, { label: 'Save...', stay: true, fn: save }, { label: 'Cancel' }] });
};
NGN.refreshDynamicMenus = () => {
  ngn.win.setDynamicMenu('Run', S.runList.map((r, i) => ({ key: 'run' + i, label: r.name })));
  ngn.win.setDynamicMenu('Macro', S.macros.map((m, i) => ({ key: 'macro' + i, label: m.name })));
};
NGN.runDynamic = async (key) => {
  if (key.startsWith('run')) { const r = S.runList[+key.slice(3)]; const res = await ngn.run(expandVars(r.cmd), curDoc()?.path?.replace(/\/[^/]*$/, '')); if (res.out) NGN.alert(r.name, res.out); }
  if (key.startsWith('macro')) NGN.macroPlay(1, S.macros[+key.slice(5)]);
};

// ---- Macros ---------------------------------------------------------------------------------------------------------------------------
const KEYCMD = { Backspace: 'deleteLeft', Delete: 'deleteRight', ArrowLeft: 'cursorLeft', ArrowRight: 'cursorRight', ArrowUp: 'cursorUp', ArrowDown: 'cursorDown', Home: 'cursorHome', End: 'cursorEnd', PageUp: 'cursorPageUp', PageDown: 'cursorPageDown' };
const SEL = { cursorLeft: 'cursorLeftSelect', cursorRight: 'cursorRightSelect', cursorUp: 'cursorUpSelect', cursorDown: 'cursorDownSelect', cursorHome: 'cursorHomeSelect', cursorEnd: 'cursorEndSelect', cursorPageUp: 'cursorPageUpSelect', cursorPageDown: 'cursorPageDownSelect' };
const NOREC = new Set([42018, 42019, 42021, 42025, 42032, 42001, 42002, 42005]);
NGN.macroRecordable = (id) => typeof id === 'number' && !NOREC.has(id) && ((id >= 42000 && id < 44000) || (id >= 45000 && id < 46000) || id >= 50000 || id === 44022 || (id >= 10001 && id <= 10006)) && ![43001, 43003, 43013, 43054, 43004, 43011, 42034, 42037, 42051, 42052, 43045].includes(id);
NGN.macroType = (t) => { if (S.macroRec && !S.macroPlaying) { const last = S.macroRec[S.macroRec.length - 1]; if (last?.text !== undefined) last.text += t.text ?? t; else S.macroRec.push({ text: t.text ?? t }); } };
NGN.macroKey = (e) => {
  if (!S.macroRec || S.macroPlaying) return; const b = e.browserEvent; let c = KEYCMD[b.key];
  if (b.key === 'Enter' && !b.metaKey && !b.ctrlKey) return; // Enter arrives through onDidType as "\n"
  if (b.key === 'Tab' && !b.metaKey && !b.ctrlKey) { S.macroRec.push({ ed: b.shiftKey ? 'outdent' : 'tab' }); return; }
  if (!c || b.metaKey || b.ctrlKey && false) return;
  if (b.altKey && (c === 'cursorLeft' || c === 'cursorRight')) c = c === 'cursorLeft' ? 'cursorWordLeft' : 'cursorWordRight';
  if (b.altKey && (c === 'deleteLeft' || c === 'deleteRight')) c = c === 'deleteLeft' ? 'deleteWordLeft' : 'deleteWordRight';
  if (b.shiftKey && SEL[c]) c = SEL[c]; S.macroRec.push({ ed: c });
};
NGN.macroStart = () => { if (S.macroRec) return; S.macroRec = []; NGN.tbState(42018, true); NGN.status('Macro recording…'); NGN.toast('Recording macro — perform your edits, then Macro ▸ Stop Recording'); };
NGN.macroStop = () => { if (!S.macroRec) return; S.lastMacro = { name: 'Current recorded macro', steps: S.macroRec }; S.macroRec = null; NGN.tbState(42018, false); NGN.status(`Macro recorded: ${S.lastMacro.steps.length} step(s)`); NGN.toast(`Macro recorded (${S.lastMacro.steps.length} steps)`); };
async function runSteps(steps) {
  const ed = curEd(); S.macroPlaying = true;
  try { for (const s of steps) { ed.focus(); if (s.text !== undefined) ed.trigger('macro', 'type', { text: s.text }); else if (s.ed) ed.trigger('macro', s.ed, {}); else if (s.cmd) await NGN.runCommand(s.cmd); else if (s.find) { if (s.find === 'next') NGN.findNext(s.back, s.opts); if (s.find === 'replaceAll') NGN.replaceAllIn(curDoc(), s.opts, s.rep); } } } finally { S.macroPlaying = false; }
}
NGN.macroPlay = async (n = 1, macro = S.lastMacro) => { if (!macro) return NGN.toast('No macro recorded.'); for (let i = 0; i < n; i++) await runSteps(macro.steps); };
NGN.macroSave = async () => {
  if (!S.lastMacro) return NGN.toast('Record a macro first.');
  const name = await NGN.prompt('Save Current Recorded Macro', 'Macro name:', 'Macro ' + (S.macros.length + 1)); if (!name) return;
  S.macros.push({ name, steps: S.lastMacro.steps }); NGN.saveCfgSoon(); NGN.refreshDynamicMenus(); NGN.toast(`Saved macro "${name}"`);
};
NGN.macroRunMultiple = () => {
  const sel = el('select', { 'data-focus': true }, S.lastMacro ? el('option', { value: -1, text: 'Current recorded macro' }) : null, S.macros.map((m, i) => el('option', { value: i, text: m.name })));
  const n = el('input', { type: 'number', value: 2, min: 1, style: 'width:80px' }), eof = el('input', { type: 'checkbox' });
  const go = async () => {
    const mac = +sel.value < 0 ? S.lastMacro : S.macros[+sel.value]; if (!mac) return;
    if (!eof.checked) return NGN.macroPlay(+n.value, mac);
    const ed = curEd(), m = ed.getModel(); let guard = 0, prev = '';
    while (guard++ < 100000) { const p = ed.getPosition(); if (p.lineNumber >= m.getLineCount() && p.column >= m.getLineMaxColumn(p.lineNumber)) break; const key = p.lineNumber + ':' + p.column + ':' + m.getVersionId(); if (key === prev) break; prev = key; await runSteps(mac.steps); }
  };
  NGN.dialog({ key: 'macro-multi', title: 'Run a Macro Multiple Times', width: 360, body: el('div', {}, el('div', { class: 'row' }, el('label', { class: 'f', text: 'Macro to run' }), sel), el('div', { class: 'row' }, n, 'times'), el('label', {}, eof, 'Run until the end of file')), buttons: [{ label: 'Run', primary: true, fn: go }, { label: 'Cancel' }] });
};

// ---- Plugins (bundled equivalents of the original's included plugins) ---------------------------------------------------------------------
const b64 = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))), dec: (s) => decodeURIComponent(escape(atob(s))),
};
function mapSel(fn) { const ed = curEd(), m = ed.getModel(); const edits = []; ed.getSelections().forEach((s) => { const r = s.isEmpty() ? m.getFullModelRange() : s; const t = m.getValueInRange(r); try { edits.push([r, fn(t)]); } catch (e) { NGN.toast('Error: ' + e.message); } }); edit(ed, edits); }
const qpEnc = (s) => unescape(encodeURIComponent(s)).replace(/[^\t\n\r -<>-~]/g, (c) => '=' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
const qpDec = (s) => decodeURIComponent(escape(s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))));
const PLUG = {
  'MIME Tools|Base64 Encode': () => mapSel((t) => b64.enc(t).replace(/=+$/, '')),
  'MIME Tools|Base64 Encode with Padding': () => mapSel((t) => b64.enc(t)), 'MIME Tools|Base64 Encode by line': () => mapSel((t) => t.split(/\r?\n/).map((l) => b64.enc(l)).join('\n')),
  'MIME Tools|Base64 Decode': () => mapSel((t) => b64.dec(t.replace(/\s+/g, ''))), 'MIME Tools|Base64 Decode strict': () => mapSel((t) => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t.replace(/\s+/g, ''))) throw new Error('Input is not strict Base64'); return b64.dec(t.replace(/\s+/g, '')); }),
  'MIME Tools|Base64 Decode by line': () => mapSel((t) => t.split(/\r?\n/).map((l) => (l ? b64.dec(l.trim()) : l)).join('\n')),
  'MIME Tools|URL Encode': () => mapSel((t) => encodeURIComponent(t)), 'MIME Tools|URL Decode': () => mapSel((t) => decodeURIComponent(t.replace(/\+/g, '%20'))),
  'MIME Tools|Quoted-printable Encode': () => mapSel(qpEnc), 'MIME Tools|Quoted-printable Decode': () => mapSel(qpDec),
  'MIME Tools|SAML Decode': () => mapSel((t) => { const bin = atob(decodeURIComponent(t).replace(/\s+/g, '')); const u = Uint8Array.from(bin, (c) => c.charCodeAt(0)); try { return new TextDecoder().decode(new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw')))); } catch { return new TextDecoder().decode(u); } }),
  'Converter|ASCII -> HEX': () => mapSel((t) => [...new TextEncoder().encode(t)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')),
  'Converter|HEX -> ASCII': () => mapSel((t) => new TextDecoder().decode(Uint8Array.from((t.match(/[0-9a-fA-F]{2}/g) || []).map((h) => parseInt(h, 16))))),
  'Converter|Conversion Panel...': () => convPanel(),
  'NppExport|Export to RTF': () => exportFile('rtf'), 'NppExport|Export to HTML': () => exportFile('html'),
  'NppExport|Copy RTF to clipboard': () => copyFmt('rtf'), 'NppExport|Copy HTML to clipboard': () => copyFmt('html'), 'NppExport|Copy all formats to clipboard': () => copyFmt('all'),
  'JSON Viewer|Show JSON Viewer': () => jsonViewer(), 'JsonTools|Open tree viewer': () => jsonViewer(),
  'JSON Viewer|Format JSON': () => mapSel((t) => JSON.stringify(JSON.parse(t), null, S.prefs.useTabs ? '\t' : S.prefs.tabSize)), 'JsonTools|Pretty-print current JSON file': () => mapSel((t) => JSON.stringify(JSON.parse(t), null, S.prefs.useTabs ? '\t' : S.prefs.tabSize)),
  'JSON Viewer|Compress JSON': () => mapSel((t) => JSON.stringify(JSON.parse(t))), 'JsonTools|Compress current JSON file': () => mapSel((t) => JSON.stringify(JSON.parse(t))),
  'JsonTools|Validate JSON': () => { try { JSON.parse(curDoc().model.getValue()); NGN.toast('Valid JSON ✔'); } catch (e) { NGN.alert('JSON error', e.message); } },
  'JsonTools|Sort object keys': () => mapSel((t) => { const sort = (v) => (Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v); return JSON.stringify(sort(JSON.parse(t)), null, 2); }),
  'Data Tools|Pretty print (2 spaces)': () => mapDT('jsonFormat', 2), 'Data Tools|Pretty print (4 spaces)': () => mapDT('jsonFormat', 4),
  'Data Tools|Minify JSON': () => mapDT('jsonMinify'), 'Data Tools|Sort keys (JSON)': () => mapDT('jsonSortKeys'),
  'Data Tools|Escape JSON': () => mapSel(DT.jsonEscape), 'Data Tools|Unescape JSON': () => mapSel(DT.jsonUnescape),
  'Data Tools|JSON to YAML': () => mapDT('jsonToYaml'), 'Data Tools|YAML to JSON': () => mapDT('yamlToJson'), 'Data Tools|Sort keys (YAML)': () => mapDT('yamlSortKeys'),
  'Data Tools|Base64 Encode (UTF-8)': () => mapSel(DT.b64Encode), 'Data Tools|Base64 Decode (UTF-8)': () => mapSel(DT.b64Decode),
};
NGN.runPlugin = (key) => { if (S.prefs.disabledPlugins.includes(key.split('|')[0])) return NGN.toast('Plugin disabled in Plugins Admin.'); const f = PLUG[key]; if (f) f(); else NGN.toast('Unknown plugin command'); };

function convPanel() {
  const a = el('textarea', { rows: 5, style: 'width:100%;font-family:var(--mono)', 'data-focus': true }), h = el('textarea', { rows: 5, style: 'width:100%;font-family:var(--mono)' });
  a.addEventListener('input', () => { h.value = [...new TextEncoder().encode(a.value)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '); });
  h.addEventListener('input', () => { a.value = new TextDecoder().decode(Uint8Array.from((h.value.match(/[0-9a-fA-F]{2}/g) || []).map((x) => parseInt(x, 16)))); });
  NGN.dialog({ key: 'convpanel', title: 'Conversion Panel', width: 480, body: el('div', {}, el('div', { text: 'ASCII / text' }), a, el('div', { text: 'HEX' }), h), buttons: [{ label: 'Insert ASCII', stay: true, fn: () => NGN.insertText(a.value) }, { label: 'Insert HEX', stay: true, fn: () => NGN.insertText(h.value) }, { label: 'Close' }] });
}

// token-colour export (RTF / HTML)
function themeRules() { const t = S.theme; const rules = (t?.monaco?.rules || []).filter((r) => r.token); return rules; }
function colorOf(type, rules, fb) { let best = null; for (const r of rules) { if (!r.token) continue; if (type === r.token || type.startsWith(r.token + '.')) if (!best || r.token.length > best.token.length) best = r; } return { fg: '#' + ((best?.foreground) || fb), bold: /bold/.test(best?.fontStyle || ''), italic: /italic/.test(best?.fontStyle || '') }; }
function tokensOf(doc) {
  const text = doc.model.getValue(LF); const lines = text.split('\n'); const lang = doc.model.getLanguageId(); const rules = themeRules(); const fb = (S.theme?.fg || '000000');
  let toks = null; try { toks = monaco.editor.tokenize(text, lang); } catch { /* plaintext */ }
  return lines.map((ln, i) => { const tk = toks?.[i] || [{ offset: 0, type: '' }]; return tk.map((t, j) => ({ text: ln.slice(t.offset, tk[j + 1]?.offset ?? ln.length), ...colorOf(t.type || '', rules, fb) })).filter((s) => s.text); });
}
const hx = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function docHtml(doc, { lineNumbers = false, mode = 'wysiwyg', body = false } = {}) {
  const bg = mode === 'wysiwyg' ? (S.theme?.bg || 'FFFFFF') : mode === 'invert' ? '000000' : 'FFFFFF'; const dfg = mode === 'wysiwyg' ? (S.theme?.fg || '000000') : mode === 'invert' ? 'FFFFFF' : '000000';
  const rows = tokensOf(doc).map((spans, i) => (lineNumbers ? `<span style="color:#888">${String(i + 1).padStart(4)} </span>` : '') + spans.map((s) => (mode === 'wysiwyg' || mode === 'invert' ? `<span style="color:${mode === 'invert' ? '#FFFFFF' : s.fg};${s.bold ? 'font-weight:bold;' : ''}${s.italic ? 'font-style:italic;' : ''}">${hx(s.text)}</span>` : hx(s.text))).join('')).join('\n');
  const pre = `<pre style="font-family:Menlo,monospace;font-size:10pt;margin:0;white-space:pre-wrap;background:#${bg};color:#${dfg}">${rows}</pre>`;
  return body ? `<!doctype html><html><head><meta charset="utf-8"><title>${hx(doc.name)}</title></head><body style="margin:0;background:#${bg}">${pre}</body></html>` : pre;
}
function docRtf(doc) {
  const colors = []; const idx = (c) => { let i = colors.indexOf(c); if (i < 0) { colors.push(c); i = colors.length - 1; } return i + 1; };
  const esc = (s) => s.replace(/[\\{}]/g, (c) => '\\' + c).replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0)}?`).replace(/\t/g, '\\tab ');
  const body = tokensOf(doc).map((spans) => spans.map((s) => `{\\cf${idx(s.fg)}${s.bold ? '\\b' : ''}${s.italic ? '\\i' : ''} ${esc(s.text)}}`).join('') + '\\par\n').join('');
  const tbl = colors.map((c) => { const n = parseInt(c.slice(1), 16); return `\\red${n >> 16}\\green${(n >> 8) & 255}\\blue${n & 255};`; }).join('');
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fmodern Menlo;}}{\\colortbl;${tbl}}\\f0\\fs20 ${body}}`;
}
async function exportFile(kind) { const d = curDoc(); const p = await ngn.dlg.save({ defaultPath: (d.path || S.paths.documents + '/' + d.name) + '.' + kind }); if (!p) return; await ngn.file.write(p, kind === 'rtf' ? docRtf(d) : docHtml(d, { body: true }), 'utf8'); NGN.toast('Exported ' + p); }
async function copyFmt(kind) { const d = curDoc(); const sel = curEd().getSelection(); const html = docHtml(d), rtf = docRtf(d); await ngn.clip.writeHTMLRTF(kind === 'rtf' ? '' : html, kind === 'html' ? '' : rtf, d.model.getValue()); NGN.toast('Copied ' + (kind === 'all' ? 'all formats' : kind.toUpperCase()) + ' to the clipboard'); }

function jsonViewer() {
  let data; try { data = JSON.parse(curDoc().model.getValue()); } catch (e) { return NGN.alert('JSON Viewer', 'Invalid JSON: ' + e.message); }
  // Children are built only when a node is expanded, and in pages of 200, so a huge document opens instantly instead of creating one DOM node per value up front.
  const PAGE = 200;
  const build = (k, v, open) => {
    const isObj = v && typeof v === 'object';
    if (!isObj) return el('div', { style: 'padding-left:16px;font-family:var(--mono)' }, el('span', { style: 'color:var(--ui-dim)', text: k + ': ' }), el('span', { text: JSON.stringify(v) }));
    const entries = Object.entries(v); let shown = 0;
    const d = el('details', { style: 'padding-left:12px' }, el('summary', { style: 'font-family:var(--mono)', text: `${k} ${Array.isArray(v) ? `[${v.length}]` : `{${entries.length}}`}` }));
    const more = el('div', { style: 'padding-left:16px;cursor:pointer;color:var(--ui-dim)' });
    const fill = () => { more.remove(); entries.slice(shown, shown + PAGE).forEach(([kk, vv]) => d.append(build(kk, vv, false))); shown = Math.min(entries.length, shown + PAGE); if (shown < entries.length) { more.textContent = `… show ${Math.min(PAGE, entries.length - shown)} more (${entries.length - shown} left)`; d.append(more); } };
    more.addEventListener('click', fill);
    d.addEventListener('toggle', () => { if (d.open && !shown) fill(); });
    if (open) { d.open = true; fill(); }
    return d;
  };
  NGN.dialog({ key: 'jsonview', title: 'JSON Viewer', width: 460, body: el('div', { style: 'max-height:60vh;overflow:auto' }, build('root', data, true)), buttons: [{ label: 'Close' }] });
}

NGN.openPluginsAdmin = async () => {
  const defs = await (await fetch('app://host/plugins.json')).json(); const info = { 'MIME Tools': 'v3.1', Converter: 'v4.7', NppExport: 'v0.4', 'JSON Viewer': '(plugins/NPPJSONViewer)', JsonTools: '(plugins/JsonTools)', 'Data Tools': 'built-in' };
  const rows = defs.map((p) => { const cb = el('input', { type: 'checkbox', checked: !S.prefs.disabledPlugins.includes(p.name) }); cb.addEventListener('change', () => { S.prefs.disabledPlugins = cb.checked ? S.prefs.disabledPlugins.filter((x) => x !== p.name) : [...S.prefs.disabledPlugins, p.name]; NGN.saveCfgSoon(); }); return el('tr', {}, el('td', {}, cb), el('td', { text: p.name }), el('td', { text: info[p.name] || '' }), el('td', { text: p.commands.filter((c) => c !== '-').length + ' commands' })); });
  NGN.dialog({ key: 'plugadmin', title: 'Plugins Admin', width: 540, body: el('div', {}, el('table', {}, el('tr', {}, ['Enabled', 'Plugin', 'Version', 'Provides'].map((h) => el('th', { text: h }))), rows), el('p', { style: 'color:var(--ui-dim)', text: 'The original loads native Windows plugin DLLs. On macOS these five bundled plugins are re-implemented natively; third-party .dll plugins cannot be loaded.' })), buttons: [{ label: 'Close' }] });
};

// ---- Print -------------------------------------------------------------------------------------------------------------------------------------
NGN.printDoc = async (silent) => {
  const d = curDoc(), p = S.prefs; const mode = p.printColor; const v = (s) => (s || '').replace(/\$\((\w+)\)/g, (m, k) => ({ FULL_CURRENT_PATH: d.path || d.name, SHORT_DATE: new Date().toLocaleDateString(), LONG_DATE: new Date().toLocaleDateString([], { dateStyle: 'full' }), TIME: new Date().toLocaleTimeString(), CURRENT_PRINTING_PAGE: '', TOTAL_PAGE_NUMBER: '' }[k] ?? ''));
  const hf = (o) => (o.left || o.mid || o.right ? `<div style="display:flex;justify-content:space-between;font:9pt sans-serif;color:#555"><span>${hx(v(o.left))}</span><span>${hx(v(o.mid))}</span><span>${hx(v(o.right))}</span></div>` : '');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:${p.printMargins.top}mm ${p.printMargins.right}mm ${p.printMargins.bottom}mm ${p.printMargins.left}mm}body{margin:0}</style></head><body>${hf(p.printHeader)}${docHtml(d, { lineNumbers: p.printLineNumbers, mode })}${hf(p.printFooter)}</body></html>`;
  const ok = await ngn.win.print(html, { silent }); if (!ok && !silent) NGN.status('Print cancelled');
};

// ---- Hide lines -----------------------------------------------------------------------------------------------------------------------------------
NGN.hideLines = () => {
  const ed = curEd(), d = curDoc(); if (!ed.setHiddenAreas) return NGN.toast('Hide Lines is not supported by this editor build.');
  const s = ed.getSelection();
  if (!s.isEmpty() && s.startLineNumber !== s.endLineNumber || (d.hiddenAreas?.length === 0 && !s.isEmpty())) {
    const a = s.startLineNumber, b = s.endColumn === 1 ? s.endLineNumber - 1 : s.endLineNumber; d.hiddenAreas = [...(d.hiddenAreas || []), new monaco.Range(a, 1, b, 1)];
    ed.setHiddenAreas(d.hiddenAreas); ed.setPosition({ lineNumber: Math.max(1, a - 1), column: 1 }); NGN.toast('Lines hidden — run Hide Lines again with no selection to restore');
  } else if (d.hiddenAreas?.length) { d.hiddenAreas = []; ed.setHiddenAreas([]); NGN.toast('Hidden lines restored'); }
  else NGN.toast('Select some lines to hide.');
};

// ---- About / Debug info ----------------------------------------------------------------------------------------------------------------------------
NGN.openAbout = () => NGN.dialog({ key: 'about', title: 'About NextGenNote', width: 480, body: el('div', {},
  el('h2', { text: 'NextGenNote', style: 'margin:0 0 4px' }), el('div', { text: 'A macOS source-code editor rebuilt from the Notepad++ v8.x feature set.' }),
  el('p', { text: 'Features were traced from the shipped notepad++.exe (PE menu + dialog resources, shipped XML data files) using REA, then re-implemented on Electron + Monaco.' }),
  el('p', { style: 'color:var(--ui-dim)', text: `Electron ${S.paths.electron} · Chromium ${S.paths.chrome} · Node ${S.paths.node}` }),
  el('p', { text: 'Licensed GPL-3.0-or-later (bundles Notepad++ data files: themes, language definitions, auto-completion & function-list rules).' })), buttons: [{ label: 'OK', primary: true }] });
NGN.openDebugInfo = () => {
  const text = [`NextGenNote Debug Info`, `Build: Electron ${S.paths.electron}, Chromium ${S.paths.chrome}, Node ${S.paths.node}`, `Platform: ${S.paths.platform}`, `Config dir: ${S.paths.userData}`, `Open documents: ${S.docs.size}`, `Active language: ${curDoc()?.lang}`, `Encoding: ${curDoc()?.enc}`, `Theme: ${S.prefs.theme}`, `Dark mode: ${S.prefs.darkMode}`, `Plugins: ${['MIME Tools', 'Converter', 'NppExport', 'JSON Viewer', 'JsonTools', 'Data Tools'].filter((p) => !S.prefs.disabledPlugins.includes(p)).join(', ')}`].join('\n');
  NGN.dialog({ key: 'debuginfo', title: 'Debug Info', width: 520, body: el('pre', { text }), buttons: [{ label: 'Copy debug info to clipboard', stay: true, fn: () => ngn.clip.writeText(text) }, { label: 'OK', primary: true }] });
};
