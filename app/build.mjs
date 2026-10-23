import * as esbuild from 'esbuild';
const M = 'node_modules/monaco-editor/esm/vs';
const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
  entryPoints: {
    renderer: 'src/renderer.js',
    'editor.worker': `${M}/editor/editor.worker.js`,
    'json.worker': `${M}/language/json/json.worker.js`,
    'css.worker': `${M}/language/css/css.worker.js`,
    'html.worker': `${M}/language/html/html.worker.js`,
    'datatools.worker': 'src/datatools.worker.js',
    'ts.worker': `${M}/language/typescript/ts.worker.js`,
  },
  bundle: true, format: 'iife', outdir: 'dist', minify: false, sourcemap: false,
  loader: { '.ttf': 'file' }, logLevel: 'info',
});
if (watch) await ctx.watch(); else { await ctx.rebuild(); await ctx.dispose(); }
