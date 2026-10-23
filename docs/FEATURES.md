# Feature ledger

Every row below is a menu command recovered from the **RT_MENU 1500** resource of the Windows `notepad++.exe` (REA `inspect_pe_resources`, 573 command entries across 12 menus), plus the dialogs in the 69 **RT_DIALOG** resources (`docs/observed-dialogs.txt`).
`app/src/selftest.js` invokes every command id against a scratch document (430 run, 45 skipped because they open native OS dialogs, spawn processes or close the test window) and asserts outputs for 65 behaviours.

Legend: ✅ implemented · 🔁 adapted to macOS (see note) · ◐ partial/approximation

## File menu

- ✅ **New** `41001`
- ✅ **Open...** `41002`
### Open Containing Folder

- 🔁 **Explorer** `41019` — Reveals the file in **Finder** (original: Explorer)
- 🔁 **cmd** `41020` — Opens **Terminal** at the folder (original: cmd)
- ✅ **Folder as Workspace** `41025`

- ✅ **Open in Default Viewer** `41023`
- ✅ **Open Folder as Workspace...** `41022`
- ✅ **Reload from Disk** `41014`
- ✅ **Save** `41006`
- ✅ **Save As...** `41008`
- ✅ **Save a Copy As...** `41015`
- ✅ **Save All** `41007`
- ✅ **Rename...** `41017`
- ✅ **Close** `41003`
- ✅ **Close All** `41004`
### Close Multiple Documents

- ✅ **Close All but Active Document** `41005`
- ✅ **Close All but Pinned Documents** `41026`
- ✅ **Close All to the Left** `41009`
- ✅ **Close All to the Right** `41018`
- ✅ **Close All Unchanged** `41024`

- 🔁 **Move to Recycle Bin** `41016` — Moves to the macOS **Trash** (original: Recycle Bin)
- ✅ **Load Session...** `41012`
- ✅ **Save Session...** `41013`
- ◐ **Print...** `41010` — System print dialog; header/footer printed once (no per-page numbering) — **partial**
- ◐ **Print Now** `1001` — Same as Print, without the dialog
- ✅ **Exit** `41011`

## Edit menu

- ✅ **Undo** `42003`
- ✅ **Redo** `42004`
- ✅ **Cut** `42001`
- ✅ **Copy** `42002`
- ✅ **Paste** `42005`
- ✅ **Delete** `42006`
- ✅ **Select All** `42007`
- ✅ **Begin/End Select** `42020`
- ✅ **Begin/End Select in Column Mode** `42089`
### Insert

- ✅ **Date Time (short)** `42084`
- ✅ **Date Time (long)** `42085`
- ✅ **Date Time (customized)** `42086`

### Copy to Clipboard

- ✅ **Copy Current Full File path** `42029`
- ✅ **Copy Current Filename** `42030`
- ✅ **Copy Current Dir. Path** `42031`
- ✅ **Copy All Filenames** `42087`
- ✅ **Copy All File Paths** `42088`

### Indent

- ✅ **Increase Line Indent** `42008`
- ✅ **Decrease Line Indent** `42009`

### Convert Case to

- ✅ **UPPERCASE** `42016`
- ✅ **lowercase** `42017`
- ✅ **Proper Case** `42067`
- ✅ **Proper Case (blend)** `42068`
- ✅ **Sentence case** `42069`
- ✅ **Sentence case (blend)** `42070`
- ✅ **iNVERT cASE** `42071`
- ✅ **ranDOm CasE** `42072`

### Line Operations

