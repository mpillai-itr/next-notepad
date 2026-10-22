// UI helpers: floating dialogs, modal prompts, popup menus, context menu, toolbar.
import { S, NGN, curEd, curDoc } from './state.js';

const { el, $ } = NGN;
const ngn = window.ngn;

// ---- floating dialog ---------------------------------------------------------------------
let zTop = 60;
const openDialogs = new Map();
export function dialog({ key, title, body, buttons = [], modal = false, width, x, y, onClose, keepOpen = false }) {
  if (key && openDialogs.has(key)) { const d = openDialogs.get(key); d.el.style.zIndex = ++zTop; d.focus?.(); return d; }
  const host = $('#dialogs');
  const bodyEl = el('div', { class: 'dlg-body' }, body);
  const foot = buttons.length ? el('div', { class: 'dlg-foot' }, buttons.map((b) => el('button', { text: b.label, class: b.primary ? 'primary' : '', onclick: async (e) => { const r = b.fn ? await b.fn(e, api) : undefined; if (r !== false && !b.stay) api.close(); } }))) : null;
  const t = el('div', { class: 'dlg-title' }, el('span', { class: 't', text: title }), el('span', { class: 'x', text: '✕', onclick: () => api.close() }));
  const box = el('div', { class: 'dlg' + (modal ? ' modal-block' : ''), style: `${width ? `width:${width}px;` : ''}z-index:${++zTop}` }, t, bodyEl, foot);
  host.append(box);
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = (x ?? Math.max(10, (innerWidth - w) / 2)) + 'px'; box.style.top = (y ?? Math.max(10, (innerHeight - h) / 3)) + 'px';
  t.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('x')) return; box.style.zIndex = ++zTop;
    const ox = e.clientX - box.offsetLeft, oy = e.clientY - box.offsetTop;
    const mv = (ev) => { box.style.left = Math.max(0, ev.clientX - ox) + 'px'; box.style.top = Math.max(0, ev.clientY - oy) + 'px'; };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  });
  box.addEventListener('mousedown', () => { box.style.zIndex = ++zTop; });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); }
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { const p = box.querySelector('.dlg-foot button.primary, [data-default]'); if (p) { e.preventDefault(); p.click(); } }
  });
  const api = {
    el: box, body: bodyEl, close() { box.remove(); if (key) openDialogs.delete(key); onClose?.(); curEd()?.focus?.(); },
    focus() { (box.querySelector('[data-focus]') || box.querySelector('input[type=text],textarea,select,button'))?.focus(); }, setTitle(s) { t.querySelector('.t').textContent = s; },
  };
  if (key) openDialogs.set(key, api);
  setTimeout(() => { const f = box.querySelector('[data-focus]') || box.querySelector('input[type=text],textarea'); f?.focus(); f?.select?.(); }, 0);
  return api;
}
NGN.dialog = dialog;
NGN.closeDialog = (key) => openDialogs.get(key)?.close();
NGN.dialogOpen = (key) => openDialogs.has(key);

// promise-based modal helper: buttons [{label,value,primary}]
export function modal(title, body, buttons, width = 380) {
  return new Promise((res) => {
    let done = false;
    const d = dialog({
      title, body, modal: true, width, onClose: () => { if (!done) { done = true; res(null); } },
      buttons: buttons.map((b) => ({ label: b.label, primary: b.primary, fn: () => { done = true; res(b.value); } })),
    });
  });
}
NGN.modal = modal;
NGN.confirm = async (title, msg) => (await modal(title, el('div', { style: 'white-space:pre-wrap;max-width:420px' }, msg), [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }])) === true;
NGN.alert = (title, msg) => modal(title, el('div', { style: 'white-space:pre-wrap;max-width:460px;user-select:text' }, msg), [{ label: 'OK', value: true, primary: true }]);
NGN.prompt = (title, label, value = '') => new Promise((res) => {
  const inp = el('input', { type: 'text', value, style: 'width:100%', 'data-focus': true }); inp.value = value;
  let done = false;
  dialog({ title, modal: true, width: 400, body: el('div', {}, el('div', { text: label, style: 'margin-bottom:6px' }), inp), onClose: () => { if (!done) res(null); },
    buttons: [{ label: 'Cancel', fn: () => { done = false; } }, { label: 'OK', primary: true, fn: () => { done = true; res(inp.value); } }] });
});
NGN.askSave = (doc, multi) => new Promise((res) => {
  let done = false; const finish = (v) => () => { done = true; res(v); };
  dialog({ title: 'Save', modal: true, width: 400, onClose: () => { if (!done) res('cancel'); },
    body: el('div', { text: `Save file "${doc.path || doc.name}" ?`, style: 'padding:6px 0' }),
    buttons: multi
      ? [{ label: 'Yes', primary: true, fn: finish('yes') }, { label: 'No', fn: finish('no') }, { label: 'Yes to all', fn: finish('yesall') }, { label: 'No to all', fn: finish('noall') }, { label: 'Cancel', fn: finish('cancel') }]
      : [{ label: 'Yes', primary: true, fn: finish('yes') }, { label: 'No', fn: finish('no') }, { label: 'Cancel', fn: finish('cancel') }] });
});

