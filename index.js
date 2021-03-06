
var util = require('util')
var Q = require('q')
var typeforce = require('typeforce')
var Offline = require('@tradle/offline-keeper')
var Client = require('@tradle/bitkeeper-client')

util.inherits(Keeper, Offline)
module.exports = Keeper

function Keeper (options) {
  var self = this

  typeforce({
    fallbacks: typeforce.maybe(typeforce.arrayOf('String')),
    storeOnFetch: '?Boolean'
  }, options)

  Offline.call(this, options)

  if (!options.fallbacks) return

  this._storeOnFetch = options.storeOnFetch
  this._fallbacks = options.fallbacks.map(function (url) {
    return new Client(url)
  })

  var getOne = this.getOne
  this.getOne = function (key) {
    return getOne.apply(this, arguments)
      .catch(function (err) {
        return self._fetch(key)
      })
  }

  var putOne = this.putOne
  this.put =
  this.putOne = function (options) {
    return putOne.apply(this, arguments)
      .then(function () {
        if (options.push) {
          return self.push(options)
        }
      })
  }
}

// Keeper.prototype.publish = function (key, value) {
//   return this._normalizeKeyValue(key, value)
//     .then(function (obj) {
//       return Q.allSettled(self._fallbacks.map(function (client) {
//         return client.put(obj.key, obj.value)
//       }))
//     })
// }

Keeper.prototype.push = function (options) {
  var self = this
  return this._normalizeOptions(options)
    .then(function (options) {
      return Q.allSettled(self._fallbacks.map(function (c) {
        return c.put(options.key, options.value)
      }))
    })
}

Keeper.prototype._fetch = function (key) {
  var self = this
  var i = 0

  return tryNext()

  function tryNext () {
    if (i === self._fallbacks.length) {
      return Q.reject(new Error('not found'))
    }

    return self._fallbacks[i++]
      .getOne(key)
      .then(putAndReturn)
      .catch(tryNext)
  }

  function putAndReturn (val) {
    if (self._storeOnFetch) {
      self.putOne(key, val)
    }

    return val
  }
}