- ✅ **Duplicate Current Line** `42010`
- ✅ **Remove Duplicate Lines** `42079`
- ✅ **Remove Consecutive Duplicate Lines** `42077`
- 🔁 **Split Lines** `42012` — Splits at the edge column (80 if edge is off)
- ✅ **Join Lines** `42013`
- ✅ **Move Up Current Line** `42014`
- ✅ **Move Down Current Line** `42015`
- ✅ **Remove Empty Lines** `42055`
- ✅ **Remove Empty Lines (Containing Blank characters)** `42056`
- ✅ **Insert Blank Line Above Current** `42057`
- ✅ **Insert Blank Line Below Current** `42058`
- ✅ **Reverse Line Order** `42083`
- ✅ **Randomize Line Order** `42078`
- ✅ **Sort Lines Lexicographically Ascending** `42059`
- ✅ **Sort Lines Lex. Ascending Ignoring Case** `42080`
- ✅ **Sort Lines In Locale Order Ascending** `42100`
- ✅ **Sort Lines As Integers Ascending** `42061`
- ✅ **Sort Lines As Decimals (Comma) Ascending** `42063`
- ✅ **Sort Lines As Decimals (Dot) Ascending** `42065`
- ✅ **Sort Lines As Length Ascending** `42104`
- ✅ **Sort Lines Lexicographically Descending** `42060`
- ✅ **Sort Lines Lex. Descending Ignoring Case** `42081`
- ✅ **Sort Lines In Locale Order Descending** `42101`
- ✅ **Sort Lines As Integers Descending** `42062`
- ✅ **Sort Lines As Decimals (Comma) Descending** `42064`
- ✅ **Sort Lines As Decimals (Dot) Descending** `42066`
- ✅ **Sort Lines As Length Descending** `42105`

### Comment/Uncomment

- ✅ **Toggle Single Line Comment** `42022`
- ✅ **Single Line Comment** `42035`
- ✅ **Single Line Uncomment** `42036`
- ✅ **Block Comment** `42023`
- ✅ **Block Uncomment** `42047`

### Auto-Completion

- ✅ **Function Completion** `50000`
- ✅ **Word Completion** `50001`
- ✅ **Function Parameters Hint** `50002`
- ✅ **Function Parameters Previous Hint** `50010`
- ✅ **Function Parameters Next Hint** `50011`
- ✅ **Path Completion** `50006`

### EOL Conversion

- ✅ **Windows (CR LF)** `45001`
- ✅ **Unix (LF)** `45002`
- ✅ **Macintosh (CR)** `45003`

### Blank Operations

- ✅ **Trim Trailing Space** `42024`
- ✅ **Trim Leading Space** `42042`
- ✅ **Trim Leading and Trailing Space** `42043`
- ✅ **EOL to Space** `42044`
- ✅ **Trim both and EOL to Space** `42045`
- ✅ **TAB to Space** `42046`
- ✅ **Space to TAB (All)** `42054`
- ✅ **Space to TAB (Leading)** `42053`

### Paste Special

- 🔁 **Paste HTML Content** `42038` — Reads HTML flavour from the macOS pasteboard
- 🔁 **Paste RTF Content** `42039` — Reads RTF flavour from the macOS pasteboard
- ✅ **Copy Binary Content** `42048`
- ✅ **Cut Binary Content** `42049`
- ✅ **Paste Binary Content** `42050`

### On Selection

- ✅ **Open File** `42073`
- ✅ **Open Containing Folder in Explorer** `42074`
- ✅ **Search on Internet** `42075`
- ✅ **Change Search Engine...** `42076`

### Multi-select All

- ✅ **Ignore Case  Whole Word** `42090`
- ✅ **Match Case Only** `42091`
- ✅ **Match Whole Word Only** `42092`
- ✅ **Match Case  Whole Word** `42093`

### Multi-select Next

- ✅ **Ignore Case  Whole Word** `42094`
- ✅ **Match Case Only** `42095`
- ✅ **Match Whole Word Only** `42096`
- ✅ **Match Case  Whole Word** `42097`

- ✅ **Undo the Latest Added Multi-Select** `42098`
- ✅ **Skip Current  Go to Next Multi-select** `42099`
- ✅ **Column Mode...** `42037`
- ✅ **Column Editor...** `42034`
- ✅ **Character Panel** `42051`
- ✅ **Clipboard History** `42052`
### Read-Only in Notepad++

- ✅ **Read-Only on Current Document** `42028`
- ✅ **Read-Only for All Documents** `42102`
- ✅ **Clear Read-Only for All Documents** `42103`

- 🔁 **Read-Only Attribute in Windows** `42033` — Maps to the POSIX write bit (`chmod`) instead of the Windows read-only attribute

## Search menu

