var fs = require('fs')

module.exports = {
  vert: {
    simple: fs.readFileSync(require.resolve('./vert-simple.glsl'), 'utf8'),
    texture: fs.readFileSync(require.resolve('./vert-texture.glsl'), 'utf8')
  },
  frag: {
    color: fs.readFileSync(require.resolve('./frag-color.glsl'), 'utf8'),
    voxel: fs.readFileSync(require.resolve('./frag-voxel.glsl'), 'utf8')
  }
}
