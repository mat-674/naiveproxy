"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startProxy: (config) => electron_1.ipcRenderer.invoke('start-proxy', config),
    stopProxy: () => electron_1.ipcRenderer.invoke('stop-proxy'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onLog: (callback) => electron_1.ipcRenderer.on('proxy-log', callback),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onStatus: (callback) => electron_1.ipcRenderer.on('proxy-status', callback),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDeepLink: (callback) => electron_1.ipcRenderer.on('deep-link', callback),
});
//# sourceMappingURL=preload.js.map