precision mediump float;
attribute vec2 aPosition;
attribute vec4 aColor;
varying vec4 vColor;

// Inputs: positions in clip coordinates and colors.
void main(void) {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vColor = aColor;
}
