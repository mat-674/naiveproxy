import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let naiveProcess: ChildProcess | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Register protocol client for deep linking (naiveproxy://)
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('naiveproxy', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('naiveproxy');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Deep linking handler (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  // Handle the deep link URL here (e.g., send to renderer)
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// Deep linking handler (Windows/Linux) - usually passed as argv
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      // Handle the deep link URL from argv
      const url = commandLine.find((arg) => arg.startsWith('naiveproxy://'));
      if (url) {
          mainWindow.webContents.send('deep-link', url);
      }
    }
  });
}

// IPC Handlers
ipcMain.handle('start-proxy', async (event, config) => {
  if (naiveProcess) {
    return false; // Already running
  }

  try {
    const configPath = path.join(os.tmpdir(), `naive-config-${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    let execPath = '';
    let args = [configPath];

    if (app.isPackaged) {
      // Production path (relative to resources/bin)
      execPath = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'naive.exe' : 'naive');
    } else {
      // Development
      // Try to find the built binary from repo root
      // gui/electron/electron/main.ts -> gui/electron/ -> gui/ -> src/out/Release/naive.exe
      // The path would be: ../../../src/out/Release/naive.exe relative to main.ts location?
      // __dirname is gui/electron/dist-electron/ (when compiled) or gui/electron/electron/ (ts-node?)
      // We assume dist-electron/main.js is where it runs from.
      // So ../../../src/out/Release/naive.exe

      // repo/gui/electron/dist-electron/main.js
      // repo/src/out/Release/naive.exe
      // Relative: ../../../src/out/Release/naive.exe

      const potentialAbsPath = path.resolve(__dirname, '../../../src/out/Release/naive.exe');

      if (fs.existsSync(potentialAbsPath) && process.platform === 'win32') {
         execPath = potentialAbsPath;
      } else {
         // Mock using node
         execPath = 'node';
         // mock_naive.js is in gui/electron/mock_naive.js
         // __dirname is gui/electron/dist-electron/
         // So ../mock_naive.js
         args = [path.resolve(__dirname, '../mock_naive.js'), configPath];
      }
    }

    console.log(`Spawning: ${execPath} ${args.join(' ')}`);

    const env = { ...process.env };
    // Ensure binary execution permission on Linux/Mac if needed
    // if (process.platform !== 'win32' && execPath !== 'node') fs.chmodSync(execPath, '755');

    naiveProcess = spawn(execPath, args, { env });

    naiveProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        console.log(`[naive] ${str}`);
        mainWindow?.webContents.send('proxy-log', str);
    });

    naiveProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        console.error(`[naive err] ${str}`);
        mainWindow?.webContents.send('proxy-log', str);
    });

    naiveProcess.on('close', (code) => {
        console.log(`naive process exited with code ${code}`);
        mainWindow?.webContents.send('proxy-status', 'Stopped');
        naiveProcess = null;
        try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    });

    mainWindow?.webContents.send('proxy-status', 'Running');
    return true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Failed to start proxy:', err);
    mainWindow?.webContents.send('proxy-log', `Error starting proxy: ${err.message}`);
    return false;
  }
});

ipcMain.handle('stop-proxy', async () => {
    if (naiveProcess) {
        naiveProcess.kill(); // SIGTERM
        // On Windows, tree kill might be needed if naive spawns children, but usually naive is single process.
        naiveProcess = null;
        mainWindow?.webContents.send('proxy-status', 'Stopped');
    }
    return true;
});
