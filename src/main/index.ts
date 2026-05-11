import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DatabaseService } from './services/database'
import { ConfigService } from './services/config'
import { GitService } from './services/git'
import { RemoteGitService } from './services/remote-git'
import { ReviewEngine } from './services/review-engine'
import { StaticAnalyzer } from './services/static-analyzer'
import { BridgeTypeChecker } from './services/bridge-checker'
import { ContextBuilder } from './services/context-builder'
import { KnowledgeService } from './services/knowledge/knowledge-service'
import { registerIpcHandlers } from './ipc-handlers'

let db: DatabaseService
let config: ConfigService
let git: GitService
let remoteGit: RemoteGitService
let staticAnalyzer: StaticAnalyzer
let bridgeChecker: BridgeTypeChecker
let contextBuilder: ContextBuilder
let reviewEngine: ReviewEngine
let knowledgeService: KnowledgeService

function createWindow(): void {
  const iconPath = join(__dirname, '../../build/icon.png')
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Code Reviewer',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Set macOS Dock icon in dev mode
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath))
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Code Reviewer')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.code-reviewer')

  // Initialize services
  db = new DatabaseService()
  config = new ConfigService()
  git = new GitService()
  remoteGit = new RemoteGitService()
  staticAnalyzer = new StaticAnalyzer()
  bridgeChecker = new BridgeTypeChecker()
  contextBuilder = new ContextBuilder()
  reviewEngine = new ReviewEngine(git, db, config, staticAnalyzer, bridgeChecker, contextBuilder)
  knowledgeService = new KnowledgeService(db, app.getAppPath())

  // Register IPC handlers
  registerIpcHandlers(db, config, git, reviewEngine, contextBuilder, knowledgeService, remoteGit)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db?.close()
    app.quit()
  }
})
