// Two-phase check of "close without prompts, reopen where I left off".
import { S, NGN, curEd } from './state.js';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ngn = window.ngn;
export async function run(env) {
  await wait(700);
  if (env.phase === '1') {
    S.prefs.theme = 'Zenburn'; await NGN.applyPrefs({ theme: true });
    const scratch = NGN.createDoc({ text: 'scratch notes\nnever saved anywhere\nthird line', name: null, activate: true });
    const js = await NGN.openPath(env.demo + '/sample.js'); js.model.pushEditOperations([], [{ range: new NGN.monaco.Range(1, 1, 1, 1), text: '/* UNSAVED EDIT */ ' }], () => null);
    NGN.activateDoc(js.id); curEd().setPosition({ lineNumber: 12, column: 5 }); curEd().revealLineInCenter(12); NGN.bm.add(js, 9);
    const fr = await NGN.openPath(env.demo + '/fruits.txt'); NGN.moveTabTo(fr.id, 1, null); curEd().setPosition({ lineNumber: 3, column: 2 });
    NGN.activateDoc(js.id); await wait(500);
    const dialogsBefore = document.querySelectorAll('.dlg').length;
    await ngn.demo.capture(env.shots + '/R1-before-quit.png');
    console.log('RESTORE1 docs', S.docs.size, 'dirty', [...S.docs.values()].filter(NGN.isDirty).map((d) => d.name).join(','), 'dialogsBeforeQuit', dialogsBefore);
    await NGN.quit();   // must NOT show a save prompt
    await wait(1500);
    console.log('RESTORE1 FAIL quit did not exit; dialogs open:', document.querySelectorAll('.dlg').length);
  } else {
    await wait(800);
    const names = [...S.docs.values()].map((d) => `${d.name}${NGN.isDirty(d) ? '*' : ''}@v${d.view}`);
    const js = [...S.docs.values()].find((d) => d.name === 'sample.js'); const sc = [...S.docs.values()].find((d) => d.untitledNo);
    const fr = [...S.docs.values()].find((d) => d.name === 'fruits.txt');
    const act = S.views[0].active === js?.id; const pos = curEd().getPosition();
    console.log('RESTORE2 docs', names.join(' | '));
    console.log('RESTORE2 untitled text:', JSON.stringify(sc?.model.getValue()));
    console.log('RESTORE2 js first line:', JSON.stringify(js?.model.getLineContent(1).slice(0, 30)), 'dirty', js && NGN.isDirty(js));
    console.log('RESTORE2 active is sample.js:', act, 'caret', pos.lineNumber + ':' + pos.column, 'split', S.split, 'fruits view', fr?.view, 'bookmarks', JSON.stringify(js && NGN.bm.lines(js)), 'theme', S.prefs.theme);
    await ngn.demo.capture(env.shots + '/R2-after-reopen.png');
    await wait(200); await ngn.win.quit();
  }
}
