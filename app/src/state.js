// Shared mutable state + cross-module registry. Modules attach functions to NGN to avoid import cycles.
export const NGN = (window.NGN = {});

export const DEFAULT_PREFS = {
  // General
  toolbar: 'small', tabHide: false, tabVertical: false, tabMultiline: false, tabLock: false, tabDblClickClose: false, exitOnLastTab: false,
  tabMaxLabel: 40, tabReduce: false, tabAltIcons: false, tabInactiveColor: true, tabActiveBar: true, tabCloseButton: true, tabPin: true,
  tabOnlyPinnedBtn: false, tabBtnsOnInactive: false, menuHide: false, statusHide: false, localization: 'english', multiInstance: 'mono',
  dateFormatReverse: false, dateCustom: 'yyyy-MM-dd HH:mm:ss',
  // Editing
  caretWidth: 2, caretBlink: 500, curLine: 'bg', wrapIndent: 'aligned', smoothFont: true, virtualSpace: false, foldToggle: false,
  keepSelOnRightClick: false, copyLineNoSel: true, lineNumbers: true, lineNumDynamic: true, bookmarkMargin: true, changeHistory: 'margin',
  foldStyle: 'box', edge: 'none', edgeColumn: 80, multiEdit: true, columnToMulti: true, scrollBeyondLast: false, rtl: false,
  fontName: '', fontSize: 13, wordWrap: false, indentGuide: true, whitespace: false, allChars: false, eolVisible: false, ctrlChars: false,
  // Dark mode
  darkMode: 'light', theme: 'Default (stylers.xml)',
  // New document
  newEOL: 'LF', newEncoding: 'utf8', newLang: 'normal', newAtStartup: true, firstLineAsName: false,
  // Directories / recent
  dirMode: 'follow', dirCustom: '', recentMax: 15, recentDisplay: 'full', recentSubmenu: false, recentLen: 80, openFolderOnDrop: false,
  // Language menu
  langMenuCompact: false, langDisabled: [],
  // Highlighting
  smartHl: true, smartHlCase: false, smartHlWord: true, smartHlOther: true, smartHlUseFind: false, tagHl: true, tagHlAttr: true,
  styleTokenCase: false, styleTokenWord: false,
  // Print
  printLineNumbers: true, printColor: 'wysiwyg', printMargins: { top: 5, left: 5, right: 5, bottom: 5 },
  printHeader: { left: '$(FULL_CURRENT_PATH)', mid: '', right: '$(LONG_DATE) $(TIME)' }, printFooter: { left: '', mid: 'Page $(CURRENT_PRINTING_PAGE) of $(TOTAL_PAGE_NUMBER)', right: '' },
  // Searching
  searchAutoFill: true, searchFillSelected: true, searchMaxFill: 1024, searchWordUnderCaret: true, searchMono: false, searchStayOpen: false,
  searchFillDir: true, searchInSelAuto: 1024, searchEngine: 'https://www.google.com/search?q=$(CURRENT_WORD)',
  // Backup / session
  rememberSession: true, snapshot: true, snapshotInterval: 7, backupOnSave: 'none', backupDir: '', rememberInaccessible: true,
  // Auto-completion
  acEnable: false, acMode: 'both', acFromNth: 1, acBrief: false, acParamHint: true, acInsert: 'tab', acIgnoreNumbers: true,
  acCloseHtml: true, acPairs: { paren: false, bracket: false, brace: false, dquote: false, squote: false, user: false, userOpen: '', userClose: '' },
  // Performance / large file
  largeFile: true, largeFileMB: 200, largeNoWrap: true, largeAC: false, largeSmart: false, largeBrace: false, largeUrl: false,
  // Delimiter / words
  wordChars: '', delimOpen: '', delimClose: '', delimMulti: false,
  // Links
  clickableLinks: true, linkNoUnderline: false, linkFullbox: false, linkSchemes: 'mailto: ftp:// file:// http:// https:// ssh://',
  // Indent
  tabSize: 4, useTabs: true, backspaceUnindent: false, autoIndent: 'advanced',
  // Misc
  autoDetectStatus: true, updateSilent: false, scrollToLast: false, docSwitcher: false, docSwitcherMRU: true, peek: false,
  titleOnlyFilename: false, saveAllConfirm: true, autoDetectEncoding: true, muteSounds: false, snapshotMonitor: 'ask',
  // Cloud
  cloudPath: '',
  // Panel state persisted
  panels: {}, zoom: 0, shortcuts: {}, disabledPlugins: [], styleOverrides: {},
};

export const S = {
  prefs: { ...DEFAULT_PREFS },
  docs: new Map(), nextId: 1, untitledN: 0,
  views: [
    { idx: 0, ed: null, tabsEl: null, hostEl: null, order: [], active: null },
    { idx: 1, ed: null, tabsEl: null, hostEl: null, order: [], active: null },
  ],
  cur: 0, split: false, recent: [], closedStack: [], clipHist: [], macros: [], runList: [],
  find: { what: '', repl: '', mode: 'normal', matchCase: false, whole: false, wrap: true, backward: false, dotNL: false, inSel: false, filters: '', dir: '', recursive: true, hidden: false, bookmarkLine: false, purge: false },
  theme: null, paths: null, readOnlyAll: false, syncV: false, syncH: false, monitoring: new Set(), bookmarksByDoc: new WeakMap(),
  clipboardStyle: null, macroRec: null, lastMacro: null, sessionDirty: false,
};

export const curView = () => S.views[S.cur];
export const curEd = () => S.views[S.cur].ed;
export const curDoc = () => { const v = S.views[S.cur]; return v.active ? S.docs.get(v.active) : null; };
export const docOfModel = (m) => { for (const d of S.docs.values()) if (d.model === m) return d; return null; };
