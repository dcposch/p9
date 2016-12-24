precision mediump float;
uniform sampler2D uTexture;
varying vec2 vUV;

void main(void) {
  vec4 tex = texture2D(uTexture, vUV);
  if (tex.w < 0.5) discard;
  gl_FragColor = tex;
}
