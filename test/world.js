var test = require('tape')
var World = require('../src/world')

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
