import { app, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { registerClientsHandlers } from './ipc/clients'
import { registerSettingsHandlers } from './ipc/settings'
import { registerBilansHandlers } from './ipc/bilans'
import { registerMesuresHandlers } from './ipc/mesures'
import { registerNotesHandlers } from './ipc/notes'
import { registerReportsHandlers } from './ipc/reports'
import { registerAIHandlers } from './ipc/ai'
import { registerTransferHandlers } from './ipc/transfer'
import { initDb } from '../db/client'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

const isDev = !app.isPackaged

autoUpdater.logger = log
log.transports.file.level = 'info'

function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
    win.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    win.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info.version)
    win.webContents.send('update:not-available')
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    win.webContents.send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err.message)
    win.webContents.send('update:error', { message: err.message })
  })

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
  }
}

ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('update:quit-and-install', () => autoUpdater.quitAndInstall())

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Kinésio Outils',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setupAutoUpdater(win)
}

app.whenReady().then(() => {
  const dbPath = join(app.getPath('userData'), 'kinesio.db')
  // En dev : out/main/ → ../.. → racine projet → db/migrations
  // En prod : les migrations sont copiées dans process.resourcesPath/migrations via extraResources
  const migrationsPath = isDev
    ? resolve(__dirname, '../../db/migrations')
    : join(process.resourcesPath, 'migrations')

  initDb(dbPath, migrationsPath)
  registerClientsHandlers()
  registerTransferHandlers()
  registerSettingsHandlers()
  registerBilansHandlers()
  registerMesuresHandlers()
  registerNotesHandlers()
  registerReportsHandlers()
  registerAIHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
