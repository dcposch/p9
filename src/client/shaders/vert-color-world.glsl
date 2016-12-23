precision mediump float;
attribute vec3 aPosition;
attribute vec4 aColor;
uniform mat4 uMatrix;
varying vec4 vColor;

// Inputs: positions in world coordinates, a projection * view matrix, and colors.
// Outputs: projected (screen space) vertices with colors.
void main(void) {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vColor = aColor;
}
