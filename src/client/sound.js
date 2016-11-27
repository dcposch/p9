module.exports = {
  play
}

var fs = require('fs')

// Cache <audio> elements for instant playback
var cache = {}

// Preload the cache
var names = fs.readdirSync('static/sounds')
names.forEach(function (name) {
  var audio = new window.Audio()
  audio.src = 'sounds/' + name
  cache[name] = audio
})

function play (name) {
  var audio = cache[name]
  if (!audio) throw new Error('Missing sound: ' + name)
  audio.currentTime = 0
  audio.play()
}