- ✅ **Find...** `43001`
- ✅ **Find in Files...** `43013`
- ✅ **Find Next** `43002`
- ✅ **Find Previous** `43010`
- ✅ **Select and Find Next** `43048`
- ✅ **Select and Find Previous** `43049`
- ✅ **Find (Volatile) Next** `43014`
- ✅ **Find (Volatile) Previous** `43015`
- ✅ **Replace...** `43003`
- 🔁 **Incremental Search** `43011` — Bottom incremental-search bar
- ✅ **Search Results Window** `43045`
- ✅ **Next Search Result** `43046`
- ✅ **Previous Search Result** `43047`
- ✅ **Go to...** `43004`
- ✅ **Go to Matching Brace** `43009`
- ✅ **Select All In-between {} [] or ()** `43053`
- ✅ **Mark...** `43054`
### Change History

- ✅ **Go to Next Change** `43067`
- ✅ **Go to Previous Change** `43068`
- ✅ **Clear Change History** `43069`

### Style All Occurrences of Token

- ✅ **Using 1st Style** `43022`
- ✅ **Using 2nd Style** `43024`
- ✅ **Using 3rd Style** `43026`
- ✅ **Using 4th Style** `43028`
- ✅ **Using 5th Style** `43030`

### Style One Token

- ✅ **Using 1st Style** `43062`
- ✅ **Using 2nd Style** `43063`
- ✅ **Using 3rd Style** `43064`
- ✅ **Using 4th Style** `43065`
- ✅ **Using 5th Style** `43066`

### Clear Style

- ✅ **Clear 1st Style** `43023`
- ✅ **Clear 2nd Style** `43025`
- ✅ **Clear 3rd Style** `43027`
- ✅ **Clear 4th Style** `43029`
- ✅ **Clear 5th Style** `43031`
- ✅ **Clear all Styles** `43032`

### Jump Up

- ✅ **1st Style** `43033`
- ✅ **2nd Style** `43034`
- ✅ **3rd Style** `43035`
- ✅ **4th Style** `43036`
- ✅ **5th Style** `43037`
- ✅ **Find Mark Style** `43038`

### Jump Down

- ✅ **1st Style** `43039`
- ✅ **2nd Style** `43040`
- ✅ **3rd Style** `43041`
- ✅ **4th Style** `43042`
- ✅ **5th Style** `43043`
- ✅ **Find Mark Style** `43044`

### Copy Styled Text

- ✅ **1st Style** `43055`
- ✅ **2nd Style** `43056`
- ✅ **3rd Style** `43057`
- ✅ **4th Style** `43058`
- ✅ **5th Style** `43059`
- ✅ **All Styles** `43060`
- ✅ **Find Mark Style** `43061`

### Bookmark

- ✅ **Toggle Bookmark** `43005`
- ✅ **Next Bookmark** `43006`
- ✅ **Previous Bookmark** `43007`
- ✅ **Clear All Bookmarks** `43008`
- ✅ **Cut Bookmarked Lines** `43018`
- ✅ **Copy Bookmarked Lines** `43019`
- ✅ **Paste to (Replace) Bookmarked Lines** `43020`
- ✅ **Remove Bookmarked Lines** `43021`
- ✅ **Remove Non-Bookmarked Lines** `43051`
- ✅ **Inverse Bookmarks** `43050`

- ✅ **Find characters in range...** `43052`

## View menu

- ✅ **Always on Top** `44034`
- ✅ **Toggle Full Screen Mode** `44032`
- 🔁 **Post-It** `44009` — Post-It = chrome-less window
- 🔁 **Distraction Free Mode** `44011` — Distraction-free = full screen, no chrome
### View Current File in

- ✅ **Firefox** `44100`
- ✅ **Chrome** `44101`
- 🔁 **Edge** `44102` — Opens in Microsoft Edge (must be installed)
- 🔁 **IE** `44103` — Opens in **Safari** (original: Internet Explorer)

### Show Symbol

- ✅ **Show Space and Tab** `44025`
- ✅ **Show End of Line** `44026`
- ◐ **Show Non-Printing Characters** `44130` — Approximation: turns on whitespace + EOL markers
- ◐ **Show Control Characters  Unicode EOL** `44131` — Approximation: Monaco control-character rendering (no Unicode-EOL glyph set)
- ✅ **Show All Characters** `44019`
- ✅ **Show Indent Guide** `44020`
- ◐ **Show Wrap Symbol** `44041` — Toggle is stored, but Monaco draws no wrap glyph — **partial**

### Zoom

