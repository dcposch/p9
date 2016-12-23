precision mediump float;
attribute vec2 aPosition;
attribute vec2 aUV;
varying vec2 vUV;

// Input vertex positions are in clip coordinates
void main(void) {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vUV = aUV;
}
