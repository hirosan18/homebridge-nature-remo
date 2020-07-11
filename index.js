const TimerQueue = require('timer-queue')
const request = require('request')
const sleep = require('sleep-promise')

let version
let Service
let Characteristic
let mainQueue
let statusList

module.exports = homebridge => {
  version = homebridge.version
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  mainQueue = new TimerQueue({ autoStart: true })
  statusList = {}

  homebridge.registerAccessory('homebridge-nature-remo', 'remo', NatureRemo, true)
}

class NatureRemo {
  constructor (log, config, api) {
    log('homebridge API version: ' + version)
    log('NatureRemo Init')
    this.log = log
    this.config = config
    this.name = config.name
    this.host = config.host
    const interval = this.interval = config.interval >= 0 ? config.interval : 1000
    const commandList = this.command = typeof config.command === 'object' && !Array.isArray(config.command) && config.command !== null ? config.command : {}
    this.timeout = config.timeout >= 0 ? config.timeout : 0
    this.retry = config.retry >= 0 ? config.retry : 2
    this.retryInterval = config.retryInterval || 500

    const convert = (command) => {
      let delay
      if (typeof command !== 'string') {
        delay = command.delay >= 0 ? command.delay : 0
        command = command.command
      }
      return { name: command, postData: commandList[command], delay }
    }
    this.on = (config.on || []).map(convert)
    this.off = (config.off || []).map(convert)

    this.switchService = new Service.Switch(config.name)
    this.informationService = new Service.AccessoryInformation()
    this.queue = new TimerQueue({
      interval,
      autoStart: true
    })
    statusList[this.name] = false
  }
  request (postData = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        uri: `http://${this.host}/messages`,
        headers: {
          'X-Requested-With': 'curl',
          'content-type': 'application/json'
        },
        body: JSON.stringify(postData)
      }
      if (this.timeout > 0) {
        options.timeout = this.timeout
      }

      this.log(`>> [request]`)
      request.post(options, (error, res, body) => {
        if (!error && res.statusCode === 200) {
          resolve(body)
        } else {
          this.log(JSON.stringify(res))
          reject(error || new Error(res.statusCode))
        }
      })
    })
  }
  getServices () {
    this.log(`start homebridge Server ${this.name}`)

    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Nature')
      .setCharacteristic(Characteristic.Model, 'Remo')
      .setCharacteristic(Characteristic.SerialNumber, '031-45-154')

    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setState.bind(this))
      .on('get', this.getState.bind(this))

    return [this.informationService, this.switchService]
  }
  setState (on, callback) {
    this.log(`[Setting] ${on}`)
    this.lastCommandTime = Date.now()
    this[on ? 'on' : 'off'].forEach((command) => {
      this.queue.push((done) => {
        sleep(command.delay - (Date.now() - this.lastCommandTime)).then(() => {
          mainQueue.push(() => {
            this.log(`> [Exec] "${command.name}"`)
            return new Promise((resolve, reject) => {
              this.request(command.postData).then(() => {
                this.log(`>> [Done] "${command.name}"`)
                this.update(on)
                this.lastCommandTime = Date.now()
                done()
                resolve()
              }).catch((e) => {
                this.log(`>> [Fail] "${command.name}"`)
                reject(e)
              })
            })
          }, {
            delay: this.interval,
            retry: this.retry,
            retryInterval: this.retryInterval,
            error: (e) => {
              this.log(`>> [Error] "${command.name}"`)
              this.update(e)
              this.queue.clear()
              done()
              setTimeout(() => {
                mainQueue.start()
              }, 0)
            }
          })
        })
      })
    })

    callback()
  }
  getState (callback) {
    const value = statusList[this.name] || false
    this.log(`<<< [Getting] ${value}`)
    return callback(null, value)
  }
  update (on) {
    if (typeof on === 'undefined') {
      on = statusList[this.name]
    }
    this.log(`>>> [Update] ${statusList[this.name]} => ${on}`)
    this.switchService.getCharacteristic(Characteristic.On).updateValue(on)
    statusList[this.name] = on
  }
}
