var Chunk = require('../chunk')

module.exports = {
  write: write,
  read: read
}

// Takes a FlexBuffer and an array of chunks
// Serializes the chunks into the FlexBuffer
function write (buf, chunks) {
  buf.writeInt32LE(chunks.length)
  chunks.forEach(function (chunk) {
    if (!chunk.packed) throw new Error('expected all chunks to be packed list-of-quads')
    buf.writeInt32LE(chunk.x)
    buf.writeInt32LE(chunk.y)
    buf.writeInt32LE(chunk.z)
    buf.writeInt32LE(chunk.length / 8) // num quads
    if (chunk.length === 0) return
    buf.writeUint8Array(chunk.data, 0, chunk.length)
  })
}

// Deserializes chunks from an ArrayBuffer
// Returns an array of chunks
function read (arrayBuffer) {
  var ints = new Int32Array(arrayBuffer)
  var numChunks = ints[0]
  var ret = new Array(numChunks)
  var offset = 1
  for (var i = 0; i < numChunks; i++) {
    var x = ints[offset]
    var y = ints[offset + 1]
    var z = ints[offset + 2]
    var numQuads = ints[offset + 3]
    offset += 4
    var data = new Uint8Array(arrayBuffer.slice(offset * 4, offset * 4 + numQuads * 8))
    offset += numQuads * 2
    ret[i] = new Chunk(x, y, z, data, true)
  }
  return ret
}
