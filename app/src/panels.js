// Docked panels: Folder as Workspace, Project Panels 1-3, Document List, Function List,
// Document Map, Clipboard History, Character (ASCII) Panel. Bottom dock: Search results.
import { monaco, activateDoc, isDirty } from './core.js';
import { S, NGN, curEd, curDoc } from './state.js';
import { LANGS } from './languages.js';

const { el, $ } = NGN;
const ngn = window.ngn;

const PANELS = {}; // name -> {title, build(host), refresh?}
const dock = { tabs: [], active: null };

function layoutSoon() { setTimeout(() => S.views.forEach((v) => v.ed?.layout()), 30); }
function renderDock() {
  const host = $('#panel-left'), sp = $('#split-left');
  if (!dock.tabs.length) { host.classList.add('hidden'); sp.classList.add('hidden'); layoutSoon(); return; }
  host.classList.remove('hidden'); sp.classList.remove('hidden'); host.innerHTML = '';
  const head = el('div', { class: 'panel-head', style: 'flex-wrap:wrap;padding:0' }, dock.tabs.map((n) => el('div', { class: 'tab small ' + (n === dock.active ? 'active' : ''), style: 'border-radius:0;border-top:none', onclick: () => { dock.active = n; renderDock(); } }, el('span', { class: 'name', text: PANELS[n].title }), el('span', { class: 'close', text: '✕', onclick: (e) => { e.stopPropagation(); closePanel(n); } }))));
  const body = el('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;overflow:hidden' }); host.append(head, body);
  PANELS[dock.active].build(body); layoutSoon();
  NGN.syncMenuState?.();
}
export function openPanel(n) { if (!dock.tabs.includes(n)) dock.tabs.push(n); dock.active = n; renderDock(); }
export function closePanel(n) { dock.tabs = dock.tabs.filter((x) => x !== n); if (dock.active === n) dock.active = dock.tabs[dock.tabs.length - 1] || null; PANELS[n].onClose?.(); renderDock(); }
NGN.togglePanel = (n) => {
  if (n === 'docmap') { S.prefs.panels.docMap = !S.prefs.panels.docMap; NGN.applyEditorOptions(); NGN.saveCfgSoon(); NGN.syncMenuState(); return; }
  if (dock.tabs.includes(n) && dock.active === n) closePanel(n); else openPanel(n);
  S.prefs.panels.open = dock.tabs.slice(); NGN.saveCfgSoon();
};
NGN.panelOpen = (n) => (n === 'docmap' ? !!S.prefs.panels.docMap : dock.tabs.includes(n));
NGN.refreshPanels = () => { if (dock.active) renderDock(); };
NGN.restorePanels = () => { (S.prefs.panels.open || []).forEach((n) => { if (PANELS[n] && !dock.tabs.includes(n)) dock.tabs.push(n); }); dock.active = dock.tabs[0] || null; renderDock(); };

// bottom dock
NGN.bottomPanel = null;
NGN.showBottomPanel = (n) => { NGN.bottomPanel = n; $('#panel-bottom').classList.remove('hidden'); $('#split-bottom').classList.remove('hidden'); if (n === 'results') NGN.buildResultsPanel($('#panel-bottom')); layoutSoon(); };
NGN.hideBottomPanel = () => { NGN.bottomPanel = null; $('#panel-bottom').classList.add('hidden'); $('#split-bottom').classList.add('hidden'); layoutSoon(); };

const treeIt = (label, { icon = '', depth = 0, tw = '', sel, onclick, ondbl, onctx } = {}) => {
  const d = el('div', { class: 'it' + (sel ? ' sel' : ''), style: `padding-left:${6 + depth * 14}px` }, el('span', { class: 'tw', text: tw }), icon ? el('span', { text: icon }) : null, el('span', { text: label, style: 'overflow:hidden;text-overflow:ellipsis' }));
  if (onclick) d.addEventListener('click', onclick); if (ondbl) d.addEventListener('dblclick', ondbl); if (onctx) d.addEventListener('contextmenu', (e) => { e.preventDefault(); onctx(e); });
  return d;
};

