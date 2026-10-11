// WebCodecs-based video exporter
// Renders each frame using the same WebGL pipeline as the preview,
// encodes with H.264 via VideoEncoder, sends raw stream to Electron for muxing

export interface ExportClip {
  id: string;
  type: string;
  url: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  track: number;
  config?: any;
  effect?: string;
}

export interface WebCodecsExportSettings {
  fps: number;
  width: number;
  height: number;
  outputPath: string;
  title: string;
  quality: string; // 'low'|'medium'|'high'
}

type ProgressCallback = (pct: number, msg: string) => void;

import { Muxer, ArrayBufferTarget } from 'webm-muxer';

// Maps effect id to WebGL uniform value (must match WebGLPreview.tsx)
function effectToUniform(effectId: string | null | undefined): number {
  if (!effectId) return 0;
  if (effectId === 'blur') return 1;
  if (effectId === 'glitch') return 2;
  if (effectId === 'bw_classic' || effectId === 'bw') return 3;
  if (effectId === 'sepia_pro' || effectId === 'sepia') return 4;
  if (effectId === 'warm') return 5;
  if (effectId === 'cold') return 6;
  if (effectId === 'teal_orange') return 7;
  if (effectId === 'vaporwave') return 8;
  if (effectId === 'infrared') return 9;
  if (effectId === 'duotone') return 10;
  if (effectId === 'vhs_color') return 11;
  if (effectId === 'blood_red') return 12;
  if (effectId === 'matrix_green') return 13;
  return 0;
}

function getEffectiveDur(clip: ExportClip): number {
  const raw = clip.duration - clip.trimStart - clip.trimEnd;
  const speed = clip.config?.speed || 1;
  return (clip.type === 'video' || clip.type === 'audio') ? raw / speed : raw;
}

