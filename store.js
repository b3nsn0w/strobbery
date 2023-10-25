const { EventEmitter } = require('events')

class DocumentStore extends EventEmitter {
  constructor () {
    super()

    this._document = null
    this._documentLocation = null
    this._captureMode = false
    this._continuousCapture = false
    this._allowOutlinks = true
    this._allowNetworkFallback = false
    this._allowApiHosts = true
  }

  get document () {
    return this._document
  }

  set document (document) {
    this._document = document
    if (!document) this.documentLocation = null

    this._captureMode = false
    this._continuousCapture = document?.continuousCapture ?? false
    this._allowOutlinks = document?.allowOutlinks ?? true
    this._allowNetworkFallback = document?.allowNetworkFallback ?? false
    this._allowApiHosts = document?.allowApiHosts ?? true

    this.emit('open', document)
  }

  get documentLocation () {
    return this._documentLocation
  }

  set documentLocation (documentLocation) {
    this._documentLocation = documentLocation
    this.emit('location', documentLocation)
  }

  get captureMode () {
    return this._captureMode
  }

  set captureMode (captureMode) {
    this._captureMode = captureMode
    this.emit('capture', captureMode)
  }

  get continuousCapture () {
    return this._continuousCapture
  }

  set continuousCapture (continuousCapture) {
    this._continuousCapture = continuousCapture
    if (this.document) this.document.continuousCapture = continuousCapture
    this.emit('continuous-capture', continuousCapture)
  }

  get allowOutlinks () {
    return this._allowOutlinks
  }

  set allowOutlinks (allowOutlinks) {
    this._allowOutlinks = allowOutlinks
    if (this.document) this.document.allowOutlinks = allowOutlinks
    this.emit('allow-outlinks', allowOutlinks)
  }

  get allowNetworkFallback () {
    return this._allowNetworkFallback
  }

  set allowNetworkFallback (allowNetworkFallback) {
    this._allowNetworkFallback = allowNetworkFallback
    if (this.document) this.document.allowNetworkFallback = allowNetworkFallback
    this.emit('allow-network-fallback', allowNetworkFallback)
  }

  get allowApiHosts () {
    return this._allowApiHosts
  }

  set allowApiHosts (allowApiHosts) {
    this._allowApiHosts = allowApiHosts
    if (this.document) this.document.allowApiHosts = allowApiHosts
    this.emit('allow-api-hosts', allowApiHosts)
  }
}

const store = new DocumentStore()

module.exports = store
