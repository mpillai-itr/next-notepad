// Preferences, Style Configurator, Shortcut Mapper, User Defined Language, theme import, applyPrefs.
import { monaco, renderTabs, setLanguage, updateStatus } from './core.js';
import { S, NGN, curEd, curDoc, DEFAULT_PREFS } from './state.js';
import { LANGS, LANG_BY_MENU_ID, langForPath } from './languages.js';
import { listThemes, applyTheme, THEME_FILES, parseTheme } from './themes.js';

const { el, $ } = NGN;
const ngn = window.ngn;

// ---- apply preferences to the live UI ------------------------------------------------------------------------------
export async function applyPrefs({ theme = false } = {}) {
  const p = S.prefs;
  const dark = p.darkMode === 'dark' || (p.darkMode === 'system' && (await ngn.app.systemDark()));
  document.body.classList.toggle('theme-dark', dark); document.body.classList.toggle('theme-light', !dark);
  $('#toolbar').classList.toggle('hidden', p.toolbar === 'hide'); $('#statusbar').classList.toggle('hidden', !!p.statusHide);
  ngn.win.setMenuVisible(!p.menuHide);
  if (theme || !S.theme) { S.theme = await applyTheme(p.theme); }
  NGN.applyEditorOptions(); S.views.forEach((v) => renderTabs(v));
  document.body.classList.toggle('wrap-sym', !!p.wrapSymbol);
  S.views.forEach((v) => v.hostEl.querySelector('.monaco-editor')?.style.setProperty('--link-underline', p.linkNoUnderline ? 'none' : 'underline'));
  NGN.buildToolbar(); NGN.syncMenuState();
  setTimeout(() => S.views.forEach((v) => v.ed?.layout()), 30);
}
NGN.applyPrefs = applyPrefs;

const REBUILD_MENU = new Set(['langMenuCompact', 'multiInstance']);
const set = async (k, v, opts) => { S.prefs[k] = v; if (REBUILD_MENU.has(k)) { await NGN.saveCfgNow(); await ngn.menu.rebuild(S.prefs.localization); NGN.refreshRecentMenu(); NGN.refreshDynamicMenus(); } NGN.saveCfgSoon(); applyPrefs(opts); };

// ---- field builders -------------------------------------------------------------------------------------------------------
const F = {
  check: (k, label, hint) => () => { const i = el('input', { type: 'checkbox' }); i.checked = !!S.prefs[k]; i.addEventListener('change', () => set(k, i.checked)); return el('label', { title: hint || '' }, i, label); },
  num: (k, label, min = 0, max = 9999, step = 1) => () => { const i = el('input', { type: 'number', min, max, step, style: 'width:84px' }); i.value = S.prefs[k]; i.addEventListener('change', () => set(k, Math.max(min, Math.min(max, +i.value || 0)))); return el('div', { class: 'row' }, el('label', { class: 'f', style: 'width:230px', text: label }), i); },
  text: (k, label, w) => () => { const i = el('input', { type: 'text', style: w ? `width:${w}px;flex:none` : '' }); i.value = S.prefs[k] ?? ''; i.addEventListener('change', () => set(k, i.value)); return el('div', { class: 'row' }, el('label', { class: 'f', style: 'width:230px', text: label }), i); },
  select: (k, label, opts) => () => { const s = el('select', {}, opts.map(([v, t]) => el('option', { value: v, text: t }))); s.value = S.prefs[k]; s.addEventListener('change', () => set(k, s.value, { theme: k === 'darkMode' || k === 'theme' })); return el('div', { class: 'row' }, el('label', { class: 'f', style: 'width:230px', text: label }), s); },
  note: (t) => () => el('p', { style: 'color:var(--ui-dim);margin:4px 0', text: t }),
  group: (title, ...fields) => () => el('fieldset', {}, el('legend', { text: title }), fields.map((f) => f())),
};
const nested = (obj, k, label) => () => { const i = el('input', { type: 'checkbox' }); i.checked = !!S.prefs[obj][k]; i.addEventListener('change', () => { S.prefs[obj] = { ...S.prefs[obj], [k]: i.checked }; NGN.saveCfgSoon(); applyPrefs(); }); return el('label', {}, i, label); };
const nestedText = (obj, k, label) => () => { const i = el('input', { type: 'text' }); i.value = S.prefs[obj][k] ?? ''; i.addEventListener('change', () => { S.prefs[obj] = { ...S.prefs[obj], [k]: i.value }; NGN.saveCfgSoon(); }); return el('div', { class: 'row' }, el('label', { class: 'f', style: 'width:110px', text: label }), i); };

