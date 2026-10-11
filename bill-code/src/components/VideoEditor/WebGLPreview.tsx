import { useEffect, useRef } from 'react';

interface WebGLPreviewProps {
  videoRef: HTMLVideoElement | null;
  effectId: string | null;
  effectIntensity: number;
  width: number;
  height: number;
  isPlaying?: boolean;
  style?: React.CSSProperties;
}

// Vertex shader — simples, só mapeia textura no quad
const VERT_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  varying vec2 v_texcoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
  }
`;

// Fragment shader base + efeitos
const FRAG_SRC = `
  precision mediump float;
  varying vec2 v_texcoord;
  uniform sampler2D u_texture;
  uniform float u_effect;    // 0=none, 1=blur, 2=glitch, 3=bw, 4=sepia
  uniform float u_intensity; // 0.0 - 1.0
  uniform float u_time;

  // Glitch: RGB split + block displacement
  vec4 applyGlitch(vec2 uv, float intensity) {
    float px = intensity * 0.04; // deslocamento horizontal
    
    // Pulso: ativo ~30% do tempo baseado no tempo
    float cycle = mod(u_time, 0.6);
    float active = step(cycle, 0.18); // ativo nos primeiros 30% do ciclo
    
    if (active < 0.5) return texture2D(u_texture, uv);
    
    // Distorção de blocos — divide em faixas horizontais e desloca
    float blockY = floor(uv.y * 16.0) / 16.0; // 16 blocos verticais
    float seed = fract(sin(blockY * 127.3 + u_time * 13.7) * 4375.5);
    float blockOffset = (seed - 0.5) * px * 2.0 * active;
    
    vec2 uvR = vec2(uv.x + px + blockOffset, uv.y);
    vec2 uvG = vec2(uv.x + blockOffset, uv.y);
    vec2 uvB = vec2(uv.x - px + blockOffset, uv.y);
    
    // Clamp para não sair da textura
    uvR.x = clamp(uvR.x, 0.0, 1.0);
    uvG.x = clamp(uvG.x, 0.0, 1.0);
    uvB.x = clamp(uvB.x, 0.0, 1.0);
    
    float r = texture2D(u_texture, uvR).r;
    float g = texture2D(u_texture, uvG).g;
    float b = texture2D(u_texture, uvB).b;
    
    return vec4(r, g, b, 1.0);
  }

  // Blur simples (9-tap box blur)
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

  // Preto e branco
  vec4 applyBW(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    return vec4(mix(c.rgb, vec3(gray), intensity), c.a);
  }

  // Sépia
  vec4 applySepia(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float r = dot(c.rgb, vec3(0.393, 0.769, 0.189));
    float g = dot(c.rgb, vec3(0.349, 0.686, 0.168));
    float b = dot(c.rgb, vec3(0.272, 0.534, 0.131));
    return vec4(mix(c.rgb, vec3(r,g,b), intensity), c.a);
  }

  vec4 applyColorMatrix(vec2 uv, vec3 r, vec3 g, vec3 b, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    vec3 outColor = vec3(dot(c.rgb, r), dot(c.rgb, g), dot(c.rgb, b));
    return vec4(mix(c.rgb, outColor, intensity), c.a);
  }

  vec4 applyTealOrange(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 shadow = vec3(0.1, 0.5, 0.7);
    vec3 high = vec3(1.0, 0.6, 0.2);
    vec3 graded = mix(shadow * c.rgb * 2.0, high * c.rgb * 1.5, luma);
    graded = smoothstep(0.1, 0.9, graded);
    return vec4(mix(c.rgb, graded, intensity), c.a);
  }

  vec4 applyVaporwave(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    vec3 graded = vec3(c.r * 1.2 + c.b * 0.4, c.g * 0.8 + c.b * 0.2, c.b * 1.5 + c.r * 0.3);
    graded = pow(clamp(graded, 0.0, 1.0), vec3(1.2));
    return vec4(mix(c.rgb, graded, intensity), c.a);
  }

  vec4 applyInfrared(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    vec3 graded = vec3(c.g * 1.5, c.b * 0.8, c.r * 0.8);
    graded = smoothstep(0.0, 0.8, graded);
    return vec4(mix(c.rgb, clamp(graded, 0.0, 1.0), intensity), c.a);
  }

  vec4 applyDuotone(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 col1 = vec3(0.1, 0.0, 0.3);
    vec3 col2 = vec3(1.0, 0.2, 0.5);
    vec3 graded = mix(col1, col2, smoothstep(0.2, 0.8, luma));
    return vec4(mix(c.rgb, graded, intensity), c.a);
  }

  vec4 applyVHSColor(vec2 uv, float intensity) {
    float offset = intensity * 0.005;
    float r = texture2D(u_texture, vec2(clamp(uv.x + offset, 0.0, 1.0), uv.y)).r;
    float g = texture2D(u_texture, uv).g;
    float b = texture2D(u_texture, vec2(clamp(uv.x - offset, 0.0, 1.0), uv.y)).b;
    vec3 c = vec3(r, g, b);
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 desat = mix(vec3(luma), c, 0.7);
    vec3 graded = desat + vec3(0.0, 0.1 * (1.0 - luma), 0.0);
    return vec4(clamp(graded, 0.0, 1.0), 1.0);
  }

  vec4 applyBloodRed(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(vec3(0.0), vec3(1.0, 0.0, 0.0), smoothstep(0.2, 0.8, luma));
    return vec4(mix(c.rgb, graded, intensity), c.a);
  }

  vec4 applyMatrix(vec2 uv, float intensity) {
    vec4 c = texture2D(u_texture, uv);
    float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(vec3(0.0), vec3(0.0, 1.0, 0.2), smoothstep(0.1, 0.9, luma));
    return vec4(mix(c.rgb, graded, intensity), c.a);
  }

  void main() {
    vec2 uv = v_texcoord;
    
    if (u_effect < 0.5) {
      gl_FragColor = texture2D(u_texture, uv);
    } else if (u_effect < 1.5) {
      gl_FragColor = applyBlur(uv, u_intensity);
    } else if (u_effect < 2.5) {
      gl_FragColor = applyGlitch(uv, u_intensity);
    } else if (u_effect < 3.5) {
      gl_FragColor = applyBW(uv, u_intensity);
    } else if (u_effect < 4.5) {
      gl_FragColor = applySepia(uv, u_intensity);
    } else if (u_effect < 5.5) {
      gl_FragColor = applyColorMatrix(uv, vec3(1.2,0.1,0.0), vec3(0.0,1.1,0.0), vec3(0.0,0.0,0.8), u_intensity); // warm
    } else if (u_effect < 6.5) {
      gl_FragColor = applyColorMatrix(uv, vec3(0.8,0.0,0.0), vec3(0.0,0.9,0.0), vec3(0.1,0.2,1.3), u_intensity); // cold
    } else if (u_effect < 7.5) {
      gl_FragColor = applyTealOrange(uv, u_intensity);
    } else if (u_effect < 8.5) {
      gl_FragColor = applyVaporwave(uv, u_intensity);
    } else if (u_effect < 9.5) {
      gl_FragColor = applyInfrared(uv, u_intensity);
    } else if (u_effect < 10.5) {
      gl_FragColor = applyDuotone(uv, u_intensity);
    } else if (u_effect < 11.5) {
      gl_FragColor = applyVHSColor(uv, u_intensity);
    } else if (u_effect < 12.5) {
      gl_FragColor = applyBloodRed(uv, u_intensity);
    } else if (u_effect < 13.5) {
      gl_FragColor = applyMatrix(uv, u_intensity);
    } else {
      gl_FragColor = texture2D(u_texture, uv);
    }
  }
