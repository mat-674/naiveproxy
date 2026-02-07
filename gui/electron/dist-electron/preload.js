"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    startProxy: (config) => electron_1.ipcRenderer.invoke('start-proxy', config),
    stopProxy: () => electron_1.ipcRenderer.invoke('stop-proxy'),
    onLog: (callback) => electron_1.ipcRenderer.on('proxy-log', callback),
    onStatus: (callback) => electron_1.ipcRenderer.on('proxy-status', callback),
    onDeepLink: (callback) => electron_1.ipcRenderer.on('deep-link', callback),
});
//# sourceMappingURL=preload.js.map