// ---- Folder as Workspace ------------------------------------------------------------------------
const roots = [];
NGN.openWorkspaceFolder = (dir) => { if (!roots.includes(dir)) roots.push(dir); S.prefs.panels.roots = roots.slice(); NGN.saveCfgSoon(); openPanel('workspace'); };
PANELS.workspace = {
  title: 'Folder as Workspace',
  build(host) {
    const tree = el('div', { class: 'tree panel-body' });
    host.append(el('div', { class: 'panel-search' }, el('button', { text: '＋ Folder', onclick: async () => { const p = await ngn.dlg.open({ properties: ['openDirectory', 'multiSelections'] }); p.forEach((x) => { if (!roots.includes(x)) roots.push(x); }); renderDock(); } }), el('button', { text: '⟳', title: 'Refresh', onclick: () => renderDock() }), el('button', { text: '⌃ Collapse', onclick: () => renderDock() })), tree);
    if (!roots.length && S.prefs.panels.roots) roots.push(...S.prefs.panels.roots);
    if (!roots.length) tree.append(el('div', { style: 'padding:10px;color:var(--ui-dim)', text: 'Use File ▸ Open Folder as Workspace… or the ＋ Folder button.' }));
    const addDir = (parent, dir, depth, isRoot) => {
      const kids = el('div'); let loaded = false, open = false;
      const row = treeIt(dir.split('/').pop() || dir, { icon: '📁', depth, tw: '▸', onclick: async () => { open = !open; row.querySelector('.tw').textContent = open ? '▾' : '▸'; kids.style.display = open ? '' : 'none'; if (open && !loaded) { loaded = true; try { for (const e of await ngn.file.listDir(dir)) { if (e.name.startsWith('.') && e.name !== '.gitignore') continue; if (e.dir) addDir(kids, e.path, depth + 1); else kids.append(treeIt(e.name, { icon: '📄', depth: depth + 1, ondbl: () => NGN.openPath(e.path), onctx: (ev) => fileMenu(ev, e.path) })); } } catch { kids.append(el('div', { text: '(unreadable)', style: 'padding-left:30px' })); } } },
        onctx: (e) => NGN.popup([{ label: 'Open as workspace root only', fn: () => { roots.length = 0; roots.push(dir); renderDock(); } }, { label: 'Reveal in Finder', fn: () => ngn.file.reveal(dir) }, { label: 'Copy path', fn: () => ngn.clip.writeText(dir) }, ...(isRoot ? [{ label: 'Remove root', fn: () => { roots.splice(roots.indexOf(dir), 1); renderDock(); } }] : [])], e.clientX, e.clientY) });
      kids.style.display = 'none'; parent.append(row, kids); if (isRoot) row.click();
    };
    roots.forEach((r) => addDir(tree, r, 0, true));
  },
};
function fileMenu(e, p) { NGN.popup([{ label: 'Open', fn: () => NGN.openPath(p) }, { label: 'Reveal in Finder', fn: () => ngn.file.reveal(p) }, { label: 'Copy path', fn: () => ngn.clip.writeText(p) }, { label: 'Open in default viewer', fn: () => ngn.file.openDefault(p) }], e.clientX, e.clientY); }

