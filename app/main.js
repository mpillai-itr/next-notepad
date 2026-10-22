'use strict';
// Main process: window, native menu, file/encoding IO, hashing, search, sessions.
// Menu structure is generated from docs/menu.json, which was extracted from the
// Windows notepad++.exe RT_MENU resource (id 1500) with REA.
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, protocol, net, clipboard, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const ROOT = __dirname;
const MENU = require('./menu.json');
const CFG_FILE = () => {
  // "Settings on cloud": a synced folder chosen in Preferences holds config.json instead of the local profile.
  try { const l = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'config.json'), 'utf8')).prefs?.cloudPath; if (l && fs.existsSync(l)) return path.join(l, 'config.json'); } catch { /* no local config yet */ }
  return path.join(app.getPath('userData'), 'config.json');
};
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'window.json');
const SESSION_FILE = () => path.join(app.getPath('userData'), 'session.json');
const BACKUP_DIR = () => path.join(app.getPath('userData'), 'backup');

// ---- encodings (menu ids 45004-45068 in the original) ----------------------
const ENC = {
  ansi: 'windows-1252', utf8: 'utf8', 'utf8-bom': 'utf8bom', 'utf16be-bom': 'utf16be', 'utf16le-bom': 'utf16le',
  45029: 'iso-8859-1', 45030: 'iso-8859-2', 45031: 'iso-8859-3', 45032: 'iso-8859-4', 45033: 'iso-8859-5', 45034: 'iso-8859-6',
  45035: 'iso-8859-7', 45036: 'iso-8859-8', 45037: 'iso-8859-9', 45040: 'iso-8859-13', 45041: 'iso-8859-14', 45042: 'iso-8859-15',
  45020: 'windows-1250', 45021: 'windows-1251', 45022: 'windows-1252', 45023: 'windows-1253', 45024: 'windows-1254',
  45025: 'windows-1255', 45026: 'windows-1256', 45027: 'windows-1257', 45028: 'windows-1258',
  45044: 'cp437', 45045: 'cp720', 45046: 'cp737', 45047: 'cp775', 45048: 'cp850', 45049: 'cp852', 45050: 'cp855', 45051: 'cp857',
  45052: 'cp858', 45053: 'cp860', 45054: 'cp861', 45055: 'cp862', 45056: 'cp863', 45057: 'cp865', 45058: 'cp866', 45059: 'cp869',
  45060: 'big5', 45061: 'gb2312', 45062: 'shift_jis', 45063: 'cp949', 45064: 'euc-kr', 45065: 'tis620', 45066: 'macintosh',
  45067: 'koi8-u', 45068: 'koi8-r',
};

function decodeBuffer(buf, forced) {
  // BOM detection first, like the original's "Autodetect character encoding".
  if (!forced) {
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.slice(3).toString('utf8'), enc: 'utf8-bom' };
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return { text: iconv.decode(buf.slice(2), 'utf16le'), enc: 'utf16le-bom' };
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return { text: iconv.decode(buf.slice(2), 'utf16be'), enc: 'utf16be-bom' };
    const asUtf8 = buf.toString('utf8');
    if (!asUtf8.includes('�')) return { text: asUtf8, enc: 'utf8' };
    const det = jschardet.detect(buf.slice(0, 65536));
    const name = det && det.confidence > 0.6 && iconv.encodingExists(det.encoding) ? det.encoding : 'windows-1252';
    return { text: iconv.decode(buf, name), enc: 'cs:' + name };
  }
  if (forced === 'ansi') return { text: iconv.decode(buf, 'windows-1252'), enc: 'ansi' };
  if (forced === 'utf8-bom') return { text: buf.slice(buf[0] === 0xef ? 3 : 0).toString('utf8'), enc: forced };
  if (forced === 'utf16le-bom') return { text: iconv.decode(buf.slice(buf[0] === 0xff ? 2 : 0), 'utf16le'), enc: forced };
  if (forced === 'utf16be-bom') return { text: iconv.decode(buf.slice(buf[0] === 0xfe ? 2 : 0), 'utf16be'), enc: forced };
  if (forced === 'utf8') return { text: buf.toString('utf8'), enc: forced };
  const name = forced.startsWith('cs:') ? forced.slice(3) : forced;
  return { text: iconv.decode(buf, name), enc: forced };
}

