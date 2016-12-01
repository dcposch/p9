var nextPow2 = require('../math/bit').nextPow2

module.exports = Scratch

// Scratch space
// Uses a buffer that resizes automatically
function Scratch () {
  this.buf = new Buffer(1 << 20)
  this.n = 0
}

Scratch.prototype.reset = function () {
  this.n = 0
}

Scratch.prototype.writeInt32LE = function (v) {
  resize(this, 4)
  this.buf.writeInt32LE(v, this.n)
  this.n += 4
}

Scratch.prototype.writeUint8 = function (v) {
  resize(this, 1)
  this.buf.writeUint8(v, this.n)
  this.n++
}

Scratch.prototype.writeUint8Array = function (arr, start, len) {
  if (start) {
    var arrayBuf = arr.buffer // get the underlying ArrayBuffer
    arr = new Uint8Array(arrayBuf.slice(start, len))
  }
  resize(this, arr.length)
  this.buf.set(arr, this.n)
  this.n += len
}

Scratch.prototype.slice = function () {
  return this.buf.slice(0, this.n)
}

function resize (self, m) {
  var n = self.n
  if (n + m <= self.buf.length) return
  var newBuf = new Buffer(nextPow2(n + m))
  newBuf.set(self.buf.slice(0, n))
  self.buf = newBuf
}
