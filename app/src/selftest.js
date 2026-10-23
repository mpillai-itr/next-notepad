// Runs every menu command id against a scratch document and reports any that throw.
import { S, NGN, curEd } from './state.js';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = new Set([41002, 41008, 41015, 41012, 41013, 41022, 48006, 41010, 1001, 41011, 41003, 41004, 41005, 41026, 41009, 41018, 41024, 41016, 41017, 10003, 10004,
  41019, 41020, 41023, 41025, 44100, 44101, 44102, 44103, 42075, 47001, 47002, 47003, 47004, 47006, 48014, 46300, 46301, 44032, 44034, 48018, 44011, 44009, 42033, 42076]);
export async function run() {
  const errs = []; const origErr = console.error;
  console.error = (...a) => { errs.push(a.map((x) => (x && x.stack) || String(x)).join(' ')); };
  const tree = await (await fetch('app://host/menu.json')).json(); const ids = [];
  const walk = (l) => l.forEach((n) => (n.children ? walk(n.children) : n.id && ids.push(n.id)));
  walk(tree);
  const text = ['function alpha(a, b) {', '  return a + b; // sum', '}', '', 'banana', 'apple', 'cherry', 'apple', '', 'class Foo {', '  bar() { return 1 }', '}', '    trailing   ', 'last line'].join('\n');
  const doc = NGN.createDoc({ text, path: null, name: 'selftest.js', lang: 'javascript.js', activate: true });
  const ed = curEd(); let ok = 0; const failed = []; const uniq = [...new Set(ids)];
  for (const id of uniq) {
    if (SKIP.has(id)) continue;
    ed.focus(); ed.setSelection(new NGN.monaco.Selection(5, 1, 8, 6));
    const before = errs.length;
    try { await NGN.runCommand(id); } catch (e) { errs.push('THROW ' + id + ' ' + e.stack); }
    await wait(30);
    document.querySelectorAll('.dlg .x').forEach((x) => x.click()); document.querySelectorAll('.popup').forEach((p) => p.remove()); document.getElementById('incsearch')?.classList.add('hidden');
    if (errs.length > before) failed.push([id, errs.slice(before).join(' | ').slice(0, 300)]); else ok++;
    if (S.macroRec) NGN.macroStop();
    if (!NGN.curDocSafe) { /* keep going */ }
  }
  console.error = origErr;
  try { await functional(); } catch (e) { console.log('SELFTEST2 CRASH', e.stack); }
  console.log('SELFTEST total', uniq.length, 'skipped', SKIP.size, 'ok', ok, 'failed', failed.length);
  failed.forEach(([id, m]) => console.log('SELFTEST FAIL', id, m));
  await window.ngn.win.quit();
}