function encodeText(text, enc) {
  switch (enc) {
    case 'utf8': return Buffer.from(text, 'utf8');
    case 'utf8-bom': return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
    case 'utf16le-bom': return Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, 'utf16le')]);
    case 'utf16be-bom': return Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode(text, 'utf16be')]);
    case 'ansi': return iconv.encode(text, 'windows-1252');
    default: return iconv.encode(text, enc.startsWith('cs:') ? enc.slice(3) : enc);
  }
}

// ---- config ------------------------------------------------------------------
function loadJSON(file, dflt) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return dflt; } }
function saveJSON(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 1)); }

let win = null;
let cfgCache = null;
const getCfg = () => (cfgCache ||= loadJSON(CFG_FILE(), {}));

// ---- menu --------------------------------------------------------------------
// Default shortcuts follow the Notepad++ defaults, with Ctrl mapped to Cmd on macOS.
const ACCEL = {
  41001: 'CmdOrCtrl+N', 41002: 'CmdOrCtrl+O', 41006: 'CmdOrCtrl+S', 41008: 'CmdOrCtrl+Alt+S', 41007: 'CmdOrCtrl+Shift+S',
  41003: 'CmdOrCtrl+W', 41004: 'CmdOrCtrl+Shift+W', 41010: 'CmdOrCtrl+P', 41011: 'Alt+F4', 42003: 'CmdOrCtrl+Z', 42004: 'CmdOrCtrl+Y',
  42001: 'CmdOrCtrl+X', 42002: 'CmdOrCtrl+C', 42005: 'CmdOrCtrl+V', 42007: 'CmdOrCtrl+A', 42010: 'CmdOrCtrl+D', 42012: 'CmdOrCtrl+I',
  42013: 'CmdOrCtrl+J', 42014: 'CmdOrCtrl+Shift+Up', 42015: 'CmdOrCtrl+Shift+Down', 42016: 'CmdOrCtrl+Shift+U', 42017: 'CmdOrCtrl+U',
  42022: 'CmdOrCtrl+Q', 42023: 'CmdOrCtrl+Shift+Q', 42047: 'CmdOrCtrl+Shift+K', 42024: null, 42034: 'Alt+C', 42037: 'Alt+Shift+C',
  42018: 'CmdOrCtrl+Shift+R', 42021: 'F9', 43001: 'CmdOrCtrl+F', 43013: 'CmdOrCtrl+Shift+F', 43002: 'F3', 43010: 'Shift+F3',
  43003: 'CmdOrCtrl+H', 43011: 'CmdOrCtrl+Alt+I', 43004: 'CmdOrCtrl+G', 43009: 'CmdOrCtrl+B', 43054: 'CmdOrCtrl+M', 43005: 'CmdOrCtrl+F2',
  43006: 'F2', 43007: 'Shift+F2', 43048: 'CmdOrCtrl+F3', 43049: 'CmdOrCtrl+Shift+F3', 44034: null, 44032: 'F11', 44009: 'F12',
  44011: 'CmdOrCtrl+Shift+F11', 44022: null, 44010: 'Alt+0', 44029: 'Alt+Shift+0', 44023: 'CmdOrCtrl+=', 44024: 'CmdOrCtrl+-',
  44033: 'CmdOrCtrl+Numadd', 44095: 'Ctrl+Tab', 44096: 'Ctrl+Shift+Tab', 47000: null, 46001: null, 48011: null, 49000: 'F5', 50000: 'CmdOrCtrl+Enter',
  50001: 'CmdOrCtrl+Space', 42038: null, 44070: null, 44085: null, 44084: null, 44080: null, 11001: null, 42089: null,
};
// Keep only unambiguous accelerators; drop duplicates and ones the OS reserves.
const USED = new Set();
function accelFor(id) {
  const ov = (getCfg().prefs || {}).shortcuts || {};
  const a = id in ov ? ov[id] : ACCEL[id];
  if (!a || a.includes('Numadd') || a === 'Alt+F4' || a === 'Ctrl+Tab' || a === 'Ctrl+Shift+Tab') return undefined;
  if (USED.has(a)) return undefined;
  USED.add(a);
  return a;
}

