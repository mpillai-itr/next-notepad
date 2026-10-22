// Scripted tour used to prove the build: drives real commands and captures the window.
import { S, NGN, curEd, curDoc } from './state.js';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ngn = window.ngn;
export async function run(env) {
  const D = env.demo; const shot = async (n) => { await wait(450); await ngn.demo.capture(`${env.shots}/${n}.png`); };
  const cmd = async (id, ms = 250) => { await NGN.runCommand(id); await wait(ms); };
  const ed = () => curEd();
  S.prefs.rememberSession = false;
  await wait(800);
  // 1. open files
  await NGN.openPath(`${D}/sample.js`); await NGN.openPath(`${D}/fruits.txt`); await NGN.openPath(`${D}/page.html`); await NGN.openPath(`${D}/report.py`);
  await NGN.runCommand(44084); // function list
  S.prefs.theme = 'Monokai'; await NGN.applyPrefs({ theme: true });
  NGN.activateDoc([...S.docs.values()].find((d) => d.name === 'sample.js').id); await wait(700);
  await shot('01-syntax-theme-functionlist');
  // 2. line operations on fruits
  NGN.activateDoc([...S.docs.values()].find((d) => d.name === 'fruits.txt').id); await wait(300);
  ed().setSelection(ed().getModel().getFullModelRange());
  await cmd(42079); await cmd(42059); await shot('02-sort-dedupe');
  // 3. find dialog + marks + bookmarks
  S.find.what = 'an'; S.find.mode = 'normal'; NGN.openFindDialog(4); await wait(300);
  await shot('03-find-dialog');
  document.querySelectorAll('.dlg button').forEach((b) => { if (b.textContent === 'Mark All') b.click(); });
  ed().setPosition({ lineNumber: 2, column: 1 }); await cmd(43005); ed().setPosition({ lineNumber: 5, column: 1 }); await cmd(43005);
  NGN.closeDialog('find'); await wait(200);
  await cmd(44019); // show all characters
  await shot('04-marks-bookmarks-eol');
  await cmd(44019);
  // 4. column editor (numbering)
  ed().setSelection(new (NGN.monaco.Selection)(1, 1, 7, 1)); NGN.openColumnEditor(); await wait(300);
  document.querySelectorAll('.dlg input[type=radio]')[1].click(); await wait(100);
  const nums = document.querySelectorAll('.dlg input[type=number]'); nums[0].value = 1; nums[1].value = 1;
  document.querySelectorAll('.dlg-foot button').forEach((b) => { if (b.textContent === 'OK') b.click(); }); await wait(300);
  await shot('05-column-editor');
  // 5. HTML tag match + split view
  NGN.activateDoc([...S.docs.values()].find((d) => d.name === 'page.html').id); ed().setPosition({ lineNumber: 5, column: 8 }); await wait(500);
  await cmd(10002); await wait(300); await shot('06-split-view-html');
  // 6. dialogs
  await cmd(48011); await wait(400); await shot('07-preferences');
  NGN.closeDialog('prefs');
  NGN.activateDoc([...S.docs.values()].find((d) => d.name === 'sample.js').id);
  ed().setSelection(ed().getModel().getFullModelRange());
  await NGN.hashDialog('sha256', 'SHA-256', 'text'); await wait(400); await shot('08-sha256');
  document.querySelectorAll('.dlg .x').forEach((x) => x.click());
  // 7. macro record / playback
  NGN.activateDoc([...S.docs.values()].find((d) => d.name === 'fruits.txt').id);
  ed().setPosition({ lineNumber: 1, column: 1 }); ed().focus(); await wait(200); NGN.macroStart(); await ngn.demo.keys([{ text: '* ' }, { key: 'Down' }, { key: 'Home' }]); await wait(200); NGN.macroStop();
  await NGN.macroPlay(5); await shot('09-macro');
  // 8. dark mode
  S.prefs.darkMode = 'dark'; await NGN.applyPrefs({ theme: true }); await shot('10-dark');
  await wait(300); await ngn.win.quit();
}