// ---- functional assertions (outputs, not just "did not throw") ---------------------------------------------------------------
export async function functional() {
  const ngn = window.ngn; const res = []; const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); res.push([ok, name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`]); };
  const doc = NGN.createDoc({ text: '', name: 'f.txt', activate: true }); const ed = curEd(); const m = doc.model;
  const setText = (t, sel = true) => { m.setValue(t); if (sel) ed.setSelection(m.getFullModelRange()); };
  const run = async (id) => { ed.focus(); await NGN.runCommand(id); await wait(20); };
  setText('b\na\nC\n10\n9'); await run(42059); check('sort lexicographic asc', m.getValue(), '10\n9\nC\na\nb');
  setText('b\na\nC\n10\n9'); await run(42080); check('sort ignore-case asc', m.getValue(), '10\n9\na\nb\nC');
  setText('10\n9\nx\n2'); await run(42061); check('sort integers asc (non-numeric first)', m.getValue(), 'x\n2\n9\n10');
  setText('10\n9\nx\n2'); await run(42062); check('sort integers desc', m.getValue(), '10\n9\n2\nx');
  setText('ccc\na\nbb'); await run(42104); check('sort by length asc', m.getValue(), 'a\nbb\nccc');
  setText('1,5\n1,25\n1,3'); await run(42063); check('sort decimals (comma) asc', m.getValue(), '1,25\n1,3\n1,5'.split('\n').sort((a,b)=>parseFloat(a.replace(',','.'))-parseFloat(b.replace(',','.'))).join('\n'));
  setText('a\nb\na\nb\nb'); await run(42079); check('remove duplicate lines', m.getValue(), 'a\nb');
  setText('a\na\nb\nb\na'); await run(42077); check('remove consecutive duplicates', m.getValue(), 'a\nb\na');
  setText('a\n\n  \nb'); await run(42055); check('remove empty lines', m.getValue(), 'a\n  \nb');
  setText('a\n\n  \nb'); await run(42056); check('remove empty lines (blank)', m.getValue(), 'a\nb');
  setText('a\nb\nc'); await run(42083); check('reverse lines', m.getValue(), 'c\nb\na');
  setText('hello wORLD foo'); await run(42067); check('proper case', m.getValue(), 'Hello World Foo');
  setText('hello wORLD'); await run(42071); check('invert case', m.getValue(), 'HELLO World');
  setText('first. second! third'); await run(42069); check('sentence case', m.getValue(), 'First. Second! Third');
  setText('  a \t\n b  '); await run(42043); check('trim leading+trailing', m.getValue(), 'a\nb');
  setText('a\tb'); await run(42046); check('tab to space', m.getValue(), 'a' + ' '.repeat(S.prefs.tabSize) + 'b');
  setText('a\nb\nc'); ed.setSelection(new NGN.monaco.Selection(1, 1, 3, 2)); await run(42013); check('join lines', m.getValue(), 'a b c');
  doc.lang = 'javascript.js'; setText('x = 1;\ny = 2;'); await run(42022); check('toggle comment (js) on', m.getValue(), '// x = 1;\n// y = 2;'); ed.setSelection(m.getFullModelRange()); await run(42022); check('toggle comment (js) off', m.getValue(), 'x = 1;\ny = 2;');
  doc.lang = 'python'; setText('a\nb'); await run(42022); check('toggle comment (python)', m.getValue(), '# a\n# b');
  doc.lang = 'html'; setText('<p>hi</p>'); await run(42022); check('toggle comment (html block)', m.getValue(), '<!-- <p>hi</p> -->');
  doc.lang = 'normal';
  setText('foo123bar'); check('regex replace with \\1', (NGN.replaceAllIn(doc, { what: '(\\d+)', mode: 'regex', matchCase: false, whole: false }, '<\\1>'), m.getValue()), 'foo<123>bar');
  setText('a\nb\nc'); NGN.replaceAllIn(doc, { what: '\\n', mode: 'extended', matchCase: false, whole: false }, ', '); check('extended-mode replace \\n', m.getValue(), 'a, b, c');
  setText('Cat cat concat'); NGN.replaceAllIn(doc, { what: 'cat', mode: 'normal', matchCase: false, whole: true }, 'dog'); check('whole word + ignore case', m.getValue(), 'dog dog concat');
  setText('Cat cat'); NGN.replaceAllIn(doc, { what: 'cat', mode: 'normal', matchCase: true, whole: false }, 'X'); check('match case', m.getValue(), 'Cat X');
  setText('a1\na2'); check('count matches', NGN.findAllIn(doc, { what: '^a', mode: 'regex', matchCase: false, whole: false }).hits.length, 2);
  setText('abc', false); ed.setPosition({ lineNumber: 1, column: 1 }); NGN.findNext(false, { what: 'b', mode: 'normal', matchCase: false, whole: false }); check('find next selects', m.getValueInRange(ed.getSelection()), 'b');
  check('sha256("abc")', await ngn.hash('abc', 'sha256'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  check('md5("abc")', await ngn.hash('abc', 'md5'), '900150983cd24fb0d6963f7d28e17f72');
  // multi-selection / column editor
  setText('a\nb\nc', false); ed.setSelection(new NGN.monaco.Selection(1, 1, 3, 1)); NGN.openColumnEditor(); await wait(50);
  document.querySelectorAll('.dlg input[type=radio]')[1].click(); const nums = document.querySelectorAll('.dlg input[type=number]'); nums[0].value = 9; nums[1].value = 1; document.querySelectorAll('.dlg select')[0].value = 'zeros';
  document.querySelectorAll('.dlg-foot button').forEach((b) => b.textContent === 'OK' && b.click()); await wait(50); check('column editor numbers', m.getValue(), '09a\n10b\n11c'); document.querySelectorAll('.dlg .x').forEach((x) => x.click());
  // EOL conversion
  setText('a\nb'); await run(45001); check('EOL -> CRLF', NGN.docEol(doc), 'CRLF'); check('CRLF text saved form', NGN.docText(doc), 'a\r\nb'); await run(45003); check('EOL -> CR', NGN.docText(doc), 'a\rb'); await run(45002); check('EOL -> LF', NGN.docText(doc), 'a\nb');
  // file IO across encodings
  const dir = S.paths.userData + '/selftest-' + Date.now(); const mk = async (name, text, enc) => { await ngn.file.write(dir + '/' + name, text, enc); };
  await ngn.run(`mkdir -p "${dir}"`);
  for (const [name, text, enc, wantEnc, wantEol] of [['u8.txt', 'héllo\n', 'utf8', 'utf8', 'LF'], ['u8b.txt', 'héllo\r\n', 'utf8-bom', 'utf8-bom', 'CRLF'], ['u16.txt', 'héllo ✓\n', 'utf16le-bom', 'utf16le-bom', 'LF'], ['u16b.txt', 'héllo\n', 'utf16be-bom', 'utf16be-bom', 'LF'], ['cr.txt', 'a\rb\rc', 'utf8', 'utf8', 'CR'], ['w1252.txt', 'caf\u00e9 \u201cq\u201d\n', 'ansi', null, 'LF']]) {
    await mk(name, text, enc); const d = await NGN.openPath(dir + '/' + name); const okEnc = wantEnc ? d.enc === wantEnc : /cs:|windows|iso/i.test(d.enc);
    check(`open ${name} enc`, okEnc, true); check(`open ${name} eol`, NGN.docEol(d), wantEol);
    check(`open ${name} text`, d.model.getValue().replace(/\r/g, '\n').replace(/\n+$/, ''), text.replace(/\r\n|\r/g, '\n').replace(/\n+$/, ''));
    d.model.pushEditOperations([], [{ range: new NGN.monaco.Range(1, 1, 1, 1), text: 'X' }], () => null); await NGN.saveDoc(d);
    const back = await ngn.file.read(dir + '/' + name); check(`save ${name} roundtrip`, back.text.replace(/\n+$/, ''), 'X' + text.replace(/\n+$/, '').replace(/\r\n/g, '\r\n'));
  }
  // find in files
  await mk('g1.txt', 'needle here\nno\nneedle again\n', 'utf8'); await mk('g2.log', 'needle\n', 'utf8'); await ngn.run(`mkdir -p "${dir}/sub" "${dir}/.hid"`); await mk('sub/g3.txt', 'a needle\n', 'utf8'); await mk('.hid/g4.txt', 'needle\n', 'utf8');
  let r = await ngn.findInFiles({ dir, filters: 'g*.txt', recursive: true, hidden: false, regex: 'needle', flags: 'gi' }); check('find in files (recursive, no hidden)', [r.files, r.hits], [2, 3]);
  r = await ngn.findInFiles({ dir, filters: '*.*', recursive: true, hidden: true, regex: 'needle', flags: 'gi' }); check('find in files (hidden folders)', r.hits, 5);
  r = await ngn.findInFiles({ dir, filters: '*.* !*.log', recursive: false, hidden: false, regex: 'needle', flags: 'gi' }); check('find in files exclude filter', r.files, 1);
  r = await ngn.findInFiles({ dir, filters: 'g1.txt', recursive: false, hidden: false, regex: 'needle', flags: 'gi', replaceWith: 'pin', apply: true }); check('replace in files', (await ngn.file.read(dir + '/g1.txt')).text, 'pin here\nno\npin again\n');
  // Data Tools plugin (JSON / YAML / Base64)
  { // fresh document so earlier file-IO tests (which switch the active document) cannot interfere
  const ddoc = NGN.createDoc({ text: '', name: 'dt.txt', activate: true }); await wait(50); const ed = curEd(); const m = ddoc.model;
  const setText = (t) => { m.setValue(t); ed.setSelection(m.getFullModelRange()); };
  const run = async (id) => { ed.focus(); await NGN.runCommand(id); await wait(20); };
  const dt = async (cmd) => run('plugin:Data Tools|' + cmd);
  setText('{"b":1,"a":{"d":1,"c":2}}'); await dt('Pretty print (4 spaces)'); check('data tools pretty 4', m.getValue(), '{\n    "b": 1,\n    "a": {\n        "d": 1,\n        "c": 2\n    }\n}');
  await dt('Minify JSON'); check('data tools minify', m.getValue(), '{"b":1,"a":{"d":1,"c":2}}');
  await dt('Sort keys (JSON)'); check('data tools sort json', m.getValue().replace(/\s+/g, ''), '{"a":{"c":2,"d":1},"b":1}');
  setText('{"a":"x"}'); await dt('Escape JSON'); check('data tools escape', m.getValue(), '{\\"a\\":\\"x\\"}'); await dt('Unescape JSON'); check('data tools unescape', m.getValue(), '{"a":"x"}');
  setText('{"name":"app","ports":[80,443]}'); await dt('JSON to YAML'); check('data tools json->yaml', m.getValue(), 'name: app\nports:\n  - 80\n  - 443\n');
  setText('b: 1\na:\n  d: 1\n  c: 2\n'); await dt('Sort keys (YAML)'); check('data tools sort yaml', m.getValue(), 'a:\n  c: 2\n  d: 1\nb: 1\n'); await dt('YAML to JSON'); check('data tools yaml->json', (() => { try { return JSON.parse(m.getValue()); } catch (e) { return m.getValue(); } })(), { a: { c: 2, d: 1 }, b: 1 });
  setText('héllo ✓'); await dt('Base64 Encode (UTF-8)'); check('data tools b64 encode', m.getValue(), 'aMOpbGxvIOKckw=='); await dt('Base64 Decode (UTF-8)'); check('data tools b64 decode', m.getValue(), 'héllo ✓');
  setText('{"a":'); await dt('Minify JSON'); check('data tools invalid json untouched', m.getValue(), '{"a":');
  setText('x'); await dt('Base64 Encode (UTF-8)'); ed.trigger('t', 'undo'); check('data tools undo', m.getValue(), 'x');
  }
  // function list
  const py = NGN.createDoc({ text: 'import os\n\ndef alpha(x):\n    pass\n\nclass K:\n    def beta(self):\n        pass\n', name: 'p.py', lang: 'python', activate: true }); const fl = await NGN.parseFunctions(py); check('function list (python)', fl.map((f) => f.name), ['alpha(x)', 'K', 'beta(self)']);
  // session serialisation
  const sess = await NGN.sessionData(); check('session has docs', sess.docs.length > 5, true);
  // large document sorting performance
  const big = Array.from({ length: 200000 }, (_, i) => 'line ' + ((i * 7919) % 200003)).join('\n'); setText(big); const t0 = performance.now(); await run(42059); check('sort 200k lines under 5s', performance.now() - t0 < 5000, true);
  const bad = res.filter((r) => !r[0]); console.log('SELFTEST2 checks', res.length, 'passed', res.length - bad.length, 'failed', bad.length); bad.forEach((b) => console.log('SELFTEST2 FAIL', b[1], b[2]));
}