export async function exportWithWebCodecs(
  clips: ExportClip[],
  settings: WebCodecsExportSettings,
  mediaRefs: { [id: string]: HTMLVideoElement | null },
  glCanvas: HTMLCanvasElement | null,
  onProgress: ProgressCallback,
  trackingData?: any[]
): Promise<{ success: boolean; error?: string }> {

  if (!('VideoEncoder' in window)) {
    return { success: false, error: 'WebCodecs não disponível neste browser.' };
  }

  const { fps, width, height } = settings;
  const frameDuration = 1 / fps; // seconds per frame

  const videoClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  const effectClips = clips.filter(c => c.type === 'effect');
  const transClips = clips.filter(c => c.type === 'transition');
  const textClips = clips.filter(c => c.type === 'text');
  const totalDuration = Math.max(...clips.map(c => c.startTime + getEffectiveDur(c)), 0.1);
  const totalFrames = Math.ceil(totalDuration * fps);

  onProgress(2, '🎬 Iniciando WebCodecs export...');
  try {
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
  } catch {}

  // Collect encoded chunks
  const chunks: EncodedVideoChunk[] = [];

  const bitrate = settings.quality === 'high' ? 8_000_000 : settings.quality === 'low' ? 2_000_000 : 4_000_000;

  // Use webm-muxer to wrap VP8 stream in proper WebM container
  const muxerTarget = new ArrayBufferTarget();
  const muxer = new Muxer({
    target: muxerTarget,
    video: { codec: 'V_VP8', width, height, frameRate: fps },
  });

  // Check codec support
  let codec = 'vp8';
  try {
    if ((window as any).VideoEncoder) {
      const support = await (window as any).VideoEncoder.isConfigSupported({ codec: 'avc1.42001e', width, height, bitrate, framerate: fps });
      if (support.supported) codec = 'avc1.42001e';
    }
  } catch {}

  const encoder = new (window as any).VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta: any) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e: Error) => console.error('VideoEncoder error:', e),
  });

  encoder.configure({
    codec: 'vp8',
    width,
    height,
    bitrate,
    framerate: fps,
  });

  // Offscreen canvas for compositing
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx2d = offscreen.getContext('2d')!;

  // WebGL context for effects (reuse or create)
  let gl: WebGLRenderingContext | null = null;
  let glProgram: WebGLProgram | null = null;
  let glTexture: WebGLTexture | null = null;

  const setupWebGL = () => {
    const glCanvas2 = document.createElement('canvas');
    glCanvas2.width = width;
    glCanvas2.height = height;
    gl = glCanvas2.getContext('webgl', { alpha: false })!;
    if (!gl) return;

    const VERT = `attribute vec2 a_pos;attribute vec2 a_uv;varying vec2 v_uv;void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;}`;
    const FRAG = `precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;uniform float u_effect;uniform float u_intensity;uniform float u_time;
vec4 applyBlur(vec2 uv,float i){float p=i*0.008;vec4 c=vec4(0);float t=0.;for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){c+=texture2D(u_tex,uv+vec2(float(x),float(y))*p);t+=1.;}}return c/t;}
vec4 applyGlitch(vec2 uv,float i){float p=i*0.04;float cyc=mod(u_time,0.6);if(cyc>0.18)return texture2D(u_tex,uv);float bY=floor(uv.y*16.)/16.;float s=fract(sin(bY*127.3+u_time*13.7)*4375.5);float off=(s-0.5)*p*2.;return vec4(texture2D(u_tex,vec2(uv.x+p+off,uv.y)).r,texture2D(u_tex,vec2(uv.x+off,uv.y)).g,texture2D(u_tex,vec2(uv.x-p+off,uv.y)).b,1.);}
vec4 applyBW(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float g=dot(c.rgb,vec3(0.299,0.587,0.114));return vec4(mix(c.rgb,vec3(g),i),1.);}
vec4 applySepia(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float r=dot(c.rgb,vec3(.393,.769,.189));float g=dot(c.rgb,vec3(.349,.686,.168));float b=dot(c.rgb,vec3(.272,.534,.131));return vec4(mix(c.rgb,vec3(r,g,b),i),1.);}
vec4 applyCM(vec2 uv,vec3 r,vec3 g,vec3 b,float i){vec4 c=texture2D(u_tex,uv);vec3 o=vec3(dot(c.rgb,r),dot(c.rgb,g),dot(c.rgb,b));return vec4(mix(c.rgb,o,i),1.);}
vec4 applyTO(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float l=dot(c.rgb,vec3(.299,.587,.114));vec3 s=vec3(.1,.5,.7);vec3 h=vec3(1.,.6,.2);vec3 g=mix(s*c.rgb*2.,h*c.rgb*1.5,l);return vec4(mix(c.rgb,smoothstep(.1,.9,g),i),1.);}
vec4 applyVP(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);vec3 g=vec3(c.r*1.2+c.b*.4,c.g*.8+c.b*.2,c.b*1.5+c.r*.3);return vec4(mix(c.rgb,pow(clamp(g,0.,1.),vec3(1.2)),i),1.);}
vec4 applyIR(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);vec3 g=vec3(c.g*1.5,c.b*.8,c.r*.8);return vec4(mix(c.rgb,smoothstep(0.,.8,g),i),1.);}
vec4 applyDT(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float l=dot(c.rgb,vec3(.299,.587,.114));vec3 g=mix(vec3(.1,0.,.3),vec3(1.,.2,.5),smoothstep(.2,.8,l));return vec4(mix(c.rgb,g,i),1.);}
vec4 applyVC(vec2 uv,float i){float o=i*.005;float r=texture2D(u_tex,vec2(clamp(uv.x+o,0.,1.),uv.y)).r;float g=texture2D(u_tex,uv).g;float b=texture2D(u_tex,vec2(clamp(uv.x-o,0.,1.),uv.y)).b;vec3 c=vec3(r,g,b);float l=dot(c,vec3(.299,.587,.114));vec3 d=mix(vec3(l),c,.7);return vec4(clamp(d+vec3(0.,.1*(1.-l),0.),0.,1.),1.);}
vec4 applyBR(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float l=dot(c.rgb,vec3(.299,.587,.114));vec3 g=mix(vec3(0.),vec3(1.,0.,0.),smoothstep(.2,.8,l));return vec4(mix(c.rgb,g,i),1.);}
vec4 applyMG(vec2 uv,float i){vec4 c=texture2D(u_tex,uv);float l=dot(c.rgb,vec3(.299,.587,.114));vec3 g=mix(vec3(0.),vec3(0.,1.,.2),smoothstep(.1,.9,l));return vec4(mix(c.rgb,g,i),1.);}
void main(){vec2 uv=v_uv;if(u_effect<0.5)gl_FragColor=texture2D(u_tex,uv);else if(u_effect<1.5)gl_FragColor=applyBlur(uv,u_intensity);else if(u_effect<2.5)gl_FragColor=applyGlitch(uv,u_intensity);else if(u_effect<3.5)gl_FragColor=applyBW(uv,u_intensity);else if(u_effect<4.5)gl_FragColor=applySepia(uv,u_intensity);else if(u_effect<5.5)gl_FragColor=applyCM(uv,vec3(1.2,.1,0.),vec3(0.,1.1,0.),vec3(0.,0.,.8),u_intensity);else if(u_effect<6.5)gl_FragColor=applyCM(uv,vec3(.8,0.,0.),vec3(0.,.9,0.),vec3(.1,.2,1.3),u_intensity);else if(u_effect<7.5)gl_FragColor=applyTO(uv,u_intensity);else if(u_effect<8.5)gl_FragColor=applyVP(uv,u_intensity);else if(u_effect<9.5)gl_FragColor=applyIR(uv,u_intensity);else if(u_effect<10.5)gl_FragColor=applyDT(uv,u_intensity);else if(u_effect<11.5)gl_FragColor=applyVC(uv,u_intensity);else if(u_effect<12.5)gl_FragColor=applyBR(uv,u_intensity);else if(u_effect<13.5)gl_FragColor=applyMG(uv,u_intensity);else gl_FragColor=texture2D(u_tex,uv);}`;

    const vs = gl.createShader(gl.VERTEX_SHADER)!; gl.shaderSource(vs, VERT); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!; gl.shaderSource(fs, FRAG); gl.compileShader(fs);
    glProgram = gl.createProgram()!;
    gl.attachShader(glProgram, vs); gl.attachShader(glProgram, fs); gl.linkProgram(glProgram); gl.useProgram(glProgram);

    const pos = new Float32Array([-1,-1,1,-1,-1,1,1,1]);
    const uvs = new Float32Array([0,1,1,1,0,0,1,0]);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(glProgram, 'a_pos'); gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    const uLoc = gl.getAttribLocation(glProgram, 'a_uv'); gl.enableVertexAttribArray(uLoc); gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);

    glTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(glProgram, 'u_tex'), 0);
  };

  setupWebGL();

  const startTime = performance.now();

  // Render each frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame * frameDuration; // current time in seconds

    // Find active video clips at time t
    const activeVideos = videoClips
      .filter(c => {
        if (t >= c.startTime - 0.001 && t <= c.startTime + getEffectiveDur(c) + 0.001) return true;
        const activeTrans = transClips.find(trans => t >= trans.startTime && t <= trans.startTime + getEffectiveDur(trans));
        if (activeTrans) {
          if (c.startTime >= activeTrans.startTime - 1.0 && c.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0) return true;
          const cEnd = c.startTime + getEffectiveDur(c);
          if (cEnd >= activeTrans.startTime - 1.0 && cEnd <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0) return true;
        }
        return false;
      })
      .sort((a, b) => a.track - b.track);

    // Find active effect at time t
    const activeEffect = effectClips.find(c => t >= c.startTime && t <= c.startTime + getEffectiveDur(c));
    const activeTrans = transClips.find(c => t >= c.startTime && t <= c.startTime + getEffectiveDur(c));

    // Clear compositing canvas
    ctx2d.fillStyle = '#000';
    ctx2d.fillRect(0, 0, width, height);

    // Render each video clip
    for (const clip of activeVideos) {
      const vid = mediaRefs[clip.id];
      if (!vid) continue;

      // Seek video to correct time
      const speed = clip.config?.speed || 1;
      const targetTime = clip.trimStart + (t - clip.startTime) * speed;
      // Clamp negative target time if it's pre-rendered for transition, and max duration (avoid exact end frame)
      const maxTime = clip.duration ? clip.duration - 0.05 : 999999;
      const safeTargetTime = Math.max(0, Math.min(targetTime, maxTime));
      if (Math.abs(vid.currentTime - safeTargetTime) > 0.02) {
        vid.currentTime = safeTargetTime;
        // Wait for seek
        await new Promise<void>(res => {
          const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); res(); };
          vid.addEventListener('seeked', onSeeked);
          setTimeout(res, 200); // timeout fallback
        });
      }

      let offX = 0;
      let offY = 0;
      if (activeTrans) {
         const isEntering = (clip.startTime >= activeTrans.startTime - 1.0 && clip.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
         const cEnd = clip.startTime + getEffectiveDur(clip);
         const isLeaving = (cEnd >= activeTrans.startTime - 1.0 && cEnd <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
         const p = Math.max(0, Math.min(1, (t - activeTrans.startTime) / getEffectiveDur(activeTrans)));
         if (isEntering) {
            if (activeTrans.effect === 'trans_up') offY = (1-p)*height;
            if (activeTrans.effect === 'trans_down') offY = -(1-p)*height;
            if (activeTrans.effect === 'trans_left') offX = (1-p)*width;
            if (activeTrans.effect === 'trans_right') offX = -(1-p)*width;
         } else if (isLeaving) {
            if (activeTrans.effect === 'trans_up') offY = -p*height;
            if (activeTrans.effect === 'trans_down') offY = p*height;
            if (activeTrans.effect === 'trans_left') offX = -p*width;
            if (activeTrans.effect === 'trans_right') offX = p*width;
         }
      }

      ctx2d.save();
      ctx2d.translate(offX, offY);

      // Apply effect via WebGL or draw directly
      if (activeEffect && gl && glProgram && glTexture) {
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
        gl.uniform1f(gl.getUniformLocation(glProgram, 'u_effect'), effectToUniform(activeEffect.effect));
        gl.uniform1f(gl.getUniformLocation(glProgram, 'u_intensity'), Math.min(1, (activeEffect.config?.effectIntensity ?? 5) / 10));
        gl.uniform1f(gl.getUniformLocation(glProgram, 'u_time'), t);
        gl.viewport(0, 0, width, height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // Copy WebGL result to 2D canvas
        const glC = (gl.canvas as HTMLCanvasElement);
        ctx2d.drawImage(glC, 0, 0, width, height);
      } else {
        // No effect — draw video directly
        ctx2d.drawImage(vid, 0, 0, width, height);
      }
      
      ctx2d.filter = 'none'; // Reseta filtro
      ctx2d.restore();
    }

    if (activeTrans && activeTrans.effect === 'trans_flash') {
      const p = Math.max(0, Math.min(1, (t - activeTrans.startTime) / getEffectiveDur(activeTrans)));
      const flashOpacity = p < 0.5 ? p * 2 : (1 - p) * 2;
      ctx2d.save();
      ctx2d.globalAlpha = flashOpacity;
      ctx2d.fillStyle = 'white';
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.restore();
    }

    // Render active text and subtitle clips on top of video and effects
    const activeTexts = textClips.filter(c => {
      const dur = getEffectiveDur(c);
      return t >= c.startTime && t <= c.startTime + dur;
    });

    for (const txt of activeTexts) {
      const tc = (txt as any).textConfig;
      if (!tc || !tc.content) continue;

      ctx2d.save();

      let posX = width * 0.5;
      let posY = height * 0.85;

      // Handle motion tracking for text
      let hasTracking = false;
      if (txt.config?.trackId && trackingData && trackingData.length > 0) {
        const track = trackingData.find((tr: any) => tr.id === txt.config!.trackId);
        if (track && track.tracking_data && track.tracking_data.length > 0) {
          const trackFps = track.fps || fps;
          const relativeTime = t - txt.startTime;
          const frameIndex = Math.max(0, Math.floor(relativeTime * trackFps));
          const trackFrame = track.tracking_data[Math.min(frameIndex, track.tracking_data.length - 1)];
          if (trackFrame) {
            const videoWidth = track.video_width || width;
            const videoHeight = track.video_height || height;
            const scaleX = width / videoWidth;
            const scaleY = height / videoHeight;
            const offsetX = tc.trackOffsetX || 0;
            const offsetY = tc.trackOffsetY || 0;
            posX = trackFrame.x * scaleX + (trackFrame.width * scaleX / 2) + offsetX;
            posY = trackFrame.y * scaleY + (trackFrame.height * scaleY / 2) + offsetY;
            hasTracking = true;
          }
        }
      }

      if (!hasTracking) {
        if (tc.x !== undefined && tc.x !== null) {
          if (typeof tc.x === 'string') {
            if (tc.x.endsWith('%')) posX = width * (parseFloat(tc.x) / 100);
            else if (tc.x.endsWith('px')) posX = parseFloat(tc.x);
            else {
              const num = parseFloat(tc.x);
              if (!isNaN(num)) posX = num <= 1 ? width * num : num;
            }
          } else if (typeof tc.x === 'number') {
            posX = tc.x <= 1 ? width * tc.x : tc.x;
          }
        }

        if (tc.y !== undefined && tc.y !== null) {
          if (typeof tc.y === 'string') {
            if (tc.y.endsWith('%')) posY = height * (parseFloat(tc.y) / 100);
            else if (tc.y.endsWith('px')) posY = parseFloat(tc.y);
            else {
              const num = parseFloat(tc.y);
              if (!isNaN(num)) posY = num <= 1 ? height * num : num;
            }
          } else if (typeof tc.y === 'number') {
            posY = tc.y <= 1 ? height * tc.y : tc.y;
          }
        }
      }

      const fontSize = Math.round((tc.fontSize || 24) * (height / 360));
      const fontFamily = tc.fontFamily || 'Outfit, sans-serif';
      const fontWeight = tc.fontWeight || 'bold';
      const fontStyle = tc.fontStyle || 'normal';

      ctx2d.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';

      // Outline/Stroke
      if (tc.strokeWidth && tc.strokeWidth > 0) {
        ctx2d.strokeStyle = tc.strokeColor || '#000000';
        ctx2d.lineWidth = Math.max(1, Math.round(tc.strokeWidth * (height / 360)));
        ctx2d.lineJoin = 'round';
        ctx2d.strokeText(tc.content, posX, posY);
      }

      // Fill
      ctx2d.fillStyle = tc.color || '#ffff00';
      ctx2d.fillText(tc.content, posX, posY);

      ctx2d.restore();
    }

    // Create VideoFrame from canvas
    const videoFrame = new (window as any).VideoFrame(offscreen, {
      timestamp: Math.round(t * 1_000_000), // microseconds
      duration: Math.round(frameDuration * 1_000_000),
    });

    const keyFrame = frame % (fps * 2) === 0; // keyframe every 2 seconds
    encoder.encode(videoFrame, { keyFrame });
    videoFrame.close();

    // Progress
    if (frame % 10 === 0) {
      const pct = 5 + Math.round((frame / totalFrames) * 75);
      const elapsed = (performance.now() - startTime) / 1000;
      const fps_actual = frame / Math.max(elapsed, 0.1);
      const remaining = (totalFrames - frame) / Math.max(fps_actual, 1);
      onProgress(pct, `🎞️ Frame ${frame}/${totalFrames} | ${fps_actual.toFixed(1)} fps | ~${remaining.toFixed(0)}s restantes`);
    }

    // Yield to keep UI responsive
    if (frame % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }


  await encoder.flush();
  encoder.close();
  muxer.finalize();

  onProgress(84, 'Empacotando video WebM...');
  const webmBuffer = new Uint8Array(muxerTarget.buffer);

  onProgress(86, 'Salvando video...');
  // Envia como Array de numeros para evitar problemas de serialização IPC
  const api = (window as any).electronAPI;
  console.log('[WebCodecsExporter] Chamando muxVideoWithAudio...');
  console.log('[WebCodecsExporter] Clips:', clips.length);
  console.log('[WebCodecsExporter] Settings:', settings);
  
  try {
    const result = await api.muxVideoWithAudio({
      videoArray: Array.from(webmBuffer),
      codec: 'vp8',
      clips: clips,
      settings: { ...settings, fps, width, height },
    });
    console.log('[WebCodecsExporter] Resultado do mux:', result);

    if (result.success) {
      onProgress(100, 'Exportado: ' + result.finalPath);
      return { success: true };
    } else {
      console.error('[WebCodecsExporter] Erro no mux:', result.error);
      return { success: false, error: result.error };
    }
  } catch (err) {
    console.error('[WebCodecsExporter] Exceção ao chamar mux:', err);
    return { success: false, error: String(err) };
  }
}