const TOGGLE_IDS = new Set([44034, 44022, 44025, 44026, 44130, 44131, 44019, 44020, 44041, 44032, 44011, 44009, 44080, 44070, 44084, 44085,
  44097, 42028, 42102, 44035, 44036, 44072, 44042, 44081, 44082, 44083, 42033]);
const RADIO = { eol: [45001, 45002, 45003], enc: [45004, 45008, 45005, 45006, 45007] };

// ---- localization (data/localization/*.xml, same format as Notepad++'s nativeLang files) --------
const stripAmp = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
function parseNative(file) {
  let xml; try { xml = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const out = { cmd: {}, sub: {}, top: {} };
  const grab = (re, fn) => { let m; while ((m = re.exec(xml))) fn(m); };
  grab(/<Item id="(\d+)" name="([^"]*)"/g, (m) => { out.cmd[m[1]] = stripAmp(m[2]); });
  grab(/<Item subMenuId="([^"]+)" name="([^"]*)"/g, (m) => { out.sub[m[1]] = stripAmp(m[2]); });
  grab(/<Item menuId="([^"]+)" name="([^"]*)"/g, (m) => { out.top[m[1]] = stripAmp(m[2]); });
  return out;
}
let TR = null, ENG = null;
function setLocale(lang) {
  ENG = parseNative(path.join(ROOT, 'data', 'english.xml'));
  TR = null; if (lang && lang !== 'english') { const t = parseNative(path.join(ROOT, 'data', 'localization', lang + '.xml')); if (t) TR = { ...t, engSub: Object.fromEntries(Object.entries(ENG.sub).map(([k, v]) => [v.replace(/&/g, ''), k])), engTop: Object.fromEntries(Object.entries(ENG.top).map(([k, v]) => [v.replace(/&/g, ''), k])) }; }
}
const tl = (kind, label, id) => {
  if (!TR) return label;
  if (kind === 'cmd') return TR.cmd[id] ? TR.cmd[id].replace(/\(&\w\)|&/g, '') : label;
  const k = (kind === 'top' ? TR.engTop : TR.engSub)[label.replace(/&/g, '')] || (kind === 'top' ? TR.engTop[label.toLowerCase()] : null);
  const v = k && (kind === 'top' ? TR.top : TR.sub)[k]; return v ? v.replace(/\(&\w\)|&/g, '') : label;
};

function buildItem(n) {
  if (n.sep) return { type: 'separator' };
  if (n.children) return { label: tl('sub', n.label), submenu: n.children.map(buildItem), _id: n.label };
  const it = { label: tl('cmd', n.label, n.id), id: String(n.id) };
  const a = accelFor(n.id);
  if (a) it.accelerator = a;
  const role = { 42001: 'cut', 42002: 'copy', 42005: 'paste' }[n.id];
  if (role) it.role = role; // native roles keep clipboard shortcuts working inside dialog inputs
  else it.click = () => send('cmd', n.id);
  if (TOGGLE_IDS.has(n.id)) it.type = 'checkbox';
  return it;
}

function localizeMenu(items, tr) { return items; }