// ---- Project panels -----------------------------------------------------------------------------
NGN.projects ||= null;
function projData() { return (NGN.projects ||= [{ name: 'Workspace 1', children: [] }, { name: 'Workspace 2', children: [] }, { name: 'Workspace 3', children: [] }]); }
NGN.projectFiles = () => { const out = []; const walk = (n) => (n.children || []).forEach((c) => (c.path ? out.push(c.path) : walk(c))); projData().forEach(walk); return out; };
[1, 2, 3].forEach((i) => {
  PANELS['project' + i] = {
    title: 'Project ' + i,
    build(host) {
      const root = projData()[i - 1]; const save = () => NGN.saveCfgSoon();
      const tree = el('div', { class: 'tree panel-body' });
      const draw = () => {
        tree.innerHTML = '';
        const rec = (node, depth, parent) => {
          (node.children || []).forEach((c) => {
            if (c.path) tree.append(treeIt(c.name || c.path.split('/').pop(), { icon: '📄', depth, ondbl: () => NGN.openPath(c.path), onctx: (e) => NGN.popup([{ label: 'Open', fn: () => NGN.openPath(c.path) }, { label: 'Remove', fn: () => { parent.children.splice(parent.children.indexOf(c), 1); save(); draw(); } }], e.clientX, e.clientY) }));
            else { c.open ??= true; tree.append(treeIt(c.name, { icon: '📁', depth, tw: c.open ? '▾' : '▸', onclick: () => { c.open = !c.open; draw(); }, onctx: (e) => folderMenu(e, c, parent) })); if (c.open) rec(c, depth + 1, c); }
          });
        };
        rec(root, 0, root);
        if (!root.children.length) tree.append(el('div', { style: 'padding:10px;color:var(--ui-dim)', text: 'Right-click here ▸ Add New Folder / Add Files.' }));
      };
      const folderMenu = (e, c, parent) => NGN.popup([
        { label: 'Add Files…', fn: async () => { (await ngn.dlg.open({ properties: ['openFile', 'multiSelections'] })).forEach((f) => c.children.push({ path: f })); save(); draw(); } },
        { label: 'Add Files from Directory…', fn: async () => { const d = (await ngn.dlg.open({ properties: ['openDirectory'] }))[0]; if (!d) return; for (const x of await ngn.file.listDir(d)) if (!x.dir) c.children.push({ path: x.path }); save(); draw(); } },
        { label: 'Add New Folder', fn: async () => { const n = await NGN.prompt('Add folder', 'Folder name:', 'Folder'); if (n) { c.children.push({ name: n, children: [], open: true }); save(); draw(); } } },
        { label: 'Rename', fn: async () => { const n = await NGN.prompt('Rename', 'Name:', c.name); if (n) { c.name = n; save(); draw(); } } },
        ...(parent !== c ? [{ label: 'Remove', fn: () => { parent.children.splice(parent.children.indexOf(c), 1); save(); draw(); } }] : []), { sep: true },
        { label: 'Open all files', fn: async () => { const w = (n) => (n.children || []).forEach((k) => (k.path ? NGN.openPath(k.path) : w(k))); w(c); } }], e.clientX, e.clientY);
      const menu = (e) => NGN.popup([
        { label: 'New Workspace', fn: () => { root.children = []; save(); draw(); } },
        { label: 'Open Workspace…', fn: async () => { const f = (await ngn.dlg.open({ filters: [{ name: 'Workspace', extensions: ['json', 'workspace'] }] }))[0]; if (f) { const d = await ngn.session.readFile(f); if (d) { root.children = d.children || []; save(); draw(); } } } },
        { label: 'Save As…', fn: async () => { const p = await ngn.dlg.save({ defaultPath: S.paths.documents + '/project.workspace.json' }); if (p) await ngn.file.write(p, JSON.stringify({ name: root.name, children: root.children }, null, 1), 'utf8'); } }, { sep: true },
        { label: 'Add New Folder', fn: () => folderMenu(e, root, root) }], e.clientX, e.clientY);
      host.append(el('div', { class: 'panel-search' }, el('button', { text: 'Workspace ▾', onclick: menu }), el('button', { text: '＋', title: 'Add folder / files', onclick: (e) => folderMenu(e, root, root) })), tree);
      tree.addEventListener('contextmenu', (e) => { if (e.target === tree) { e.preventDefault(); folderMenu(e, root, root); } }); draw();
    },
  };
});

// ---- Document list --------------------------------------------------------------------------------
PANELS.doclist = {
  title: 'Document List',
  build(host) {
    const body = el('div', { class: 'tree panel-body' }); let sortBy = null;
    const draw = () => {
      body.innerHTML = '';
      const docs = [...S.docs.values()]; if (sortBy === 'name') docs.sort((a, b) => a.name.localeCompare(b.name)); else if (sortBy === 'ext') docs.sort((a, b) => a.name.split('.').pop().localeCompare(b.name.split('.').pop()));
      docs.forEach((d) => body.append(treeIt((isDirty(d) ? '● ' : '') + d.name + (S.split ? `  [view ${d.view + 1}]` : ''), { icon: '📄', sel: S.views[d.view].active === d.id && d.view === S.cur, onclick: () => activateDoc(d.id), onctx: (e) => NGN.showTabMenu(e.clientX, e.clientY, d) })));
    };
    host.append(el('div', { class: 'panel-search' }, el('button', { text: 'Sort: Name', onclick: () => { sortBy = 'name'; draw(); } }), el('button', { text: 'Ext', onclick: () => { sortBy = 'ext'; draw(); } }), el('button', { text: 'Tab order', onclick: () => { sortBy = null; draw(); } })), body);
    draw(); PANELS.doclist._draw = draw;
  },
};
['doc-activated', 'opened', 'closed', 'saved', 'content'].forEach((ev) => NGN.on(ev, () => { if (dock.active === 'doclist') PANELS.doclist._draw?.(); }));

