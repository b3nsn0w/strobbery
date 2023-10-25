const { app, BrowserWindow, screen, session, protocol, net, shell, dialog } = require('electron')
const path = require('path')

const updateMenu = require('./menu')
const { addCapture, retrieveCapture, captureExists } = require('./document')
const store = require('./store')

let mainWindow = null
const documentWindows = []

const createWindow = () => {
  const { workAreaSize, bounds } = screen.getPrimaryDisplay()

  const padding = 120
  const height = workAreaSize.height - padding * 2
  const width = Math.floor(height * (workAreaSize.width / workAreaSize.height))
  const x = workAreaSize.width / 2 - width / 2
  const y = bounds.y + padding

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    title: 'Strobbery v0.1 alpha',
    icon: './strobbery-icon-96.png'
  })

  return win
}

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') app.quit()
})

const openDocument = async (document) => {
  await session.defaultSession.clearStorageData()
  documentWindows.forEach((window) => window.destroy())
  mainWindow.webContents.clearHistory()

  if (mainWindow) mainWindow.loadURL(document ? document.entryPoint : path.join(__dirname, 'index.html'))
}

store.on('open', async (document) => {
  await openDocument(document)
})

const run = async () => {
  await app.whenReady()

  session.defaultSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
    const url = new URL(details.url)
    const origin = url.origin
    const document = store.document

    if (!document) return callback({ cancel: false }) // eslint-disable-line n/no-callback-literal

    let allow = false

    // capture mode allows any requests going to resource origins
    if (store.captureMode) {
      if (document.originGuard.resource.includes(origin)) allow = true
    }

    // network fallback allows extraneous requests depending on the fallback policy
    if (document.allowNetworkFallback) {
      if (document.networkFallbackMode === 'blacklist') { // blacklist mode allows any requests not going to blacklisted origins
        if (!document.originGuard.blacklisted.includes(origin)) allow = true
      } else if (document.networkFallbackMode === 'whitelist') { // whitelist mode only allows non-captured requests going to resource origins
        if (document.originGuard.resource.includes(origin)) allow = true
      }
    }

    // api hosts are always allowed
    if (document.apiHosts.includes(origin)) allow = true

    // origin blacklist overrides everything but existing captures
    if (document.originGuard.blacklisted.includes(origin)) allow = false

    // capture override, anything captured gets a pass
    if (await captureExists(document, details.url)) allow = true

    // devtools override
    if (url.protocol === 'devtools:') allow = true

    if (!allow) console.log('[request] blocked', details.url, `(${details.resourceType})`)

    callback({ cancel: !allow }) // eslint-disable-line n/no-callback-literal
  })

  const requestHandler = async (request) => {
    const document = store.document
    if (!document) return

    const captured = await retrieveCapture(document, request.url)
    if (captured) return captured

    const response = await net.fetch(request, { bypassCustomProtocolHandlers: true })

    // if we're in capture mode, add the response to the appropriate capture object
    let shouldCapture = store.captureMode || document.continuousCapture
    // but only if the request is going to a resource origin
    if (!document.originGuard.resource.includes(new URL(request.url).origin)) shouldCapture = false
    // do not capture api responses either (but do allow overrides, which is why this is after the capture check)
    if (document.apiHosts.includes(new URL(request.url).origin)) shouldCapture = false

    if (shouldCapture) {
      await addCapture(document, request.url, response, !store.captureMode)
    }

    return response
  }

  protocol.handle('http', requestHandler)
  protocol.handle('https', requestHandler)

  updateMenu()

  mainWindow = createWindow()

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const document = store.document
    if (!document) return

    const origin = new URL(url).origin

    if (!document.originGuard.navigable.includes(origin)) {
      event.preventDefault()
      console.log('[navigation] blocked', url)

      if (document.allowOutlinks) {
        shell.openExternal(url)
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const document = store.document
    if (!document) {
      console.log('[navigation] blocked', url)
      shell.openExternal(url)
      return { action: 'deny' }
    }

    const origin = new URL(url).origin

    if (!document.originGuard.navigable.includes(origin)) {
      console.log('[navigation] blocked', url)

      if (document.allowOutlinks) {
        shell.openExternal(url)
      }

      return { action: 'deny' }
    } else {
      return { action: 'allow' }
    }
  })

  mainWindow.webContents.on('did-create-window', (childWindow) => {
    documentWindows.push(childWindow)
    // todo attach all handlers to child windows
  })

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      title: 'Do you want to leave this site?',
      message: 'Changes you made may not be saved.',
      defaultId: 0,
      cancelId: 1
    })
    const leave = (choice === 0)
    if (leave) {
      event.preventDefault()
    }
  })

  const document = store.document
  openDocument(document)
}

run()