function buildMenu() {
  USED.clear();
  const top = [];
  const seen = new Set();
  const compact = !!(getCfg().prefs || {}).langMenuCompact; let langN = 0;
  for (const m of MENU) {
    // The resource holds two Language menus: the flat list and the compact A–Z variant ("Make language menu compact").
    if (m.label === 'Language') { langN++; if (langN !== (compact ? 2 : 1)) continue; }
    if (!m.children || !m.children.length) continue;
    if (['＋', '▼', '✕'].includes(m.label)) continue;
    seen.add(m.label);
    const TOPKEY = { File: 'file', Edit: 'edit', Search: 'search', View: 'view', Encoding: 'encoding', Language: 'language', Settings: 'settings', Tools: 'tools', Macro: 'macro', Run: 'run', Plugins: 'Plugins', Window: 'Window' };
    const tl2 = TR && TOPKEY[m.label] && TR.top[TOPKEY[m.label]] ? TR.top[TOPKEY[m.label]].replace(/\(&\w\)|&/g, '') : m.label;
    top.push({ label: tl2, submenu: m.children.map(buildItem), id: 'top-' + m.label, _top: m.label });
  }
  // Items the original creates at runtime (not stored in the RT_MENU resource).
  const plugins = top.find((t) => t._top === 'Plugins');
  if (plugins) {
    const defs = require('./plugins.json');
    plugins.submenu.unshift({ label: 'Plugins Admin...', click: () => send('cmd', 'plugins-admin') }, { type: 'separator' });
    defs.forEach((p) => plugins.submenu.push({ label: p.name, submenu: p.commands.map((c) => (c === '-' ? { type: 'separator' } : { label: c, click: () => send('cmd', 'plugin:' + p.name + '|' + c) })) }));
  }
  const file = top.find((t) => t._top === 'File');
  const idx = file.submenu.findIndex((i) => i.id === '41012');
  file.submenu.splice(idx > 0 ? idx - 1 : file.submenu.length, 0, { label: 'Recent Files', id: 'recent-files', submenu: [{ label: '(empty)', enabled: false }] });
  const tpl = [
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Preferences…', accelerator: 'Cmd+,', click: () => send('cmd', 48011) }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    ...top,
  ];
  tpl.push({ label: 'Developer', submenu: [{ role: 'toggleDevTools' }, { role: 'reload' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function send(ch, ...a) { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); }

// ---- window ------------------------------------------------------------------
function createWindow() {
  const b = loadJSON(BOUNDS_FILE(), {});
  const { screen } = require('electron');
  const onScreen = b.x != null && screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width - 40 && b.x + (b.width || 0) > d.bounds.x + 40 && b.y >= d.bounds.y - 10 && b.y < d.bounds.y + d.bounds.height - 40);
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 820, ...(onScreen ? { x: b.x, y: b.y } : {}), minWidth: 640, minHeight: 400, title: 'NextGenNote',
    backgroundColor: '#ffffff', show: !process.env.NGN_HEADLESS,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadURL('app://host/index.html');
  if (b.maximized) win.maximize();
  if (b.fullscreen) win.setFullScreen(true);
  const saveBounds = () => { try { if (win.isDestroyed()) return; const nb = win.isMaximized() || win.isFullScreen() ? (loadJSON(BOUNDS_FILE(), {})) : win.getBounds(); saveJSON(BOUNDS_FILE(), { ...nb, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }); } catch { /* best effort */ } };
  win.on('resized', saveBounds); win.on('moved', saveBounds); win.on('maximize', saveBounds); win.on('unmaximize', saveBounds);
  win.on('close', (e) => {
    saveBounds();
    if (win._forceClose) return;
    e.preventDefault();
    send('request-close');
  });
}

app.setName('NextGenNote');
// Default "mono-instance" mode: a second launch hands its files to the running window (Preferences ▸ Multi-Instance).
if (!process.env.NGN_DEMO && !process.env.NGN_SELFTEST && !process.env.NGN_NEW_INSTANCE && ((loadJSON(CFG_FILE(), {}).prefs || {}).multiInstance || 'mono') !== 'multi') {
  if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
  app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); const f = argv.slice(1).filter((a) => !a.startsWith('--') && fs.existsSync(a)); if (f.length) send('open-paths', f.map((x) => path.resolve(x))); } });
}
if (process.env.NGN_DEMO) app.setPath('userData', path.join(app.getPath('temp'), 'ngn-demo-profile'));

const pendingOpen = [];
app.on('open-file', (e, p) => { e.preventDefault(); if (win) send('open-paths', [p]); else pendingOpen.push(p); });

