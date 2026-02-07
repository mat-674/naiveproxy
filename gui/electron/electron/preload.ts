import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startProxy: (config: any) => ipcRenderer.invoke('start-proxy', config),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLog: (callback: (event: any, log: string) => void) => ipcRenderer.on('proxy-log', callback),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStatus: (callback: (event: any, status: string) => void) => ipcRenderer.on('proxy-status', callback),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDeepLink: (callback: (event: any, url: string) => void) => ipcRenderer.on('deep-link', callback),
});
