var env = require('./env')
var config = require('../config')

module.exports = {
  load: load,
  loadAll: loadAll,
  loaded: {}
}

// Loads all built-in textures, then calls back
function loadAll (cb) {
  var tex = {}
  tex.atlas = load('textures/atlas-p9.png')
  tex.skinHerobrine = load('textures/skin-herobrine.png')
  tex.skinSkeletor = load('textures/skindex-skeletor.png')
  tex.skinOcean = load('textures/skindex-ocean-dusk.png')
  tex.skinPurple = load('textures/skindex-purple-dragongirl.png')
  tex.skinGamer = load('textures/skindex-gamer-boy.png')
  tex.hud = load('textures/hud.png')

  var keys = Object.keys(tex)
  var promises = keys.map(function (key) { return tex[key] })
  var loaded = module.exports.loaded

  Promise.all(promises)
    .then(function (textures) {
      keys.forEach(function (key, i) { loaded[key] = textures[i] })
      cb()
    })
    .catch(function (err) {
      cb(err)
    })
}

// Returns a Promise that resolves to a REGL texture object
function load (url) {
  var aniso = Math.min(env.regl.limits.maxAnisotropic, config.GRAPHICS.MAX_ANISOTROPIC)

  return new Promise(function (resolve, reject) {
    var image = new window.Image()
    image.src = url
    image.onload = function () {
      console.log('Loaded ' + url)
      var tex = env.regl.texture({
        min: 'nearest',
        aniso: aniso,
        mag: 'nearest',
        data: image
      })
      resolve(tex)
    }
    image.onerror = function () {
      console.log('Failed to load ' + url)
      reject()
    }
  })
}
