#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUV;
varying vec3 vPosition;
varying vec3 vNormal;

uniform sampler2D uSampler;
uniform vec3 uLightDir;
uniform vec3 uLightDiffuse;
uniform vec3 uLightAmbient;

// Algorithm from a sweet blog post
// http://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/
vec4 sampleTileAtlas(vec2 tileOffset,
                  vec2 tileUV,
                  float tileSize,
                  sampler2D atlas) {
  //Initialize accumulators
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
  float totalWeight = 0.0;

  for(int dx=0; dx<2; ++dx)
  for(int dy=0; dy<2; ++dy) {
    //Compute coordinate in 2x2 tile patch
    //vec2 tileCoord = 2.0 * fract(0.5 * (tileUV + vec2(dx,dy)));
    vec2 tileCoord = tileUV + vec2(dx,dy);

    //Weight sample based on distance to center
    float w = pow(1.0 - max(abs(tileCoord.x-1.0), abs(tileCoord.y-1.0)), 16.0);

    //Compute atlas coord
    vec2 atlasUV = tileOffset + tileSize * tileCoord;

    //Sample and accumulate
    color += w * texture2D(atlas, atlasUV);
    totalWeight += w;
  }

  //Return weighted color
  return color / totalWeight;
}

void main(void) {
    float tileSize = 1.0/32.0;

    float u = dot(vPosition, vNormal.zxy);
    float v = dot(vPosition, vNormal.yzx);
    vec2 tileUV = fract(vec2(u, v));
    vec4 texColor = sampleTileAtlas(vUV, tileUV, tileSize, uSampler);

    float lightDot = clamp(dot(uLightDir, vNormal), 0.0, 1.0);
    vec3 light = uLightAmbient + lightDot * uLightDiffuse;

    float alpha = clamp(uLightDir.x+uLightAmbient.x+uLightDiffuse.x, 0.8, 0.9);
    gl_FragColor = vec4(light * texColor.xyz, texColor.w);
}