// ---- popup (context) menus ------------------------------------------------------------------------
let popEl = null;
export function popup(items, x, y) {
  popup.close();
  const m = el('div', { class: 'popup', style: `left:${x}px;top:${y}px` });
  const build = (list, root) => {
    list.forEach((it) => {
      if (it.sep) { root.append(el('div', { class: 'psep' })); return; }
      const row = el('div', { class: 'pit' + (it.disabled ? ' dis' : ''), text: '' }, el('span', { class: 'chk', text: it.checked ? '✓' : '' }), el('span', { class: 'lbl', text: it.label }), it.accel ? el('span', { class: 'acc', text: it.accel }) : null, it.children ? el('span', { class: 'arr', text: '▶' }) : null);
      if (it.children) {
        const sub = el('div', { class: 'popup sub' }); build(it.children, sub); row.append(sub);
        row.addEventListener('mouseenter', () => { sub.style.display = 'block'; const r = row.getBoundingClientRect(); sub.style.left = r.width - 4 + 'px'; sub.style.top = '-4px'; const sr = sub.getBoundingClientRect(); if (sr.right > innerWidth) sub.style.left = -sr.width + 'px'; if (sr.bottom > innerHeight) sub.style.top = innerHeight - sr.bottom - 8 + 'px'; });
        row.addEventListener('mouseleave', () => { sub.style.display = 'none'; });
      } else if (!it.disabled) row.addEventListener('click', (e) => { e.stopPropagation(); popup.close(); it.fn?.(); });
      root.append(row);
    });
  };
  build(items, m); document.body.append(m); popEl = m;
  const r = m.getBoundingClientRect(); if (r.right > innerWidth) m.style.left = Math.max(0, innerWidth - r.width - 4) + 'px'; if (r.bottom > innerHeight) m.style.top = Math.max(0, innerHeight - r.height - 4) + 'px';
  setTimeout(() => addEventListener('mousedown', outside, true), 0);
  function outside(e) { if (!m.contains(e.target)) { popup.close(); } }
  popup._outside = outside;
}
popup.close = () => { if (popEl) { popEl.remove(); popEl = null; removeEventListener('mousedown', popup._outside, true); } };
NGN.popup = popup;
addEventListener('keydown', (e) => { if (e.key === 'Escape') popup.close(); });

// ---- editor context menu: driven by the shipped contextMenu.xml ----------------------------------------------
let menuIndex = null; // "Entry|Item" -> id, by walking docs/menu.json
async function indexMenu() {
  if (menuIndex) return menuIndex;
  menuIndex = { byName: {}, byId: {} };
  const tree = await (await fetch('app://host/menu.json')).json();
  const walk = (list, top) => list.forEach((n) => { if (n.children) walk(n.children, top || n.label); else if (n.id) { menuIndex.byName[(top + '|' + n.label)] = n.id; menuIndex.byId[n.id] = n.label; } });
  tree.forEach((t) => t.children && walk(t.children, t.label));
  return menuIndex;
}
NGN.menuLabel = async (id) => (await indexMenu()).byId[id];
let ctxItems = null;
NGN.showContextMenu = async (x, y) => {
  const ix = await indexMenu();
  if (!ctxItems) {
    const xml = await ngn.file.readData('../contextMenu.xml').catch(() => null);
    ctxItems = xml ? parseContextXml(xml, ix) : defaultContext(ix);
  }
  popup(ctxItems.map((i) => (i.sep ? i : { ...i })).map((i) => i.children ? { ...i, children: i.children } : i), x, y);
};
function defaultContext(ix) {
  const E = (n) => ix.byName['Edit|' + n];
  return [['Cut', 42001], ['Copy', 42002], ['Paste', 42005], ['Delete', 42006], ['Select All', 42007]].map(([l, id]) => ({ label: l, fn: () => NGN.runCommand(id) }));
}
function parseContextXml(xml, ix) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml'); const out = []; const folders = {};
  doc.querySelectorAll('ScintillaContextMenu > Item').forEach((it) => {
    let entry;
    if (it.getAttribute('id') === '0') entry = { sep: true };
    else {
      let id = it.getAttribute('id') ? parseInt(it.getAttribute('id'), 10) : ix.byName[(it.getAttribute('MenuEntryName') + '|' + it.getAttribute('MenuItemName'))];
      const pe = it.getAttribute('PluginEntryName');
      const label = it.getAttribute('ItemNameAs') || (it.getAttribute('PluginCommandItemName')) || ix.byId[id] || it.getAttribute('MenuItemName');
      if (pe) entry = { label, fn: () => NGN.runCommand('plugin:' + pe + '|' + it.getAttribute('PluginCommandItemName')) };
      else if (id) entry = { label: ix.byId[id] || label, fn: () => NGN.runCommand(id) };
      else return;
    }
    const f = it.getAttribute('FolderName');
    if (f && !entry.sep) { (folders[f] ||= (() => { const g = { label: f, children: [] }; out.push(g); return g; })()).children.push(entry); } else out.push(entry);
  });
  return out;
}
NGN.reloadContextMenu = () => { ctxItems = null; };

