const JSZip = require('jszip')
const yaml = require('yaml')

// todo switch to typescript and create a document class

const createDocument = (configYaml) => {
  const config = yaml.parse(configYaml)

  if (!config.strobbery) throw new Error('File signature not found (file is likely not a strobbery descriptor)')
  if (String(config.strobbery).split('.')[0] !== '1') throw new Error('Invalid strobbery version')
  if (!config.entryPoint) throw new Error('Entry point not specified')

  const entryPoint = config.entryPoint
  const entryPointUrl = new URL(entryPoint)

  const originGuard = config.originGuard ?? {
    resource: [entryPointUrl.origin],
    navigable: [entryPointUrl.origin],
    blacklisted: []
  }
  const apiHosts = config.apiHosts ?? []

  const continuousCapture = config.continuousCapture ?? false
  const allowNetworkFallback = config.allowNetworkedFallback ?? false
  const networkFallbackMode = config.networkFallbackMode ?? 'blacklist'

  const allowOutlinks = config.allowOutlinks ?? false
  const allowApiHosts = config.allowApiHosts ?? true

  const capturedData = {}
  const continuousCaptureData = {}

  return {
    originGuard,
    apiHosts,
    continuousCapture,
    allowNetworkFallback,
    networkFallbackMode,
    allowOutlinks,
    allowApiHosts,
    capturedData,
    continuousCaptureData,
    entryPoint,
    entryPointUrl,
    configYaml
  }
}

const addCapture = async (document, url, response, continuousMode = false) => {
  const clone = await response.clone()
  const body = Buffer.from(await clone.arrayBuffer())
  const headers = Object.fromEntries([...clone.headers.entries()])

  const captureObject = {
    body,
    headers
  }

  if (continuousMode) {
    document.continuousCaptureData[url] = captureObject
  } else {
    document.capturedData[url] = captureObject
  }

  console.log('[document] added capture for', url)

  return captureObject
}

const retrieveCapture = async (document, url) => {
  const capture = document.capturedData[url] ?? document.continuousCaptureData[url]
  if (!capture) return null

  const headers = new Headers(capture.headers)
  const response = new Response(capture.body, { headers })

  return response
}

const captureExists = async (document, url) => {
  const capture = document.capturedData[url] ?? document.continuousCaptureData[url]
  return !!capture
}

const saveArchive = async (document) => {
  const zip = new JSZip()

  zip.file('strobbery.yaml', document.configYaml)

  const captures = [
    ...Object.entries(document.capturedData).map(([url, capture]) => [url, capture, 'captured']),
    ...Object.entries(document.continuousCaptureData).map(([url, capture]) => [url, capture, 'continuous'])
  ]

  for (const [url, capture, type] of captures) {
    const urlObject = new URL(url)
    const path = urlObject.hostname + (urlObject.pathname ?? '_index') + (urlObject.pathname.endsWith('/') ? '_index' : '')

    zip.file(`${type}/${path}`, capture.body)
    zip.file(`${type}/${path}.strb.yaml`, yaml.stringify({
      url,
      headers: capture.headers
    }))
  }

  return zip.generateAsync({ type: 'nodebuffer' })
}

const loadArchive = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer)

  const configYaml = await zip.file('strobbery.yaml').async('string')
  const document = createDocument(configYaml)

  const captures = [
    ...await Promise.all(zip.file(/captured\/.*/).map(async (file) => {
      if (file.name.endsWith('.strb.yaml')) return null
      const path = file.name.replace(/^captured\//, '')
      const body = await file.async('nodebuffer')
      const config = yaml.parse(await zip.file(`captured/${path}.strb.yaml`).async('string'))

      return [config.url, { body, headers: config.headers }, 'captured']
    })),
    ...await Promise.all(zip.file(/continuous\/.*/).map(async (file) => {
      if (file.name.endsWith('.strb.yaml')) return null
      const path = file.name.replace(/^continuous\//, '')
      const body = await file.async('nodebuffer')
      const config = yaml.parse(await zip.file(`continuous/${path}.strb.yaml`).async('string'))

      return [config.url, { body, headers: config.headers }, 'continuous']
    }))
  ].filter(Boolean)

  for (const [url, capture, type] of captures) {
    await addCapture(document, url, new Response(capture.body, { headers: capture.headers }), type === 'continuous')
  }

  return document
}

module.exports = {
  createDocument,
  addCapture,
  retrieveCapture,
  captureExists,
  saveArchive,
  loadArchive
}