- ✅ **Zoom In (Ctrl+Mouse Wheel Up)** `44023`
- ✅ **Zoom Out (Ctrl+Mouse Wheel Down)** `44024`
- ✅ **Restore Default Zoom** `44033`

### Move/Clone Current Document

- ✅ **Move to Other View** `10001`
- ✅ **Clone to Other View** `10002`
- 🔁 **Move to New Instance** `10003` — Spawns a second app instance
- 🔁 **Open in New Instance** `10004` — Spawns a second app instance

### Tab

- ✅ **1st Tab** `44086`
- ✅ **2nd Tab** `44087`
- ✅ **3rd Tab** `44088`
- ✅ **4th Tab** `44089`
- ✅ **5th Tab** `44090`
- ✅ **6th Tab** `44091`
- ✅ **7th Tab** `44092`
- ✅ **8th Tab** `44093`
- ✅ **9th Tab** `44094`
- ✅ **First Tab** `44116`
- ✅ **Last Tab** `44117`
- ✅ **Next Tab** `44095`
- ✅ **Previous Tab** `44096`
- ✅ **Move to Start** `10005`
- ✅ **Move to End** `10006`
- ✅ **Move Tab Forward** `44098`
- ✅ **Move Tab Backward** `44099`
- ✅ **Apply Color 1** `44111`
- ✅ **Apply Color 2** `44112`
- ✅ **Apply Color 3** `44113`
- ✅ **Apply Color 4** `44114`
- ✅ **Apply Color 5** `44115`
- ✅ **Remove Color** `44110`

- ✅ **Word wrap** `44022`
- ✅ **Focus on Another View** `44072`
- ✅ **Hide Lines** `44042`
- ✅ **Fold All** `44010`
- ✅ **Unfold All** `44029`
- ✅ **Fold Current Level** `44030`
- ✅ **Unfold Current Level** `44031`
### Fold Level

- ✅ **1** `44051`
- ✅ **2** `44052`
- ✅ **3** `44053`
- ✅ **4** `44054`
- ✅ **5** `44055`
- ✅ **6** `44056`
- ✅ **7** `44057`
- ◐ **8** `44058` — Monaco has fold levels 1–7; level 8 folds to level 7 — **partial**

### Unfold Level

- ✅ **1** `44061`
- ✅ **2** `44062`
- ✅ **3** `44063`
- ✅ **4** `44064`
- ✅ **5** `44065`
- ✅ **6** `44066`
- ✅ **7** `44067`
- ◐ **8** `44068` — Implemented as unfold-all then refold deeper levels — **approximation**

- ✅ **Summary...** `44049`
### Project Panels

- ✅ **Project Panel 1** `44081`
- ✅ **Project Panel 2** `44082`
- ✅ **Project Panel 3** `44083`

- ✅ **Folder as Workspace** `44085`
- ✅ **Document Map** `44080`
- ✅ **Document List** `44070`
- ✅ **Function List** `44084`
- ✅ **Synchronize Vertical Scrolling** `44035`
- ✅ **Synchronize Horizontal Scrolling** `44036`
- ✅ **Text Direction RTL** `42026`
- ✅ **Text Direction LTR** `42027`
- ✅ **Monitoring (tail -f)** `44097`

## Encoding menu

- ✅ **ANSI** `45004`
- ✅ **UTF-8** `45008`
- ✅ **UTF-8-BOM** `45005`
- ✅ **UTF-16 BE BOM** `45006`
- ✅ **UTF-16 LE BOM** `45007`
### Character sets

#### Arabic

- ✅ **ISO 8859-6** `45034`
- ✅ **OEM 720** `45045`
- ✅ **Windows-1256** `45026`

#### Baltic

- ✅ **ISO 8859-4** `45032`
- ✅ **ISO 8859-13** `45040`
- ✅ **OEM 775** `45047`
- ✅ **Windows-1257** `45027`

#### Celtic

- ✅ **ISO 8859-14** `45041`

#### Cyrillic

- ✅ **ISO 8859-5** `45033`
- ✅ **KOI8-R** `45068`
- ✅ **KOI8-U** `45067`
- ✅ **Macintosh** `45066`
- ✅ **OEM 855** `45050`
- ✅ **OEM 866** `45058`
- ✅ **Windows-1251** `45021`

#### Central European

