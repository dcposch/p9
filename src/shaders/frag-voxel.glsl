#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;
varying vec3 vPosition;
varying vec3 vNormal;

uniform sampler2D uAtlas;
uniform vec3 uLightDir;
uniform vec3 uLightDiffuse;
uniform vec3 uLightAmbient;

const float TILE_SIZE = 1.0 / 32.0;

// Algorithm from a sweet blog post
// http://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/
// tileCoord represents integer coordinates in the texture atlas. (3, 4) would be 3rd col, 4th row.
// tileUV represents the fract in that particular square. tileUV is in [0.0, 1.0)
vec4 sampleTileAtlas(vec2 tileCoord, vec2 tileUV) {
  // Initialize accumulators
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
  float totalWeight = 0.0;

  for(int dx = 0; dx < 2; ++dx)
  for(int dy = 0; dy < 2; ++dy) {
    // Compute coordinate in 2x2 tile patch
    vec2 patchUV = 2.0 * fract(0.5 * (tileUV + vec2(dx, dy)));

    // Weight sample based on distance to center
    float w = pow(1.0 - max(abs(patchUV.x - 1.0), abs(patchUV.y - 1.0)), 16.0);

    // Compute atlas coord
    vec2 atlasUV = TILE_SIZE * (2.0 * tileCoord + patchUV);

    // Sample and accumulate
    color += w * texture2D(uAtlas, atlasUV);
    totalWeight += w;
  }

  // Return weighted color
  return color / totalWeight;
}

void main(void) {
    vec3 n = vNormal;
    vec3 p = vPosition;
    float u = dot(vec3(p.x, p.y, p.x), abs(vec3(n.z, n.x, n.y)));
    float v = dot(vec3(-p.z, p.y, -p.z), abs(vec3(n.y, n.z, n.x)));
    vec2 tileUV = fract(vec2(u, v));
    vec4 texColor = sampleTileAtlas(vUV, tileUV);
    if (texColor.a < 0.5) discard;

    float lightDot = clamp(dot(uLightDir, vNormal), 0.0, 1.0);
    vec3 light = uLightAmbient + lightDot * uLightDiffuse;

    gl_FragColor = vec4(light * texColor.xyz, texColor.w);
}
