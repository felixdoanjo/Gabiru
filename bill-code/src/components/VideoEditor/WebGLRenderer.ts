// Renderizador WebGL compartilhado para preview e export
// Usa os mesmos shaders para garantir que preview = export

const VERT_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  varying vec2 v_texcoord;
  uniform mat3 u_matrix;
  void main() {
    vec3 pos = u_matrix * vec3(a_position, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
    v_texcoord = a_texcoord;
  }
`;

const FRAG_SRC = `
  precision mediump float;
  varying vec2 v_texcoord;
  uniform sampler2D u_texture;
  uniform float u_effect;
  uniform float u_intensity;
  uniform float u_time;

  vec4 applyBlur(vec2 uv, float intensity) {
    float px = intensity * 0.008;
    vec4 color = vec4(0.0);
    float total = 0.0;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * px;
        color += texture2D(u_texture, uv + offset);
        total += 1.0;
      }
    }
    return color / total;
  }

  void main() {
    vec2 uv = v_texcoord;
    vec4 color;
    
    if (u_effect < 0.5) {
      color = texture2D(u_texture, uv);
    } else if (u_effect < 1.5) {
      color = applyBlur(uv, u_intensity);
    } else {
      color = texture2D(u_texture, uv);
    }
    
    gl_FragColor = color;
  }
`;

function createMatrix(zoom: number, rotation: number, offsetX: number, offsetY: number): Float32Array {
  // Cria matriz de transformação 3x3
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  
  // Scale
  const sx = zoom;
  const sy = zoom;
  
  // Transform: translate -> rotate -> scale
  return new Float32Array([
    sx * cos, sx * sin, 0,
    -sy * sin, sy * cos, 0,
    offsetX, offsetY, 1
  ]);
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private posBuffer: WebGLBuffer;
  private texBuffer: WebGLBuffer;
  
  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL não disponível');
    this.gl = gl;
    
    // Compila shaders
    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    
    const program = gl.createProgram();
    if (!program) throw new Error('Erro ao criar program');
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Erro ao linkar program: ' + gl.getProgramInfoLog(program));
    }
    
    this.program = program;
    gl.useProgram(program);
    
    // Setup buffers
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
    this.texBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    
    // Cria textura
    const texture = gl.createTexture();
    if (!texture) throw new Error('Erro ao criar textura');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  
  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Erro ao criar shader');
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Erro ao compilar shader: ' + gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }
  
  render(
    videoElement: HTMLVideoElement, 
    effectId: string | null, 
    intensity: number, 
    time: number,
    zoom: number = 1.0,
    rotation: number = 0,
    shakeX: number = 0,
    shakeY: number = 0
  ): void {
    const gl = this.gl;
    
    // Upload textura do vídeo
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    
    // Setup matrix com zoom, rotation, shake
    const matrix = createMatrix(zoom, rotation, shakeX / this.canvas.width, shakeY / this.canvas.height);
    const matrixLoc = gl.getUniformLocation(this.program, 'u_matrix');
    gl.uniformMatrix3fv(matrixLoc, false, matrix);
    
    // Setup attributes
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    const texLoc = gl.getAttribLocation(this.program, 'a_texcoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
    
    // Setup uniforms
    const effectValue = effectId === 'blur' ? 1.0 : 0.0;
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_effect'), effectValue);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_intensity'), intensity);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), time);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);
    
    // Renderiza
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  captureFrame(): string {
    // JPEG 85% é mais rápido que PNG
    return this.canvas.toDataURL('image/jpeg', 0.85);
  }
  
  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.posBuffer);
    gl.deleteBuffer(this.texBuffer);
    gl.deleteProgram(this.program);
  }
}