- ✅ **OEM 852** `45049`
- ✅ **Windows-1250** `45020`

#### Chinese

- ✅ **Big5 (Traditional)** `45060`
- ✅ **GB2312 (Simplified)** `45061`

#### Eastern European

- ✅ **ISO 8859-2** `45030`

#### Greek

- ✅ **ISO 8859-7** `45035`
- ✅ **OEM 737** `45046`
- ✅ **OEM 869** `45059`
- ✅ **Windows-1253** `45023`

#### Hebrew

- ✅ **ISO 8859-8** `45036`
- ✅ **OEM 862** `45055`
- ✅ **Windows-1255** `45025`

#### Japanese

- ✅ **Shift-JIS** `45062`

#### Korean

- ✅ **Windows 949** `45063`
- ✅ **EUC-KR** `45064`

#### North European

- ✅ **OEM 861 : Icelandic** `45054`
- ✅ **OEM 865 : Nordic** `45057`

#### Thai

- ✅ **TIS-620** `45065`

#### Turkish

- ✅ **ISO 8859-3** `45031`
- ✅ **ISO 8859-9** `45037`
- ✅ **OEM 857** `45051`
- ✅ **Windows-1254** `45024`

#### Western European

- ✅ **ISO 8859-1** `45029`
- ✅ **ISO 8859-15** `45042`
- ✅ **OEM 850** `45048`
- ✅ **OEM 858** `45052`
- ✅ **OEM 860 : Portuguese** `45053`
- ✅ **OEM 863 : French** `45056`
- ✅ **OEM-US** `45044`
- ✅ **Windows-1252** `45022`

#### Vietnamese

- ✅ **Windows-1258** `45028`


- ✅ **Convert to ANSI** `45009`
- ✅ **Convert to UTF-8** `45010`
- ✅ **Convert to UTF-8-BOM** `45011`
- ✅ **Convert to UTF-16 BE BOM** `45012`
- ✅ **Convert to UTF-16 LE BOM** `45013`

## Language menu

- ✅ **None (Normal Text)** `46016`
- ✅ **ActionScript** `46028`
- ✅ **Ada** `46042`
- ✅ **ASN.1** `46064`
- ✅ **ASP** `46009`
- ✅ **Assembly** `46033`
- ✅ **AutoIt** `46044`
- ✅ **AviSynth** `46065`
- ✅ **BaanC** `46059`
- ✅ **Batch** `46022`
- ✅ **Blitzbasic** `46066`
- ✅ **C** `46002`
- ✅ **C#** `46023`
- ✅ **C++** `46003`
- ✅ **Caml** `46040`
- ✅ **CMake** `46048`
- ✅ **COBOL** `46050`
- ✅ **CSound** `46069`
- ✅ **CoffeeScript** `46056`
- ✅ **CSS** `46010`
- ✅ **D** `46051`
- ✅ **Diff** `46034`
- ✅ **Erlang** `46070`
- ✅ **ErrorList** `46093`
- ✅ **ESCRIPT** `46071`
- ✅ **Forth** `46072`
- ✅ **Fortran (free form)** `46026`
- ✅ **Fortran (fixed form)** `46058`
- ✅ **Freebasic** `46068`
- ✅ **GDScript** `46087`
- ✅ **Go** `46089`
- ✅ **Gui4Cli** `46052`
- ✅ **Haskell** `46046`
- ✅ **Hollywood** `46088`
- ✅ **HTML** `46005`
- ✅ **INI file** `46019`
- ✅ **Inno Setup** `46047`
- ✅ **Intel HEX** `46061`
- ✅ **Java** `46004`
- ✅ **JavaScript** `46007`
- ✅ **JSON** `46057`
- ✅ **JSON5** `46085`
- ✅ **JSP** `46055`
- ✅ **KIXtart** `46041`
- ✅ **LISP** `46031`
- ✅ **LaTeX** `46073`
- ✅ **Lua** `46024`
- ✅ **Makefile** `46018`
- ✅ **Matlab** `46045`
- ✅ **Microsoft Transact-SQL** `46086`
- ✅ **MMIXAL** `46074`
- ✅ **MS-DOS Style** `46015`
- ✅ **Nim** `46075`
- ✅ **Nncrontab** `46076`
- ✅ **NSIS** `46029`
- ✅ **Objective-C** `46014`
- ✅ **OScript** `46077`
- ✅ **Pascal** `46011`
- ✅ **Perl** `46013`
- ✅ **PHP** `46008`
- ✅ **PostScript** `46036`
- ✅ **PowerShell** `46053`
- ✅ **Properties** `46035`
- ✅ **Purebasic** `46067`
- ✅ **Python** `46012`
- ✅ **R** `46054`
- ✅ **Raku** `46090`
- ✅ **REBOL** `46078`
- ✅ **Registry** `46079`
- ✅ **Resource file** `46017`
- ✅ **Ruby** `46037`
- ✅ **Rust** `46080`
- ✅ **SAS** `46092`
- ✅ **Shell** `46027`
- ✅ **Scheme** `46032`
- ✅ **Smalltalk** `46038`
- ✅ **Spice** `46081`
- ✅ **SQL** `46020`
- ✅ **Swift** `46063`
- ✅ **S-Record** `46060`
- ✅ **TCL** `46030`
- ✅ **Tektronix extended HEX** `46062`
- ✅ **TeX** `46025`
- ✅ **TOML** `46091`
- ✅ **txt2tags** `46082`
- ✅ **TypeScript** `46084`
- ✅ **Verilog** `46043`
- ✅ **VHDL** `46039`
- ✅ **Visual Basic** `46021`
- ✅ **Visual Prolog** `46083`
- ✅ **XML** `46006`
- ✅ **YAML** `46049`
- ✅ **Define your language...** `46250`
- ✅ **Open User Defined Language folder...** `46300`
- 🔁 **Notepad++ User Defined Languages Collection** `46301` — Opens the UDL collection on GitHub
- ✅ **User-Defined** `46180`

