precision mediump float;
attribute vec2 aVertexPosition;
attribute vec4 aVertexColor;
varying vec4 vColor;

// Inputs: positions in clip coordinates and colors.
void main(void) {
  gl_Position = vec4(aVertexPosition, 0.0, 1.0);
  vColor = aVertexColor;
}