`;

function effectIdToUniform(id: string | null): number {
  if (!id) return 0;
  if (id === 'blur') return 1;
  if (id === 'glitch') return 2;
  if (id === 'bw_classic' || id === 'bw') return 3;
  if (id === 'sepia_pro' || id === 'sepia') return 4;
  if (id === 'warm') return 5;
  if (id === 'cold') return 6;
  if (id === 'teal_orange') return 7;
  if (id === 'vaporwave') return 8;
  if (id === 'infrared') return 9;
  if (id === 'duotone') return 10;
  if (id === 'vhs_color') return 11;
  if (id === 'blood_red') return 12;
  if (id === 'matrix_green') return 13;
  return 0;
}

export default function WebGLPreview({ videoRef, effectId, effectIntensity, width, height, isPlaying = false, style }: WebGLPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false });
    if (!gl) return;
    glRef.current = gl;

    // Compile shaders
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    gl.useProgram(program);
    programRef.current = program;

    // Full-screen quad
    const positions = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const texcoords = new Float32Array([0,1, 1,1, 0,0, 1,0]);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, 'a_texcoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Create texture
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textureRef.current = texture;

    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(program);
      gl.deleteTexture(texture);
    };
  }, []);

  // Render loop
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const texture = textureRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !texture || !canvas) return;

    const effectUniform = gl.getUniformLocation(program, 'u_effect');
    const intensityUniform = gl.getUniformLocation(program, 'u_intensity');
    const timeUniform = gl.getUniformLocation(program, 'u_time');

    const render = () => {
      if (!videoRef || videoRef.readyState < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Só anima quando tocando — quando pausado renderiza um único frame estático
      if (!isPlaying) {
        // Renderiza o frame atual uma vez (para mostrar o efeito no frame parado)
        // mas não continua animando (glitch não pisca quando pausado)
        canvas.width = videoRef.videoWidth || width;
        canvas.height = videoRef.videoHeight || height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef);
        const effectNum = effectIdToUniform(effectId);
        const normalizedIntensity = Math.min(1, effectIntensity / 10);
        gl.uniform1f(effectUniform, effectNum); // Mantém o filtro visualmente no preview
        gl.uniform1f(intensityUniform, normalizedIntensity);
        gl.uniform1f(timeUniform, 0); // Mantém tempo 0 para não animar glitch pausado
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      canvas.width = videoRef.videoWidth || width;
      canvas.height = videoRef.videoHeight || height;
      gl.viewport(0, 0, canvas.width, canvas.height);

      // Upload video frame to texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef);

      // Set uniforms
      const effectNum = effectIdToUniform(effectId);
      const normalizedIntensity = Math.min(1, effectIntensity / 10);
      const elapsed = (performance.now() - startTimeRef.current) / 1000;

      gl.uniform1f(effectUniform, effectNum);
      gl.uniform1f(intensityUniform, normalizedIntensity);
      gl.uniform1f(timeUniform, elapsed);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);

    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, effectId, effectIntensity, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        ...style
      }}
    />
  );
}
