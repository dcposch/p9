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
uniform vec4 uDepthFog;
uniform float uAnimateT;

const vec2 UV_WATER = vec2(0, 0);

const float TILE_SIZE = 1.0 / 32.0;

vec4 computeTexColor ();
vec3 computeLight ();
vec4 computeDepthFog ();
vec4 sampleTileAtlas (vec2 tileCoord, vec2 tileUV);

void main (void) {
    vec4 texColor = computeTexColor(); // Voxel texture
    if (texColor.a < 0.25) discard; // Binary transparency: see thru leaves, glass blocks, etc
    vec3 light = computeLight(); // Ambient and direct lighting
    vec4 fog = computeDepthFog();
    vec3 emittedLight = light * texColor.xyz;
    gl_FragColor = vec4(emittedLight * (1.0 - fog.w) + fog.xyz * fog.w, texColor.a);
}

// Computes the voxel texture color for this fragment
vec4 computeTexColor () {
  vec3 n = vNormal;
  vec3 p = vPosition;
  float u = dot(vec3(p.x, p.y, p.x), abs(vec3(n.z, n.x, n.y)));
  float v = dot(vec3(-p.z, p.y, -p.z), abs(vec3(n.y, n.z, n.x)));
  vec2 tileUV = fract(vec2(u, v));

  // Animate water
  vec2 uv;
  if (vUV == UV_WATER) {
    vec3 q = floor(p);
    float t = floor(uAnimateT);
    float frame = mod(dot(q.xyz, q.yzx) + dot(q.xyz, q.zxy) + q.x + q.y + q.z + t, 6.0);
    frame = min(frame, 3.0);
    uv = vec2(vUV.x + frame, vUV.y);
  } else {
    uv = vUV;
  }

  return sampleTileAtlas(uv, tileUV);
}

// Computes the combined ambient and direct lighting. There is no diffuse light.
vec3 computeLight () {
  float lightDot = clamp(dot(uLightDir, vNormal), 0.0, 1.0);
  return uLightAmbient + lightDot * uLightDiffuse;
}

// Computes depth fog
// uDepthFog.xyz is the color of the fog
// uDepthFog.w is the depth at which it reaches 50% opacity
// When depth is 3 * uDepthFog.w, the fog is at 75% opacity, etc
vec4 computeDepthFog () {
  float depth = gl_FragCoord.z / gl_FragCoord.w;
  float opacity = 1.0 - exp(-depth / uDepthFog.w);
  return vec4(uDepthFog.xyz, opacity);
}

// Algorithm from a sweet blog post
// http://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/
// tileCoord represents integer coordinates in the texture atlas. (3, 4) would be 3rd col, 4th row.
// tileUV represents the fract in that particular square. tileUV is in [0.0, 1.0)
vec4 sampleTileAtlas (vec2 tileCoord, vec2 tileUV) {
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