let localizations = [];
async function pages() {
  if (!localizations.length) localizations = (await ngn.file.listData('localization')).filter((f) => f.endsWith('.xml')).map((f) => f.replace(/\.xml$/, '')).sort();
  const themes = await listThemes();
  return {
    General: [
      F.group('Toolbar', F.select('toolbar', 'Toolbar', [['small', 'Show (small icons)'], ['hide', 'Hide']])),
      F.group('Tab Bar', F.check('tabHide', 'Hide'), F.check('tabMultiline', 'Multi-line'), F.check('tabVertical', 'Vertical'), F.check('tabLock', 'Lock (no drag and drop)'), F.check('tabDblClickClose', 'Double click to close document'), F.check('exitOnLastTab', 'Exit on close the last tab'), F.num('tabMaxLabel', 'Max. tab label length', 8, 120)),
      F.group('Tab look & feel', F.check('tabReduce', 'Reduce'), F.check('tabAltIcons', 'Alternate icons'), F.check('tabInactiveColor', 'Change inactive tab color'), F.check('tabActiveBar', 'Draw a coloured bar on active tab'), F.check('tabCloseButton', 'Show close button'), F.check('tabPin', 'Enable pin tab feature')),
      F.group('Menu / Status bar', F.check('menuHide', 'Hide menu (macOS menu bar stays; applies to in-window menu on other platforms)'), F.check('statusHide', 'Hide status bar')),
      F.group('Localization', F.select('localization', 'Language', localizations.map((l) => [l, l])), F.note('Menu text is translated from the shipped nativeLang files; the app menu is rebuilt immediately.')),
    ],
    Editing: [
      F.group('Current Line Indicator', F.select('curLine', 'Indicator', [['none', 'None'], ['bg', 'Highlight Background'], ['frame', 'Frame']])),
      F.group('Caret Settings', F.num('caretWidth', 'Width', 1, 3), F.num('caretBlink', 'Blink rate (ms, 0 = no blink)', 0, 2500, 50)),
      F.group('Line Wrap', F.select('wrapIndent', 'Wrapped line indent', [['default', 'Default'], ['aligned', 'Aligned'], ['indent', 'Indent']]), F.check('wordWrap', 'Word wrap')),
      F.group('Other', F.check('smoothFont', 'Enable smooth font'), F.check('virtualSpace', 'Enable virtual space'), F.check('foldToggle', 'Make current level folding/unfolding commands toggleable'), F.check('keepSelOnRightClick', 'Keep selection when right-click outside of selection'), F.check('copyLineNoSel', 'Enable Copy/Cut Line without selection'), F.check('scrollBeyondLast', 'Scroll beyond last line'), F.num('fontSize', 'Font size', 6, 40), F.text('fontName', 'Font name (blank = Menlo)', 200)),
      F.group('Multi-Editing', F.check('multiEdit', 'Enable Multi-Editing (Cmd+click / selection)'), F.check('columnToMulti', 'Enable Column Selection to Multi-Editing')),
      F.group('Non-printing characters', F.check('ctrlChars', 'Show control characters'), F.check('eolVisible', 'Show end of line markers'), F.check('whitespace', 'Show space and tab')),
    ],
    'Dark Mode': [F.group('Mode', F.select('darkMode', 'Appearance', [['light', 'Light mode'], ['dark', 'Dark mode'], ['system', 'Follow macOS']])), F.group('Style theme', F.select('theme', 'Select theme', themes.map((t) => [t, t])), F.note('Dark mode switches the UI chrome; pick a dark theme (e.g. DarkModeDefault, Monokai, Zenburn) for the editor area.'))],
    'Margins/Border/Edge': [
      F.group('Line Number', F.check('lineNumbers', 'Display'), F.check('lineNumDynamic', 'Dynamic width')),
      F.group('Bookmark', F.check('bookmarkMargin', 'Show bookmark margin')), F.group('Change History', F.select('changeHistory', 'Show', [['margin', 'In the margin'], ['none', 'Off']])),
      F.group('Vertical Edge', F.select('edge', 'Mode', [['none', 'None'], ['line', 'Line mode']]), F.num('edgeColumn', 'Number of columns', 1, 400)),
      F.group('Indent', F.check('indentGuide', 'Show indent guide')),
    ],
    'New Document': [F.group('Format (Line ending)', F.select('newEOL', 'Default', [['CRLF', 'Windows (CR LF)'], ['LF', 'Unix (LF)'], ['CR', 'Macintosh (CR)']])), F.group('Encoding', F.select('newEncoding', 'Default', [['utf8', 'UTF-8'], ['utf8-bom', 'UTF-8 with BOM'], ['utf16be-bom', 'UTF-16 Big Endian with BOM'], ['utf16le-bom', 'UTF-16 Little Endian with BOM'], ['ansi', 'ANSI']])), F.select('newLang', 'Default language', Object.keys(LANGS).map((n) => [n, NGN.langDisplay(n)])), F.check('newAtStartup', 'Always open a new document in addition at startup'), F.check('firstLineAsName', 'Use the first line of document as untitled tab name')],
    'Default Directory': [F.select('dirMode', 'Open/Save dialog starts in', [['follow', 'Follow current document'], ['remember', 'Remember last used directory'], ['custom', 'Custom directory']]), F.text('dirCustom', 'Custom directory', 280), F.check('openFolderOnDrop', 'Open all files of folder instead of launching Folder as Workspace on folder dropping')],
    'Recent Files History': [F.num('recentMax', 'Max. number of entries', 0, 30), F.select('recentDisplay', 'Display', [['full', 'Full File Name Path'], ['name', 'Only File Name']]), F.num('recentLen', 'Customize maximum length', 20, 200), F.check('recentSubmenu', 'In Submenu')],
    'File Association': [F.note('On macOS, file associations are managed by Finder: select a file ▸ Get Info ▸ Open with ▸ NextGenNote ▸ Change All…  The packaged app declares itself an editor for all text-like types.')],
    Language: [F.group('Language Menu', F.check('langMenuCompact', 'Make language menu compact')), F.group('Per-language tabs', F.note('Default tab size and indent type are set under Indentation. Languages with their own setting in langs.model.xml (Python, YAML) use 4 spaces.'))],
    Indentation: [F.num('tabSize', 'Indent size', 1, 16), F.select('useTabs', 'Indent using', [[true, 'Tab character'], [false, 'Space character(s)']]), F.check('backspaceUnindent', 'Backspace key unindents instead of removing single space'), F.select('autoIndent', 'Auto-indent', [['none', 'None'], ['basic', 'Basic'], ['advanced', 'Advanced']])],
    Highlighting: [F.group('Style All Occurrences of Token', F.check('styleTokenCase', 'Match case'), F.check('styleTokenWord', 'Match whole word only')), F.group('Matching Tags', F.check('tagHl', 'Highlight Matching Tags'), F.check('tagHlAttr', 'Highlight tag attributes')), F.group('Smart Highlighting', F.check('smartHl', 'Enable'), F.check('smartHlCase', 'Match case'), F.check('smartHlWord', 'Match whole word only'), F.check('smartHlOther', 'Highlight another view'), F.check('smartHlUseFind', 'Use Find dialog settings'))],
    Print: [F.check('printLineNumbers', 'Print line number'), F.select('printColor', 'Color Options', [['wysiwyg', 'WYSIWYG'], ['invert', 'Invert'], ['bw', 'Black on white'], ['nobg', 'No background color']]),
      F.group('Margin Setting (mm)', ...['top', 'left', 'right', 'bottom'].map((k) => () => { const i = el('input', { type: 'number', style: 'width:70px' }); i.value = S.prefs.printMargins[k]; i.addEventListener('change', () => { S.prefs.printMargins = { ...S.prefs.printMargins, [k]: +i.value }; NGN.saveCfgSoon(); }); return el('div', { class: 'row' }, el('label', { class: 'f', text: k }), i); })),
      F.group('Header', nestedText('printHeader', 'left', 'Left part'), nestedText('printHeader', 'mid', 'Middle part'), nestedText('printHeader', 'right', 'Right part')), F.group('Footer', nestedText('printFooter', 'left', 'Left part'), nestedText('printFooter', 'mid', 'Middle part'), nestedText('printFooter', 'right', 'Right part')),
      F.note('Variables: $(FULL_CURRENT_PATH) $(SHORT_DATE) $(LONG_DATE) $(TIME). Per-page numbering is not available in the system print dialog.')],
    Searching: [F.group('When Find Dialog is Invoked', F.check('searchFillSelected', 'Fill Find Field with Selected Text'), F.num('searchMaxFill', 'Max Characters to Auto-Fill Find Field from Selection', 1, 5000), F.check('searchWordUnderCaret', 'Select Word Under Caret when Nothing Selected'), F.check('searchFillDir', 'Fill Find in Files Directory Field Based On Active Document'), F.check('searchStayOpen', 'Find dialog remains open after operation'), F.check('searchMono', 'Use Monospaced font in Find dialog'))],
    'Backup': [F.group('Session snapshot and periodic backup', F.check('rememberSession', 'Remember current session for next launch'), F.check('snapshot', 'Enable session snapshot and periodic backup'), F.num('snapshotInterval', 'Trigger backup on modification in every (seconds)', 1, 600), F.check('rememberInaccessible', 'Remember inaccessible files from past session')), F.group('Backup on save', F.select('backupOnSave', 'Mode', [['none', 'None'], ['simple', 'Simple backup'], ['verbose', 'Verbose backup']]), F.text('backupDir', 'Custom Backup Directory (blank = nppBackup next to file)', 280))],
    'Auto-Completion': [F.group('Auto-Completion', F.check('acEnable', 'Enable auto-completion on each input'), F.select('acMode', 'Mode', [['function', 'Function completion'], ['word', 'Word completion'], ['both', 'Function and word completion']]), F.num('acFromNth', 'From nth character', 1, 9), F.check('acBrief', 'Make auto-completion list brief'), F.check('acIgnoreNumbers', 'Ignore numbers'), F.select('acInsert', 'Insert selection with', [['tab', 'TAB'], ['enter', 'ENTER']])), F.group('Function parameters hint', F.check('acParamHint', 'Function parameters hint on input')),
      F.group('Auto-Insert', F.check('acCloseHtml', 'html/xml close tag'), nested('acPairs', 'paren', '( )'), nested('acPairs', 'bracket', '[ ]'), nested('acPairs', 'brace', '{ }'), nested('acPairs', 'dquote', '" "'), nested('acPairs', 'squote', "' '"))],
    'Multi-Instance & Date': [F.select('multiInstance', 'Multi-instance settings', [['mono', 'Default (mono-instance)'], ['multi', 'Always in multi-instance mode']]), F.group('Customize insert Date Time', F.check('dateFormatReverse', 'Reverse default date time order (short & long formats)'), F.text('dateCustom', 'Custom format', 240), F.note('Tokens: yyyy MM dd HH mm ss tt MMM MMMM dddd'))],
    Delimiter: [F.group('Word character list', F.text('wordChars', 'Add your characters as part of word', 200)), F.group('Delimiter selection (Ctrl + Mouse double click)', F.text('delimOpen', 'Open', 80), F.text('delimClose', 'Close', 80), F.check('delimMulti', 'Allow on several lines'))],
    Performance: [F.group('Large File Restriction', F.check('largeFile', 'Enable Large File Restriction (no syntax highlighting)'), F.num('largeFileMB', 'Define Large File Size (MB)', 1, 2048), F.check('largeNoWrap', 'Deactivate Word Wrap globally'), F.check('largeAC', 'Allow Auto-Completion'), F.check('largeSmart', 'Allow Smart Highlighting'), F.check('largeBrace', 'Allow Brace Match'), F.check('largeUrl', 'Allow URL Clickable Link'))],
    'Cloud & Link': [F.group('Settings on cloud', F.text('cloudPath', 'Cloud location path', 280), F.note('Set to a synced folder (iCloud Drive/Dropbox); config.json is read from there on next launch.')), F.group('Clickable Link Settings', F.check('clickableLinks', 'Enable (Cmd+click)'), F.check('linkNoUnderline', 'No underline'), F.text('linkSchemes', 'URI customized schemes', 320))],
    'Search Engine': [F.group('Search Engine (for command "Search on Internet")', () => { const s = el('select', {}, [['https://duckduckgo.com/?q=$(CURRENT_WORD)', 'DuckDuckGo'], ['https://www.google.com/search?q=$(CURRENT_WORD)', 'Google'], ['https://search.yahoo.com/search?p=$(CURRENT_WORD)', 'Yahoo!'], ['https://stackoverflow.com/search?q=$(CURRENT_WORD)', 'Stack Overflow'], ['', 'Custom']].map(([v, t]) => el('option', { value: v, text: t }))); const known = [...s.options].some((o) => o.value === S.prefs.searchEngine); s.value = known ? S.prefs.searchEngine : ''; const c = el('input', { type: 'text', style: 'width:100%' }); c.value = S.prefs.searchEngine; s.addEventListener('change', () => { if (s.value) { c.value = s.value; set('searchEngine', s.value); } }); c.addEventListener('change', () => set('searchEngine', c.value)); return el('div', {}, s, c, el('div', { style: 'color:var(--ui-dim)', text: 'Example: https://www.google.com/search?q=$(CURRENT_WORD)' })); })],
    'MISC.': [F.group('File Status Auto-Detection', F.check('autoDetectStatus', 'Enable'), F.check('updateSilent', 'Update silently'), F.check('scrollToLast', 'Scroll to the last line after update')), F.group('Document Switcher (Ctrl+TAB)', F.check('docSwitcher', 'Enable'), F.check('docSwitcherMRU', 'Enable MRU behaviour')), F.check('autoDetectEncoding', 'Autodetect character encoding'), F.check('titleOnlyFilename', 'Show only filename in title bar'), F.check('saveAllConfirm', 'Enable Save All confirm dialog'), F.check('muteSounds', 'Mute all sounds')],
    Updater: [F.note('The original uses WinGUp. NextGenNote is updated by replacing the app; "Update" opens the download page. No proxy is used for these operations.'), F.text('proxy', 'Proxy host:port (optional)', 240)],
  };
}