## Settings menu

- ✅ **Preferences...** `48011`
- ✅ **Style Configurator...** `46001`
- ✅ **Shortcut Mapper...** `48009`
### Import

- 🔁 **Import plugin(s)...** `48005` — Not possible: native Windows plugin DLLs cannot load on macOS. The five bundled plugins are re-implemented instead (Plugins ▸ Plugins Admin)
- 🔁 **Import style theme(s)...** `48006` — Theme XML must be copied into `app/data/themes` (a rebuild picks it up)

- 🔁 **Edit Popup ContextMenu** `48018` — Opens an editable copy of contextMenu.xml from the user-data folder

## Tools menu

### MD5

- ✅ **Generate...** `48501`
- ✅ **Generate from files...** `48502`
- ✅ **Generate from selection into clipboard** `48503`

### SHA-1

- ✅ **Generate...** `48507`
- ✅ **Generate from files...** `48508`
- ✅ **Generate from selection into clipboard** `48509`

### SHA-256

- ✅ **Generate...** `48504`
- ✅ **Generate from files...** `48505`
- ✅ **Generate from selection into clipboard** `48506`

### SHA-512

- ✅ **Generate...** `48510`
- ✅ **Generate from files...** `48511`
- ✅ **Generate from selection into clipboard** `48512`


## Macro menu

- ✅ **Start Recording** `42018`
- ✅ **Stop Recording** `42019`
- ✅ **Playback** `42021`
- ✅ **Save Current Recorded Macro...** `42025`
- ✅ **Run a Macro Multiple Times...** `42032`

## Run menu

- ✅ **Run...** `49000`

## Plugins menu

- ✅ **Open Plugins Folder...** `48014`

## Window menu

### Sort By

- ✅ **Name A to Z** `11002`
- ✅ **Name Z to A** `11003`
- ✅ **Path A to Z** `11004`
- ✅ **Path Z to A** `11005`
- ✅ **Type A to Z** `11006`
- ✅ **Type Z to A** `11007`
- ✅ **Content Length Ascending** `11008`
- ✅ **Content Length Descending** `11009`
- ✅ **Modified Time Ascending** `11010`
- ✅ **Modified Time Descending** `11011`

- ✅ **Windows...** `11001`
- ✅ **Recent Window** `11020`

## ? menu

- ✅ **Command Line Arguments...** `47010`
- ✅ **Notepad++ Home** `47001`
- ✅ **Notepad++ Project Page** `47002`
- ✅ **Notepad++ Online User Manual** `47003`
- ✅ **Notepad++ Community (Forum)** `47004`
- 🔁 **Update Notepad++** `47006` — Opens the download page (no WinGUp updater on macOS)
- 🔁 **Set Updater Proxy...** `47009` — Opens the Updater preference page
- ✅ **Debug Info...** `47012`
- ✅ **About Notepad++** `47000`

