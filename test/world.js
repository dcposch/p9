var test = require('tape')
var World = require('../src/world')
var Chunk = require('../src/chunk')
var vox = require('../src/vox')

test('create a chunk', function (t) {
  var c = new Chunk()
  t.equal(c.data, null)
  t.equal(c.getVox(1, 2, 3), 0)
  t.equal(c.getVox(1, 2, 3), vox.INDEX.AIR)

  c.setVox(1, 2, 3, 250)
  t.notEqual(c.data, null)
  t.equal(c.mesh, null)
  t.ok(c.dirty)
  t.equal(c.getVox(1, 2, 3), 250)
  t.end()
})

test('create a chunk, coalesce', function (t) {
  var c = new Chunk()

  // Create 1x1x1
  c.setVox(10, 10, 10, 1)
  t.equal(c.length / 8, 1, '1x1x1')

  // Create 1x1x2
  c.setVox(10, 10, 11, 1)
  t.equal(c.length / 8, 1, '1x1x2')

  // Another block next to that
  c.setVox(10, 11, 11, 1)
  t.equal(c.length / 8, 2, '1x1x2 + 1')

  // Coalesce into a 1x2x2
  c.setVox(10, 11, 10, 1)
  t.equal(c.length / 8, 1, '1x2x2')

  // Coalesce into a 2x2x2
  c.setVox(11, 11, 10, 1)
  c.setVox(11, 10, 10, 1)
  c.setVox(11, 11, 11, 1)
  t.equal(c.length / 8, 3, '1x2x2 + 3')
  c.setVox(11, 10, 11, 1)
  t.equal(c.length / 8, 1, '2x2x2')

  // Coalesce into a 3x3x3
  c.setVox(10, 10, 12, 1)
  c.setVox(10, 11, 12, 1)
  c.setVox(10, 12, 10, 1)
  c.setVox(10, 12, 11, 1)
  c.setVox(10, 12, 12, 1)
  t.equal(c.length / 8, 3, '2x2x2 + some')
  t.equal(print(c), 'vox 1 2x2x2 at 10,10,10; vox 1 1x1x2 at 10,12,10; vox 1 1x3x1 at 10,10,12')

  c.setVox(11, 10, 12, 1)
  c.setVox(11, 11, 12, 1)
  c.setVox(11, 12, 10, 1)
  c.setVox(11, 12, 11, 1)
  c.setVox(11, 12, 12, 1)
  t.equal(c.length / 8, 1, '2x3x3')

  c.setVox(12, 10, 10, 1)
  c.setVox(12, 10, 11, 1)
  c.setVox(12, 10, 12, 1)
  c.setVox(12, 11, 10, 1)
  c.setVox(12, 11, 11, 1)
  c.setVox(12, 11, 12, 1)
  c.setVox(12, 12, 10, 1)
  c.setVox(12, 12, 11, 1)
  t.equal(c.length / 8, 3, 'almost 3x3x3')
  c.setVox(12, 12, 12, 1)
  t.equal(c.length / 8, 1, '3x3x3')

  // Finally, remove the middle vox in the 3x3x3, splitting it into 6 quads
  c.setVox(11, 11, 11, 0)
  t.equal(c.length / 8, 6, 'split')
  t.equal(print(c), [
    'vox 1 1x3x3 at 10,10,10',
    'vox 1 1x3x3 at 12,10,10',
    'vox 1 1x1x3 at 11,10,10',
    'vox 1 1x1x3 at 11,12,10',
    'vox 1 1x1x1 at 11,11,10',
    'vox 1 1x1x1 at 11,11,12'
  ].join('; '))

  t.end()
})

test('create a new world, get and set voxels', function (t) {
  var world = new World()
  world.setVox(100, 0, 0, 5) // Creates the 32x32x32 chunk containing (100, 0, 0)
  t.equal(world.chunks.length, 1)
  t.equal(world.getVox(100, 0, 0), 5, 'voxel in newly created chunk')
  t.equal(world.getVox(100, 0, 1), 0, 'air in newly created chunk')
  t.equal(world.getVox(100, 31, 31), 0, 'air in newly created chunk')
  t.equal(world.getVox(100, 32, 32), -1, 'off-world')
  t.end()
})

test('create a new world, fill it with hills', function (t) {
  var heightmap = []
  for (var i = 0; i < 100; i++) {
    for (var j = 0; j < 100; j++) {
      var cos = Math.cos(i * 0.1)
      var sin = Math.sin(j * 0.1)
      var height = (cos * cos + sin * sin) * 50
      heightmap.push({i: i, j: j, height: Math.floor(height)})
    }
  }

  var world = new World()
  heightmap.forEach(function (p) {
    for (var k = 0; k < p.height; k++) {
      world.setVox(p.i, p.j, k, p.height)
    }
  })
  t.equal(world.chunks.length, 56, 'should fill chunks sparsely')

  var actual = new Buffer(heightmap.length * 60)
  var expected = new Buffer(heightmap.length * 60)
  i = 0
  heightmap.forEach(function (p) {
    for (var k = -5; k < 55; k++) {
      var v = world.getVox(p.i, p.j, k)
      actual[i] = v === -1 ? 0 : v
      expected[i] = k >= 0 && k < p.height ? p.height : 0
      i++
    }
  })
  t.equal(Buffer.compare(actual, expected), 0, 'all voxels should match')
  t.end()
})

function print (c) {
  var data = c.data
  if (!data) return 'empty'
  var parts = []
  for (var i = 0; i < c.length; i += 8) {
    var x0 = data[i]
    var y0 = data[i + 1]
    var z0 = data[i + 2]
    var wx = data[i + 3] - x0
    var wy = data[i + 4] - y0
    var wz = data[i + 5] - z0
    var v = data[i + 6]
    parts.push('vox ' + v + ' ' + [wx, wy, wz].join('x') + ' at ' + [x0, y0, z0].join(','))
  }
  return parts.join('; ')
}