NGN.openPrefs = async (cat) => {
  const P = await pages(); const names = Object.keys(P); let cur = names.includes(cat) ? cat : (S.prefsPage && names.includes(S.prefsPage) ? S.prefsPage : names[0]);
  const nav = el('div', { class: 'pref-nav' }), pane = el('div', { class: 'pref-pane' });
  const draw = () => { nav.innerHTML = ''; names.forEach((n) => nav.append(el('div', { class: n === cur ? 'on' : '', text: n, onclick: () => { cur = n; S.prefsPage = n; draw(); } }))); pane.innerHTML = ''; P[cur].forEach((f) => pane.append(f())); };
  const old = NGN.dialogOpen('prefs'); if (old) NGN.closeDialog('prefs');
  NGN.dialog({ key: 'prefs', title: 'Preferences', width: 760, body: el('div', { class: 'pref-wrap' }, nav, pane), buttons: [{ label: 'Close', primary: true }] }); draw();
  // localization applies on change
  pane.addEventListener('change', async (e) => { if (cur === 'General' && e.target.tagName === 'SELECT') { await ngn.cfg.set({ prefs: S.prefs, recent: S.recent, macros: S.macros, runList: S.runList, find: S.find, userProjects: NGN.projects }); ngn.menu.rebuild(S.prefs.localization); setTimeout(() => { NGN.refreshRecentMenu(); NGN.syncMenuState(); NGN.refreshDynamicMenus(); }, 100); } });
};

