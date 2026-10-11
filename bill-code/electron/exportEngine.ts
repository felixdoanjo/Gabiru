import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ExportSettings {
  format: string;
  quality: string;
  resolution: string;
  fps: number;
  outputPath: string;
}

const FFMPEG = (() => {
  const candidates = [
    // Runtime do instalador
    path.join(path.dirname(process.execPath), 'runtime', 'ffmpeg'),
    path.join(process.env.APPDATA || '', 'Gabiru', 'runtime', 'ffmpeg'),
    path.join(process.env.LOCALAPPDATA || '', 'Gabiru', 'runtime', 'ffmpeg'),
  ];
  
  const findExe = (dir: string): string | null => {
    try {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe') return full;
        if (e.isDirectory()) { const f = findExe(full); if (f) return f; }
      }
    } catch {}
    return null;
  };
  
  for (const candidate of candidates) {
    const found = findExe(candidate);
    if (found) return found.includes(' ') ? `"${found}"` : found;
  }
  
  return 'ffmpeg';
})();

export class VideoExportEngine {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'bill_code_nle_' + Date.now());
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  private execute(command: string, logFn?: (msg: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const realCmd = command.replace(/^ffmpeg /, `${FFMPEG} `);
      if (logFn) logFn(`[CMD] ${realCmd.slice(0, 300)}`);
      exec(realCmd, { 
        maxBuffer: 1024 * 1024 * 1000, // 1GB buffer
        cwd: this.tempDir,
        env: { ...process.env }  // Passa variáveis de ambiente incluindo FONTCONFIG_FILE
      }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = stderr.slice(-2000) || error.message;
          console.error('[NLE FFmpeg Error]', errMsg);
          if (logFn) logFn(`[FFMPEG ERR] ${errMsg.slice(-500)}`);
          reject(new Error(errMsg.slice(-800)));
        } else {
          resolve(stdout + stderr);
        }
      });
    });
  }

  private escapeDrawtext(text: string): string {
    return text
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "\u2019")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/,/g, '\\,')
      .replace(/=/g, '\\=');
  }

  private getFontPath(family: string, bold: boolean, italic: boolean, fontCache?: Record<string, string>): string {
    // Se temos o cache, usa ele (é a fonte da verdade agora!)
    if (fontCache) {
      // Monta as variações do nome COM estilo primeiro
      const styledVariations = [];
      if (bold && italic) {
        styledVariations.push(`${family} Bold Italic`, `${family}BoldItalic`, `${family}-BoldItalic`, `${family} BI`);
      } else if (bold) {
        styledVariations.push(`${family} Bold`, `${family}Bold`, `${family}-Bold`, `${family} BD`, `${family}BD`);
      } else if (italic) {
        styledVariations.push(`${family} Italic`, `${family}Italic`, `${family}-Italic`, `${family} I`);
      }
      
      // Depois tenta o nome sem estilo
      const baseVariations = [
        family,
        family.toLowerCase(),
        family.replace(/\s+/g, ''),
        family.replace(/\s+/g, '').toLowerCase(),
      ];
      
      const allVariations = [...styledVariations, ...baseVariations];
      
      for (const variant of allVariations) {
        if (fontCache[variant]) {
          return fontCache[variant];
        }
      }
      
      // Busca parcial: pega a primeira palavra do nome e procura no cache
      const firstWord = family.split(/\s+/)[0].toLowerCase();
      if (firstWord.length >= 3) {
        const partialMatches = Object.keys(fontCache).filter(k => 
          k.toLowerCase().startsWith(firstWord)
        );
        
        if (partialMatches.length > 0) {
          partialMatches.sort((a, b) => a.length - b.length);
          const match = partialMatches[0];
          return fontCache[match];
        }
      }
    }
    
    // Fallback: mapa de fontes do sistema
    const normalizedFamily = (family || 'arial').toLowerCase().replace(/\s+/g, '');
    const fontMap: { [key: string]: string } = {
      'arial': bold && italic ? 'arialbi.ttf' : bold ? 'arialbd.ttf' : italic ? 'ariali.ttf' : 'arial.ttf',
      'times': bold && italic ? 'timesbi.ttf' : bold ? 'timesbd.ttf' : italic ? 'timesi.ttf' : 'times.ttf',
      'timesnewroman': bold && italic ? 'timesbi.ttf' : bold ? 'timesbd.ttf' : italic ? 'timesi.ttf' : 'times.ttf',
      'courier': bold && italic ? 'courbi.ttf' : bold ? 'courbd.ttf' : italic ? 'couri.ttf' : 'cour.ttf',
      'couriernew': bold && italic ? 'courbi.ttf' : bold ? 'courbd.ttf' : italic ? 'couri.ttf' : 'cour.ttf',
      'verdana': bold ? 'verdanab.ttf' : italic ? 'verdanai.ttf' : 'verdana.ttf',
      'tahoma': bold ? 'tahomabd.ttf' : 'tahoma.ttf',
      'trebuchet': bold && italic ? 'trebucbi.ttf' : bold ? 'trebucbd.ttf' : italic ? 'trebucit.ttf' : 'trebuc.ttf',
      'trebuchetms': bold && italic ? 'trebucbi.ttf' : bold ? 'trebucbd.ttf' : italic ? 'trebucit.ttf' : 'trebuc.ttf',
      'impact': 'impact.ttf',
      'comicsans': 'comic.ttf',
      'comicsansms': 'comic.ttf',
      'georgia': bold && italic ? 'georgiaz.ttf' : bold ? 'georgiab.ttf' : italic ? 'georgiai.ttf' : 'georgia.ttf',
    };
    
    // Se está no mapa, retorna com diretório padrão
    if (fontMap[normalizedFamily]) {
      return `C:\\Windows\\Fonts|${fontMap[normalizedFamily]}`;
    }
    
    // Procura em múltiplos diretórios e formatos (fallback legacy)
    const fontDirs = [
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Windows\\Fonts'),
      'C:\\Windows\\Fonts'
    ];
    
    const searchTerms = [
      normalizedFamily,
      family.replace(/\s+/g, ''),
      family.replace(/\s+/g, '-'),
      family.replace(/\s+/g, '_'),
      family.toLowerCase(),
      family,
    ];
    
    for (const fontsDir of fontDirs) {
      if (!fs.existsSync(fontsDir)) continue;
      
      for (const term of searchTerms) {
        const variants = [
          `${term}.otf`,
          `${term}.ttf`,
          `${term}-Regular.otf`,
          `${term}-Regular.ttf`,
          `${term}Regular.otf`,
          `${term}Regular.ttf`,
          `${term.charAt(0).toUpperCase() + term.slice(1)}.otf`,
          `${term.charAt(0).toUpperCase() + term.slice(1)}.ttf`,
          `${term.charAt(0).toUpperCase() + term.slice(1)}-Regular.otf`,
          `${term.charAt(0).toUpperCase() + term.slice(1)}-Regular.ttf`,
          `${term.toUpperCase()}.otf`,
          `${term.toUpperCase()}.ttf`,
          `${term.toLowerCase()}.otf`,
          `${term.toLowerCase()}.ttf`,
        ];
        
        if (bold && italic) {
          variants.unshift(`${term}-BoldItalic.otf`, `${term}-BoldItalic.ttf`, `${term}BI.otf`, `${term}BI.ttf`);
        } else if (bold) {
          variants.unshift(`${term}-Bold.otf`, `${term}-Bold.ttf`, `${term}Bold.otf`, `${term}Bold.ttf`, `${term}BD.otf`, `${term}BD.ttf`);
        } else if (italic) {
          variants.unshift(`${term}-Italic.otf`, `${term}-Italic.ttf`, `${term}Italic.otf`, `${term}Italic.ttf`);
        }
        
        for (const variant of variants) {
          const fullPath = path.join(fontsDir, variant);
          if (fs.existsSync(fullPath)) {
            return `${fontsDir}|${variant}`;
          }
        }
      }
    }
    
    // Fallback final para Arial
    return 'C:\\Windows\\Fonts|arial.ttf';
  }

  private async prepareFonts(textClips: any[], logFn?: (msg: string) => void, fontCache?: Record<string, string>) {
    const fontFiles = new Set<string>();
    const debugInfo: any[] = [];
    
    // Coleta todas as fontes necessárias
    for (const t of textClips) {
      if (!t.textConfig) continue;
      const isBold = t.textConfig.fontWeight === 'bold' || Number(t.textConfig.fontWeight) >= 700;
      const isItalic = t.textConfig.fontStyle === 'italic';
      const fontPath = this.getFontPath(t.textConfig.fontFamily || 'arial', isBold, isItalic, fontCache);
      fontFiles.add(fontPath);
      
      debugInfo.push({
        requested: `${t.textConfig.fontFamily} ${isBold ? 'Bold' : ''} ${isItalic ? 'Italic' : ''}`.trim(),
        resolved: fontPath
      });
    }
    
    // Salva debug
    const debugPath = path.join(this.tempDir, 'font-debug.json');
    fs.writeFileSync(debugPath, JSON.stringify(debugInfo, null, 2));
    
    // Sempre inclui Arial como fallback
    fontFiles.add('C:\\Windows\\Fonts|arial.ttf');
    
    // Copia cada fonte para o tempDir
    for (const fontPath of fontFiles) {
      const [srcDir, file] = fontPath.split('|');
      const src = path.join(srcDir, file);
      const dest = path.join(this.tempDir, file);
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          const arialSrc = path.join('C:\\Windows\\Fonts', 'arial.ttf');
          if (fs.existsSync(arialSrc) && !fs.existsSync(dest)) {
            fs.copyFileSync(arialSrc, dest);
          }
        }
      } catch (e: any) {}
    }
  }

  private buildKfExpr(clip: any, prop: string, defaultValue: number, multiplier: number = 1, timeOffset: number = 0): string {
    if (!clip.keyframes || clip.keyframes.length < 2) {
      return ((clip.config?.[prop] ?? defaultValue) * multiplier).toFixed(4);
    }
    const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time);
    const defVal = (defaultValue * multiplier).toFixed(4);
    let expr = defVal;
    for (let i = 0; i < kfs.length - 1; i++) {
      const k1 = kfs[i], k2 = kfs[i+1];
      const v1 = (k1[prop] ?? defaultValue) * multiplier;
      const v2 = (k2[prop] ?? defaultValue) * multiplier;
      const t1 = (k1.time - timeOffset).toFixed(3);
      const t2 = (k2.time - timeOffset).toFixed(3);
      const duration = (k2.time - k1.time).toFixed(3);
      const stepExpr = `${v1.toFixed(4)}+(${v2 - v1})*(t-${t1})/${duration}`;
      expr = `if(between(t,${t1},${t2}),${stepExpr},${expr})`;
    }
    const lastKf = kfs[kfs.length - 1];
    const firstKf = kfs[0];
    
    expr = `if(gt(t,${(lastKf.time - timeOffset).toFixed(3)}),${defVal},${expr})`;
    expr = `if(lt(t,${(firstKf.time - timeOffset).toFixed(3)}),${defVal},${expr})`;

    return expr;
  }
  private applyTexts(current: string, texts: any[], segStart: number, segEnd: number, resH: number, resW: number = 1920, trackingData?: any[], fps: number = 30, logFn?: (msg: string) => void, fontCache?: Record<string, string>): string {
    for (const t of texts) {
      if (!t.textConfig) continue;
      const tc = t.textConfig;
      const tDur = (t.duration - (t.trimStart || 0) - (t.trimEnd || 0));
      const startTime = Math.max(0, t.startTime - segStart).toFixed(3);
      const endTime = Math.min(segEnd - segStart, t.startTime + tDur - segStart).toFixed(3);
      if (Number(endTime) <= Number(startTime)) continue;
      const font = this.getFontPath(tc.fontFamily || 'arial', tc.fontWeight === 'bold', tc.fontStyle === 'italic', fontCache);
      const fontFile = path.join(this.tempDir, font.split('|')[1]); // Pega só o nome do arquivo
      const size = (tc.fontSize * (resH / 360)).toFixed(0);
      const escaped = this.escapeDrawtext(tc.content);
      
      // MOTION TRACKING
      if (t.config?.trackId && trackingData) {
        if (logFn) logFn(`[Motion Track] Texto "${tc.content}" tem trackId: ${t.config.trackId}`);
        const track = trackingData.find((tr: any) => tr.id === t.config.trackId);
        if (track && track.tracking_data && track.tracking_data.length > 0) {
          if (logFn) logFn(`[Motion Track] Track encontrado com ${track.tracking_data.length} frames`);
          const trackFps = track.fps || fps;
          
          // Calcula fatores de escala baseado nas dimensões do vídeo rastreado
          const videoWidth = track.video_width || resW;
          const videoHeight = track.video_height || resH;
          const scaleX = resW / videoWidth;
          const scaleY = resH / videoHeight;
          
          // WORKAROUND: O offset está sendo salvo em pixels do canvas da edição
          // mas o canvas está em escala diferente do vídeo original
          // Multiplica por 1.7 pra compensar
          const rawOffsetX = tc.trackOffsetX || t.textConfig?.trackOffsetX || 0;
          const rawOffsetY = tc.trackOffsetY || t.textConfig?.trackOffsetY || 0;
          
          // Multiplica por 1.7 (ajuste empírico) e depois escala pra resolução de export
          const offsetX = (rawOffsetX * 1.7) * scaleX;
          const offsetY = (rawOffsetY * 1.7) * scaleY;
          
          if (logFn) logFn(`[Motion Track] Raw offset: (${rawOffsetX.toFixed(0)}, ${rawOffsetY.toFixed(0)}), x1.7: (${(rawOffsetX*1.7).toFixed(0)}, ${(rawOffsetY*1.7).toFixed(0)}), Final: (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
          
          let style = `:fontcolor=0x${tc.color.replace('#','')}`;
          if (tc.strokeWidth > 0) {
            style += `:borderw=${Math.max(1, Math.round(tc.strokeWidth * (resH / 360)))}:bordercolor=0x${tc.strokeColor.replace('#','')}`;
          }
          
          // Usa 20 keyframes para melhor precisão no tracking (compromisso entre precisão e limite FFmpeg)
          const maxKeyframes = 20;
          const sampleInterval = Math.max(1, Math.floor(track.tracking_data.length / maxKeyframes));
          const sampledFrames: any[] = [];
          for (let i = 0; i < track.tracking_data.length; i += sampleInterval) {
            sampledFrames.push(track.tracking_data[i]);
          }
          // Sempre inclui o último frame
          if (sampledFrames[sampledFrames.length - 1] !== track.tracking_data[track.tracking_data.length - 1]) {
            sampledFrames.push(track.tracking_data[track.tracking_data.length - 1]);
          }
          
          if (logFn) logFn(`[Motion Track] Usando ${sampledFrames.length} keyframes de ${track.tracking_data.length} frames`);
          
          // Debug: mostra distribuição dos keyframes
          if (logFn && sampledFrames.length > 0) {
            const firstTs = sampledFrames[0].timestamp.toFixed(3);
            const lastTs = sampledFrames[sampledFrames.length - 1].timestamp.toFixed(3);
            const avgInterval = ((lastTs as any - firstTs as any) / (sampledFrames.length - 1)).toFixed(3);
            logFn(`[Motion Track] Keyframes: t=${firstTs}s até t=${lastTs}s (intervalo médio: ${avgInterval}s)`);
          }
          
          // Constrói expressão FFmpeg com interpolação baseada em timestamps reais
          let xExpr = '', yExpr = '';
          const lastFrame = sampledFrames[sampledFrames.length - 1];
          const lastX = Math.round(lastFrame.x * scaleX + (lastFrame.width * scaleX / 2) + offsetX);
          const lastY = Math.round(lastFrame.y * scaleY + (lastFrame.height * scaleY / 2) + offsetY);
          xExpr = `${lastX}`;
          yExpr = `${lastY}`;
          
          // Usa timestamps do próprio tracking data para sincronização perfeita
          for (let i = sampledFrames.length - 2; i >= 0; i--) {
            const frame = sampledFrames[i];
            const nextFrame = sampledFrames[i + 1];
            
            // Usa timestamp direto do tracking data (já está em segundos)
            const frameTime = (t.startTime + frame.timestamp).toFixed(4);
            const nextFrameTime = (t.startTime + nextFrame.timestamp).toFixed(4);
            
            const x = Math.round(frame.x * scaleX + (frame.width * scaleX / 2) + offsetX);
            const y = Math.round(frame.y * scaleY + (frame.height * scaleY / 2) + offsetY);
            const nextX = Math.round(nextFrame.x * scaleX + (nextFrame.width * scaleX / 2) + offsetX);
            const nextY = Math.round(nextFrame.y * scaleY + (nextFrame.height * scaleY / 2) + offsetY);
            
            const duration = (nextFrame.timestamp - frame.timestamp).toFixed(4);
            
            xExpr = `if(lt(t,${nextFrameTime}),${x}+(${nextX}-${x})*(t-${frameTime})/${duration},${xExpr})`;
            yExpr = `if(lt(t,${nextFrameTime}),${y}+(${nextY}-${y})*(t-${frameTime})/${duration},${yExpr})`;
          }
          
          // Escapa o caminho do arquivo para FFmpeg (barra invertida e dois pontos)
          const escapedFontFile = fontFile.replace(/\\/g, '/').replace(/:/g, '\\:');
          
          current += `,drawtext=fontfile='${escapedFontFile}':text='${escaped}':fontsize=${size}${style}:x='${xExpr}-tw/2':y='${yExpr}-th/2':enable='between(t\\,${startTime}\\,${endTime})'`;
          continue;
        }
      }
      
      // TEXTO NORMAL
      const xPerc = Math.max(0, Math.min(1, parseFloat(String(tc.x || '50')) / 100));
      const yPerc = Math.max(0, Math.min(1, parseFloat(String(tc.y || '50')) / 100));
      let style = `:fontcolor=0x${tc.color.replace('#','')}`;
      if (tc.strokeWidth > 0) {
        style += `:borderw=${Math.max(1, Math.round(tc.strokeWidth * (resH / 360)))}:bordercolor=0x${tc.strokeColor.replace('#','')}`;
      }
      // Escapa o caminho do arquivo para FFmpeg
      const escapedFontFile = fontFile.replace(/\\/g, '/').replace(/:/g, '\\:');
      current += `,drawtext=fontfile='${escapedFontFile}':text='${escaped}':fontsize=${size}${style}:x=(w-tw)*${xPerc}:y=(h-th)*${yPerc}:enable='between(t\\,${startTime}\\,${endTime})'`;
    }
    return current;
  }

  public async renderProject(clips: any[], settings: ExportSettings, progressCallback: (p: number) => void, logCallback?: (msg: string) => void, trackingData?: any[], fontCache?: Record<string, string>): Promise<string> {
    const log = (msg: string) => { console.log(msg); if (logCallback) logCallback(msg); };
    progressCallback(5);
    
    if (trackingData && trackingData.length > 0) {
      log(`[Motion Track] ${trackingData.length} track(s) recebido(s)`);
      trackingData.forEach(tr => log(`[Motion Track] - ID: ${tr.id}, Frames: ${tr.tracking_data?.length || 0}`));
    } else {
      log(`[Motion Track] Nenhum tracking data recebido`);
    }

    const allVideoClips = clips.filter(c => c.type === 'video' || c.type === 'image');
    const audioClips      = clips.filter(c => c.type === 'audio');
    const textClips       = clips.filter(c => c.type === 'text');

    const projectDuration = Math.max(0.1, ...clips.map(c => {
       const speed = c.config?.speed || 1;
       const dur = (c.duration - (c.trimStart||0) - (c.trimEnd||0)) / speed;
       return c.startTime + dur;
    }));

    let resW = 1920, resH = 1080;
    if (settings.resolution && settings.resolution !== 'original') {
      const parts = settings.resolution.split('x');
      resW = parseInt(parts[0]) || 1920;
      resH = parseInt(parts[1]) || 1080;
    }
    const crf = settings.quality === 'low' ? 28 : settings.quality === 'high' ? 18 : 23;
    const preset = settings.quality === 'low' ? 'veryfast' : settings.quality === 'high' ? 'slow' : 'medium';

    log(`🎬 Iniciando Exportação NLE (Multi-Track): ${resW}x${resH} @ ${settings.fps}fps`);
    await this.prepareFonts(textClips, log, fontCache);

    const markers = new Set<number>([0, projectDuration]);
    allVideoClips.forEach(c => {
      const dur = (c.duration - (c.trimStart||0) - (c.trimEnd||0)) / (c.config?.speed || 1);
      markers.add(Number(c.startTime.toFixed(3)));
      markers.add(Number((c.startTime + dur).toFixed(3)));
    });
    // Adiciona marcadores de início/fim de efeitos para segmentar corretamente
    clips.filter(c => c.type === 'effect').forEach(c => {
      const dur = c.duration - (c.trimStart||0) - (c.trimEnd||0);
      markers.add(Number(c.startTime.toFixed(3)));
      markers.add(Number((c.startTime + dur).toFixed(3)));
    });
    const sortedMarkers = Array.from(markers).sort((a, b) => a - b);
    const chunkFiles: string[] = [];

    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const start = sortedMarkers[i], end = sortedMarkers[i+1], duration = end - start;
      if (duration < 0.01) continue;
      const chunkPath = path.join(this.tempDir, `segment_${i}.mp4`);
      log(`🔧 Segmento ${i + 1}/${sortedMarkers.length - 1}: ${start.toFixed(2)}s -> ${end.toFixed(2)}s`);

      const activeVideos = allVideoClips.filter(c => {
        const dur = (c.duration - (c.trimStart||0) - (c.trimEnd||0)) / (c.config?.speed || 1);
        return c.startTime <= start + 0.005 && c.startTime + dur >= end - 0.005;
      }).sort((a, b) => a.track - b.track);
      
      const activeTransitions = clips.filter(c => c.type === 'transition' && c.startTime < end && (c.startTime + c.duration - (c.trimStart||0) - (c.trimEnd||0)) > start);
      if (activeTransitions.length > 0) {
        log(`🔄 ${activeTransitions.length} transições ativas: ${activeTransitions.map(t => `${t.effect} @ ${t.startTime.toFixed(2)}s`).join(', ')}`);
      }

      let cmdInputs = [`-f lavfi -i "color=c=black:s=${resW}x${resH}:r=${settings.fps}:d=${duration.toFixed(3)},format=yuv420p"`];
      let filterComplex = `[0:v]format=rgba[base];`;
      let lastLabel = 'base';

      for (let j = 0; j < activeVideos.length; j++) {
        const v = activeVideos[j], speed = v.config?.speed || 1;
        const offset = (start - v.startTime) * speed + (v.trimStart || 0);
        
        if (v.type === 'image') {
           cmdInputs.push(`-loop 1 -t ${(duration * speed).toFixed(4)} -i "${v.path}"`);
        } else {
           cmdInputs.push(`-ss ${offset.toFixed(4)} -t ${(duration * speed).toFixed(4)} -i "${v.path}"`);
        }
        
        const vIdx = j + 1;
        const scaleExpr = this.buildKfExpr(v, 'scale', 100, 1/100, offset);
        let xExpr     = this.buildKfExpr(v, 'x', 0, resH / 360, offset);
        let yExpr     = this.buildKfExpr(v, 'y', 0, resH / 360, offset);
        const b = (v.config?.brightness ?? 100) / 100 - 1;
        const c = (v.config?.contrast   ?? 100) / 100;
        const s = (v.config?.saturation ?? 100) / 100;

        // Aplicar transições ao movimento
        for (const trans of activeTransitions) {
          const transStart = Math.max(0, trans.startTime - start);
          const transEnd = Math.min(end - start, trans.startTime + trans.duration - (trans.trimStart||0) - (trans.trimEnd||0) - start);
          if (transEnd <= transStart) continue;
          const transDur = transEnd - transStart;
          
          const vEnd = v.startTime + (v.duration - (v.trimStart||0) - (v.trimEnd||0)) / speed;
          const isEntering = Math.abs(v.startTime - trans.startTime) < 0.1;
          const isLeaving = Math.abs(vEnd - trans.startTime) < 0.1;
          
          if (isEntering || isLeaving) {
            const tVar = `t-${transStart.toFixed(3)}`;
            const progress = `(${tVar})/${transDur.toFixed(3)}`;
            const p = isEntering ? `(1-${progress})` : progress;
            const condition = `between(t,${transStart.toFixed(3)},${transEnd.toFixed(3)})`;
            
            if (trans.effect === 'trans_up') {
              yExpr = `if(${condition},(${yExpr})+(${resH}*${p}),${yExpr})`;
            } else if (trans.effect === 'trans_down') {
              yExpr = `if(${condition},(${yExpr})-(${resH}*${p}),${yExpr})`;
            } else if (trans.effect === 'trans_left') {
              xExpr = `if(${condition},(${xExpr})+(${resW}*${p}),${xExpr})`;
            } else if (trans.effect === 'trans_right') {
              xExpr = `if(${condition},(${xExpr})-(${resW}*${p}),${xExpr})`;
            }
          }
        }

        const fitScale = `max(${resW}/iw,${resH}/ih)`;
        const finalScale = `(${fitScale}*${scaleExpr})`;

        let vFilt = `eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)},scale='iw*${finalScale}':-1:eval=frame:flags=lanczos,format=rgba`;
        // Only apply setpts if it's a video
        if (v.type === 'video') {
           vFilt += `,setpts=${(1/speed).toFixed(4)}*PTS`;
        }
        
        if (v.config?.chromaKey) {
          const color = (v.config.chromaColor || '#00ff00').replace('#', '0x');
          const sim = 0.05 + ((v.config.chromaSimilarity || 50) / 100) * 0.5;
          const blend = 0.02; 
          vFilt += `,chromakey=${color}:${sim.toFixed(4)}:${blend.toFixed(4)}`;
        }
        
        filterComplex += `[${vIdx}:v]${vFilt}[v${vIdx}];`;
        filterComplex += `[${lastLabel}][v${vIdx}]overlay=x='(W-w)/2+(${xExpr})':y='(H-h)/2+(${yExpr})':format=auto[tmp${vIdx}];`;
        lastLabel = `tmp${vIdx}`;
      }

      const activeTexts = textClips.filter(t => {
        const tEnd = t.startTime + (t.duration - (t.trimStart || 0) - (t.trimEnd || 0));
        return t.startTime < end && tEnd > start;
      });
      const activeEffects = clips.filter(c => c.type === 'effect' && c.startTime < end && (c.startTime + c.duration - (c.trimStart||0) - (c.trimEnd||0)) > start);

      let finalVf = `[${lastLabel}]null`;
      // Aplica efeitos no export — apenas efeitos com suporte FFmpeg estável
      for (const ef of activeEffects) {
        const efStart = Math.max(0, ef.startTime - start);
        const efEnd = Math.min(end - start, ef.startTime + ef.duration - (ef.trimStart||0) - (ef.trimEnd||0) - start);
        if (efEnd <= efStart) continue;
        const enable = `enable='between(t,${efStart.toFixed(3)},${efEnd.toFixed(3)})'`;
        const efDur = efEnd - efStart;
        
        if (ef.effect === 'blur') {
          const intensity = ef.config?.effectIntensity ?? 8;
          const sigma = Math.round(intensity * (resH / 360));
          finalVf += `,gblur=sigma=${sigma}:${enable}`;
        }
        else if (ef.effect === 'rotate') {
          const rotateExpr = `2*PI*(t-${efStart.toFixed(3)})/${efDur.toFixed(3)}`;
          finalVf += `,rotate='${rotateExpr}':c=black:${enable}`;
        }
        else if (ef.effect === 'fadein') {
          finalVf += `,fade=t=in:st=${efStart.toFixed(3)}:d=${efDur.toFixed(3)}:${enable}`;
        }
        else if (ef.effect === 'fadeout') {
          finalVf += `,fade=t=out:st=${efStart.toFixed(3)}:d=${efDur.toFixed(3)}:${enable}`;
        }
        else if (ef.effect === 'flipv') {
          finalVf += `,vflip=${enable}`;
        }
        else if (ef.effect === 'fliph') {
          finalVf += `,hflip=${enable}`;
        }
        // Filtros de cor - SOMENTE os que comprovadamente funcionam
        else if (ef.effect === 'sepia_pro') {
          finalVf += `,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:${enable}`;
        }
        else if (ef.effect === 'bw_classic') {
          finalVf += `,hue=s=0:${enable}`;
        }
        else if (ef.effect === 'dramatic') {
          finalVf += `,eq=contrast=1.5:saturation=0.6:brightness=-0.15:${enable}`;
        }
        else if (ef.effect === 'pastel') {
          finalVf += `,eq=saturation=0.5:brightness=0.15:${enable}`;
        }
      }
      if (activeTexts.length > 0) finalVf = this.applyTexts(finalVf, activeTexts, start, end, resH, resW, trackingData, settings.fps, log, fontCache);
      finalVf += `,format=yuv420p`;
      filterComplex += `${finalVf}[outv]`;

      const filterScriptPath = path.join(this.tempDir, `filter_script_v_${i}.txt`);
      
      // Escapa o filtro complexo para linha de comando
      const escapedFilter = filterComplex.replace(/"/g, '\\"');
      
      await this.execute([FFMPEG, '-y', ...cmdInputs, `-filter_complex "${escapedFilter}"`, `-map "[outv]" -c:v libx264 -crf ${crf} -preset ${preset} -an "${chunkPath}"`].join(' '), log);
      chunkFiles.push(chunkPath);
      progressCallback(10 + Math.round((i + 1) / (sortedMarkers.length - 1) * 70));
    }

    const listPath = path.join(this.tempDir, 'concat_list.txt');
    fs.writeFileSync(listPath, chunkFiles.map(f => `file '${path.basename(f)}'`).join('\n'));
    
    let videoOnly = path.join(this.tempDir, 'video_only.mp4');
    
    // Detecta transições entre clips CONSECUTIVOS na timeline
    const transitions = clips.filter(c => c.type === 'transition');
    
    if (transitions.length > 0 && allVideoClips.length >= 2) {
      log(`🔄 Aplicando ${transitions.length} transições com xfade...`);
      
      // Mapeia transições pro formato xfade
      const transMap: Record<string, string> = {
        'trans_up': 'slideup',
        'trans_down': 'slidedown',
        'trans_left': 'slideleft',
        'trans_right': 'slideright',
        'trans_flash': 'fadewhite',
        'fade': 'fade',
        'dissolve': 'dissolve',
        'wipeleft': 'wipeleft',
        'wiperight': 'wiperight',
        'wipeup': 'wipeup',
        'wipedown': 'wipedown',
        'wipetl': 'wipetl',
        'wipetr': 'wipetr',
        'wipebl': 'wipebl',
        'wipebr': 'wipebr',
        'circlecrop': 'circlecrop',
        'rectcrop': 'rectcrop',
        'circleopen': 'circleopen',
        'circleclose': 'circleclose',
        'vertopen': 'vertopen',
        'vertclose': 'vertclose',
        'horzopen': 'horzopen',
        'horzclose': 'horzclose',
        'smoothleft': 'smoothleft',
        'smoothright': 'smoothright',
        'smoothup': 'smoothup',
        'smoothdown': 'smoothdown',
        'diagtl': 'diagtl',
        'diagtr': 'diagtr',
        'diagbl': 'diagbl',
        'diagbr': 'diagbr',
        'hlslice': 'hlslice',
        'hrslice': 'hrslice',
        'vuslice': 'vuslice',
        'vdslice': 'vdslice',
        'distance': 'distance',
        'fadeblack': 'fadeblack',
        'radial': 'radial',
        'pixelize': 'pixelize',
        'hblur': 'hblur',
        'fadegrays': 'fadegrays',
        'squeezeh': 'squeezeh',
        'squeezev': 'squeezev'
      };
      
      // Ordena clips por startTime
      const sortedClips = [...allVideoClips].sort((a, b) => a.startTime - b.startTime);
      
      // Procura pares de clips com transição
      const clipPairs: Array<{clip1: any, clip2: any, trans: any}> = [];
      for (let i = 0; i < sortedClips.length - 1; i++) {
        const clip1 = sortedClips[i];
        const clip2 = sortedClips[i + 1];
        const clip1End = clip1.startTime + (clip1.duration - (clip1.trimStart||0) - (clip1.trimEnd||0)) / (clip1.config?.speed || 1);
        
        log(`🔍 Verificando: clip1="${clip1.name}" (${clip1.startTime.toFixed(2)}s-${clip1End.toFixed(2)}s) → clip2="${clip2.name}" (${clip2.startTime.toFixed(2)}s)`);
        
        // Verifica se há transição que OVERLAP com o fim do clip1 e início do clip2
        const trans = transitions.find(t => {
          const transStart = t.startTime;
          const transEnd = transStart + (t.duration - (t.trimStart||0) - (t.trimEnd||0));
          
          // Transição deve começar antes do fim de clip1 e terminar depois do início de clip2
          const overlapsClip1 = transStart < clip1End && transEnd > clip1End - 1;
          const overlapsClip2 = transEnd > clip2.startTime && transStart < clip2.startTime + 1;
          
          log(`  Trans ${t.effect} @ ${transStart.toFixed(2)}s-${transEnd.toFixed(2)}s: overlap1=${overlapsClip1} overlap2=${overlapsClip2}`);
          
          return overlapsClip1 || overlapsClip2;
        });
        
        if (trans) {
          clipPairs.push({clip1, clip2, trans});
          log(`✓ Transição ${trans.effect} entre "${clip1.name}" e "${clip2.name}"`);
        }
      }
      
      if (clipPairs.length > 0) {
        log(`📹 Aplicando ${clipPairs.length} transições com xfade...`);
        
        try {
          // Constrói comando com múltiplos xfades em um único filtro complexo
          let inputs = '';
          let filterComplex = '';
          
          for (let i = 0; i < chunkFiles.length; i++) {
            inputs += `-i "${chunkFiles[i]}" `;
          }
          
          // Aplica xfades progressivamente
          // xfade funciona assim: pega 2 inputs, faz overlap, offset é quando começa a transição no primeiro input
          let currentLabel = '[0:v]';
          let currentVideoDuration = 0; // Duração do vídeo atual (que vai sendo o resultado dos xfades)
          
          for (let pairIdx = 0; pairIdx < clipPairs.length; pairIdx++) {
            const pair = clipPairs[pairIdx];
            const transType = transMap[pair.trans.effect] || 'fade';
            const transDuration = Math.min(2, pair.trans.duration - (pair.trans.trimStart||0) - (pair.trans.trimEnd||0));
            
            // IMPORTANTE: clipDuration aqui é a duração do SEGMENT que foi gerado, não do clip original
            // Precisamos pegar a duração do segment_X.mp4
            const segmentIdx = pairIdx;
            const nextSegmentIdx = pairIdx + 1;
            
            // Para calcular corretamente, vamos usar a duração dos segments que foram criados
            // Segment duration = markers[i+1] - markers[i]
            const clipDuration = (pair.clip1.duration - (pair.clip1.trimStart||0) - (pair.clip1.trimEnd||0)) / (pair.clip1.config?.speed || 1);
            const nextClipDuration = (pair.clip2.duration - (pair.clip2.trimStart||0) - (pair.clip2.trimEnd||0)) / (pair.clip2.config?.speed || 1);
            
            if (pairIdx === 0) {
              // Primeiro xfade: input é segment[0], duração conhecida
              currentVideoDuration = clipDuration;
            }
            
            // Offset: quando começa a transição no vídeo atual (antes do fim)
            const offset = currentVideoDuration - transDuration;
            
            // Resultado deste xfade: duração atual + próximo clip - overlap
            const resultDuration = currentVideoDuration + nextClipDuration - transDuration;
            
            const nextIdx = pairIdx + 1;
            const nextLabel = `[${nextIdx}:v]`;
            const outLabel = pairIdx === clipPairs.length - 1 ? '[outv]' : `[xf${pairIdx}]`;
            
            log(`  [${pairIdx + 1}/${clipPairs.length}] ${transType}, dur=${transDuration.toFixed(2)}s, offset=${offset.toFixed(2)}s`);
            log(`    Matemática: segment[${segmentIdx}]=${currentVideoDuration.toFixed(2)}s + segment[${nextSegmentIdx}]=${nextClipDuration.toFixed(2)}s - overlap=${transDuration.toFixed(2)}s = ${resultDuration.toFixed(2)}s`);
            
            filterComplex += `${currentLabel}${nextLabel}xfade=transition=${transType}:duration=${transDuration.toFixed(3)}:offset=${Math.max(0.1, offset).toFixed(3)}${outLabel};`;
            currentLabel = outLabel;
            currentVideoDuration = resultDuration; // Atualiza pra próxima iteração
            
            // Marca ajuste de áudio com acumulação correta
            // Cada clip precisa saber quantas transições aconteceram ANTES dele
            (pair.clip2 as any)._xfadeAdjustment = transDuration;
            (pair.clip2 as any)._xfadeCount = pairIdx + 1; // Quantas transições antes deste clip
          }
          
          // Remove último ponto e vírgula
          filterComplex = filterComplex.replace(/;$/, '');
          
          log(`🔧 Filter complex: ${filterComplex}`);
          
          const xfadePath = path.join(this.tempDir, 'video_all_xfades.mp4');
          const xfadeFullCmd = `ffmpeg -y ${inputs}-filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -preset medium -crf 23 "${xfadePath}"`;
          
          log(`🔧 Comando FFmpeg: ${xfadeFullCmd.substring(0, 200)}...`);
          
          await this.execute(xfadeFullCmd, log);
          
          // Se há segmentos não usados, concatena
          if (chunkFiles.length > clipPairs.length + 1) {
            const remainingList = path.join(this.tempDir, 'remaining_list.txt');
            const remainingFiles = [`file '${path.basename(xfadePath)}'`, ...chunkFiles.slice(clipPairs.length + 1).map(f => `file '${path.basename(f)}'`)];
            fs.writeFileSync(remainingList, remainingFiles.join('\n'));
            await this.execute(`ffmpeg -y -f concat -safe 0 -i "${remainingList}" -c copy "${videoOnly}"`, log);
          } else {
            videoOnly = xfadePath;
          }
        } catch (err) {
          log(`⚠️ Erro ao aplicar múltiplas transições: ${err}`);
          log(`⚠️ Usando concat normal`);
          await this.execute(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${videoOnly}"`, log);
        }
      } else {
        log(`⚠️ Nenhuma transição válida entre clips consecutivos`);
        await this.execute(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${videoOnly}"`, log);
      }
    } else {
      await this.execute(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${videoOnly}"`, log);
    }

    log(`🔊 Mixagem final de áudio...`);
    let finalOutput = settings.outputPath;
    if (fs.existsSync(finalOutput) && fs.statSync(finalOutput).isDirectory()) {
      const sanitizedTitle = ((settings as any).title || `export_${Date.now()}`).replace(/[<>:"/\\|?*]/g, '_');
      finalOutput = path.join(finalOutput, `${sanitizedTitle}.${settings.format || 'mp4'}`);
    }

    let audioInputs = [`-i "${videoOnly}"`], audioFilter = '', mixCount = 0;
    const allClipsForAudio = clips.filter(c => c.type === 'video' || c.type === 'audio');
    log(`[Export Audio] Total de clips com áudio: ${allClipsForAudio.length}`);
    
    for (let i = 0; i < allClipsForAudio.length; i++) {
      const c = allClipsForAudio[i], speed = c.config?.speed || 1;
      const aStart = c.trimStart || 0, aDur = (c.duration - aStart - (c.trimEnd || 0)) / speed;
      const volPercent = (c.config?.volume ?? 100);
      
      log(`[Export Audio] Clip ${i}: name="${c.name}" volume=${volPercent}% duration=${aDur.toFixed(2)}s`);
      
      if (aDur <= 0.05) {
        log(`[Export Audio] Pulando clip ${i}: duração muito curta`);
        continue;
      }
      
      audioInputs.push(`-ss ${aStart.toFixed(3)} -t ${(aDur * speed).toFixed(3)} -i "${c.path}"`);
      
      // Ajusta delay se clip foi afetado por xfade(s)
      let adjustedStartTime = c.startTime;
      let totalXfadeReduction = 0;
      
      // Precisa somar TODAS as transições que aconteceram antes deste clip
      if ((c as any)._xfadeCount) {
        // Este clip é o clip2 de um xfade, então teve N transições antes dele
        const xfadeCount = (c as any)._xfadeCount;
        const xfadeAdjustment = (c as any)._xfadeAdjustment;
        
        // Calcula quanto tempo foi perdido com TODAS as transições anteriores
        // Cada xfade encurta o vídeo, então precisamos somar todas
        for (let j = 0; j < i; j++) {
          if ((allClipsForAudio[j] as any)._xfadeAdjustment) {
            totalXfadeReduction += (allClipsForAudio[j] as any)._xfadeAdjustment;
          }
        }
        // Adiciona a própria transição deste clip
        totalXfadeReduction += xfadeAdjustment;
        
        adjustedStartTime -= totalXfadeReduction;
        log(`[Export Audio] Ajustando delay por ${xfadeCount} xfades: -${totalXfadeReduction.toFixed(3)}s`);
      }
      
      const delay = Math.max(0, adjustedStartTime * 1000).toFixed(0), vol = volPercent / 100;
      log(`[Export Audio] Aplicando: volume=${vol.toFixed(3)} (${volPercent}%), delay=${delay}ms`);
      
      let f = `volume=${vol}`;
      if (c.config?.denoise) {
        f += `,afftdn=nr=18:nf=-30,anlmdn=s=0.0005,highpass=f=200,lowpass=f=8000`;
      }
      if (speed !== 1) f += `,atempo=${speed}`;
      
      // Usamos mixCount para garantir índices contínuos [a0], [a1]... mesmo se pularmos clipes
      audioFilter += `[${audioInputs.length - 1}:a]${f},adelay=${delay}|${delay}|${delay}|${delay}|${delay}|${delay}[a${mixCount}];`;
      mixCount++;
    }
    
    log(`[Export Audio] Total de ${mixCount} faixas de áudio para mixar`);

    if (mixCount > 0) {
      const mixInputs = Array.from({length: mixCount}, (_, i) => `[a${i}]`).join('');
      // duration=longest evita que o primeiro clipe (ex: um vídeo curto) silencie o resto (ex: o narrador)
      audioFilter += `${mixInputs}amix=inputs=${mixCount}:duration=longest[outa]`;
      // -shortest garante que o arquivo final termine junto com o vídeo, cortando excessos de áudio
      const escapedAudioFilter = audioFilter.replace(/"/g, '\\"');
      await this.execute([FFMPEG, '-y', ...audioInputs, `-filter_complex "${escapedAudioFilter}"`, `-map 0:v -map "[outa]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${finalOutput}"`].join(' '), log);
    } else {
      fs.copyFileSync(videoOnly, finalOutput);
    }

    progressCallback(100);
    log(`✅ Exportação concluída com sucesso!`);
    return finalOutput;
  }
}