## Session snapshot (quit without prompts, reopen where you left off)

- ✅ Quit / ⌘Q / closing the window never asks to save: every tab is snapshotted (unsaved edits, never-saved untitled tabs, read-only flag, bookmarks, caret/selection, scroll position, folds, pinned/colour tabs, split-view layout, active tab per view)
- ✅ Window size, position, maximised/full-screen state; open side panels; theme, zoom and all preferences
- ✅ Periodic backup while editing (Preferences ▸ Backup), so a crash also recovers unsaved work
- ✅ Verified by `app/src/restoretest.js` (two-phase quit → relaunch test)
- Turn it off in Preferences ▸ Backup ▸ "Remember current session" to get classic save prompts on quit
- Closing a **single tab** with unsaved changes still asks, like the original

## Dialogs & panels (from RT_DIALOG)

- ✅ Find / Replace / Find in Files / Find in Projects / Mark (dialog 1600) — Normal, Extended and Regex modes, ". matches newline", whole word, match case, wrap, in-selection, backward, Count, Find All (current / all open docs), Replace All (current / all open docs / selection), bookmark line, purge
- ✅ Search results panel (1670) + Find in search results (1710)
- ✅ Incremental search bar (1680)
- ✅ Go To… line/offset (2000)
- ✅ Column / Multi-Selection editor (2020): text or numbers, Dec/Hex/Oct/Bin, initial, increase, repeat, leading zeros/spaces
- 🔁 Style Configurator (2200): theme picker + core token styles (foreground, background, bold/italic/underline, font); not every per-lexer style group
- ✅ Shortcut Mapper (2600/5000): rebinding with conflict detection; main-menu, macro and run commands
- ✅ Character panel (2700), Clipboard History (2800), Document List (3000), Project panels (3100), Document Map (3300 → minimap), Function List (3400), Folder as Workspace (3500)
- ✅ Run… (1900) with `$(VARIABLES)`, saved commands appear in the Run menu
- ✅ Hash dialogs (1920/1930) MD5 / SHA-1 / SHA-256 / SHA-512 from text, files, selection
- ✅ Summary, Windows… (7000), Debug Info (1750), About (1700), Command-line arguments (1755), Save prompts (1760 incl. Yes/No to all), Run a Macro Multiple Times (8000), Find characters in range (2900)
- ✅ Preferences (6000): 22 categories mirroring dialogs 6010–7160 (General, Editing, Dark Mode, Margins, New Document, Default Directory, Recent Files, File Association, Language, Indentation, Highlighting, Print, Searching, Backup, Auto-Completion, Multi-Instance & Date, Delimiter, Performance, Cloud & Link, Search Engine, MISC, Updater)
- 🔁 User Defined Language (20000–26000): name, extensions, 4 keyword groups, line/block comments, import/export; not the full 8-group/delimiter matrix
- 🔁 Plugins Admin (5500): lists the five bundled re-implementations (MIME Tools, Converter, NppExport, JSON Viewer, JsonTools)
- ✅ **Data Tools** plugin (Plugins ▸ Data Tools), an addition not present in the original; every command works on the selection, or the whole document when nothing is selected, and is one undo step:
  - JSON: Pretty print (2 spaces) / (4 spaces), Minify JSON, Sort keys (JSON, recursive, 2-space output), Escape JSON / Unescape JSON (string-literal escaping, no outer quotes)
  - YAML: JSON to YAML, YAML to JSON (first document only, aliases resolved, comments dropped), Sort keys (YAML)
  - Base64 Encode / Decode (UTF-8): padded output, decode accepts whitespace, URL-safe alphabet and missing padding
  - Invalid input shows an error toast and leaves that selection unchanged

## Data files reused as-is from the install

`themes/*.xml` (22 themes) · `stylers.model.xml` · `langs.model.xml` (80 languages: keywords, comment markers, extensions) · `autoCompletion/*.xml` (33) · `functionList/*.xml` (46 PCRE parsers) · `localization/*.xml` (94 UI languages) · `contextMenu.xml`