// ---- Style Configurator --------------------------------------------------------------------------------------------------------------
const STYLE_TO_TOKEN = { 'INSTRUCTION WORD': ['keyword'], 'TYPE WORD': ['type', 'type.identifier', 'keyword.other'], NUMBER: ['number'], STRING: ['string'], 'COMMENT LINE': ['comment'], COMMENT: ['comment'], OPERATOR: ['operator', 'delimiter'], PREPROCESSOR: ['metatag'], DEFAULT: [''] };
NGN.openStyleConfigurator = async () => {
  const names = await listThemes(); let themeName = S.prefs.theme; let t = await parseTheme(themeName);
  const themeSel = el('select', {}, names.map((n) => el('option', { value: n, text: n }))); themeSel.value = themeName;
  const styles = ['DEFAULT', 'COMMENT', 'COMMENT LINE', 'NUMBER', 'STRING', 'INSTRUCTION WORD', 'TYPE WORD', 'OPERATOR', 'PREPROCESSOR'];
  const list = el('div', { class: 'list' }); let sel = 'INSTRUCTION WORD';
  const fg = el('input', { type: 'color' }), bg = el('input', { type: 'color' }), bold = el('input', { type: 'checkbox' }), ital = el('input', { type: 'checkbox' }), und = el('input', { type: 'checkbox' }), fsize = el('input', { type: 'number', style: 'width:60px' }), fname = el('input', { type: 'text' });
  const ov = () => (S.prefs.styleOverrides[themeName] ||= {});
  const load = () => { const o = ov()[sel] || {}; const rule = t.monaco.rules.find((r) => r.token === (STYLE_TO_TOKEN[sel][0] ?? '')); fg.value = o.fg || '#' + (rule?.foreground || t.fg); bg.value = o.bg || '#' + t.bg; bold.checked = o.bold ?? /bold/.test(rule?.fontStyle || ''); ital.checked = o.ital ?? /italic/.test(rule?.fontStyle || ''); und.checked = !!o.und; fsize.value = S.prefs.fontSize; fname.value = S.prefs.fontName; };
  const draw = () => { list.innerHTML = ''; styles.forEach((s) => list.append(el('div', { class: s === sel ? 'sel' : '', text: s, onclick: () => { sel = s; draw(); load(); } }))); };
  const applyOv = async () => { const o = ov()[sel] = { fg: fg.value, bg: bg.value, bold: bold.checked, ital: ital.checked, und: und.checked }; const th = JSON.parse(JSON.stringify(t.monaco)); Object.entries(ov()).forEach(([k, v]) => { (STYLE_TO_TOKEN[k] || []).forEach((tok) => { const r = th.rules.find((x) => x.token === tok); const fs = [v.bold && 'bold', v.ital && 'italic', v.und && 'underline'].filter(Boolean).join(' '); if (r) { r.foreground = v.fg.slice(1); r.fontStyle = fs; } if (k === 'DEFAULT') { th.colors['editor.foreground'] = v.fg; th.colors['editor.background'] = v.bg; } }); }); monaco.editor.defineTheme('ngn-custom', th); monaco.editor.setTheme('ngn-custom'); NGN.saveCfgSoon(); };
  [fg, bg, bold, ital, und].forEach((x) => x.addEventListener('change', applyOv));
  fsize.addEventListener('change', () => set('fontSize', +fsize.value)); fname.addEventListener('change', () => set('fontName', fname.value));
  themeSel.addEventListener('change', async () => { themeName = themeSel.value; t = await parseTheme(themeName); set('theme', themeName, { theme: true }); load(); });
  draw(); load();
  NGN.dialog({ key: 'styleconf', title: 'Style Configurator', width: 560, body: el('div', {},
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'Select theme:' }), themeSel),
    el('div', { class: 'cols' }, el('div', {}, el('div', { text: 'Style:' }), list), el('div', {}, el('fieldset', {}, el('legend', { text: 'Colour Style' }), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Foreground colour' }), fg), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Background colour' }), bg)),
      el('fieldset', {}, el('legend', { text: 'Font Style' }), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Font name:' }), fname), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Font size:' }), fsize), el('label', {}, bold, 'Bold'), el('label', {}, ital, 'Italic'), el('label', {}, und, 'Underline')))),
    el('p', { style: 'color:var(--ui-dim)', text: 'Tip: pick any of the 22 bundled themes (Monokai, Zenburn, Solarized, Obsidian, …).' })),
    buttons: [{ label: 'Save & Close', primary: true }, { label: 'Reset overrides', stay: true, fn: () => { delete S.prefs.styleOverrides[themeName]; set('theme', themeName, { theme: true }); load(); } }] });
};
NGN.importThemes = async (files) => { NGN.toast('Theme import: copy .xml files into ' + S.paths.root + '/data/themes and restart (bundled themes are read-only in packaged builds).', 5000); };

