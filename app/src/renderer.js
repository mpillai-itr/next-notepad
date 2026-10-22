// Renderer entry: boots modules in order, wires IPC from the native menu.
import { monaco } from './core.js';
import './ui.js';
import './find.js';
import './panels.js';
import './tools.js';
import './commands.js';
import './editorfx.js';
import { applyPrefs, matchDynamicShortcut } from './prefs.js';
import './prefs.js';
import { S, NGN, curEd, curDoc } from './state.js';
import { loadLanguages } from './languages.js';
import { listThemes } from './themes.js';

const ngn = window.ngn;

async function boot() {
  await NGN.initCore();
  await loadLanguages();
  await listThemes();
  const tree = await (await fetch('app://host/menu.json')).json();
  NGN.initLangLabels(tree);
  NGN.loadUDLs();
  NGN.initFx();
  NGN.buildToolbar();
  await applyPrefs({ theme: true });
  // dark-mode default theme pairing (original behavior: enabling dark mode selects a dark style)
  document.body.classList.toggle('wrap-sym', !!S.prefs.wrapSymbol);

  ngn.on.cmd((id) => NGN.runCommand(id));
  ngn.on.openPaths(async (paths) => { for (const p of paths) await NGN.openPath(p); });
  ngn.on.requestClose(() => NGN.quit());
  ngn.on.systemTheme(() => { if (S.prefs.darkMode === 'system') applyPrefs({ theme: false }); });
  NGN.refreshRecentMenu(); NGN.refreshDynamicMenus();

  // restore session, else a fresh document
  let restored = false;
  if (S.prefs.rememberSession) { try { restored = await NGN.restoreSession(await ngn.session.get()); } catch (e) { console.warn('restore', e); } }
  if (!S.docs.size || (S.prefs.newAtStartup && !restored)) NGN.createDoc({ view: 0 });
  NGN.restorePanels();

  // keyboard: macro/run shortcuts, document switcher, Escape in incremental search
  addEventListener('keydown', (e) => {
    const dyn = matchDynamicShortcut(e); if (dyn) { e.preventDefault(); NGN.runCommand(dyn); return; }
    if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); if (S.prefs.docSwitcher) docSwitcher(e.shiftKey ? -1 : 1); else NGN.runCommand(e.shiftKey ? 44096 : 44095); }
  }, true);
  addEventListener('keyup', (e) => { if (e.key === 'Control' && sw) commitSwitcher(); }, true);

  // drag & drop files
  addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  addEventListener('drop', async (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); for (const f of e.dataTransfer.files) { const p = ngn.pathFor(f); if (!p) continue; const st = await ngn.file.stat(p); if (st?.isDir && S.prefs.openFolderOnDrop) { for (const x of await ngn.file.listDir(p)) if (!x.dir) await NGN.openPath(x.path); } else await NGN.openPath(p); } });

  // external-change check when the window regains focus
  addEventListener('focus', async () => { if (!S.prefs.autoDetectStatus) return; for (const d of S.docs.values()) { if (!d.path || d.monitoring) continue; const st = await ngn.file.stat(d.path); if (st && st.mtime !== d.mtime) { ngn.watch.add(d.id, d.path); const fn = NGN.fileChangedHandler; } } });
  setInterval(() => NGN.saveSession?.(), 30000);
  window.addEventListener('beforeunload', () => { NGN.saveSession?.(); });

  const env = await ngn.demo.env();
  if (env.phase) { const m = await import('./restoretest.js'); await m.run(env); return; }
  if (env.selftest) { const m = await import('./selftest.js'); await m.run(); return; }
  if (env.demo) { const m = await import('./demo.js'); m.run(env); }
}
boot().catch((e) => { console.error('boot failed', e); document.body.append(Object.assign(document.createElement('pre'), { textContent: 'Boot failed: ' + (e.stack || e) })); });

// ---- Document Switcher (Ctrl+Tab): MRU or tab-order list, committed when Control is released ----------------------------------------
let sw = null;
function docSwitcher(dir) {
  const { el } = NGN;
  if (!sw) {
    const ids = S.prefs.docSwitcherMRU ? [...(S.mru || [])].filter((i) => S.docs.has(i)) : S.views[S.cur].order.slice();
    S.docs.forEach((d) => { if (!ids.includes(d.id)) ids.push(d.id); });
    const cur = S.views[S.cur].active; sw = { ids, i: Math.max(0, ids.indexOf(cur)), box: el('div', { class: 'dlg', style: 'left:50%;top:20%;transform:translateX(-50%);min-width:320px;z-index:300' }) };
    document.body.append(sw.box);
  }
  sw.i = (sw.i + dir + sw.ids.length) % sw.ids.length;
  sw.box.innerHTML = ''; sw.box.append(el('div', { class: 'dlg-title', text: 'Document Switcher' }), el('div', { class: 'list', style: 'height:auto;max-height:50vh' }, sw.ids.map((id, k) => { const d = S.docs.get(id); return el('div', { class: k === sw.i ? 'sel' : '', text: (NGN.isDirty(d) ? '● ' : '') + d.name + (d.path ? '   —   ' + d.path.replace(/\/[^/]*$/, '') : '') }); })));
}
function commitSwitcher() { const id = sw.ids[sw.i]; sw.box.remove(); sw = null; if (id) NGN.activateDoc(id); }