ipcMain.handle('menu:rebuild', (_e, lang) => { setLocale(lang); buildMenu(); });
app.whenReady().then(() => {
  setLocale((getCfg().prefs || {}).localization || 'english');
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(f).toString());
  });
  buildMenu();
  createWindow();
  win.webContents.once('did-finish-load', () => {
    const args = process.argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('--') && fs.existsSync(a));
    if (pendingOpen.length || args.length) send('open-paths', [...pendingOpen, ...args.map((a) => path.resolve(a))]);
  });
  nativeTheme.on('updated', () => send('system-theme', nativeTheme.shouldUseDarkColors));
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

// ---- IPC: config/session -----------------------------------------------------
ipcMain.handle('cfg:get', () => getCfg());
ipcMain.handle('cfg:set', (_e, c) => { cfgCache = c; saveJSON(CFG_FILE(), c); });
ipcMain.handle('session:get', () => loadJSON(SESSION_FILE(), null));
ipcMain.handle('session:set', (_e, s) => { saveJSON(SESSION_FILE(), s); });
ipcMain.handle('file:readSessionFile', (_e, p) => loadJSON(p, null));
ipcMain.handle('app:systemDark', () => nativeTheme.shouldUseDarkColors);
ipcMain.handle('app:paths', () => ({ userData: app.getPath('userData'), home: app.getPath('home'), documents: app.getPath('documents'), root: ROOT, version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform + ' ' + process.arch }));

// ---- IPC: files --------------------------------------------------------------
ipcMain.handle('file:read', async (_e, p, forcedEnc) => {
  const st = await fsp.stat(p);
  const buf = await fsp.readFile(p);
  const { text, enc } = decodeBuffer(buf, forcedEnc);
  return { path: p, text, enc, mtime: st.mtimeMs, size: st.size, readOnly: !(st.mode & 0o200) };
});
ipcMain.handle('file:write', async (_e, p, text, enc, opts = {}) => {
  if (opts.backup && fs.existsSync(p)) {
    const dir = opts.backupDir || path.join(path.dirname(p), 'nppBackup');
    await fsp.mkdir(dir, { recursive: true });
    const base = path.basename(p);
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const dest = opts.backup === 'verbose' ? path.join(dir, `${base}.${stamp}.bak`) : path.join(dir, base + '.bak');
    await fsp.copyFile(p, dest);
  }
  await fsp.writeFile(p, encodeText(text, enc));
  const st = await fsp.stat(p);
  return { mtime: st.mtimeMs, size: st.size };
});
ipcMain.handle('file:exists', (_e, p) => fs.existsSync(p));
ipcMain.handle('file:stat', async (_e, p) => { try { const s = await fsp.stat(p); return { mtime: s.mtimeMs, size: s.size, isDir: s.isDirectory(), readOnly: !(s.mode & 0o200) }; } catch { return null; } });
ipcMain.handle('file:rename', async (_e, a, b) => { await fsp.rename(a, b); });
ipcMain.handle('file:trash', async (_e, p) => { await shell.trashItem(p); });
ipcMain.handle('file:setReadOnly', async (_e, p, ro) => { const st = await fsp.stat(p); await fsp.chmod(p, ro ? st.mode & ~0o222 : st.mode | 0o200); });
ipcMain.handle('file:reveal', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('file:openDefault', (_e, p) => shell.openPath(p));
ipcMain.handle('file:openExternalUrl', (_e, u) => shell.openExternal(u));
ipcMain.handle('file:openIn', (_e, appName, p) => new Promise((r) => spawn('open', ['-a', appName, p]).on('close', r)));
ipcMain.handle('file:terminalAt', (_e, dir) => new Promise((r) => spawn('open', ['-a', 'Terminal', dir]).on('close', r)));
ipcMain.handle('file:newInstance', (_e, p) => { spawn(process.execPath, [ROOT, ...(p ? [p] : [])], { detached: true, stdio: 'ignore', env: { ...process.env, NGN_NEW_INSTANCE: '1' } }).unref(); });
ipcMain.handle('file:listDir', async (_e, dir) => {
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  return ents.map((d) => ({ name: d.name, path: path.join(dir, d.name), dir: d.isDirectory() })).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true }));
});
ipcMain.handle('file:writeBackup', async (_e, name, text) => { await fsp.mkdir(BACKUP_DIR(), { recursive: true }); await fsp.writeFile(path.join(BACKUP_DIR(), name), text, 'utf8'); });
ipcMain.handle('file:readBackup', async (_e, name) => { try { return await fsp.readFile(path.join(BACKUP_DIR(), name), 'utf8'); } catch { return null; } });
ipcMain.handle('file:deleteBackup', async (_e, name) => { try { await fsp.unlink(path.join(BACKUP_DIR(), name)); } catch { /* already gone */ } });
ipcMain.handle('file:readData', async (_e, rel) => {
  const f = path.normalize(path.join(ROOT, 'data', rel));
  if (!f.startsWith(path.join(ROOT, 'data'))) throw new Error('bad path');
  return fsp.readFile(f, 'utf8');
});
ipcMain.handle('file:listData', async (_e, rel) => fsp.readdir(path.join(ROOT, 'data', rel)));
ipcMain.handle('file:hashBuffer', async (_e, p, algo) => {
  const h = crypto.createHash(algo); const s = fs.createReadStream(p);
  return new Promise((res, rej) => { s.on('data', (d) => h.update(d)); s.on('end', () => res(h.digest('hex'))); s.on('error', rej); });
});
ipcMain.handle('hash:text', (_e, text, algo) => crypto.createHash(algo).update(text, 'utf8').digest('hex'));

