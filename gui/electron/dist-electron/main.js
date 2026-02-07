"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
let mainWindow = null;
let naiveProcess = null;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    // Handle links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
};
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // Register protocol client for deep linking (naiveproxy://)
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            electron_1.app.setAsDefaultProtocolClient('naiveproxy', process.execPath, [path_1.default.resolve(process.argv[1])]);
        }
    }
    else {
        electron_1.app.setAsDefaultProtocolClient('naiveproxy');
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Deep linking handler (macOS)
electron_1.app.on('open-url', (event, url) => {
    event.preventDefault();
    // Handle the deep link URL here (e.g., send to renderer)
    if (mainWindow) {
        mainWindow.webContents.send('deep-link', url);
    }
});
// Deep linking handler (Windows/Linux) - usually passed as argv
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (event, commandLine) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
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
electron_1.ipcMain.handle('start-proxy', async (event, config) => {
    if (naiveProcess) {
        return false; // Already running
    }
    try {
        const configPath = path_1.default.join(os_1.default.tmpdir(), `naive-config-${Date.now()}.json`);
        fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
        let execPath = '';
        let args = [configPath];
        if (electron_1.app.isPackaged) {
            // Production path (relative to resources/bin)
            execPath = path_1.default.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'naive.exe' : 'naive');
        }
        else {
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
            const potentialAbsPath = path_1.default.resolve(__dirname, '../../../src/out/Release/naive.exe');
            if (fs_1.default.existsSync(potentialAbsPath) && process.platform === 'win32') {
                execPath = potentialAbsPath;
            }
            else {
                // Mock using node
                execPath = 'node';
                // mock_naive.js is in gui/electron/mock_naive.js
                // __dirname is gui/electron/dist-electron/
                // So ../mock_naive.js
                args = [path_1.default.resolve(__dirname, '../mock_naive.js'), configPath];
            }
        }
        console.log(`Spawning: ${execPath} ${args.join(' ')}`);
        const env = { ...process.env };
        // Ensure binary execution permission on Linux/Mac if needed
        // if (process.platform !== 'win32' && execPath !== 'node') fs.chmodSync(execPath, '755');
        naiveProcess = (0, child_process_1.spawn)(execPath, args, { env });
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
            try {
                fs_1.default.unlinkSync(configPath);
            }
            catch { /* ignore */ }
        });
        mainWindow?.webContents.send('proxy-status', 'Running');
        return true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }
    catch (err) {
        console.error('Failed to start proxy:', err);
        mainWindow?.webContents.send('proxy-log', `Error starting proxy: ${err.message}`);
        return false;
    }
});
electron_1.ipcMain.handle('stop-proxy', async () => {
    if (naiveProcess) {
        naiveProcess.kill(); // SIGTERM
        // On Windows, tree kill might be needed if naive spawns children, but usually naive is single process.
        naiveProcess = null;
        mainWindow?.webContents.send('proxy-status', 'Stopped');
    }
    return true;
});
//# sourceMappingURL=main.js.map