// Runs the heavy Data Tools transforms off the UI thread so converting a multi-MB document doesn't freeze the editor.
import * as DT from './datatools.js';

self.onmessage = ({ data: { id, op, args = [], text } }) => {
  try { self.postMessage({ id, text: DT[op](text, ...args) }); } catch (e) { self.postMessage({ id, error: e.message }); }
};