// tail -f style watcher (Monitoring) and external-change detection
const watchers = new Map();
ipcMain.handle('watch:add', (_e, id, p) => {
  if (watchers.has(id)) return;
  try { const w = fs.watch(p, { persistent: false }, () => send('file-changed', id)); watchers.set(id, w); } catch { /* unwatchable */ }
});
ipcMain.handle('watch:remove', (_e, id) => { watchers.get(id)?.close(); watchers.delete(id); });

// ---- IPC: dialogs ------------------------------------------------------------
ipcMain.handle('dlg:open', async (_e, opts) => (await dialog.showOpenDialog(win, opts)).filePaths);
ipcMain.handle('dlg:save', async (_e, opts) => (await dialog.showSaveDialog(win, opts)).filePath || null);
ipcMain.handle('dlg:message', async (_e, opts) => (await dialog.showMessageBox(win, opts)).response);

// ---- IPC: window -------------------------------------------------------------
ipcMain.handle('win:alwaysOnTop', (_e, v) => win.setAlwaysOnTop(v));
ipcMain.handle('win:fullScreen', (_e, v) => win.setFullScreen(v));
ipcMain.handle('win:isFullScreen', () => win.isFullScreen());
ipcMain.handle('win:title', (_e, t) => win.setTitle(t));
ipcMain.handle('win:edited', (_e, v) => win.setDocumentEdited(v));
ipcMain.handle('win:represented', (_e, p) => win.setRepresentedFilename(p || ''));
ipcMain.handle('win:close', () => { win._forceClose = true; win.close(); });
ipcMain.handle('win:quit', () => { win._forceClose = true; app.quit(); });
ipcMain.handle('win:setMenuVisible', (_e, v) => { Menu.getApplicationMenu().items.forEach((i) => { i.visible = v || i.role === 'appmenu' || i.label === app.name; }); });
ipcMain.handle('win:setMenuState', (_e, states) => {
  const m = Menu.getApplicationMenu();
  for (const [id, st] of Object.entries(states)) {
    const it = m.getMenuItemById(String(id));
    if (!it) continue;
    if ('checked' in st) it.checked = !!st.checked;
    if ('enabled' in st) it.enabled = !!st.enabled;
  }
});
ipcMain.handle('win:setRecent', (_e, files) => {
  const m = Menu.getApplicationMenu(); const it = m.getMenuItemById('recent-files'); if (!it) return;
  it.submenu.clear();
  if (!files.length) it.submenu.append(new (require('electron').MenuItem)({ label: '(empty)', enabled: false }));
  files.forEach((f, i) => it.submenu.append(new (require('electron').MenuItem)({ label: `${i + 1}: ${f.label}`, click: () => send('open-paths', [f.path]) })));
  if (files.length) {
    it.submenu.append(new (require('electron').MenuItem)({ type: 'separator' }));
    it.submenu.append(new (require('electron').MenuItem)({ label: 'Restore Recent Closed File', click: () => send('cmd', 'restore-closed') }));
    it.submenu.append(new (require('electron').MenuItem)({ label: 'Open All Recent Files', click: () => send('cmd', 'open-all-recent') }));
    it.submenu.append(new (require('electron').MenuItem)({ label: 'Clear Recent File List', click: () => send('cmd', 'clear-recent') }));
  }
  Menu.setApplicationMenu(m);
});
ipcMain.handle('win:setDynamicMenu', (_e, which, entries) => {
  // Entries for Macro / Run / Plugins menus that the user can add at runtime.
  const m = Menu.getApplicationMenu(); const top = m.items.find((i) => i.id === 'top-' + which); if (!top) return;
  const { MenuItem } = require('electron');
  for (const it of [...top.submenu.items]) if (it.id && it.id.startsWith('dyn-')) it.visible = false;
  entries.forEach((e) => {
    const old = top.submenu.items.find((i) => i.id === 'dyn-' + e.key);
    if (old) { old.visible = true; old.label = e.label; return; }
    top.submenu.append(new MenuItem({ id: 'dyn-' + e.key, label: e.label, click: () => send('cmd', 'dyn:' + e.key) }));
  });
  Menu.setApplicationMenu(m);
});
ipcMain.handle('win:print', async (_e, html, opts) => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return new Promise((res) => w.webContents.print({ silent: !!opts?.silent, printBackground: true }, (ok) => { w.destroy(); res(ok); }));
});
ipcMain.handle('win:printPDF', async (_e, html, dest) => {
  const w = new BrowserWindow({ show: false });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pdf = await w.webContents.printToPDF({ printBackground: true }); w.destroy();
  await fsp.writeFile(dest, pdf);
});
// Electron 44's clipboard only exposes text, so rich formats go through the macOS pasteboard via AppleScript.
const osa = (script) => new Promise((resolve) => { const c = spawn('osascript', ['-e', script]); let out = ''; c.stdout.on('data', (d) => (out += d)); c.on('close', () => resolve(out.trim())); c.on('error', () => resolve('')); });
const hexOf = (s) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
const fromOsaData = (out) => { const m = out.match(/«data (?:RTF |HTML|utf8|[A-Za-z]{4})([0-9A-Fa-f]+)»/); return m ? Buffer.from(m[1], 'hex').toString('utf8') : ''; };
ipcMain.handle('clip:writeHTMLRTF', async (_e, html, rtf, text) => {
  const parts = [`«class utf8»:«data utf8${hexOf(text || '')}»`];
  if (rtf) parts.push(`«class RTF »:«data RTF ${hexOf(rtf)}»`);
  if (html) parts.push(`«class HTML»:«data HTML${hexOf(html)}»`);
  await osa(`set the clipboard to {${parts.join(', ')}}`);
});
ipcMain.handle('clip:readHTML', async () => fromOsaData(await osa('try\nreturn (the clipboard as «class HTML»)\non error\nreturn ""\nend try')));
ipcMain.handle('clip:readRTF', async () => fromOsaData(await osa('try\nreturn (the clipboard as «class RTF »)\non error\nreturn ""\nend try')));
ipcMain.handle('clip:readBase64', async () => Buffer.from(await clipboard.readText(), 'utf8').toString('base64'));
ipcMain.handle('clip:writeBuffer', async (_e, b64) => clipboard.writeText(Buffer.from(b64, 'base64').toString('utf8')));
ipcMain.handle('clip:writeText', (_e, t) => clipboard.writeText(t));
ipcMain.handle('clip:readText', () => clipboard.readText());

