var nextPow2 = require('../math/bit').nextPow2

// Scratch space
// Uses a buffer that resizes automatically
module.exports = {
  reset,
  writeUint8,
  writeInt32LE,
  writeUint8Array,
  slice
}

var buf = new Buffer(1 << 20)
var n = 0

function reset () {
  n = 0
}

function writeInt32LE (v) {
  resize(4)
  buf.writeInt32LE(v, n)
}

function writeUint8 (v) {
  resize(1)
  buf.writeUint8(v, n)
  n++
}

function writeUint8Array (arr, start, len) {
  if (start) {
    var arrayBuf = arr.buffer // get the underlying ArrayBuffer
    arr = new Uint8Array(arrayBuf.slice(start, len))
  }
  resize(arr.length)
  buf.set(arr, n)
}

function slice () {
  return buf.slice(0, n)
}

function resize (m) {
  if (n + m <= buf.length) return
  var newBuf = new Buffer(nextPow2(n + m))
  newBuf.set(buf.slice(0, n))
  buf = newBuf
}