// ---- Shortcut Mapper ---------------------------------------------------------------------------------------------------------------------
NGN.openShortcutMapper = async () => {
  const tree = await (await fetch('app://host/menu.json')).json(); const rows = [];
  const walk = (list, path) => list.forEach((n) => { if (n.children) walk(n.children, path + n.label + ' ▸ '); else if (n.id) rows.push({ id: n.id, name: n.label, path: path.replace(/ ▸ $/, '') }); });
  tree.forEach((t) => t.children && t.label !== 'Language' && walk(t.children, t.label + ' ▸ '));
  S.macros.forEach((m, i) => rows.push({ id: 'dyn:macro' + i, name: m.name, path: 'Macros' })); S.runList.forEach((r, i) => rows.push({ id: 'dyn:run' + i, name: r.name, path: 'Run commands' }));
  const defaults = NGN.defaultAccels || {}; const q = el('input', { type: 'text', placeholder: 'Filter…', style: 'flex:1' }); const tbl = el('table'); let sel = null; const tabSel = el('select', {}, ['Main menu', 'Macros', 'Run commands'].map((x) => el('option', { value: x, text: x })));
  const accel = (r) => (r.id in S.prefs.shortcuts ? S.prefs.shortcuts[r.id] : defaults[r.id]) || '';
  const draw = () => { tbl.innerHTML = ''; tbl.append(el('tr', {}, ['Name', 'Shortcut', 'Category'].map((h) => el('th', { text: h })))); rows.filter((r) => (tabSel.value === 'Main menu' ? typeof r.id === 'number' : tabSel.value === 'Macros' ? r.path === 'Macros' : r.path === 'Run commands') && (!q.value || (r.name + r.path).toLowerCase().includes(q.value.toLowerCase()))).forEach((r) => tbl.append(el('tr', { style: sel === r ? 'background:var(--ui-accent);color:#fff' : '', onclick: () => { sel = r; draw(); }, ondblclick: () => modify(r) }, el('td', { text: r.name }), el('td', { text: accel(r) }), el('td', { text: r.path })))); };
  const modify = (r) => {
    let combo = accel(r); const box = el('input', { type: 'text', readonly: true, value: combo, 'data-focus': true, style: 'font-size:14px;text-align:center' }); const msg = el('div', { class: 'status' });
    box.addEventListener('keydown', (e) => { e.preventDefault(); if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return; const parts = []; if (e.metaKey) parts.push('Cmd'); if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); let k = e.key.length === 1 ? e.key.toUpperCase() : ({ ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space', Escape: 'Esc' }[e.key] || e.key); parts.push(k); combo = parts.join('+'); box.value = combo; const c = rows.find((x) => x !== r && accel(x) === combo); msg.textContent = c ? `CONFLICT FOUND! Used by: ${c.name}` : ''; msg.classList.toggle('err', !!c); });
    NGN.dialog({ key: 'shortcut-edit', title: 'Shortcut — ' + r.name, width: 360, modal: true, body: el('div', {}, el('div', { text: 'Press the new key combination:' }), box, msg),
      buttons: [{ label: 'Apply', primary: true, fn: async () => { S.prefs.shortcuts = { ...S.prefs.shortcuts, [r.id]: combo }; await NGN.saveCfgNow(); if (typeof r.id === 'number') ngn.menu.rebuild(S.prefs.localization); draw(); } }, { label: 'Remove shortcut', fn: async () => { S.prefs.shortcuts = { ...S.prefs.shortcuts, [r.id]: '' }; await NGN.saveCfgNow(); if (typeof r.id === 'number') ngn.menu.rebuild(S.prefs.localization); draw(); } }, { label: 'Cancel' }] });
  };
  q.addEventListener('input', draw); tabSel.addEventListener('change', draw); draw();
  NGN.dialog({ key: 'shortcutmap', title: 'Shortcut Mapper', width: 700, body: el('div', {}, el('div', { class: 'row' }, tabSel, el('label', { text: 'Filter:' }), q), el('div', { style: 'max-height:50vh;overflow:auto;border:1px solid var(--ui-edge)' }, tbl)),
    buttons: [{ label: 'Modify', stay: true, fn: () => sel && modify(sel) }, { label: 'Clear', stay: true, fn: async () => { if (sel) { S.prefs.shortcuts = { ...S.prefs.shortcuts, [sel.id]: '' }; await NGN.saveCfgNow(); if (typeof sel.id === 'number') ngn.menu.rebuild(S.prefs.localization); draw(); } } }, { label: 'Delete (reset)', stay: true, fn: async () => { if (sel) { const s = { ...S.prefs.shortcuts }; delete s[sel.id]; S.prefs.shortcuts = s; await NGN.saveCfgNow(); if (typeof sel.id === 'number') ngn.menu.rebuild(S.prefs.localization); draw(); } } }, { label: 'Close', primary: true }] });
};
NGN.saveCfgNow = () => ngn.cfg.set({ prefs: S.prefs, recent: S.recent, macros: S.macros, runList: S.runList, find: S.find, userProjects: NGN.projects });
// macro / run shortcuts are matched in the page (they are dynamic menu items)
export function matchDynamicShortcut(e) {
  const parts = []; if (e.metaKey) parts.push('Cmd'); if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key); const combo = parts.join('+');
  const hit = Object.entries(S.prefs.shortcuts).find(([id, a]) => id.startsWith('dyn:') && a === combo); return hit ? hit[0] : null;
}

// ---- User Defined Language ------------------------------------------------------------------------------------------------------------------
function registerUDL(u) {
  const id = 'udl-' + u.name.replace(/\W+/g, '_'); const key = 'udl:' + u.name; const kw = [1, 2, 3, 4].map((i) => (u['kw' + i] || '').split(/\s+/).filter(Boolean));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); monaco.languages.register({ id });
  const root = []; if (u.cOpen && u.cClose) root.push([new RegExp('^' + esc(u.cOpen)), 'comment', '@bc']); if (u.cLine) root.push([new RegExp('^' + esc(u.cLine) + '.*'), 'comment']);
  root.push([/"/, 'string', '@dq'], [/'/, 'string', '@sq'], [/\d+(\.\d+)?/, 'number'], [/[A-Za-z_][\w]*/, { cases: { '@k1': 'keyword', '@k2': 'type', '@k3': 'keyword.other', '@k4': 'predefined', '@default': 'identifier' } }], [/[-+*/=<>!&|^~%?:;,.]/, 'operator']);
  monaco.languages.setMonarchTokensProvider(id, { ignoreCase: !!u.ignoreCase, k1: kw[0], k2: kw[1], k3: kw[2], k4: kw[3], tokenizer: { root, bc: [[new RegExp(esc(u.cClose || '*/')), 'comment', '@pop'], [/./, 'comment']], dq: [[/[^\\"]+/, 'string'], [/\\./, 'string'], [/"/, 'string', '@pop']], sq: [[/[^\\']+/, 'string'], [/\\./, 'string'], [/'/, 'string', '@pop']] } });
  LANGS[key] = { name: key, exts: (u.exts || '').split(/\s+/).filter(Boolean), commentLine: u.cLine || '', commentStart: u.cOpen || '', commentEnd: u.cClose || '', keywords: {}, monaco: id };
  LANGS[key].exts.forEach((e) => { if (!LANG_BY_MENU_ID[e]) { /* extension map is consulted by langForPath through LANGS only for built-ins */ } });
  return key;
}
NGN.loadUDLs = () => { (S.prefs.udl || []).forEach(registerUDL); };
NGN.langDisplayUDL = (n) => n.replace(/^udl:/, '');
NGN.openUDL = () => {
  const list = S.prefs.udl ||= []; let cur = list[0] || null;
  const sel = el('select', { style: 'flex:1' }); const name = el('input', { type: 'text' }), exts = el('input', { type: 'text' }), ic = el('input', { type: 'checkbox' });
  const kws = [1, 2, 3, 4].map(() => el('textarea', { rows: 2, style: 'width:100%' })); const cl = el('input', { type: 'text' }), co = el('input', { type: 'text' }), cc = el('input', { type: 'text' });
  const fill = () => { name.value = cur?.name || ''; exts.value = cur?.exts || ''; ic.checked = !!cur?.ignoreCase; kws.forEach((k, i) => (k.value = cur?.['kw' + (i + 1)] || '')); cl.value = cur?.cLine || ''; co.value = cur?.cOpen || ''; cc.value = cur?.cClose || ''; };
  const refresh = () => { sel.innerHTML = ''; list.forEach((u, i) => sel.append(el('option', { value: i, text: u.name }))); if (cur) sel.value = list.indexOf(cur); fill(); };
  sel.addEventListener('change', () => { cur = list[+sel.value]; fill(); }); refresh();
  const collect = () => ({ name: name.value.trim() || 'User language', exts: exts.value, ignoreCase: ic.checked, kw1: kws[0].value, kw2: kws[1].value, kw3: kws[2].value, kw4: kws[3].value, cLine: cl.value, cOpen: co.value, cClose: cc.value });
  const save = () => { const u = collect(); const i = cur ? list.indexOf(cur) : -1; if (i >= 0) list[i] = u; else list.push(u); cur = u; registerUDL(u); NGN.saveCfgSoon(); refresh(); NGN.toast('Saved language ' + u.name); };
  NGN.dialog({ key: 'udl', title: 'User Defined Language v2.1', width: 560, body: el('div', {},
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'User language:' }), sel, el('button', { text: 'Create new...', onclick: () => { cur = null; fill(); name.focus(); } }), el('button', { text: 'Remove', onclick: () => { if (cur) { list.splice(list.indexOf(cur), 1); cur = list[0] || null; NGN.saveCfgSoon(); refresh(); } } })),
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'Name:' }), name), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Ext.:' }), exts), el('label', {}, ic, 'Ignore case'),
    ...kws.map((k, i) => el('div', {}, el('div', { text: `Keywords ${i + 1} (space separated)` }), k)),
    el('div', { class: 'row' }, el('label', { class: 'f', text: 'Line comment:' }), cl), el('div', { class: 'row' }, el('label', { class: 'f', text: 'Comment open/close:' }), co, cc)),
    buttons: [{ label: 'Save', stay: true, fn: save }, { label: 'Apply to current document', fn: () => { save(); setLanguage(curDoc(), 'udl:' + (cur?.name || '')); } }, { label: 'Export...', stay: true, fn: async () => { const p = await ngn.dlg.save({ defaultPath: S.paths.documents + '/' + (cur?.name || 'udl') + '.udl.json' }); if (p && cur) await ngn.file.write(p, JSON.stringify(cur, null, 1), 'utf8'); } }, { label: 'Import...', stay: true, fn: async () => { const f = (await ngn.dlg.open({ properties: ['openFile'] }))[0]; if (f) { const u = await ngn.session.readFile(f); if (u?.name) { list.push(u); cur = u; registerUDL(u); NGN.saveCfgSoon(); refresh(); } } } }, { label: 'Close' }] });
};