// ---- Function list -----------------------------------------------------------------------------------------
const flCache = {};
function pcre(src) {
  let flags = '';
  src = src.replace(/^\(\?([imsx]+)\)/, (m, f) => { flags += f.replace(/x/g, ''); return ''; });
  src = src.replace(/\\h/g, '[ \\t]').replace(/\\R/g, '(?:\\r\\n|\\n|\\r)').replace(/\\A/g, '(?<![\\s\\S])').replace(/\\[Zz]/g, '(?![\\s\\S])').replace(/\(\?>/g, '(?:').replace(/([*+?}])\+/g, '$1')
    .replace(/\[\[:alpha:\]\]/g, '[a-zA-Z]').replace(/\[:alpha:\]/g, 'a-zA-Z').replace(/\[:alnum:\]/g, 'a-zA-Z0-9').replace(/\[:digit:\]/g, '0-9').replace(/\[:space:\]/g, '\\s').replace(/\(\?<([A-Za-z_]\w*)>/g, '(?<$1>');
  const k = src.indexOf('\\K'); if (k >= 0) src = '(?<=' + src.slice(0, k) + ')' + src.slice(k + 2);
  return { src, flags };
}
// Notepad++ compiles function-list expressions with '.' matching newlines, so 's' is always on.
const mkRe = (expr, extra = 'g') => { try { const { src, flags } = pcre(expr); return new RegExp(src, 'ms' + extra + [...new Set(flags)].join('').replace(/[ms]/g, '')); } catch { try { return new RegExp(expr.replace(/\\K/g, ''), 'ms' + extra); } catch { return null; } } };

async function loadParsers(lang) {
  if (flCache[lang] !== undefined) return flCache[lang];
  let xml; try { xml = await ngn.file.readData(`functionList/${lang}.xml`); } catch { return (flCache[lang] = null); }
  const doc = new DOMParser().parseFromString(xml, 'text/xml'); const parsers = [];
  doc.querySelectorAll('functionList > parser').forEach((p) => {
    const nameChain = (node) => [...(node?.querySelectorAll('nameExpr, funcNameExpr, className > nameExpr') || [])].map((n) => mkRe(n.getAttribute('expr'), '')).filter(Boolean);
    const fnDef = (f) => ({ main: mkRe(f.getAttribute('mainExpr')), names: nameChain(f.querySelector('functionName') || f.querySelector('functionName')), cls: nameChain(f.querySelector('className')) });
    const entry = { comment: p.getAttribute('commentExpr') ? mkRe(p.getAttribute('commentExpr')) : null, fns: [], classes: [] };
    [...p.children].forEach((c) => {
      if (c.tagName === 'function') entry.fns.push(fnDef(c));
      if (c.tagName === 'classRange') entry.classes.push({ main: mkRe(c.getAttribute('mainExpr')), names: nameChain(c.querySelector(':scope > className')), fns: [...c.querySelectorAll(':scope > function')].map(fnDef) });
    });
    parsers.push(entry);
  });
  return (flCache[lang] = parsers);
}
const applyNames = (names, text) => { let t = text; for (const r of names) { r.lastIndex = 0; const m = r.exec(t); if (m) t = m[0]; } return t.replace(/\s+/g, ' ').trim(); };
export async function parseFunctions(doc) {
  const parsers = await loadParsers(doc.lang); if (!parsers) return null;
  let text = doc.model.getValue(monaco.editor.EndOfLinePreference.LF); if (text.length > 3e6) return [];
  const ix = [0]; for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) ix.push(i + 1);
  const lineAt = (off) => { let lo = 0, hi = ix.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ix[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; };
  const items = [];
  for (const P of parsers) {
    let t = text; if (P.comment) { P.comment.lastIndex = 0; t = t.replace(P.comment, (m) => m.replace(/[^\n]/g, ' ')); }
    const runFns = (fns, src, base, klass) => fns.forEach((f) => { if (!f.main) return; f.main.lastIndex = 0; let m; let guard = 0; while ((m = f.main.exec(src)) && guard++ < 20000) { if (!m[0]) { f.main.lastIndex++; continue; } const name = applyNames(f.names, m[0]); if (name) items.push({ name, line: lineAt(base + m.index), cls: klass }); } });
    P.classes.forEach((c) => { if (!c.main) return; c.main.lastIndex = 0; let m, guard = 0; while ((m = c.main.exec(t)) && guard++ < 5000) { if (!m[0]) { c.main.lastIndex++; continue; } const cname = applyNames(c.names, m[0]); items.push({ name: cname, line: lineAt(m.index), isClass: true }); runFns(c.fns, m[0], m.index, cname); } });
    runFns(P.fns, t, 0, null);
  }
  const seen = new Set(); return items.filter((i) => { const k = i.line + '|' + i.name; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.line - b.line);
}
NGN.parseFunctions = parseFunctions;

PANELS.funclist = {
  title: 'Function List',
  build(host) {
    const body = el('div', { class: 'tree panel-body' }); const q = el('input', { type: 'text', placeholder: 'Search…' }); let sorted = false;
    const draw = async () => {
      body.innerHTML = ''; const d = curDoc(); if (!d) return;
      const items = await parseFunctions(d);
      if (items === null) { body.append(el('div', { style: 'padding:10px;color:var(--ui-dim)', text: `No parser rule for "${d.lang}" in functionList/.` })); return; }
      let list = items.filter((i) => !q.value || i.name.toLowerCase().includes(q.value.toLowerCase())); if (sorted) list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) body.append(el('div', { style: 'padding:10px;color:var(--ui-dim)', text: 'No functions found.' }));
      list.forEach((i) => body.append(treeIt(i.name, { icon: i.isClass ? '◈' : 'ƒ', depth: i.cls ? 1 : 0, ondbl: () => { const ed = curEd(); ed.setPosition({ lineNumber: i.line, column: 1 }); ed.revealLineInCenter(i.line); ed.focus(); }, onclick: () => { const ed = curEd(); ed.revealLineInCenter(i.line); } })));
    };
    q.addEventListener('input', draw);
    host.append(el('div', { class: 'panel-search' }, q, el('button', { text: 'A↓Z', title: 'Sort', onclick: () => { sorted = !sorted; draw(); } }), el('button', { text: '⟳', title: 'Reload', onclick: () => { flCache[curDoc().lang] = undefined; draw(); } })), body);
    PANELS.funclist._draw = draw; draw();
  },
};
let flT; const flRefresh = () => { clearTimeout(flT); flT = setTimeout(() => { if (dock.active === 'funclist') PANELS.funclist._draw?.(); }, 500); };
NGN.on('doc-activated', flRefresh); NGN.on('content', flRefresh); NGN.on('lang-changed', flRefresh);

// ---- Clipboard history ----------------------------------------------------------------------------------------
NGN.noteClip = (t) => { if (!t) return; S.clipHist = [t, ...S.clipHist.filter((x) => x !== t)].slice(0, 30); if (dock.active === 'clip') PANELS.clip._draw?.(); };
addEventListener('copy', () => setTimeout(async () => { try { const t = await ngn.clip.readText(); NGN.noteClip(t); } catch { /* ignore */ } }, 20), true);
addEventListener('cut', () => setTimeout(async () => { try { const t = await ngn.clip.readText(); NGN.noteClip(t); } catch { /* ignore */ } }, 20), true);
PANELS.clip = {
  title: 'Clipboard History',
  build(host) {
    const body = el('div', { class: 'tree panel-body' }); let sel = -1;
    const draw = () => { body.innerHTML = ''; S.clipHist.forEach((t, i) => body.append(treeIt(t.replace(/\s+/g, ' ').slice(0, 80), { sel: i === sel, onclick: () => { sel = i; draw(); }, ondbl: () => { curEd().focus(); curEd().trigger('clip', 'paste', { text: t }); } }))); if (!S.clipHist.length) body.append(el('div', { style: 'padding:10px;color:var(--ui-dim)', text: 'Copied/cut text appears here. Double-click to paste.' })); };
    host.append(el('div', { class: 'panel-search' }, el('button', { text: 'Paste', onclick: () => { if (sel >= 0) { curEd().focus(); curEd().trigger('clip', 'paste', { text: S.clipHist[sel] }); } } }), el('button', { text: 'Copy', onclick: () => sel >= 0 && ngn.clip.writeText(S.clipHist[sel]) }), el('button', { text: 'Delete', onclick: () => { if (sel >= 0) { S.clipHist.splice(sel, 1); sel = -1; draw(); } } }), el('button', { text: 'Clear', onclick: () => { S.clipHist = []; draw(); } })), body);
    PANELS.clip._draw = draw; draw();
  },
};

// ---- Character panel ----------------------------------------------------------------------------------------------
PANELS.chars = {
  title: 'Character Panel',
  build(host) {
    const names = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'TAB', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
    const grid = el('div', { class: 'chargrid', style: 'padding:6px' });
    for (let i = 0; i < 256; i++) grid.append(el('div', { title: `${i} (0x${i.toString(16).toUpperCase().padStart(2, '0')})`, text: i < 32 ? names[i] : i === 127 ? 'DEL' : String.fromCharCode(i), style: i < 33 ? 'font-size:8px' : '', ondblclick: () => { curEd().focus(); curEd().trigger('chars', 'type', { text: String.fromCharCode(i) }); } }));
    host.append(el('div', { style: 'padding:6px;color:var(--ui-dim)', text: 'Double-click a character to insert it.' }), el('div', { class: 'panel-body' }, grid));
  },
};

// ---- Monitoring (tail -f) ------------------------------------------------------------------------------------------------
NGN.setMonitoring = (doc, on) => {
  if (on) { if (!doc.path) { doc.monitoring = false; return NGN.toast('Save the file to monitor it.'); } doc.roBefore = doc.readOnly; doc.readOnly = true; S.monitoring.add(doc.id); NGN.toast('Monitoring ' + doc.name); }
  else { doc.readOnly = !!doc.roBefore; S.monitoring.delete(doc.id); }
  S.views[doc.view].ed?.updateOptions({ readOnly: doc.readOnly }); NGN.renderTabs(S.views[doc.view]); NGN.tbState(44097, on);
};
ngn.on.fileChanged(async (id) => {
  const doc = S.docs.get(id); if (!doc || !doc.path) return;
  const st = await ngn.file.stat(doc.path); if (!st || st.mtime === doc.mtime) return;
  if (doc.monitoring) {
    const r = await ngn.file.read(doc.path, doc.enc); const ed = S.views[doc.view].ed; const atEnd = ed.getVisibleRanges().some((x) => x.endLineNumber >= doc.model.getLineCount() - 1);
    doc.model.setValue(r.text); doc.mtime = r.mtime; doc.savedVer = doc.model.getAlternativeVersionId(); if (atEnd || S.prefs.scrollToLast) ed.revealLine(doc.model.getLineCount());
  } else if (S.prefs.autoDetectStatus) {
    doc.mtime = st.mtime;
    if (!isDirty(doc)) { if (S.prefs.updateSilent || await NGN.confirm('File changed', `"${doc.name}" was modified outside the editor.\nReload it?`)) { const r = await ngn.file.read(doc.path, doc.enc); const pos = S.views[doc.view].ed.getPosition(); doc.model.setValue(r.text); doc.savedVer = doc.model.getAlternativeVersionId(); if (pos) S.views[doc.view].ed.setPosition(pos); NGN.renderTabs(S.views[doc.view]); } }
    else NGN.toast(`"${doc.name}" changed on disk (you have unsaved edits).`, 4000);
  }
});
