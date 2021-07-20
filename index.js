'use strict'
const { DeviceDiscoveryManager } = require('ortho-remote')

// Device connection manager
const manager = DeviceDiscoveryManager.defaultManager

let Service, Characteristic

module.exports = (homebridge) => {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory(
    'homebridge-ortho-dimmer',
    'ORTHO-DIMMER',
    DimmerAccessory
  )
}

const debounce = (func, wait = 20) => {
  let timeout

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

class DimmerAccessory {
  constructor(log, config) {
    this.log = log
    this.config = config
    this.brightness = 0
    this.isOn = true
    this.service = new Service.Lightbulb(this.config.name)

    this.connect()
  }

  async connect() {
    this.log('Starting Ortho Remote discovery')

    // Create a new discovery session
    const session = manager.startDiscoverySession()

    this.log('Waiting for device...')

    // Convenience to wait the first discovered Ortho Remote
    const device = await session.waitForFirstDevice()

    this.log(`Found device '${device.id}'`)
    this.log('Connecting...')

    // Establish device connection
    if (await device.connect()) {
      this.log('Connected')

      device.on('click', () => {
        this.log('Clicked!')
        this.onClick()
      })

      const debouncedRotate = debounce(this.onRotate.bind(this))
      device.on('rotate', (rotation) => {
        debouncedRotate(rotation)
      })

      return
    }
  }

  onClick() {
    this.isOn = !this.isOn
    this.service.getCharacteristic(Characteristic.On).updateValue(this.isOn)
    this.log('Updated to', this.isOn)
  }

  onRotate(rotation) {
    const brightness = Math.round(rotation * 100)
    // this.log(brightness)
    if (brightness == this.brightness) return
    this.brightness = brightness
    this.service
      .getCharacteristic(Characteristic.Brightness)
      .updateValue(this.brightness)
    this.log('Updated brightness', this.brightness)
  }

  getServices() {
    const informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'Alex Louden')
      .setCharacteristic(Characteristic.Model, 'ortho-dimmer')
      .setCharacteristic(Characteristic.SerialNumber, '123')

    this.service
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOnCharacteristicHandler.bind(this))
      .on('get', this.getOnCharacteristicHandler.bind(this))

    this.service
      .getCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this))
    // .on('set', this.setBrightness.bind(this))

    return [informationService, this.service]
  }

  getBrightness(callback) {
    callback(null, this.brightness)
  }

  setBrightness(value, callback) {
    this.brightness = value
    // callback(null, value)
  }

  setOnCharacteristicHandler(value, callback) {
    this.isOn = value
    // callback(null)
  }

  getOnCharacteristicHandler(callback) {
    callback(null, this.isOn)
  }
}
