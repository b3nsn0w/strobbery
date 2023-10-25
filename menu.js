const { Menu, app, dialog, BrowserWindow, shell } = require('electron')
const store = require('./store')
const { saveArchive, loadArchive, createDocument } = require('./document')
const fs = require('fs/promises')
const packageJson = require('./package.json')

const createMenu = () => Menu.buildFromTemplate([{
  label: 'File',
  submenu: [
    {
      label: 'New Capture',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: async () => {
        const result = await dialog.showOpenDialog({
          title: 'Open Descriptor File',
          filters: [
            { name: 'Strobbery YAML Descriptor', extensions: ['yaml'] }
          ]
        })

        if (result.canceled) return

        const yamlFile = await fs.readFile(result.filePaths[0], 'utf-8')
        store.document = createDocument(yamlFile)
        store.captureMode = true
      }
    },
    { type: 'separator' },
    {
      label: 'Open',
      accelerator: 'CmdOrCtrl+Shift+O',
      click: async () => {
        const result = await dialog.showOpenDialog({
          title: 'Open Archive',
          filters: [
            { name: 'Strobbery Archive', extensions: ['strobbery'] }
          ]
        })

        if (result.canceled) return

        const buffer = await fs.readFile(result.filePaths[0])
        const document = await loadArchive(buffer)
        store.document = document
        store.documentLocation = result.filePaths[0]

        console.log('[menu] opened archive')
      }
    },
    {
      label: 'Save As',
      accelerator: 'CmdOrCtrl+Shift+S',
      enabled: store.document !== null,
      click: async () => {
        const document = store.document
        if (!document) return

        const result = await dialog.showSaveDialog({
          title: 'Save Capture',
          defaultPath: `${new URL(document.entryPointUrl).hostname}.strobbery`,
          filters: [
            { name: 'Strobbery Archive', extensions: ['strobbery'] }
          ]
        })

        if (result.canceled) return

        const buffer = await saveArchive(document)
        await fs.writeFile(result.filePath, buffer)
        store.documentLocation = result.filePath

        console.log('[menu] saved archive')
      }
    },
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+Shift+W',
      enabled: store.document !== null,
      click: () => {
        store.document = null
      }
    },
    { type: 'separator' },
    {
      label: 'Edit Descriptor',
      accelerator: 'CmdOrCtrl+Shift+E',
      // enabled: store.document !== null
      enabled: false // todo
    },
    {
      label: 'Import Files',
      accelerator: 'CmdOrCtrl+Shift+I',
      // enabled: store.document !== null
      enabled: false // todo
    },
    {
      label: 'Open Archive',
      accelerator: 'CmdOrCtrl+Shift+A',
      enabled: store.documentLocation !== null,
      click: () => {
        const document = store.document
        if (!document) return

        shell.openPath(store.documentLocation) // todo replace with the default zip handler once we get windows registry support
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Shift+Q',
      click: () => app.quit()
    }
  ]
}, {
  label: 'Runtime',
  submenu: [
    {
      label: 'Back',
      accelerator: 'Alt+Left',
      enabled: store.document !== null,
      click: () => {
        const window = BrowserWindow.getFocusedWindow()
        window.webContents.goBack()
      }
    },
    {
      label: 'Forward',
      accelerator: 'Alt+Right',
      enabled: store.document !== null,
      click: () => {
        const window = BrowserWindow.getFocusedWindow()
        window.webContents.goForward()
      }
    },
    { type: 'separator' },
    {
      label: 'Capture Mode',
      accelerator: 'CmdOrCtrl+Shift+M',
      checked: store.captureMode,
      enabled: store.document !== null,
      type: 'checkbox',
      click: () => {
        store.captureMode = !store.captureMode
      }
    },
    { type: 'separator' },
    {
      label: 'Refresh Site (Keep Settings)',
      accelerator: 'CmdOrCtrl+R',
      enabled: store.document !== null,
      click: () => {
        store.emit('open', store.document)
      }
    },
    {
      label: 'Reload From Disk (Clear Settings)',
      accelerator: 'CmdOrCtrl+Shift+R',
      enabled: store.documentLocation !== null,
      click: async () => {
        const documentLocation = store.documentLocation

        const buffer = await fs.readFile(documentLocation)
        const document = await loadArchive(buffer)
        store.document = document
        store.documentLocation = documentLocation
      }
    },
    { type: 'separator' },
    {
      label: 'Allow Outgoing Links',
      accelerator: 'CmdOrCtrl+Shift+L',
      checked: store.allowOutlinks,
      enabled: store.document !== null,
      type: 'checkbox',
      click: () => {
        store.allowOutlinks = !store.allowOutlinks
      }
    },
    {
      label: 'Allow Network Fallback',
      accelerator: 'CmdOrCtrl+Shift+F',
      checked: store.allowNetworkFallback,
      enabled: store.document !== null,
      type: 'checkbox',
      click: () => {
        store.allowNetworkFallback = !store.allowNetworkFallback
      }
    },
    {
      label: 'Continuous Capture',
      accelerator: 'CmdOrCtrl+Shift+C',
      checked: false,
      enabled: store.document !== null,
      type: 'checkbox',
      click: () => {
        store.continuousCapture = !store.continuousCapture
      }
    },
    {
      label: 'Clear Continuous Capture',
      accelerator: 'CmdOrCtrl+Shift+X',
      enabled: store.document !== null,
      click: () => {
        store.document.continuousCaptureData = {}
      }
    },
    {
      label: 'View Statistics',
      accelerator: 'CmdOrCtrl+Shift+V',
      enabled: false // todo
    },
    { type: 'separator' },
    {
      label: 'Allow API Hosts',
      accelerator: 'CmdOrCtrl+Shift+P',
      enabled: store.document !== null,
      checked: store.allowApiHosts,
      type: 'checkbox',
      click: () => {
        store.allowApiHosts = !store.allowApiHosts
      }
    },
    {
      label: 'Edit API Hosts',
      accelerator: 'CmdOrCtrl+Shift+H',
      enabled: false // todo
    },
    { type: 'separator' },
    {
      label: 'Toggle Developer Tools',
      accelerator: 'F12',
      click: () => {
        const window = BrowserWindow.getFocusedWindow()
        window.webContents.toggleDevTools()
      }
    },
    {
      label: 'Edit Injections',
      accelerator: 'CmdOrCtrl+Shift+J',
      enabled: false // todo
    }
  ]
}, {
  label: 'Help',
  submenu: [
    {
      label: 'About',
      accelerator: 'CmdOrCtrl+Shift+U',
      click: () => {
        shell.openExternal(packageJson.homepage)
      }
    },
    {
      label: 'Documentation',
      accelerator: 'CmdOrCtrl+Shift+D',
      enabled: false // todo
    },
    {
      label: 'Report a Bug',
      accelerator: 'CmdOrCtrl+Shift+B',
      click: () => {
        shell.openExternal(packageJson.bugs.url)
      }
    }
  ]
}])

const updateMenu = () => {
  const menu = createMenu()
  Menu.setApplicationMenu(menu)
}

store.on('open', updateMenu)
store.on('location', updateMenu)
store.on('capture', updateMenu)
store.on('continuous-capture', updateMenu)
store.on('allow-outlinks', updateMenu)
store.on('allow-network-fallback', updateMenu)

module.exports = updateMenu
