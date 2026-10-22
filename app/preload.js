'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch, fn) => { const h = (_e, ...a) => fn(...a); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('ngn', {
  pathFor: (file) => webUtils.getPathForFile(file),
  cfg: { get: inv('cfg:get'), set: inv('cfg:set') },
  session: { get: inv('session:get'), set: inv('session:set'), readFile: inv('file:readSessionFile') },
  app: { paths: inv('app:paths'), systemDark: inv('app:systemDark') },
  file: {
    read: inv('file:read'), write: inv('file:write'), exists: inv('file:exists'), stat: inv('file:stat'), rename: inv('file:rename'),
    trash: inv('file:trash'), setReadOnly: inv('file:setReadOnly'), reveal: inv('file:reveal'), openDefault: inv('file:openDefault'),
    openUrl: inv('file:openExternalUrl'), openIn: inv('file:openIn'), terminalAt: inv('file:terminalAt'), newInstance: inv('file:newInstance'),
    listDir: inv('file:listDir'), writeBackup: inv('file:writeBackup'), readBackup: inv('file:readBackup'), deleteBackup: inv('file:deleteBackup'),
    readData: inv('file:readData'), listData: inv('file:listData'), hashFile: inv('file:hashBuffer'),
  },
  hash: inv('hash:text'),
  watch: { add: inv('watch:add'), remove: inv('watch:remove') },
  dlg: { open: inv('dlg:open'), save: inv('dlg:save'), message: inv('dlg:message') },
  win: {
    alwaysOnTop: inv('win:alwaysOnTop'), fullScreen: inv('win:fullScreen'), isFullScreen: inv('win:isFullScreen'), title: inv('win:title'),
    edited: inv('win:edited'), represented: inv('win:represented'), close: inv('win:close'), quit: inv('win:quit'),
    setMenuVisible: inv('win:setMenuVisible'), setMenuState: inv('win:setMenuState'), setRecent: inv('win:setRecent'),
    setDynamicMenu: inv('win:setDynamicMenu'), print: inv('win:print'), printPDF: inv('win:printPDF'),
  },
  clip: { writeHTMLRTF: inv('clip:writeHTMLRTF'), readHTML: inv('clip:readHTML'), readRTF: inv('clip:readRTF'), writeText: inv('clip:writeText'), readText: inv('clip:readText'), readBinary: inv('clip:readBase64'), writeBinary: inv('clip:writeBuffer') },
  run: inv('run:cmd'),
  menu: { rebuild: inv('menu:rebuild') },
  findInFiles: inv('find:inFiles'),
  demo: { capture: inv('demo:capture'), env: inv('demo:env'), keys: inv('demo:keys') },
  on: {
    cmd: (fn) => on('cmd', fn), openPaths: (fn) => on('open-paths', fn), fileChanged: (fn) => on('file-changed', fn),
    requestClose: (fn) => on('request-close', fn), systemTheme: (fn) => on('system-theme', fn),
  },
});