// ---- IPC: run command ---------------------------------------------------------
ipcMain.handle('run:cmd', (_e, cmd, cwd) => new Promise((resolve) => {
  const c = spawn(process.env.SHELL || '/bin/zsh', ['-lc', cmd], { cwd: cwd || undefined, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
  c.on('close', (code) => resolve({ code, out: out.slice(0, 20000) }));
  c.on('error', (err) => resolve({ code: -1, out: String(err) }));
  setTimeout(() => { c.unref(); resolve({ code: null, out: out.slice(0, 20000) + '\n(still running in background)' }); }, 4000);
}));

// ---- IPC: find in files ---------------------------------------------------------
function globToRe(g) { return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
async function* walk(dir, recursive, hidden, exclude) {
  let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (!hidden && e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (recursive && !exclude.dir.some((r) => r.test(e.name))) yield* walk(p, recursive, hidden, exclude); } else yield p;
  }
}
ipcMain.handle('find:inFiles', async (_e, o) => {
  // o: {dir, filters, recursive, hidden, regex(RegExp source), flags, replaceWith?, apply?}
  const inc = [], exd = [], exf = [];
  for (let f of (o.filters || '*.*').split(/[;\s]+/).filter(Boolean)) {
    if (f.startsWith('!')) { f = f.slice(1); if (f.startsWith('\\')) exd.push(globToRe(f.slice(1))); else exf.push(globToRe(f)); } else inc.push(globToRe(f === '*.*' ? '*' : f));
  }
  const re = new RegExp(o.regex, o.flags);
  const results = []; let files = 0, hits = 0, scanned = 0; const t0 = Date.now();
  for await (const f of walk(o.dir, o.recursive, o.hidden, { dir: exd })) {
    const b = path.basename(f);
    if (!inc.some((r) => r.test(b)) || exf.some((r) => r.test(b))) continue;
    scanned++;
    let buf; try { const st = await fsp.stat(f); if (st.size > 50 * 1024 * 1024) continue; buf = await fsp.readFile(f); } catch { continue; }
    if (buf.includes(0)) continue; // binary
    const { text, enc } = decodeBuffer(buf);
    const lines = text.split(/\r\n|\n|\r/);
    const found = [];
    if (o.multiline) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } const ln = text.slice(0, m.index).split(/\r\n|\n|\r/).length; found.push({ line: ln, col: 0, text: lines[ln - 1] ?? '', len: m[0].length }); }
    } else {
      lines.forEach((ln, i) => { re.lastIndex = 0; let m; while ((m = re.exec(ln))) { if (!m[0]) { re.lastIndex++; continue; } found.push({ line: i + 1, col: m.index, text: ln, len: m[0].length }); if (!re.global) break; } });
    }
    if (found.length) {
      files++; hits += found.length; results.push({ file: f, hits: found });
      if (o.apply) { const out = text.replace(new RegExp(o.regex, o.flags.includes('g') ? o.flags : o.flags + 'g'), o.replaceWith); await fsp.writeFile(f, encodeText(out, enc)); }
    }
    if (results.length > 5000) break;
  }
  return { results, files, hits, scanned, ms: Date.now() - t0 };
});

// ---- headless screenshot helper used for the demo ----------------------------------
ipcMain.handle('demo:capture', async (_e, file) => {
  const img = await win.webContents.capturePage();
  await fsp.writeFile(file, img.toPNG());
  return file;
});
ipcMain.handle('demo:env', () => ({ demo: process.env.NGN_DEMO || '', shots: process.env.NGN_SHOTS || '', selftest: !!process.env.NGN_SELFTEST, phase: process.env.NGN_PHASE || '' }));

// demo: inject real keyboard input so macro recording / typing paths are exercised
ipcMain.handle('demo:keys', async (_e, seq) => {
  const wc = win.webContents;
  for (const k of seq) {
    if (k.text) { for (const ch of k.text) { wc.sendInputEvent({ type: 'char', keyCode: ch }); await new Promise((r) => setTimeout(r, 25)); } }
    else { const m = k.mods || []; wc.sendInputEvent({ type: 'keyDown', keyCode: k.key, modifiers: m }); wc.sendInputEvent({ type: 'keyUp', keyCode: k.key, modifiers: m }); await new Promise((r) => setTimeout(r, 40)); }
  }
});
