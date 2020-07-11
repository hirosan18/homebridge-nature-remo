const nock = require('nock')
const config = require('./config.test.json')

const homebridgeMock = {
  version: 'mock',
  hap: {
    Service: {
      Switch: function (name) {
        this.getCharacteristic = jest.fn().mockImplementation(function () {
          const ret = {
            on: jest.fn().mockImplementation(() => ret),
            updateValue: jest.fn()
          }
          return ret
        })
      },
      AccessoryInformation: function () {
        this.setCharacteristic = jest.fn().mockReturnValue(this)
      }
    },
    Characteristic: jest.fn()
  },
  registerAccessory: jest.fn()
}

describe('NatureRemo', function () {
  it('登録の確認', function () {
    const init = require('../index.js')
    let data

    homebridgeMock.registerAccessory.mockImplementationOnce(function (pluginName, platformName, constructor, dynamic) {
      data = {pluginName, platformName, constructor, dynamic}
    })
    init(homebridgeMock)

    expect(data.pluginName).toBe('homebridge-nature-remo')
    expect(data.platformName).toBe('remo')
    expect(data.constructor.name).toBe('NatureRemo')
    expect(data.dynamic).toBe(true)
  })
  describe('NatureRemoクラス', function () {
    afterAll(function () {
      nock.cleanAll()
    })
    const _create = (conf = {}) => {
      const init = require('../index.js')
      let data
      homebridgeMock.registerAccessory.mockImplementationOnce(function (pluginName, platformName, constructor, dynamic) {
        data = {pluginName, platformName, constructor, dynamic}
      })
      init(homebridgeMock)

      const log = jest.fn()
      return new data.constructor(log, conf)
    }
    it('コンストラクタ 設定あり', function () {
      const natureRemo = _create(config.accessories[0])

      expect(natureRemo.config).toBe(config.accessories[0])
      expect(natureRemo.name).toBe('Blu-ray')
      expect(natureRemo.host).toBe('Remo-XXXX.local')
      expect(natureRemo.timeout).toBe(2000)
      expect(natureRemo.interval).toBe(100)
      expect(Object.keys(natureRemo.command).length).toBe(3)
      expect(natureRemo.retry).toBe(4)
      expect(natureRemo.retryInterval).toBe(500)
      expect(natureRemo.on).toHaveLength(2)
      expect(natureRemo.off).toHaveLength(2)
      expect(natureRemo.switchService).toBeDefined()
      expect(natureRemo.informationService).toBeDefined()
      expect(natureRemo.queue.constructor.name).toBe('TimerQueue')
    })
    it('コンストラクタ 設定なし', function () {
      const natureRemo = _create()

      expect(natureRemo.config).toEqual({})
      expect(natureRemo.name).not.toBeDefined()
      expect(natureRemo.host).not.toBeDefined()
      expect(natureRemo.timeout).toBe(0)
      expect(natureRemo.retry).toBe(2)
      expect(natureRemo.interval).toBe(1000)
      expect(natureRemo.command).toEqual({})
      expect(natureRemo.retryInterval).toBe(500)
      expect(natureRemo.on).toEqual([])
      expect(natureRemo.off).toEqual([])
      expect(natureRemo.switchService).toBeDefined()
      expect(natureRemo.informationService).toBeDefined()
      expect(natureRemo.queue.constructor.name).toBe('TimerQueue')
    })
    it('getServices', function () {
      const natureRemo = _create()

      const services = natureRemo.getServices()
      expect(services).toContain(natureRemo.switchService)
      expect(services).toContain(natureRemo.informationService)
    })
    it('getState', function (done) {
      const natureRemo = _create()

      natureRemo.getState((e, value) => {
        expect(value).toBe(false)
        done()
      })
    })
    it('update 引数あり', function (done) {
      const natureRemo = _create()
      natureRemo.update(true)

      natureRemo.getState((e, value) => {
        expect(value).toBe(true)
        done()
      })
    })
    it('update 引数なし', function (done) {
      const natureRemo = _create()
      natureRemo.update()

      natureRemo.getState((e, value) => {
        expect(value).toBe(false)
        done()
      })
    })
    it('request データなし', function (done) {
      nock(`http://${config.accessories[1].host}`).filteringRequestBody(/.*/, '*').post('/messages', '*').reply(200, {})
      const natureRemo = _create(config.accessories[1])
      natureRemo.update()

      natureRemo.request().then(() => {
        done()
      })
    })
    it('request データあり', function (done) {
      nock(`http://${config.accessories[0].host}`).filteringRequestBody(/.*/, '*').post('/messages', '*').reply(200, {})

      const natureRemo = _create(config.accessories[0])
      natureRemo.update()

      natureRemo.request(config.accessories[0].command.on).then(() => {
        done()
      })
    })
    it('request コネクションタイムアウト', function (done) {
      nock(`http://${config.accessories[0].host}`).filteringRequestBody(/.*/, '*').post('/messages', '*').delayConnection(4000).reply(200, {})

      const natureRemo = _create(config.accessories[0])
      natureRemo.update()

      natureRemo.request(config.accessories[0].command.on).catch(() => {
        done()
      })
    })
    it('request 読み込みタイムアウト', function (done) {
      nock(`http://${config.accessories[0].host}`).filteringRequestBody(/.*/, '*').post('/messages', '*').reply(4000, {})

      const natureRemo = _create(config.accessories[0])
      natureRemo.update()

      natureRemo.request(config.accessories[0].command.on).catch(() => {
        done()
      })
    })
    it('request エラー', function (done) {
      nock(`http://${config.accessories[0].host}`).filteringRequestBody(/.*/, '*').post('/messages', '*').reply(500, {})

      const natureRemo = _create(config.accessories[0])
      natureRemo.update()

      natureRemo.request(config.accessories[0].command.on).catch(() => {
        done()
      })
    })
    it('setState on', function (done) {
      jest.setTimeout(10000)
      const natureRemo = _create(config.accessories[0])
      natureRemo.request = jest.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 0)
      }))
      natureRemo.update = jest.fn()
      const callback = jest.fn()

      natureRemo.setState(true, callback)
      natureRemo.queue.on('end', () => {
        expect(callback).toHaveBeenCalledTimes(1)
        expect(natureRemo.update).toHaveBeenCalledTimes(2)
        done()
      })
    })
    it('setState off', function (done) {
      jest.setTimeout(10000)
      const natureRemo = _create(config.accessories[0])
      natureRemo.request = jest.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 0)
      }))
      natureRemo.update = jest.fn()
      const callback = jest.fn()

      natureRemo.setState(false, callback)
      natureRemo.queue.on('end', () => {
        expect(callback).toHaveBeenCalledTimes(1)
        expect(natureRemo.update).toHaveBeenCalledTimes(2)
        done()
      })
    })
    it('setState エラー', function (done) {
      jest.setTimeout(10000)
      const natureRemo = _create(config.accessories[0])
      natureRemo.request = jest.fn().mockImplementation(() => new Promise((resolve, reject) => {
        setTimeout(reject, 0)
      }))
      natureRemo.update = jest.fn()
      const callback = jest.fn()

      natureRemo.setState(true, callback)
      natureRemo.queue.on('end', () => {
        expect(callback).toHaveBeenCalled()
        expect(natureRemo.update).toHaveBeenCalledTimes(1)
        done()
      })
    })
    it('setState 並列処理', function (done) {
      jest.setTimeout(20000)
      const natureRemo1 = _create(config.accessories[0])
      const natureRemo2 = _create(config.accessories[1])
      natureRemo1.request = jest.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 100)
      }))
      natureRemo2.request = jest.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 100)
      }))
      natureRemo1.update = jest.fn()
      natureRemo2.update = jest.fn()
      const callback = jest.fn()

      natureRemo1.setState(true, callback)
      natureRemo2.setState(true, callback)
      const promise1 = new Promise(function (resolve) {
        natureRemo1.queue.on('end', resolve)
      })
      const promise2 = new Promise(function (resolve) {
        natureRemo2.queue.on('end', resolve)
      })
      Promise.all([promise1, promise2]).then(() => {
        expect(callback).toHaveBeenCalledTimes(2)
        expect(natureRemo1.update).toHaveBeenCalledTimes(2)
        expect(natureRemo2.update).toHaveBeenCalledTimes(2)
        done()
      })
    })
    it('setState 並列処理でエラー', function (done) {
      jest.setTimeout(20000)
      const natureRemo1 = _create(config.accessories[0])
      const natureRemo2 = _create(config.accessories[1])
      natureRemo1.request = jest.fn().mockImplementation(() => new Promise((resolve, reject) => {
        setTimeout(reject, 0)
      }))
      natureRemo2.request = jest.fn().mockImplementation(() => new Promise((resolve) => {
        setTimeout(resolve, 0)
      }))
      natureRemo1.update = jest.fn()
      natureRemo2.update = jest.fn()
      const callback = jest.fn()

      natureRemo1.setState(true, callback)
      natureRemo2.setState(true, callback)
      const promise1 = new Promise(function (resolve) {
        natureRemo1.queue.on('end', resolve)
      })
      const promise2 = new Promise(function (resolve) {
        natureRemo2.queue.on('end', resolve)
      })
      Promise.all([promise1, promise2]).then(() => {
        expect(callback).toHaveBeenCalledTimes(2)
        expect(natureRemo1.update).toHaveBeenCalledTimes(1)
        expect(natureRemo2.update).toHaveBeenCalledTimes(2)
        done()
      })
    })
  })
})
