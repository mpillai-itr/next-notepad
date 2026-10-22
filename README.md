# NextGenNote

A native macOS source-code editor rebuilt from the feature set of Notepad++ (inspected from the Windows `notepad++.exe` v8.x
shipped inside `~/Applications/Notepad.app`, a Wineskin wrapper).

* `docs/FEATURES.md` — feature ledger traced from the binary (every menu command + dialog)
* `docs/observed-main-menu.txt`, `docs/observed-dialogs.txt`, `docs/menu.json` — raw evidence extracted with REA
* `docs/screenshots/` — screenshots from the scripted tour (`app/src/demo.js`)
* `app/` — Electron + Monaco implementation

## Build & run
```bash
cd app && npm install
npm start                    # bundle + launch
./build/package.sh           # produces ../dist-app/NextGenNote.app
open ../dist-app/NextGenNote.app
```
Self-test (runs every menu command and 65 output assertions): `NGN_SELFTEST=1 NGN_DEMO=x npx electron .`

## License
GPL-3.0-or-later. The app bundles data files from Notepad++ (themes, language definitions, auto-completion, function-list rules,
localizations), which are GPL-licensed; see `app/data/LICENSE`.