// ---- toolbar ------------------------------------------------------------------------------------------------------------
const TB = [
  ['📄', 'New', 41001], ['📂', 'Open', 41002], ['💾', 'Save', 41006], ['🗂', 'Save All', 41007], ['✖', 'Close', 41003], ['🧹', 'Close All', 41004], ['🖨', 'Print', 41010], '|',
  ['✂', 'Cut', 42001], ['⧉', 'Copy', 42002], ['📋', 'Paste', 42005], '|', ['↶', 'Undo', 42003], ['↷', 'Redo', 42004], '|',
  ['🔍', 'Find', 43001], ['⇄', 'Replace', 43003], '|', ['＋', 'Zoom In', 44023], ['－', 'Zoom Out', 44024], '|',
  ['⇅', 'Synchronize Vertical Scrolling', 44035], ['⇆', 'Synchronize Horizontal Scrolling', 44036], '|',
  ['↵', 'Word wrap', 44022], ['¶', 'Show All Characters', 44019], ['┆', 'Show Indent Guide', 44020], ['UDL', 'Define your language...', 46250], '|',
  ['🗺', 'Document Map', 44080], ['☰', 'Document List', 44070], ['ƒ', 'Function List', 44084], ['📁', 'Folder as Workspace', 44085], ['⏱', 'Monitoring (tail -f)', 44097], '|',
  ['●', 'Start Recording', 42018], ['■', 'Stop Recording', 42019], ['▶', 'Playback', 42021], ['▶▶', 'Run a Macro Multiple Times...', 42032], ['💾', 'Save Current Recorded Macro...', 42025],
];
NGN.buildToolbar = () => {
  const tb = $('#toolbar'); tb.innerHTML = '';
  TB.forEach((t) => {
    if (t === '|') { tb.append(el('div', { class: 'sep' })); return; }
    const [g, title, id] = t; tb.append(el('button', { class: 'tb', title, 'data-cmd': id, text: g, onclick: () => NGN.runCommand(id) }));
  });
  tb.classList.toggle('hidden', S.prefs.toolbar === 'hide');
};
NGN.tbState = (id, on) => { document.querySelector(`#toolbar [data-cmd="${id}"]`)?.classList.toggle('on', !!on); };

const css = document.createElement('style');
css.textContent = `
.popup{position:fixed;z-index:200;background:var(--ui-panel);border:1px solid var(--ui-edge);border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.3);padding:4px 0;min-width:190px;font-size:12px;color:var(--ui-fg)}
.popup.sub{display:none;position:absolute}
.pit{display:flex;align-items:center;padding:3px 8px;gap:6px;cursor:default;position:relative;white-space:nowrap}.pit:hover{background:var(--ui-accent);color:#fff}.pit.dis{opacity:.4;pointer-events:none}
.pit .chk{width:12px}.pit .lbl{flex:1}.pit .acc{opacity:.6;margin-left:18px}.pit .arr{font-size:8px;opacity:.7}.psep{height:1px;background:var(--ui-edge);margin:3px 0}
button.primary{background:var(--ui-accent);color:#fff;border-color:var(--ui-accent)}`;
document.head.append(css);
