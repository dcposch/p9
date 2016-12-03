module.exports = {
  play
}

var fs = require('fs')

// Cache <audio> elements for instant playback
var cache = {}

// Preload any short sounds checked into the repo
var names = fs.readdirSync('static/sounds')
names.forEach(function (name) {
  var audio = new window.Audio()
  audio.src = 'sounds/' + name
  cache[name] = audio
})

// Takes a name (for short sounds) or a URL (for larger files, not in git)
// Optionally takes a time offset in seconds
function play (name, time) {
  var audio = cache[name]
  if (!audio) {
    if (!name.includes('/')) throw new Error('Missing sound: ' + name)
    audio = new window.Audio()
    audio.src = name
    cache[name] = audio
  }
  audio.currentTime = time || 0
  audio.play()
}
