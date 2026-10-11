import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Film, Music, Type, Scissors, Zap, Upload, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, Plus, Trash2,
  ChevronLeft, ChevronRight, Download, Layers, Clock, Star,
  Sparkles, PlusCircle, FilePlus, Moon, Tv, Sun, Camera,
  Skull, Cloud, Disc, Coffee, Minimize, Move, Heart,
  Waves, Wind, Ghost, Monitor, PlusSquare,
  Aperture, Palette, Search, Save, FolderOpen, Filter, Eye,
  User, UserCheck, Mic, Undo2, Redo2, Maximize2, Minimize2, ChevronUp, ChevronDown, 
  GitMerge, Share2, Activity, Box, Settings2, Sliders, ExternalLink, Image,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Target, X
} from 'lucide-react';
import './VideoEditor.css';
import WebGLPreview from './WebGLPreview';
import { exportWithWebCodecs } from './WebCodecsExporter';
import { MotionTracker, TrackingData } from './MotionTracker';

export interface VideoClip {
  id: string;
  name: string;
  path: string;
  url: string;
  duration: number;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  type: 'video' | 'audio' | 'image' | 'text' | 'effect' | 'transition';
  volume?: number;
  track: number;
  textConfig?: {
    content: string;
    fontSize: number;
    color: string;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
    x: string;
    y: string;
    strokeColor?: string;
    strokeWidth?: number;
    width?: number;
  };
  config?: {
    scale?: number;
    opacity?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    highlight?: number;
    shadow?: number;
    vignette?: number;
    volume?: number;
    speed?: number;
    chromaKey?: boolean;
    chromaColor?: string;
    chromaSimilarity?: number;
    chromaSmoothness?: number;
    denoise?: boolean;
    aiDenoised?: boolean;
    originalPath?: string;
    x?: number;
    y?: number;
    trackId?: string; // ID do track a seguir
    blur?: number; // Intensidade de blur (para efeitos de censura)
  };
  keyframes?: {
    time: number; // relativo ao início do clipe
    scale?: number;
    x?: number;
    y?: number;
    opacity?: number;
  }[];
  effect?: string;
}

// Componente para gerar e exibir miniaturas (filmstrip) nos blocos de Vídeo da timeline
const VideoFilmstrip = ({ clip, zoom }: { clip: any; zoom: number }) => {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (clip.type === 'image') {
      setThumbnails([clip.url, clip.url, clip.url, clip.url]);
      return;
    }

    // Se for um mini-clip gerado por corte automático, desabilita a miniatura para economizar CPU/Memória
    if (clip.id.includes('autocut') || clip.id.includes('_cut_')) {
      setThumbnails([]);
      return;
    }

    let active = true;
    let video: HTMLVideoElement | null = null;
    let safetyTimer: NodeJS.Timeout | null = null;

    // Debounce a geraçãoo de miniaturas para evitar recriação de decoders durante o arrasto/redimensionamento
    const debounceTimer = setTimeout(() => {
      if (!active) return;

      video = document.createElement('video');
      video.src = clip.url;
      video.muted = true;
      video.preload = 'auto';

      const duration = clip.duration || 10;
      const count = Math.min(5, Math.max(2, Math.floor((duration - clip.trimStart - clip.trimEnd) / 3)));
      const frames: string[] = [];

      const handleLoadedMetadata = () => {
        if (!active || !video) return;
        
        let currentFrameIdx = 0;
        const getNextFrame = () => {
          if (!active || !video) return;
          if (currentFrameIdx >= count) {
            setThumbnails(frames);
            video.remove();
            video = null;
            return;
          }

          const progress = currentFrameIdx / (count - 1 || 1);
          const effectiveDur = duration - clip.trimStart - clip.trimEnd;
          const time = clip.trimStart + progress * effectiveDur;

          video.currentTime = Math.min(duration - 0.1, Math.max(0.1, time));
        };

        const handleSeeked = () => {
          if (!active || !video) return;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 56;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              frames.push(canvas.toDataURL('image/jpeg', 0.4));
            }
          } catch (e) {
            console.error("Erro ao gerar miniatura:", e);
          }
          currentFrameIdx++;
          getNextFrame();
        };

        video.addEventListener('seeked', handleSeeked);
        getNextFrame();
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      safetyTimer = setTimeout(() => {
        if (!active || !video) return;
        if (video.duration) {
          handleLoadedMetadata();
        } else {
          video.remove();
          video = null;
        }
      }, 3000);
    }, 300);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
      if (video) {
        video.remove();
        video = null;
      }
    };
  }, [clip.url, clip.trimStart, clip.trimEnd, clip.duration]);

  return (
    <div 
      className="ve-clip-filmstrip" 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        display: 'flex', 
        overflow: 'hidden', 
        pointerEvents: 'none', 
        zIndex: 1, 
        opacity: 0.18,
        mixBlendMode: 'luminosity'
      }}
    >
      {thumbnails.map((url, i) => (
        <img 
          key={i} 
          src={url} 
          style={{ 
            height: '100%', 
            flexGrow: 1, 
            objectFit: 'cover', 
            minWidth: '25px',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)'
          }} 
        />
      ))}
    </div>
  );
};

export interface VideoEditorHandle {
  applyAIAction: (action: string, payload: any) => string;
  getEditorState: () => any;
  loadProjectById?: (projectId: string) => Promise<void>;
}

interface VideoEditorProps {
  onAddToTerminal: (line: string) => void;
  onExecuteCommand?: (cmd: string) => Promise<any>;
  onStateChange?: (state: any) => void;
  workFolder?: string;
  leftOpen?: boolean;
  chatHistory?: any[];
  onUpdateChatHistory?: (history: any[]) => void;
  onProjectAction?: (action: string) => void;
  activeProject?: { id: string; name: string; description: string; blockType: string; workFolder?: string; saveId?: string } | null;
  onUpdatePreview?: (previewDataUrl: string) => void;
}


// Componente para processamento de Chroma Key em tempo real via Canvas
const ChromaCanvas = ({ clipId, mediaRefs, config, style, className, onMouseDown }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameTimeRef = useRef<number>(0);
  
  useEffect(() => {
    if (!canvasRef.current || !config.chromaKey) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    let animationId: number;
    
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 255, b: 0 };
    };
    
    const keyColor = hexToRgb(config.chromaColor || '#00ff00');
    
    const render = (now: number) => {
      // Throttle: render no máximo a 30fps para chroma key (otimização de performance)
      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed < 33) {
        animationId = requestAnimationFrame(render);
        return;
      }
      lastFrameTimeRef.current = now;
      
      const media = mediaRefs.current[clipId];
      if (!media) {
        animationId = requestAnimationFrame(render);
        return;
      }
      
      try {
        const srcWidth = media.videoWidth || media.naturalWidth || 0;
        const srcHeight = media.videoHeight || media.naturalHeight || 0;
        
        if (srcWidth > 0 && (canvas.width !== srcWidth || canvas.height !== srcHeight)) {
          canvas.width = srcWidth;
          canvas.height = srcHeight;
        }
        
        ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;
        const len = data.length;
        
        const similarity = (config.chromaSimilarity || 50) / 100;
        const smoothness = (config.chromaSmoothness || 10) / 100;
        
        const isGreen = keyColor.g > keyColor.r * 1.2 && keyColor.g > keyColor.b * 1.2;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          let score = 0;
          if (isGreen) {
            score = (g - Math.max(r, b)) / 255;
            const threshold = similarity * 0.4;
            if (score > threshold) {
              data[i + 3] = 0;
            } else if (score > threshold - smoothness) {
              data[i+3] = Math.max(0, 1 - (score - (threshold - smoothness)) / smoothness) * 255;
            }
          } else {
            const rDiff = (r - keyColor.r) / 255;
            const gDiff = (g - keyColor.g) / 255;
            const bDiff = (b - keyColor.b) / 255;
            const dist = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
            
            if (dist < similarity) {
              data[i + 3] = 0;
            } else if (dist < similarity + smoothness) {
              data[i + 3] = ((dist - similarity) / smoothness) * 255;
            }
          }
        }
        
        ctx.putImageData(frame, 0, 0);
      } catch (e) { }
      
      animationId = requestAnimationFrame(render);
    };
    
    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [clipId, mediaRefs, config.chromaKey, config.chromaColor, config.chromaSimilarity, config.chromaSmoothness]);
  
  return (
    <canvas 
      ref={canvasRef} 
      style={style} 
      className={className}
      onMouseDown={onMouseDown}
    />
  );
};


const pathToFileUrl = (filePath: string) => {
  return `file:///${filePath.replace(/\\/g, '/')}`;
};

const generateWaveformSVG = (peaks: number[]): string => {
  const height = 60;
  const barWidth = 3;
  const gap = 2;
  const totalBarWidth = barWidth + gap;
  const numBars = peaks.length;
  
  let rects = '';
  for (let i = 0; i < numBars; i++) {
    const peak = peaks[i] || 0.05;
    const barHeight = Math.max(4, Math.round(peak * height * 0.85));
    const x = i * totalBarWidth;
    const y = (height - barHeight) / 2;
    rects += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="1.5" fill="#ffffff" opacity="0.75"/>`;
  }
  
  const svgWidth = numBars * totalBarWidth;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${height}" viewBox="0 0 ${svgWidth} ${height}" preserveAspectRatio="none">${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const generateMockPeaks = (duration: number): number[] => {
  const numBars = Math.max(30, Math.round(duration * 10));
  const peaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    const progress = i / numBars;
    const amp = Math.sin(progress * Math.PI * 4) * Math.cos(progress * Math.PI * 1.5);
    const noise = Math.random() * 0.15;
    peaks.push(Math.min(1.0, Math.max(0.05, Math.abs(amp) * 0.75 + noise)));
  }
  return peaks;
};

const downsamplePeaks = (peaks: number[], targetCount: number): number[] => {
  if (!peaks || peaks.length === 0) return Array(targetCount).fill(0.05);
  if (peaks.length <= targetCount) return peaks;
  const result: number[] = [];
  const step = peaks.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let max = 0;
    for (let j = start; j < end; j++) {
      if (peaks[j] > max) max = peaks[j];
    }
    result.push(max);
  }
  return result;
};

const getTrimmedPeaks = (peaks: number[], trimStart: number, trimEnd: number, duration: number): number[] => {
  if (!peaks || peaks.length === 0) return [];
  const startIdx = Math.floor((trimStart / duration) * peaks.length);
  const endIdx = Math.floor(((duration - trimEnd) / duration) * peaks.length);
  return peaks.slice(Math.max(0, startIdx), Math.min(peaks.length, endIdx));
};

const getEffectiveDur = (c: VideoClip) => {
  if (c.type !== 'video' && c.type !== 'audio') return c.duration - c.trimStart - c.trimEnd;
  return (c.duration - c.trimStart - c.trimEnd) / (c.config?.speed || 1);
};

export const getMediaDuration = (url: string): Promise<number> =>
  new Promise(resolve => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => resolve(0);
    el.src = url;
  });

// Função para interpolar valores entre keyframes
const getInterpolatedValue = (clip: VideoClip, property: 'scale' | 'x' | 'y' | 'opacity', currentTime: number, defaultValue: number) => {
  if (!clip.keyframes || clip.keyframes.length < 2) {
    if (property === 'scale') return (clip.config?.scale ?? 100);
    if (property === 'x') return (clip.config?.x ?? 0);
    if (property === 'y') return (clip.config?.y ?? 0);
    if (property === 'opacity') return (clip.config?.opacity ?? 100);
    return defaultValue;
  }

  const clipRelTime = (currentTime - clip.startTime) * (clip.config?.speed || 1);
  const sorted = [...clip.keyframes].sort((a, b) => a.time - b.time);
  
  // Se estiver antes do primeiro keyframe ou depois do último, volta pro padrão
  if (clipRelTime < sorted[0].time || clipRelTime > sorted[sorted.length - 1].time) {
    if (property === 'scale') return (clip.config?.scale ?? 100);
    if (property === 'x') return (clip.config?.x ?? 0);
    if (property === 'y') return (clip.config?.y ?? 0);
    if (property === 'opacity') return (clip.config?.opacity ?? 100);
    return defaultValue;
  }
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i];
    const k2 = sorted[i+1];
    if (clipRelTime >= k1.time && clipRelTime <= k2.time) {
      const v1 = k1[property] ?? (property === 'scale' || property === 'opacity' ? 100 : 0);
      const v2 = k2[property] ?? (property === 'scale' || property === 'opacity' ? 100 : 0);
      const t = (clipRelTime - k1.time) / (k2.time - k1.time);
      return v1 + (v2 - v1) * t;
    }
  }
  return defaultValue;
};

const VideoEditor = forwardRef(function VideoEditor(
  { onAddToTerminal, onExecuteCommand, onStateChange, workFolder, leftOpen, chatHistory, onUpdateChatHistory, onProjectAction, activeProject, onUpdatePreview }: VideoEditorProps,
  ref: React.ForwardedRef<VideoEditorHandle>
) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const clipsRef = useRef<VideoClip[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  
  // Debug WebCodecs availability
  useEffect(() => {
    console.log('[WebCodecs Debug] VideoEncoder:', typeof VideoEncoder !== 'undefined');
    console.log('[WebCodecs Debug] User Agent:', navigator.userAgent);
    console.log('[WebCodecs Debug] Chrome version:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown');
  }, []);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [zoom, setZoom] = useState(60);
  const [activeTab, setActiveTab] = useState<'media' | 'text' | 'effects' | 'filters' | 'transitions' | 'export' | 'narrator'>('media');
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'video' | 'audio' | 'narrator' | 'image-ai' | 'subtitle'>('video');
  const [narratorText, setNarratorText] = useState("");
  const [narratorVoice, setNarratorVoice] = useState<string>('faber');
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [imageAIPrompt, setImageAIPrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);
  const [previewQuality, setPreviewQuality] = useState<'144p' | '480p' | 'Original'>('Original');
  const [exportSettings, setExportSettings] = useState({
    format: 'mp4',
    resolution: '1920x1080',
    fps: 30,
    quality: 'high',
    outputPath: 'C:\\Users\\Administrator\\Videos\\BillCodeExports'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showSubtitleModeModal, setShowSubtitleModeModal] = useState(false);
  const [selectedSubtitleMode, setSelectedSubtitleMode] = useState<'normal' | 'word-by-word' | 'karaoke'>('normal');
  const [isAutoCutting, setIsAutoCutting] = useState(false);
  const [isIsolatingVoice, setIsIsolatingVoice] = useState(false);
  const [selectedKeyframeTime, setSelectedKeyframeTime] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('Novo Projeto');
  const [showMotionTracker, setShowMotionTracker] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingData[]>([]);

  const [fontFamilies, setFontFamilies] = useState<string[]>([
    'Outfit', 'JetBrains Mono', 'Arial', 'Helvetica', 'Times New Roman',
    'Courier New', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS',
    'Trebuchet MS', 'Tahoma', 'Roboto', 'Inter', 'Montserrat', 'Open Sans',
    'Lato', 'Poppins', 'Playfair Display', 'Oswald'
  ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).electronAPI.getSystemFonts();
        if (res && res.success && res.fonts) {
          const merged = Array.from(new Set([
            'Outfit', 'JetBrains Mono', 'Arial', 'Helvetica', 'Times New Roman',
            'Courier New', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS',
            'Trebuchet MS', 'Tahoma', 'Roboto', 'Inter', 'Montserrat', 'Open Sans',
            'Lato', 'Poppins', 'Playfair Display', 'Oswald',
            ...res.fonts
          ])).sort();
          setFontFamilies(merged);
        }
      } catch (e) {}
    })();
  }, []);

  const mediaRefs = useRef<{[id: string]: any}>({});
  const playingInitializedClipsRef = useRef<Set<string>>(new Set());
  const previewRefs = useRef<{[id: string]: HTMLDivElement | null}>({});
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null); // ref para atualizar progress bar direto no DOM
  // Zoom e pan do preview
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const previewPanningRef = useRef(false);
  const previewPanStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const lastMouseMoveEventRef = useRef<MouseEvent | null>(null);
  const handleAutoCutRef = useRef<(() => void) | null>(null);
  const handleAutoSubtitleRef = useRef<(() => void) | null>(null);
  const handleStartExportRef = useRef<(() => void) | null>(null);
  const [previewHeight, setPreviewHeight] = useState(360);
  const [previewScreenSize, setPreviewScreenSize] = useState({ w: 640, h: 360 });
  const previewScreenRef = useRef<HTMLDivElement>(null);
  
  // Real-time Audio Processing (Preview Denoise/Boost)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{[id: string]: { source: MediaElementAudioSourceNode, filter: BiquadFilterNode, boost: BiquadFilterNode, compressor: DynamicsCompressorNode, gain: GainNode }}>({});

  const connectSingleAudioNode = useCallback((clip: VideoClip, media: HTMLMediaElement) => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const mediaWithConn = media as any;
    
    // Se já conectado, apenas atualiza o ganho
    if (mediaWithConn.__connected) {
      const nodes = audioNodesRef.current[clip.id];
      if (nodes) {
        const targetGain = (clip.config?.volume ?? 100) / 100;
        if (nodes.gain.gain.value !== targetGain) {
          nodes.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
        }
      }
      return;
    }

    try {
      const source = ctx.createMediaElementSource(media);
      const filter = ctx.createBiquadFilter();
      const boost = ctx.createBiquadFilter();
      const compressor = ctx.createDynamicsCompressor();
      const gain = ctx.createGain();
      
      filter.type = 'lowpass'; filter.frequency.value = 4000;
      boost.type = 'highpass'; boost.frequency.value = 300;

      // Definir volume inicial imediatamente no GainNode para manter o volume persistente!
      const targetGain = (clip.config?.volume ?? 100) / 100;
      gain.gain.value = targetGain;

      audioNodesRef.current[clip.id] = { source, filter, boost, compressor, gain };
      source.connect(gain);
      gain.connect(ctx.destination);
      
      media.volume = 1; // Deixa o volume nativo em 100% e controla via GainNode
      mediaWithConn.__connected = true; 
      console.log(`[AudioEngine] Connected: ${clip.id} com volume ${targetGain * 100}%`);
    } catch(e) {
      console.warn(`[AudioEngine] Skip: ${clip.id}`, e);
    }
  }, []);

  useEffect(() => {
    clips.forEach(clip => {
      const media = mediaRefs.current[clip.id];
      if (media && (clip.type === 'video' || clip.type === 'audio')) connectSingleAudioNode(clip, media as any);
    });
  }, [clips, connectSingleAudioNode]);

  // Auto-save project with preview
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[VideoEditor] Sem saveId, não salvando');
      return;
    }
    
    const saveKey = `bill-video-${activeProject.saveId}`;
    console.log('[VideoEditor] Auto-salvando com chave:', saveKey);
    
    const timer = setTimeout(() => {
      try {
        const saveData = {
          clips,
          projectTitle,
          videoAspectRatio,
          exportSettings,
        };
        
        localStorage.setItem(saveKey, JSON.stringify(saveData));
        console.log('[VideoEditor] Salvo com sucesso');
        
        // Captura preview (primeiro frame do primeiro clip ou canvas vazio)
        if (onUpdatePreview) {
          setTimeout(async () => {
            // Tenta capturar primeiro clip de vídeo
            const firstVideoClip = clips.find(c => c.type === 'video');
            if (firstVideoClip) {
              // Tenta usar mediaRef existente
              let video = mediaRefs.current[firstVideoClip.id] as HTMLVideoElement;
              
              // Se não existe, cria temporário para captura
              if (!video || !video.readyState || video.readyState < 2) {
                console.log('[VideoEditor] Criando vídeo temporário para preview');
                video = document.createElement('video');
                video.src = firstVideoClip.url;
                video.muted = true;
                video.crossOrigin = 'anonymous';
                
                // Aguarda carregar metadados
                await new Promise<void>((resolve) => {
                  video.onloadedmetadata = () => {
                    video.currentTime = firstVideoClip.trimStart || 0.1;
                    resolve();
                  };
                  video.onerror = () => resolve(); // Ignora erro
                  setTimeout(() => resolve(), 2000); // Timeout 2s
                });
                
                // Aguarda seek completar
                await new Promise<void>((resolve) => {
                  video.onseeked = () => resolve();
                  setTimeout(() => resolve(), 1000); // Timeout 1s
                });
              }
              
              // Captura frame
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const previewUrl = canvas.toDataURL('image/png');
                  console.log('[VideoEditor] Preview capturado, tamanho:', previewUrl.length);
                  onUpdatePreview(previewUrl);
                } catch (err) {
                  console.log('[VideoEditor] Erro ao capturar preview do vídeo:', err);
                  // Fallback: placeholder
                  ctx.fillStyle = '#0a0a12';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = '#666';
                  ctx.font = '20px Inter';
                  ctx.textAlign = 'center';
                  ctx.fillText('Projeto de Vídeo', canvas.width / 2, canvas.height / 2);
                  const previewUrl = canvas.toDataURL('image/png');
                  onUpdatePreview(previewUrl);
                }
              }
            } else {
              // Sem clips, usa preview vazio/placeholder
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#0a0a12';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#666';
                ctx.font = '20px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('Projeto de Vídeo', canvas.width / 2, canvas.height / 2);
                const previewUrl = canvas.toDataURL('image/png');
                onUpdatePreview(previewUrl);
              }
            }
          }, 500); // Aumentei delay para 500ms
        }
      } catch (err) {
        console.error('[VideoEditor] Erro ao salvar:', err);
      }
    }, 2000); // Salva 2s após última mudança
    
    return () => clearTimeout(timer);
  }, [clips, projectTitle, videoAspectRatio, exportSettings, activeProject, onUpdatePreview]);

  // Auto-load project when activeProject changes
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[VideoEditor] Sem saveId no projeto, usando timeline limpa');
      return;
    }
    
    const saveKey = `bill-video-${activeProject.saveId}`;
    console.log('[VideoEditor] Tentando carregar save com chave:', saveKey);
    
    try {
      const savedData = localStorage.getItem(saveKey);
      if (!savedData) {
        console.log('[VideoEditor] Nenhum save encontrado, usando timeline limpa');
        return;
      }
      
      const data = JSON.parse(savedData);
      console.log('[VideoEditor] Save encontrado, restaurando projeto:', activeProject.name);
      
      setClips(data.clips || []);
      setProjectTitle(data.projectTitle || 'Novo Projeto');
      setVideoAspectRatio(data.videoAspectRatio || 16 / 9);
      setExportSettings(data.exportSettings || exportSettings);
      
      console.log('[VideoEditor] Projeto restaurado com sucesso');
    } catch (err) {
      console.error('[VideoEditor] Erro ao carregar save:', err);
    }
  }, [activeProject?.saveId]);

  // Limpa timeline quando activeProject fica null (usuário fechou o projeto)
  useEffect(() => {
    if (!activeProject) {
      console.log('[VideoEditor] Projeto fechado - limpando timeline');
      setClips([]);
      setProjectTitle('Novo Projeto');
      setSelectedClipId(null);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setPreviewHeight(entry.contentRect.height);
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewScreenRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setPreviewScreenSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(previewScreenRef.current);
    return () => observer.disconnect();
  }, []);

  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [potentialDragClipId, setPotentialDragClipId] = useState<string | null>(null); // Marca clique mas não arrasto ainda
  const dragActivatedRef = useRef(false); // Flag que marca se o drag foi realmente ativado
  const [resizingClipId, setResizingClipId] = useState<string | null>(null);
  const [resizeSide, setResizeSide] = useState<'l' | 'r' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, track: 0, y: 0 });
  // Ref que captura a posição EXATA do mousedown â€” evita saltos ao simples clique
  const dragOriginRef = useRef<{ x: number; y: number; track: number } | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [resizingTextWidthId, setResizingTextWidthId] = useState<string | null>(null);
  const [initialTextWidth, setInitialTextWidth] = useState<number | null>(null);
  const [draggingVideoId, setDraggingVideoId] = useState<string | null>(null);
  const [videoDragOffset, setVideoDragOffset] = useState({ x: 0, y: 0 });
  const [initialFontSize, setInitialFontSize] = useState(32);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isScrubbingRef = useRef(false); // ref síncrono para uso no animation frame
  const [snapGuide, setSnapGuide] = useState({ x: false, y: false });
  const [waveforms, setWaveforms] = useState<{ [id: string]: string }>({});
  const [clipPeaks, setClipPeaks] = useState<{ [id: string]: number[] }>({});
  
  const [activeTimelineTab, setActiveTimelineTab] = useState<'timeline' | 'workflow'>('timeline');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [dynamicNodePositions, setDynamicNodePositions] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [workflowNodes, setWorkflowNodes] = useState<any[]>([
    { id: 'input-v', type: 'input', label: 'ENTRADA VÍDEO', x: 50, y: 50, color: '#444' },
    { id: 'input-a', type: 'input', label: 'ENTRADA ÁUDIO', x: 50, y: 150, color: '#444' },
    { id: 'color', type: 'effect', label: 'AJUSTES COR', x: 250, y: 100, color: '#7c5cfc' },
    { id: 'keyframes', type: 'effect', label: 'KEYFRAMES', x: 380, y: 210, color: '#ffcc00' },
    { id: 'subs', type: 'effect', label: 'LEGENDA IA', x: 550, y: 150, color: '#f472b6' },
    { id: 'voice', type: 'effect', label: 'NARRADOR IA', x: 550, y: 50, color: '#4ade80' },
    { id: 'output', type: 'output', label: 'SAÍDA FINAL', x: 800, y: 100, color: '#ff4d4d' }
  ]);

  const activeNodes = useMemo(() => {
    // Nós Base Fixos
    const baseNodes = workflowNodes.filter(n => ['input-v', 'input-a', 'color', 'subs', 'voice', 'output', 'keyframes'].includes(n.id));
    
    // Nós Dinâmicos (um para cada clipe de efeito/transiçãoo/imagem)
    const dynamicNodes = clips
      .filter(c => c.type === 'effect' || c.type === 'transition' || c.type === 'image')
      .map((c, idx) => {
        const pos = dynamicNodePositions[c.id] || { x: 380, y: 30 + (idx * 60) };
        
        // Identificaçãoo estrita baseada nas listas oficiais
        const isFilter = ['sepia_pro', 'bw_classic', 'dramatic', 'pastel'].includes(c.effect || '');
        const isTrans = c.type === 'transition';
        const isImage = c.type === 'image';
        
        return {
          id: c.id,
          type: isImage ? 'image-node' : 'effect',
          label: isTrans ? 'TRANSIÇÃO' : (isFilter ? 'FILTRO' : (isImage ? 'IMAGEM' : 'EFEITO VFX')),
          x: pos.x,
          y: pos.y,
          color: isTrans ? '#ff9a00' : (isFilter ? '#00d2ff' : (isImage ? '#10b981' : '#a855f7')),
          isClipNode: true,
          subLabel: c.name
        };
      });

    const hasSubs = clips.some(c => c.type === 'text');
    const hasVoice = clips.some(c => c.type === 'audio' && c.name.includes('NARRAÇÃO'));
    const hasEffects = clips.some(c => c.config && (c.config.brightness !== 100 || c.config.contrast !== 100 || c.config.saturation !== 100));
    const hasKeyframes = clips.some(c => c.keyframes && c.keyframes.length > 0);
    
    const filteredBase = baseNodes.filter(node => {
      if (node.id === 'input-v' || node.id === 'input-a' || node.id === 'output') return true;
      if (node.id === 'subs') return hasSubs;
      if (node.id === 'voice') return hasVoice;
      if (node.id === 'color') return hasEffects;
      if (node.id === 'keyframes') return hasKeyframes;
      return false;
    });

    return [...filteredBase, ...dynamicNodes].sort((a, b) => a.x - b.x);
  }, [clips, workflowNodes, dynamicNodePositions]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [workflowOffset, setWorkflowOffset] = useState({ x: 0, y: 0 });
  const [workflowZoom, setWorkflowZoom] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [propsPanelPos, setPropsPanelPos] = useState({ x: 20, y: 50 });
  const [isDraggingProps, setIsDraggingProps] = useState(false);
  const [workflowNotes, setWorkflowNotes] = useState<{id: string, x: number, y: number, text: string, parentId?: string}[]>([]);
  const [workflowStatusIcons, setWorkflowStatusIcons] = useState<{id: string, x: number, y: number, type: 'check' | 'x', parentId?: string}[]>([]);
  const [workflowConnections, setWorkflowConnections] = useState<{from: string, to: string}[]>([]);
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, localX: number, localY: number, visible: boolean, targetId?: string} | null>(null);

  const historyRef = useRef<VideoClip[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoingRedoingRef = useRef<boolean>(false);
  const historyTimerRef = useRef<number>(0);

  const TRACK_HEIGHT = isTimelineExpanded ? 70 : 50;

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const recalcDuration = useCallback((c: VideoClip[]) => {
    const d = c.reduce((max, clip) => {
      const end = clip.startTime + getEffectiveDur(clip);
      return end > max ? end : max;
    }, 0);
    setTotalDuration(Math.max(d, 5));
  }, []);

  const getAvailableTrack = (startTime: number, duration: number, type: VideoClip['type']): number => {
    let track = type === 'audio' ? 100 : 1;
    while (true) {
      const collision = clips.some(c =>
        c.track === track &&
        !(startTime + duration <= c.startTime || startTime >= c.startTime + getEffectiveDur(c))
      );
      if (!collision) return track;
      track++; 
    }
  };

  const addFile = useCallback(async (file: File) => {
    const url = pathToFileUrl((file as any).path || file.name);
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const type: VideoClip['type'] = ['mp3', 'wav', 'aac', 'm4a'].includes(ext) 
      ? 'audio' 
      : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) 
        ? 'image' 
        : 'video';
        
    let duration = 5;
    if (type !== 'image') {
      try { duration = await getMediaDuration(url); } catch (e) { }
    }
    
    setClips(prev => {
      // Inicia no tempo 0 para "nascer um em cima do outro"
      const startTime = 0;
      const track = getAvailableTrack(startTime, duration, type);
      
      const newClip: VideoClip = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name, path: (file as any).path || file.name, url,
        duration, startTime, trimStart: 0, trimEnd: 0, type, volume: 100, track,
        config: { 
          scale: 100, opacity: 100, brightness: 100, contrast: 100, saturation: 100, 
          highlight: 100, shadow: 100, vignette: 0, volume: 100, speed: 1,
          chromaKey: false, chromaColor: '#00ff00', chromaSimilarity: 50, chromaSmoothness: 10
        }
      };
      const next = [...prev, newClip];
      recalcDuration(next);
      return next;
    });
    if (type === 'video' && !previewUrl) setPreviewUrl(url);
    onAddToTerminal(`Importado: ${file.name}`);
  }, [previewUrl, onAddToTerminal, recalcDuration, clips]);

  const handlePlay = useCallback(() => {
    const activeMediaClips = clips.filter(c => (c.type === 'video' || c.type === 'audio') && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c));
    
    if (isPlaying) { 
      // Pause everything
      activeMediaClips.forEach(c => {
        const media = mediaRefs.current[c.id];
        if (media && !media.paused) media.pause();
      });
      setIsPlaying(false); 
    }
    else {
      // Play everything active
      activeMediaClips.forEach(c => {
        const media = mediaRefs.current[c.id];
        if (media) {
          const speed = c.config?.speed || 1;
          media.playbackRate = speed;
          media.currentTime = c.trimStart + (currentTime - c.startTime) * speed;
          const vol = c.config?.volume ?? 100;
          media.volume = 1; // Native volume capped at 1. GainNode handles the actual volume/boost.
          media.play().catch(err => console.error("Playback failed:", err));
        }
      });
      setIsPlaying(true);
    }
  }, [isPlaying, currentTime, clips]);

  const handleSplitClip = useCallback(() => {
    if (!selectedClipId) return;
    setClips(prev => {
      const clip = prev.find(c => c.id === selectedClipId);
      if (!clip || clip.type === 'text') return prev;
      if (currentTime <= clip.startTime || currentTime >= clip.startTime + getEffectiveDur(clip)) return prev;
      
      const speed = clip.config?.speed || 1;
      const splitPt = (currentTime - clip.startTime) * speed;
      
      const safeDur = Number(clip.duration) || 0;
      const safeStart = Number(clip.trimStart) || 0;
      const safeEnd = Number(clip.trimEnd) || 0;

      const p1TrimEnd = Math.max(0, safeEnd + (safeDur - safeStart - safeEnd - splitPt));
      const p2TrimStart = Math.max(0, safeStart + splitPt);
      
      // Clone nested configurations to ensure absolute memory independence!
      const p1 = { 
        ...clip, 
        // Mantemos o ID original para reutilizar o elemento <video> do React/browser, evitando travamento/recarregamento
        id: clip.id, 
        trimEnd: p1TrimEnd,
        config: clip.config ? { ...clip.config } : undefined,
        keyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : undefined
      };
      
      const p2 = { 
        ...clip, 
        id: Math.random().toString(36).substr(2, 9), 
        startTime: currentTime, 
        trimStart: p2TrimStart,
        config: clip.config ? { ...clip.config } : undefined,
        keyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : undefined
      };
      
      // Clone peaks and loaded states instantly to avoid refetches!
      const originalPeaks = clipPeaks[clip.id];
      if (originalPeaks) {
        // Usamos setTimeout para agendar as atualizaçÁµes de estado das ondas no próximo tick do event loop.
        // Isso evita loops de renderizaçãoo cascateados/síncronos dentro da atualizaçãoo do clips!
        // Como o p1 manteve o ID original (clip.id), ele já possui as ondas carregadas. Só precisamos clonar para o p2.
        setTimeout(() => {
          setClipPeaks(prevPeaks => ({
            ...prevPeaks,
            [p2.id]: originalPeaks
          }));
          setWaveforms(prevWaves => ({
            ...prevWaves,
            [p2.id]: 'loaded'
          }));
        }, 0);
      }
      
      setTimeout(() => setSelectedClipId(p2.id), 0);
      return [...prev.filter(c => c.id !== clip.id), p1, p2];
    });
  }, [selectedClipId, currentTime, clipPeaks]);

  const handleDeleteClip = useCallback(() => {
    if (!selectedClipId) return;
    setClips(prev => prev.filter(c => c.id !== selectedClipId));
    setTimeout(() => setSelectedClipId(null), 0);
  }, [selectedClipId]);

  // â”€â”€ AI Action Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ExpÁµe estado e açÁµes para o App.tsx consumir via ref
  useImperativeHandle(ref, () => ({
    getEditorState: () => {
      const c = clipsRef.current;
      const sel = c.find(x => x.id === selectedClipId);
      return {
        totalDuration,
        currentTime,
        clipCount: c.length,
        selectedClip: sel ? {
          id: sel.id,
          name: sel.name,
          type: sel.type,
          duration: Number((sel.duration - sel.trimStart - sel.trimEnd).toFixed(2)),
          startTime: Number(sel.startTime.toFixed(2)),
          speed: sel.config?.speed ?? 1,
          volume: sel.config?.volume ?? 100,
          brightness: sel.config?.brightness ?? 100,
          contrast: sel.config?.contrast ?? 100,
          saturation: sel.config?.saturation ?? 100,
          opacity: sel.config?.opacity ?? 100,
          scale: sel.config?.scale ?? 100,
          effect: sel.effect ?? null,
          track: sel.track,
        } : null,
        clips: c.map(x => ({
          id: x.id,
          name: x.name,
          type: x.type,
          track: x.track,
          startTime: Number(x.startTime.toFixed(2)),
          duration: Number((x.duration - x.trimStart - x.trimEnd).toFixed(2)),
          speed: x.config?.speed ?? 1,
          volume: x.config?.volume ?? 100,
          effect: x.effect ?? null,
        }))
      };
    },

    applyAIAction: (action: string, payload: any): string => {
      // Resolve o clip alvo: usa o selecionado se "selected", senão acha pelo nome/id/índice/ordinal
      const resolveClip = (target?: any) => {
        const all = clipsRef.current;
        if (target === undefined || target === null || target === 'selected' || target === 'selecionado') {
          // 1º: clipe selecionado (mais provável que o usuário queira)
          const sel = all.find(c => c.id === selectedClipId);
          if (sel) return sel;
          // 2º: último clipe de Vídeo (nunca aplica velocidade em áudio por engano)
          const lastVideo = [...all].reverse().find(c => c.type === 'video');
          if (lastVideo) return lastVideo;
          // 3º: qualquer clipe (último recurso)
          return all[all.length - 1] || null;
        }

        const targetStr = String(target).trim().toLowerCase();

        // 1. Se for número direto (ex: 3 ou "3" ou "3º")
        const cleanNumStr = targetStr.replace(/[^0-9]/g, '');
        if (cleanNumStr.length > 0) {
          const num = parseInt(cleanNumStr, 10);
          if (!isNaN(num) && num > 0 && num <= all.length) {
            return all[num - 1];
          }
        }

        // 2. Mapeamento de ordinais por extenso em português e inglês
        const ordinalMap: Record<string, number> = {
          primeiro: 0, first: 0,
          segundo: 1, second: 1,
          terceiro: 2, third: 2,
          quarto: 3, fourth: 3,
          quinto: 4, fifth: 4,
          sexto: 5, sixth: 5,
          setimo: 6, sétimo: 6, seventh: 6,
          oitavo: 7, eighth: 7,
          nono: 8, ninth: 8,
          decimo: 9, décimo: 9, tenth: 9,
        };

        if (targetStr in ordinalMap) {
          const idx = ordinalMap[targetStr];
          if (idx < all.length) return all[idx];
        }

        if (targetStr === 'ultimo' || targetStr === 'último' || targetStr === 'last') {
          return all[all.length - 1] || null;
        }

        // 3. Tenta achar por ID exato ou busca parcial do nome
        return all.find(c => c.id === targetStr || c.name.toLowerCase().includes(targetStr)) || null;
      };


      const updateConfig = (clipId: string | string[], patch: Partial<VideoClip['config']>) => {
        const ids = Array.isArray(clipId) ? clipId : [clipId];
        setClips(prev => prev.map(c =>
          ids.includes(c.id) && c.config
            ? { ...c, config: { ...c.config, ...patch } }
            : c
        ));
      };

      // Resolve valor absoluto ou relativo (+20, -10, +20%, 120%)
      // currentVal: valor atual do parâmetro (ex: clip.config.brightness = 100)
      const resolveRelativeValue = (rawVal: any, currentVal: number, minVal = 0, maxVal = 200): number => {
        const s = String(rawVal).trim();
        // "+20%" ou "-20%" => relativo percentual
        const relPct = s.match(/^([+-])(\d+(?:\.\d+)?)%$/);
        if (relPct) {
          const delta = parseFloat(relPct[2]) * (relPct[1] === '+' ? 1 : -1);
          return Math.max(minVal, Math.min(maxVal, currentVal + delta));
        }
        // "+20" ou "-10" => delta absoluto
        const relAbs = s.match(/^([+-])(\d+(?:\.\d+)?)$/);
        if (relAbs) {
          const delta = parseFloat(relAbs[2]) * (relAbs[1] === '+' ? 1 : -1);
          return Math.max(minVal, Math.min(maxVal, currentVal + delta));
        }
        // "120" => valor absoluto puro
        const abs = parseFloat(s);
        if (!isNaN(abs)) return Math.max(minVal, Math.min(maxVal, abs));
        return currentVal;
      };

      switch (action) {
        // â”€â”€ Velocidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-speed': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          const speed = Number(payload.speed ?? payload.value ?? 1);
          if (speed <= 0 || speed > 10) return 'âŒ Velocidade inválida (0.1 a 10)';

          if (isAll) {
            const videoClips = clipsRef.current.filter(c => c.type === 'video');
            if (videoClips.length === 0) return 'âŒ Nenhum clipe de Vídeo na timeline';
            updateConfig(videoClips.map(c => c.id), { speed });
            onAddToTerminal(`ðŸŽ¬ Velocidade de TODOS os clipes de Vídeo â†’ ${speed}x`);
            return `✅ Velocidade de todos os ${videoClips.length} clipes de Vídeo alterada para ${speed}x`;
          }

          let clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          // Se o clipe resolvido for áudio e não foi especificado explicitamente,
          // tenta encontrar o clipe de Vídeo mais recente
          if (clip.type === 'audio' && !payload.clipId) {
            const videoClip = clipsRef.current.find(c => c.type === 'video');
            if (videoClip) {
              clip = videoClip;
              onAddToTerminal(`â„¹ï¸ Alternado para clipe de Vídeo "${clip.name}" (set-speed não se aplica a áudio puro)`);
            }
          }
          if (!clip.config) return `âŒ "${clip.name}" não suporta ajuste de velocidade`;
          updateConfig(clip.id, { speed });
          onAddToTerminal(`ðŸŽ¬ Velocidade de "${clip.name}" â†’ ${speed}x`);
          return `✅ Velocidade de "${clip.name}" alterada para ${speed}x (${speed < 1 ? 'slow motion' : speed > 1 ? 'fast motion' : 'normal'})`;
        }

        // â”€â”€ Volume â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-volume': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config);
            if (targets.length === 0) return 'âŒ Nenhum clipe na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config) return c;
              const cur = c.config.volume ?? 100;
              const vol = resolveRelativeValue(payload.volume ?? payload.value ?? cur, cur, 0, 200);
              return { ...c, config: { ...c.config, volume: vol } };
            }));
            onAddToTerminal(`ðŸ”Š Volume de TODOS os clipes ajustado`);
            return `✅ Volume de todos os ${targets.length} clipes ajustado`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.volume ?? 100;
          const vol = resolveRelativeValue(payload.volume ?? payload.value ?? cur, cur, 0, 200);
          updateConfig(clip.id, { volume: vol });
          onAddToTerminal(`ðŸ”Š Volume de "${clip.name}" â†’ ${vol}%`);
          return `✅ Volume de "${clip.name}" â†’ ${Math.round(vol)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Mute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'mute': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config);
            if (targets.length === 0) return 'âŒ Nenhum clipe na timeline';
            updateConfig(targets.map(c => c.id), { volume: 0 });
            onAddToTerminal(`ðŸ”‡ TODOS os clipes mutados`);
            return `✅ Todos os ${targets.length} clipes mutados`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          updateConfig(clip.id, { volume: 0 });
          onAddToTerminal(`ðŸ”‡ "${clip.name}" mutado`);
          return `✅ "${clip.name}" mutado`;
        }

        // â”€â”€ Brilho â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-brightness': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const cur = c.config.brightness ?? 100;
              const val = resolveRelativeValue(payload.value ?? payload.brightness ?? cur, cur);
              return { ...c, config: { ...c.config, brightness: val } };
            }));
            onAddToTerminal(`â˜€ï¸ Brilho de TODOS os clipes ajustado`);
            return `✅ Brilho de todos os ${targets.length} clipes ajustado`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.brightness ?? 100;
          const val = resolveRelativeValue(payload.value ?? payload.brightness ?? cur, cur);
          updateConfig(clip.id, { brightness: val });
          onAddToTerminal(`â˜€ï¸ Brilho de "${clip.name}" â†’ ${Math.round(val)}%`);
          return `✅ Brilho â†’ ${Math.round(val)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Contraste â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-contrast': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const cur = c.config.contrast ?? 100;
              const val = resolveRelativeValue(payload.value ?? payload.contrast ?? cur, cur);
              return { ...c, config: { ...c.config, contrast: val } };
            }));
            onAddToTerminal(`ðŸŒ“ Contraste de TODOS os clipes ajustado`);
            return `✅ Contraste de todos os ${targets.length} clipes ajustado`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.contrast ?? 100;
          const val = resolveRelativeValue(payload.value ?? payload.contrast ?? cur, cur);
          updateConfig(clip.id, { contrast: val });
          onAddToTerminal(`ðŸŒ“ Contraste de "${clip.name}" â†’ ${Math.round(val)}%`);
          return `✅ Contraste â†’ ${Math.round(val)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Saturaçãoo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-saturation': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const cur = c.config.saturation ?? 100;
              const val = resolveRelativeValue(payload.value ?? payload.saturation ?? cur, cur);
              return { ...c, config: { ...c.config, saturation: val } };
            }));
            onAddToTerminal(`ðŸŽ¨ Saturaçãoo de TODOS os clipes ajustada`);
            return `✅ Saturaçãoo de todos os ${targets.length} clipes ajustada`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.saturation ?? 100;
          const val = resolveRelativeValue(payload.value ?? payload.saturation ?? cur, cur);
          updateConfig(clip.id, { saturation: val });
          onAddToTerminal(`ðŸŽ¨ Saturaçãoo de "${clip.name}" â†’ ${Math.round(val)}%`);
          return `✅ Saturaçãoo â†’ ${Math.round(val)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Opacidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-opacity': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const cur = c.config.opacity ?? 100;
              const val = resolveRelativeValue(payload.value ?? payload.opacity ?? cur, cur, 0, 100);
              return { ...c, config: { ...c.config, opacity: val } };
            }));
            onAddToTerminal(`ðŸ‘ï¸ Opacidade de TODOS os clipes ajustada`);
            return `✅ Opacidade de todos os ${targets.length} clipes ajustada`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.opacity ?? 100;
          const val = resolveRelativeValue(payload.value ?? payload.opacity ?? cur, cur, 0, 100);
          updateConfig(clip.id, { opacity: val });
          onAddToTerminal(`ðŸ‘ï¸ Opacidade de "${clip.name}" â†’ ${Math.round(val)}%`);
          return `✅ Opacidade â†’ ${Math.round(val)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Escala â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-scale': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const cur = c.config.scale ?? 100;
              const val = resolveRelativeValue(payload.value ?? payload.scale ?? cur, cur, 10, 300);
              return { ...c, config: { ...c.config, scale: val } };
            }));
            onAddToTerminal(`ðŸ”² Escala de TODOS os clipes ajustada`);
            return `✅ Escala de todos os ${targets.length} clipes ajustada`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const cur = clip.config?.scale ?? 100;
          const val = resolveRelativeValue(payload.value ?? payload.scale ?? cur, cur, 10, 300);
          updateConfig(clip.id, { scale: val });
          onAddToTerminal(`ðŸ”² Escala de "${clip.name}" â†’ ${Math.round(val)}%`);
          return `✅ Escala â†’ ${Math.round(val)}% (era ${Math.round(cur)}%)`;
        }

        // â”€â”€ Color grade mÁºltiplo com suporte relativo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'color-grade': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          if (isAll) {
            const targets = clipsRef.current.filter(c => c.config && c.type !== 'audio');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => {
              if (!c.config || c.type === 'audio') return c;
              const patch: any = {};
              if (payload.brightness != null) patch.brightness = resolveRelativeValue(payload.brightness, c.config.brightness ?? 100);
              if (payload.contrast != null) patch.contrast = resolveRelativeValue(payload.contrast, c.config.contrast ?? 100);
              if (payload.saturation != null) patch.saturation = resolveRelativeValue(payload.saturation, c.config.saturation ?? 100);
              if (payload.opacity != null) patch.opacity = resolveRelativeValue(payload.opacity, c.config.opacity ?? 100, 0, 100);
              return { ...c, config: { ...c.config, ...patch } };
            }));
            onAddToTerminal(`ðŸŽ¨ Color grade em TODOS os clipes concluído`);
            return `✅ Color grade aplicado em todos os ${targets.length} clipes`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const patch: any = {};
          if (payload.brightness != null) patch.brightness = resolveRelativeValue(payload.brightness, clip.config?.brightness ?? 100);
          if (payload.contrast != null) patch.contrast = resolveRelativeValue(payload.contrast, clip.config?.contrast ?? 100);
          if (payload.saturation != null) patch.saturation = resolveRelativeValue(payload.saturation, clip.config?.saturation ?? 100);
          if (payload.opacity != null) patch.opacity = resolveRelativeValue(payload.opacity, clip.config?.opacity ?? 100, 0, 100);
          updateConfig(clip.id, patch);
          const desc = Object.entries(patch).map(([k, v]) => `${k}:${Math.round(v as number)}`).join(', ');
          onAddToTerminal(`ðŸŽ¨ Color grade em "${clip.name}": ${desc}`);
          return `✅ Color grade: ${desc}`;
        }

        // â”€â”€ Deletar clipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'delete': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const name = clip.name;
          setClips(prev => prev.filter(c => c.id !== clip.id));
          setSelectedClipId(null);
          onAddToTerminal(`ðŸ—‘ï¸ Clipe "${name}" deletado`);
          return `✅ Clipe "${name}" deletado da timeline`;
        }

        // â”€â”€ Recortar (trim) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'trim': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          let trimStart = payload.trimStart != null ? Number(payload.trimStart) : clip.trimStart;
          let trimEnd = payload.trimEnd != null ? Number(payload.trimEnd) : clip.trimEnd;
          if (isNaN(trimStart)) trimStart = clip.trimStart || 0;
          if (isNaN(trimEnd)) trimEnd = clip.trimEnd || 0;
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, trimStart, trimEnd } : c));
          onAddToTerminal(`❌‚ï¸ "${clip.name}" trimado: início=${trimStart}s fim=${trimEnd}s`);
          return `✅ Trim aplicado em "${clip.name}": início ${trimStart}s, fim ${trimEnd}s`;
        }

        // â”€â”€ Dividir clipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'split': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const splitAt = payload.time != null ? Number(payload.time) : currentTime;
          if (isNaN(splitAt) || splitAt <= clip.startTime || splitAt >= clip.startTime + getEffectiveDur(clip)) {
            return 'âŒ Ponto de corte inválido ou fora do clipe';
          }
          const speed = clip.config?.speed || 1;
          const splitPt = (splitAt - clip.startTime) * speed;
          
          const safeDur = Number(clip.duration) || 0;
          const safeStart = Number(clip.trimStart) || 0;
          const safeEnd = Number(clip.trimEnd) || 0;

          const p1TrimEnd = Math.max(0, safeEnd + (safeDur - safeStart - safeEnd - splitPt));
          const p2TrimStart = Math.max(0, safeStart + splitPt);

          const p1 = { ...clip, id: clip.id, trimEnd: p1TrimEnd, config: clip.config ? {...clip.config} : undefined, keyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : undefined };
          const p2 = { ...clip, id: Math.random().toString(36).substr(2,9), startTime: splitAt, trimStart: p2TrimStart, config: clip.config ? {...clip.config} : undefined, keyframes: clip.keyframes ? JSON.parse(JSON.stringify(clip.keyframes)) : undefined };
          setClips(prev => [...prev.filter(c => c.id !== clip.id), p1, p2]);
          onAddToTerminal(`❌‚ï¸ "${clip.name}" dividido em ${splitAt.toFixed(2)}s`);
          return `✅ Clipe dividido em ${splitAt.toFixed(2)}s`;
        }

        // â”€â”€ Aplicar efeito/filtro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-effect': {
          const isAll = payload.clipId === 'all' || payload.clipId === 'todos';
          let effectName = payload.effect ?? payload.value ?? null;
          if (effectName) {
            // Se a IA mandar o nome em linguagem natural, normaliza para o ID correto
            const map: Record<string, string> = { 'desfoque pulso': 'blurpulse', 'desfoque': 'blur', 'sepia pro': 'sepia_pro', 'p&b classico': 'bw_classic', 'terror vermelho': 'horror_red', 'cinema scope': 'cinema_scope', 'focar vermelho': 'iso_red', 'visao noturna': 'night_vision', 'vintage 70s': 'vintage_70s', 'tons pastel': 'pastel', '80s retro': 'retro80s', 'sepia gold': 'sepia', 'filme antigo': 'oldfilm', 'crt antigo': 'crt', 'zoom pump': 'zoom', 'zoom lento': 'slowzoom', 'troca cor': 'colorshift', 'blur trans': 'blurtrans', 'glitch trans': 'glitchtrans', 'flash branco': 'flashwhite', 'iris circular': 'iris', 'vira-pagina': 'flip' };
            const lower = effectName.toLowerCase();
            if (map[lower]) effectName = map[lower];
            else if (effectName.includes(' ')) effectName = lower.replace(/\s+/g, '_'); // Fallback: "algo legal" -> "algo_legal"
          }

          if (isAll) {
            const targets = clipsRef.current.filter(c => c.type === 'video' || c.type === 'image');
            if (targets.length === 0) return 'âŒ Nenhum clipe visual na timeline';
            setClips(prev => prev.map(c => (c.type === 'video' || c.type === 'image') ? { ...c, effect: effectName } : c));
            onAddToTerminal(`❌¨ Efeito "${effectName || 'nenhum'}" aplicado em TODOS os clipes`);
            return `✅ Efeito "${effectName || 'removido'}" em todos os ${targets.length} clipes`;
          }

          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, effect: effectName } : c));
          onAddToTerminal(`❌¨ Efeito "${effectName || 'nenhum'}" aplicado em "${clip.name}"`);
          return `✅ Efeito "${effectName || 'removido'}" em "${clip.name}"`;
        }

        // â”€â”€ Gerar Imagem com IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'generate-image': {
          const prompt = payload.prompt || payload.value;
          if (!prompt) return 'âŒ Nenhum prompt fornecido';
          const imgId = Math.random().toString(36).substr(2, 9);
          
          onAddToTerminal(`ðŸŽ¨ Comando gerar imagem enviado: "${prompt}". Aguardando backend processar...`);
          
          window.electronAPI.generateImage({ prompt }).then((result: any) => {
             if (result.success && result.path) {
                const safePath = result.path.replace(/\\/g, '/');
                const newClip: VideoClip = {
                  id: imgId,
                  name: `IMG IA: ${prompt.substring(0, 15)}...`,
                  path: result.path,
                  url: `file://${safePath}`,
                  type: 'image',
                  duration: 5,
                  startTime: currentTime,
                  trimStart: 0,
                  trimEnd: 0,
                  track: 2,
                  config: { 
                    scale: 100, 
                    opacity: 100, 
                    brightness: 100, 
                    contrast: 100, 
                    saturation: 100, 
                    highlight: 100, 
                    shadow: 100, 
                    vignette: 0, 
                    volume: 100 
                  }
                };
                setClips(prev => {
                  const next = [...prev, newClip];
                  recalcDuration(next);
                  return next;
                });
                onAddToTerminal(`ðŸŽ¨ Imagem "${prompt.substring(0,20)}" finalizada e carregada na trilha 2!`);
             } else {
                onAddToTerminal(`âŒ Falha na geraçãoo da imagem: ${result.error || 'Erro desconhecido no backend'}`);
             }
          }).catch(err => {
             onAddToTerminal(`âŒ Falha grave ao contatar backend de imagem: ${err.message}`);
          });

          return `✅ Imagem solicitada via IA. O processamento começou no backend nativo, e ela será adicionada Á  timeline automaticamente assim que pronta.`;
        }

        // â”€â”€ Mover playhead (seek) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'seek': {
          const t = Math.max(0, Math.min(totalDuration, Number(payload.time ?? 0)));
          setCurrentTime(t);
          onAddToTerminal(`â© Playhead â†’ ${t.toFixed(2)}s`);
          return `✅ Playhead movido para ${t.toFixed(2)}s`;
        }

        // â”€â”€ Adicionar texto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'add-text': {
          const text = payload.text || 'Texto';
          const newClip: VideoClip = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Texto: ${text.substring(0, 20)}`,
            path: '',
            url: '',
            duration: payload.duration || 5,
            startTime: payload.startTime ?? currentTime,
            trimStart: 0,
            trimEnd: 0,
            type: 'text',
            volume: 0,
            track: 200,
            textConfig: {
              content: text,
              fontSize: payload.fontSize || 48,
              color: payload.color || '#ffffff',
              fontFamily: payload.fontFamily || 'Arial',
              fontWeight: payload.bold ? 'bold' : 'normal',
              fontStyle: 'normal',
              x: payload.x || '50%',
              y: payload.y || '85%',
              strokeColor: '#000000',
              strokeWidth: 2,
            }
          };
          setClips(prev => { const next = [...prev, newClip]; recalcDuration(next); return next; });
          setSelectedClipId(newClip.id);
          onAddToTerminal(`ðŸ“ Texto adicionado: "${text}"`);
          return `✅ Texto "${text}" adicionado na timeline em ${newClip.startTime.toFixed(2)}s`;
        }

        // â”€â”€ Chroma Key â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-chroma': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          updateConfig(clip.id, {
            chromaKey: payload.enabled !== false,
            chromaColor: payload.color || '#00ff00',
            chromaSimilarity: payload.similarity ?? 50,
            chromaSmoothness: payload.smoothness ?? 10,
          });
          onAddToTerminal(`ðŸŸ© Chroma Key ${payload.enabled !== false ? 'ativado' : 'desativado'} em "${clip.name}"`);
          return `✅ Chroma Key configurado em "${clip.name}"`;
        }

        // â”€â”€ Selecionar clipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'select': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Clipe não encontrado';
          setSelectedClipId(clip.id);
          return `✅ Clipe "${clip.name}" selecionado`;
        }

        // â”€â”€ Mover clipe na timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'move': {
          const clip = resolveClip(payload.clipId);
          if (!clip) return 'âŒ Nenhum clipe selecionado';
          const newStart = Math.max(0, Number(payload.startTime ?? clip.startTime));
          const newTrack = payload.track != null ? Number(payload.track) : clip.track;
          setClips(prev => prev.map(c => c.id === clip.id ? { ...c, startTime: newStart, track: newTrack } : c));
          onAddToTerminal(`ðŸ”€ "${clip.name}" movido para ${newStart.toFixed(2)}s (trilha ${newTrack})`);
          return `✅ "${clip.name}" movido para ${newStart.toFixed(2)}s na trilha ${newTrack}`;
        }

        // â”€â”€ Corte Automático (isola voz + corta silêncios) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'auto-cut': {
          // Dispara o mesmo fluxo que o botão "CORTE AUTO" â€” isolar voz â†’ detectar silêncio â†’ cortar
          const clip = resolveClip(payload.clipId);
          if (!clip || clip.type !== 'video') return 'âŒ Selecione um clipe de Vídeo para o corte automático';
          setSelectedClipId(clip.id);
          // Pequeno delay para garantir que o estado selectedClipId foi atualizado antes de chamar
          setTimeout(() => { handleAutoCutRef.current?.(); }, 100);
          return `✅ Iniciando corte automático em "${clip.name}" (isolando voz â†’ detectando silêncios â†’ cortando...)`;
        }

        // â”€â”€ Isolar Voz (remover ruído) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'isolate-voice': {
          const clip = resolveClip(payload.clipId);
          if (!clip || clip.type !== 'video') return 'âŒ Selecione um clipe de Vídeo para isolar a voz';
          const api = (window as any).electronAPI;
          if (!api?.isolateVoice) return 'âŒ API de isolamento de voz não disponível';
          onAddToTerminal(`ðŸ”‡ Isolando voz de "${clip.name}"...`);
          api.isolateVoice(clip.path).then((res: any) => {
            if (res.success && res.path) {
              const safePath = res.path.replace(/\\/g, '/');
              setClips(prev => prev.map(c => c.id === clip.id
                ? { ...c, path: res.path, url: `file://${safePath}` }
                : c
              ));
              onAddToTerminal(`✅ Voz isolada! Clipe "${clip.name}" atualizado com áudio limpo.`);
            } else {
              onAddToTerminal(`âŒ Falha ao isolar voz: ${res.error}`);
            }
          });
          return `✅ Isolamento de voz iniciado para "${clip.name}". Aguarde o processamento...`;
        }

        // â”€â”€ Legenda Automática â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'auto-subtitle': {
          const clip = resolveClip(payload.clipId);
          if (!clip || clip.type !== 'video') return 'âŒ Selecione um clipe de Vídeo para legendar';
          setSelectedClipId(clip.id);
          setTimeout(() => { handleAutoSubtitleRef.current?.(); }, 100);
          return `✅ Iniciando legenda automática em "${clip.name}"...`;
        }

        // â”€â”€ Mudar cor de TODAS as legendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-subtitle-color': {
          const color = payload.color || payload.value || '#ffff00';
          const subtitles = clipsRef.current.filter(c => c.type === 'text' && c.textConfig);
          if (subtitles.length === 0) return 'âŒ Nenhuma legenda encontrada na timeline';
          setClips(prev => prev.map(c =>
            c.type === 'text' && c.textConfig
              ? { ...c, textConfig: { ...c.textConfig, color } }
              : c
          ));
          onAddToTerminal(`ðŸŽ¨ Cor de ${subtitles.length} legenda(s) alterada para ${color}`);
          return `✅ Cor de todas as ${subtitles.length} legenda(s) alterada para ${color}`;
        }

        // â”€â”€ Mudar cor do contorno de TODAS as legendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-subtitle-stroke': {
          const strokeColor = payload.color || payload.strokeColor || payload.value || '#000000';
          const strokeWidth = payload.width != null ? Number(payload.width) : undefined;
          const subtitles = clipsRef.current.filter(c => c.type === 'text' && c.textConfig);
          if (subtitles.length === 0) return 'âŒ Nenhuma legenda encontrada na timeline';
          setClips(prev => prev.map(c => {
            if (c.type === 'text' && c.textConfig) {
              const patch: any = { strokeColor };
              if (strokeWidth != null) patch.strokeWidth = strokeWidth;
              return { ...c, textConfig: { ...c.textConfig, ...patch } };
            }
            return c;
          }));
          onAddToTerminal(`❌ï¸ Contorno de ${subtitles.length} legenda(s) â†’ ${strokeColor}${strokeWidth != null ? ` (espessura ${strokeWidth})` : ''}`);
          return `✅ Contorno de todas as ${subtitles.length} legenda(s) alterado para ${strokeColor}`;
        }

        // â”€â”€ Mudar tamanho de fonte de TODAS as legendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-subtitle-size': {
          const fontSize = payload.size || payload.fontSize || payload.value;
          if (fontSize == null) return 'âŒ Nenhum tamanho de fonte especificado';
          const subtitles = clipsRef.current.filter(c => c.type === 'text' && c.textConfig);
          if (subtitles.length === 0) return 'âŒ Nenhuma legenda encontrada na timeline';
          setClips(prev => prev.map(c => {
            if (c.type === 'text' && c.textConfig) {
              const currentSize = c.textConfig.fontSize || 24;
              const newSize = Math.round(resolveRelativeValue(fontSize, currentSize, 5, 200));
              return { ...c, textConfig: { ...c.textConfig, fontSize: newSize } };
            }
            return c;
          }));
          onAddToTerminal(`ðŸ“ Tamanho de ${subtitles.length} legenda(s) ajustado (parâmetro: ${fontSize})`);
          return `✅ Tamanho de todas as ${subtitles.length} legenda(s) ajustado conforme solicitado`;
        }

        // â”€â”€ Mudar fonte (fontFamily) de TODAS as legendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'set-subtitle-font': {
          const fontFamily = payload.fontFamily || payload.font || payload.value;
          if (!fontFamily) return 'âŒ Nenhuma fonte especificada';
          const subtitles = clipsRef.current.filter(c => c.type === 'text' && c.textConfig);
          if (subtitles.length === 0) return 'âŒ Nenhuma legenda encontrada na timeline';
          setClips(prev => prev.map(c =>
            c.type === 'text' && c.textConfig
              ? { ...c, textConfig: { ...c.textConfig, fontFamily } }
              : c
          ));
          onAddToTerminal(`ðŸ”¤ Fonte de ${subtitles.length} legenda(s) alterada para ${fontFamily}`);
          return `✅ Fonte de todas as ${subtitles.length} legenda(s) alterada para ${fontFamily}`;
        }
        // â”€â”€ Ediçãoo Shorts Automatizada (Macro Completa) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'make-shorts': {
          setVideoAspectRatio(9/16);
          setExportSettings(prev => ({ ...prev, resolution: '1080x1920' }));
          
          setClips(prev => prev.map(c => {
            if (!c.config || c.type === 'audio' || c.type === 'text') return c;
            const curSat = c.config.saturation ?? 100;
            const curCont = c.config.contrast ?? 100;
            return { ...c, config: { ...c.config, saturation: Math.min(200, curSat + 20), contrast: Math.min(200, curCont + 10) } };
          }));

          // Executar etapas assíncronas sequencialmente
          (async () => {
            onAddToTerminal('ðŸš€ Iniciando fluxo automático de Ediçãoo Shorts (Corte + Legenda + Exportaçãoo)...');
            try {
              // Espera o state update de clipes e settings se propagar
              await new Promise(r => setTimeout(r, 1000));
              
              if (handleAutoCutRef.current) {
                await handleAutoCutRef.current();
                // Aguarda o state update do auto-corte
                await new Promise(r => setTimeout(r, 1500));
              }
              
              if (handleAutoSubtitleRef.current) {
                await handleAutoSubtitleRef.current();
                // Aguarda o state update das legendas
                await new Promise(r => setTimeout(r, 1500));
              }

              if (handleStartExportRef.current) {
                await handleStartExportRef.current();
              }
            } catch (err: any) {
              onAddToTerminal(`âŒ Erro crítico no fluxo Shorts: ${err.message}`);
            }
          })();

          return `✅ Fluxo de Ediçãoo Shorts ativado: Tela ajustada (9:16), +20 Saturaçãoo e +10 Contraste em todos os Vídeos. Corte, Legenda e Exportaçãoo estão sendo executados em background!`;
        }

        // â”€â”€ Adicionar clipe baixado da web â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'add-clip': {
          const filePath = payload.path || '';
          const clipType: 'video' | 'audio' | 'image' = 
            payload.type === 'audio' ? 'audio' : 
            payload.type === 'image' ? 'image' : 'video';
          if (!filePath) return 'âŒ Caminho do arquivo não informado.';

          const safePath = filePath.replace(/\\/g, '/');
          const url = `file:///${safePath}`;
          const fileName = safePath.split('/').pop() || 'clip';

          // Imagem tem duraçãoo fixa; Vídeo/áudio detecta
          const getMediaDur = async (): Promise<number> => {
            if (clipType === 'image') return 5;
            return new Promise((resolve) => {
              const media = document.createElement(clipType === 'audio' ? 'audio' : 'video');
              media.src = url;
              media.onloadedmetadata = () => resolve(media.duration || 5);
              media.onerror = () => resolve(5);
            });
          };

          getMediaDur().then((duration) => {
            setClips(prev => {
              const startTime = 0;
              // Áudio começa em track 100 (igual ao getAvailableTrack), Vídeo em track 1
              const track = clipType === 'audio' ? 100 : 1;
              const newClip = {
                id: Math.random().toString(36).substr(2, 9),
                name: fileName,
                path: filePath,
                url,
                duration,
                startTime,
                trimStart: 0,
                trimEnd: 0,
                type: clipType,
                volume: 100,
                track,
                config: {
                  scale: 100, opacity: 100, brightness: 100, contrast: 100,
                  saturation: 100, highlight: 100, shadow: 100, vignette: 0,
                  volume: 100, speed: 1,
                  chromaKey: false, chromaColor: '#00ff00', chromaSimilarity: 50, chromaSmoothness: 10
                }
              };
              const next = [...prev, newClip];
              recalcDuration(next);
              return next;
            });
            onAddToTerminal(`✅ "${fileName}" adicionado Á  timeline (${duration.toFixed(1)}s)`);
          });

          return `✅ Carregando "${fileName}" na timeline...`;
        }

        default:
          return `âŒ Açãoo desconhecida: "${action}". AçÁµes: set-speed, set-volume, set-brightness, set-contrast, set-saturation, set-opacity, set-scale, color-grade, delete, trim, split, set-effect, seek, add-text, set-chroma, select, move, mute, auto-cut, isolate-voice, auto-subtitle, set-subtitle-color, set-subtitle-stroke, set-subtitle-size, set-subtitle-font, make-shorts`;
      }
    },

    loadProjectById: async (projectId: string) => {
      try {
        const result = await (window as any).electronAPI.loadProject('video', projectId);
        if (result.success && result.data) {
          const data = result.data;
          if (data.title) setProjectTitle(data.title);
          if (data.clips && Array.isArray(data.clips)) {
            setClips(data.clips);
            recalcDuration(data.clips);
          }
          if (data.aiHistory && Array.isArray(data.aiHistory)) {
            onUpdateChatHistory?.(data.aiHistory);
          } else {
            onUpdateChatHistory?.([]);
          }
          onAddToTerminal("✅ Projeto de vídeo carregado!");
        } else {
          onAddToTerminal("❌ Erro ao carregar: " + (result.error || 'Projeto não encontrado'));
        }
      } catch (e) {
        console.error('[VideoEditor] Erro ao carregar projeto:', e);
        onAddToTerminal("❌ Erro ao carregar projeto de vídeo");
      }
    }
  }), [selectedClipId, currentTime, totalDuration, clips, recalcDuration, onAddToTerminal, onUpdateChatHistory]);

  const addKeyframe = () => {
    if (!selectedClipId) return;
    const clip = clips.find(c => c.id === selectedClipId);
    if (!clip || !clip.config) return;
    const time = (currentTime - clip.startTime) * (clip.config.speed || 1);
    const timeFixed = Math.max(0, Number(time.toFixed(3)));
    
    const newKeyframe = {
      time: timeFixed,
      scale: clip.config.scale,
      x: clip.config.x || 0,
      y: clip.config.y || 0,
      opacity: clip.config.opacity
    };

    setClips(prev => prev.map(c => {
      if (c.id !== selectedClipId) return c;
      const kfs = c.keyframes || [];
      const nextKfs = [...kfs.filter(k => Math.abs(k.time - timeFixed) > 0.1), newKeyframe].sort((a,b) => a.time - b.time);
      return { ...c, keyframes: nextKfs };
    }));
    
    setSelectedKeyframeTime(timeFixed);
    onAddToTerminal(`ðŸ’Ž Keyframe definido aos ${timeFixed.toFixed(2)}s`);
  };

  const handleSaveProject = async () => {
    const projectData = { 
      type: 'video-editor',
      title: projectTitle, 
      clips, 
      aiHistory: chatHistory || [] 
    };
    
    // Captura thumbnail do preview atual
    let thumbnailBase64: string | undefined;
    try {
      const previewDiv = canvasRef.current;
      if (previewDiv) {
        // Cria um canvas temporário para capturar o preview
        const tempCanvas = document.createElement('canvas');
        const thumbSize = 300;
        
        // Define dimensões baseado no aspect ratio do vídeo
        const aspectRatio = videoAspectRatio || (16/9);
        if (aspectRatio > 1) {
          tempCanvas.width = thumbSize;
          tempCanvas.height = thumbSize / aspectRatio;
        } else {
          tempCanvas.height = thumbSize;
          tempCanvas.width = thumbSize * aspectRatio;
        }
        
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          // Preenche com cor de fundo
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          
          // Se tem clips, tenta capturar o primeiro frame de vídeo/imagem
          if (clips.length > 0) {
            const firstClip = clips[0];
            if (firstClip.type === 'image' && firstClip.imageSrc) {
              try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  img.src = firstClip.imageSrc;
                  setTimeout(reject, 3000); // timeout de 3s
                });
                ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
              } catch (e) {
                console.log('[VideoEditor] Erro ao carregar imagem para thumbnail:', e);
              }
            } else if (firstClip.type === 'video') {
              // Para vídeo, desenha um frame se possível
              const videoEl = mediaRefs.current[firstClip.id];
              if (videoEl && videoEl.readyState >= 2) {
                try {
                  ctx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);
                } catch (e) {
                  console.log('[VideoEditor] Erro ao capturar frame de vídeo:', e);
                }
              }
            }
          }
          
          // Adiciona texto indicando que é um projeto de vídeo
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, tempCanvas.height - 40, tempCanvas.width, 40);
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('📹 Projeto de Vídeo', tempCanvas.width / 2, tempCanvas.height - 15);
          
          thumbnailBase64 = tempCanvas.toDataURL('image/png');
        }
      }
    } catch (e) {
      console.error('[VideoEditor] Erro ao gerar thumbnail:', e);
    }
    
    const result = await (window as any).electronAPI.saveProject('video', projectData, thumbnailBase64);
    if (result.success) {
      onAddToTerminal("✅ Projeto de vídeo salvo!");
      onProjectAction?.('Projeto salvo');
      // Atualiza preview do planejamento
      if (thumbnailBase64) {
        onUpdatePreview?.(thumbnailBase64);
      }
    } else {
      onAddToTerminal("❌ Erro ao salvar: " + (result.error || 'desconhecido'));
    }
  };

  const handleLoadProject = async () => {
    const result = await (window as any).electronAPI.loadBillProject();
    if (result.success && result.clips) {
      if (Array.isArray(result.clips)) {
        setClips(result.clips);
        recalcDuration(result.clips);
        onUpdateChatHistory?.([]);
      } else {
        const data = result.clips as any;
        if (data.title) setProjectTitle(data.title);
        if (data.clips) {
          setClips(data.clips);
          recalcDuration(data.clips);
        }
        if (data.aiHistory && Array.isArray(data.aiHistory)) {
          onUpdateChatHistory?.(data.aiHistory);
        } else {
          onUpdateChatHistory?.([]);
        }
      }
      onAddToTerminal("✅ Projeto carregado!");
    }
  };

  const removeKeyframe = (time: number) => {
    setClips(prev => prev.map(c => c.id === selectedClipId ? { 
      ...c, 
      keyframes: (c.keyframes || []).filter(k => k.time !== time) 
    } : c));
    if (selectedKeyframeTime === time) setSelectedKeyframeTime(null);
  };

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isUndoingRedoingRef.current = true;
      historyIndexRef.current--;
      const previous = historyRef.current[historyIndexRef.current];
      setClips(JSON.parse(JSON.stringify(previous)));
      setSelectedClipId(null);
      setTimeout(() => { isUndoingRedoingRef.current = false; }, 100);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoingRedoingRef.current = true;
      historyIndexRef.current++;
      const next = historyRef.current[historyIndexRef.current];
      setClips(JSON.parse(JSON.stringify(next)));
      setSelectedClipId(null);
      setTimeout(() => { isUndoingRedoingRef.current = false; }, 100);
    }
  }, []);

  useEffect(() => {
    if (isUndoingRedoingRef.current) return;
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      const h = historyRef.current;
      const currentClipsStr = JSON.stringify(clips);
      const lastSavedStr = historyIndexRef.current >= 0 ? JSON.stringify(h[historyIndexRef.current]) : '';

      if (currentClipsStr !== lastSavedStr) {
        // Trunca o histórico se houver redos pendentes
        const newHistory = h.slice(0, historyIndexRef.current + 1);
        newHistory.push(JSON.parse(currentClipsStr));
        if (newHistory.length > 50) newHistory.shift(); // Aumentado para 50 undos
        historyRef.current = newHistory;
        historyIndexRef.current = newHistory.length - 1;
      }
    }, 500);
  }, [clips]);

  // Carregamento dinâmico de waveforms para áudio
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    clips.forEach(async (clip) => {
      if (clip.type !== 'audio') return;
      if (waveforms[clip.id]) return; // Já carregando, carregado ou erro

      setWaveforms(prev => ({ ...prev, [clip.id]: 'loading' }));

      try {
        if (api.getWaveform) {
          const result = await api.getWaveform(clip.path);
          if (result.success && result.peaks) {
            console.log(`[Waveform] Geraçãoo de peaks reais concluída para: ${clip.name}. Total de picos: ${result.peaks.length}`);
            setClipPeaks(prev => ({ ...prev, [clip.id]: result.peaks }));
            setWaveforms(prev => ({ ...prev, [clip.id]: 'loaded' }));
          } else {
            console.warn(`[Waveform] Falha ao extrair peaks reais para ${clip.name}:`, (result as any).error);
            const mockPeaks = generateMockPeaks(clip.duration);
            setClipPeaks(prev => ({ ...prev, [clip.id]: mockPeaks }));
            setWaveforms(prev => ({ ...prev, [clip.id]: 'loaded' }));
          }
        } else {
          console.warn(`[Waveform] getWaveform API não disponível na API Electron (usando mock)`);
          const mockPeaks = generateMockPeaks(clip.duration);
          setClipPeaks(prev => ({ ...prev, [clip.id]: mockPeaks }));
          setWaveforms(prev => ({ ...prev, [clip.id]: 'loaded' }));
        }
      } catch (err) {
        console.error(`[Waveform] Erro na requisição de peaks para ${clip.name}:`, err);
        const mockPeaks = generateMockPeaks(clip.duration);
        setClipPeaks(prev => ({ ...prev, [clip.id]: mockPeaks }));
        setWaveforms(prev => ({ ...prev, [clip.id]: 'loaded' }));
      }
    });
  }, [clips, waveforms]);

  const applyGlobalAdjustment = useCallback((key: string, value: number) => {
    setClips(prev => prev.map(c => ({
      ...c,
      config: { ...c.config, [key]: value }
    })));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteClip();
      } else if (e.key.toLowerCase() === 's') {
        handleSplitClip();
      } else if (e.key === ' ') {
        e.preventDefault();
        handlePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteClip, handleSplitClip, handlePlay]);

  useEffect(() => {
    if (!isPlaying || isScrubbing) { cancelAnimationFrame(animFrameRef.current); return; }
    let lastTime = performance.now();
    const tick = (now: DOMHighResTimeStamp) => {
      // Para imediatamente se scrubbing começou (ref é síncrono, sem delay de re-render)
      if (isScrubbingRef.current) { cancelAnimationFrame(animFrameRef.current); return; }
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setCurrentTime(prev => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setIsPlaying(false);
          // Atualiza progress bar
          if (progressBarRef.current) progressBarRef.current.style.width = '100%';
          return totalDuration;
        }
        // Atualiza progress bar diretamente no DOM â€” sem esperar React re-render
        if (progressBarRef.current && totalDuration > 0) {
          progressBarRef.current.style.width = `${(next / totalDuration) * 100}%`;
        }
        return next;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, totalDuration, isScrubbing]);

  // Atualiza a progress bar sempre que currentTime muda (scrub, seek, click)
  useEffect(() => {
    if (progressBarRef.current && totalDuration > 0) {
      progressBarRef.current.style.width = `${(currentTime / totalDuration) * 100}%`;
    }
  }, [currentTime, totalDuration]);

  useEffect(() => {
    if (isPlaying) return;
    const currentClips = clipsRef.current;
    const activeMediaClips = currentClips.filter(c => {
      if (c.type !== 'video' && c.type !== 'audio') return false;
      if (currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c)) return true;
      const activeTrans = currentClips.find(t => t.type === 'transition' && currentTime >= t.startTime && currentTime <= t.startTime + getEffectiveDur(t));
      if (activeTrans) {
        if (c.startTime >= activeTrans.startTime - 0.1 && c.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans)) return true;
      }
      return false;
    });
    activeMediaClips.forEach(clip => {
      const media = mediaRefs.current[clip.id];
      if (media) {
        const speed = clip.config?.speed || 1;
        const targetTime = clip.trimStart + (currentTime - clip.startTime) * speed;
        // Permite seek ao arrastar se a Mídia estiver carregada e não estiver ativamente buscando
        if (media.readyState >= 1 && !media.seeking && Math.abs(media.currentTime - targetTime) > 0.05) {
          media.currentTime = targetTime;
        }
      }
    });
  }, [currentTime, isPlaying]);

  // Limpa o cache de inicializaçãoo ao pausar
  useEffect(() => {
    if (!isPlaying) {
      playingInitializedClipsRef.current.clear();
    }
  }, [isPlaying]);

  useEffect(() => {
    const currentClips = clipsRef.current;
    // LOOKAHEAD: Pré-posiciona clipes que começarão em breve (dentro de 0.5s)
    // para eliminar o stutter de decodificaçãoo na transiçãoo entre clipes.
    const LOOKAHEAD_WINDOW = 0.5;
    // GUARDA DE ESTABILIZAÇÃO: Não fazemos preload nos primeiros 0.4s após um clipe começar.
    // Isso evita que o seek de preload do clipe N+1 interfira no decodificador do clipe N recém-iniciado.
    const STABILIZATION_TIME = 0.4;
    const activeMediaClips = currentClips.filter(c => {
      if (c.type !== 'video' && c.type !== 'audio') return false;
      if (currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c)) return true;
      const activeTrans = currentClips.find(t => t.type === 'transition' && currentTime >= t.startTime && currentTime <= t.startTime + getEffectiveDur(t));
      if (activeTrans) {
        if (c.startTime >= activeTrans.startTime - 0.1 && c.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans)) return true;
      }
      return false;
    });
    // Só inicia o preload se o clipe ativo atual já estabilizou (passou do período inicial)
    const activeClipIsStable = activeMediaClips.every(c => (currentTime - c.startTime) >= STABILIZATION_TIME);
    const upcomingClips = (isPlaying && activeClipIsStable) ? currentClips.filter(c => {
      if (c.type !== 'video' && c.type !== 'audio') return false;
      // Clipes que ainda não começaram mas vão começar dentro da janela de lookahead
      return c.startTime > currentTime && c.startTime <= currentTime + LOOKAHEAD_WINDOW;
    }) : [];

    // Seek helper: usa fastSeek() se disponível (vai ao keyframe mais próximo, 5-10x mais rápido).
    // Para transiçÁµes de corte no preview, imprecisão de alguns frames é invisível.
    const doSeek = (media: HTMLVideoElement, targetTime: number) => {
      if (typeof (media as any).fastSeek === 'function') {
        (media as any).fastSeek(targetTime);
      } else {
        media.currentTime = targetTime;
      }
    };

    // Play/Pause and sync dos clipes ativos
    activeMediaClips.forEach(clip => {
      const media = mediaRefs.current[clip.id];
      if (media) {
        if (isPlaying) {
          const speed = clip.config?.speed || 1;
          if (!playingInitializedClipsRef.current.has(clip.id)) {
            // Se o clipe foi PRÁ‰-CARREGADO (preloaded), já está posicionado no frame certo.
            // Apenas marcamos como inicializado e damos play â€” ZERO seek = ZERO stutter!
            const wasPreloaded = playingInitializedClipsRef.current.has(clip.id + '_preloaded');
            if (!wasPreloaded) {
              // Primeira vez que este clipe fica ativo sem preload: faz seek rápido
              const targetTime = clip.trimStart + (currentTime - clip.startTime) * speed;
              doSeek(media, targetTime);
            }
            media.playbackRate = speed;
            playingInitializedClipsRef.current.add(clip.id);
          } else {
            media.playbackRate = speed;
          }
          if (media.paused) {
            media.play().catch(() => {});
          }
        } else {
          if (!media.paused) media.pause();
        }
      }
    });

    // PRELOAD: Pré-posiciona clipes próximos sem reproduzir,
    // assim o buffer de Vídeo já está no frame certo quando a transiçãoo ocorrer.
    upcomingClips.forEach(clip => {
      if (playingInitializedClipsRef.current.has(clip.id + '_preloaded')) return;
      const media = mediaRefs.current[clip.id];
      if (media && media.readyState >= 1 && !media.seeking) {
        const speed = clip.config?.speed || 1;
        const targetTime = clip.trimStart; // Começo do clipe = trimStart
        if (Math.abs(media.currentTime - targetTime) > 0.05) {
          doSeek(media, targetTime);
          media.playbackRate = speed;
        }
        // Mantém pausado (não reproduz ainda)
        if (!media.paused) media.pause();
        playingInitializedClipsRef.current.add(clip.id + '_preloaded');
      }
    });

    // Pausa clipes que não estão mais ativos e não são upcoming
    Object.keys(mediaRefs.current).forEach(id => {
      const media = mediaRefs.current[id] as any;
      const isActive = activeMediaClips.some(c => c.id === id);
      const isUpcoming = upcomingClips.some(c => c.id === id);
      if (media && typeof media.pause === 'function' && !isActive && !isUpcoming) {
        if (!media.paused) media.pause();
      }
    });
  }, [isPlaying, currentTime]); // REMOVIDO clips daqui

  // Aplicação de transformações e filtros para múltiplos vídeos
  // Aplica posicionamento (x, y, scale, opacity) e efeitos aos clips de vídeo via DOM
  useEffect(() => {
    const activeVideoClips = clips.filter(c => {
      if (c.type !== 'video' && c.type !== 'image') return false;
      if (currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c)) return true;
      const activeTrans = clips.find(t => t.type === 'transition' && currentTime >= t.startTime && currentTime <= t.startTime + getEffectiveDur(t));
      if (activeTrans) {
        if (c.startTime >= activeTrans.startTime - 0.1 && c.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans)) return true;
        const cEnd = c.startTime + getEffectiveDur(c);
        if (cEnd >= activeTrans.startTime && cEnd <= activeTrans.startTime + getEffectiveDur(activeTrans) + 0.1) return true;
      }
      return false;
    });
    const activeEffect = clips.find(c => c.type === 'effect' && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c));

    activeVideoClips.forEach(clip => {
      const container = previewRefs.current[clip.id];
      const vid = mediaRefs.current[clip.id];
      if (container && clip.config) {
        const cfg = clip.config;
        const currentScale = getInterpolatedValue(clip, 'scale', currentTime, cfg.scale);
        const currentX = getInterpolatedValue(clip, 'x', currentTime, cfg.x || 0);
        const currentY = getInterpolatedValue(clip, 'y', currentTime, cfg.y || 0);
        const currentOpacity = getInterpolatedValue(clip, 'opacity', currentTime, cfg.opacity || 100);

        // Base filter from clip properties
        let cssFilter = `brightness(${cfg.brightness}%) contrast(${cfg.contrast}%) saturate(${cfg.saturation}%)`;

        // Apply active effect
        if (activeEffect?.effect === 'blur') {
          const intensity = activeEffect.config?.effectIntensity ?? 8;
          cssFilter += ` blur(${intensity}px)`;
        }
        else if (activeEffect?.effect === 'sepia_pro') {
          cssFilter += ` sepia(100%)`;
        }
        else if (activeEffect?.effect === 'bw_classic') {
          cssFilter += ` grayscale(100%)`;
        }
        else if (activeEffect?.effect === 'dramatic') {
          cssFilter += ` contrast(150%) saturate(60%) brightness(85%)`;
        }
        else if (activeEffect?.effect === 'pastel') {
          cssFilter += ` saturate(50%) brightness(115%)`;
        }

        container.style.filter = cssFilter;
        // Remove canvas de efeitos se existir
        container.querySelector('.effect-canvas')?.remove();

        // Calcula transformações de efeitos (só rotate funciona no preview)
        let effectTransform = '';
        let finalOpacity = currentOpacity / 100;
        
        if (activeEffect) {
          const efStart = activeEffect.startTime;
          const efDur = getEffectiveDur(activeEffect);
          const efProgress = Math.max(0, Math.min(1, (currentTime - efStart) / efDur));
          
          if (activeEffect.effect === 'rotate') {
            const angle = efProgress * 360;
            effectTransform += ` rotate(${angle}deg)`;
          }
          else if (activeEffect.effect === 'flipv') {
            effectTransform += ` scaleY(-1)`;
          }
          else if (activeEffect.effect === 'fliph') {
            effectTransform += ` scaleX(-1)`;
          }
          // fadein/fadeout são aplicados via opacity
          else if (activeEffect.effect === 'fadein') {
            finalOpacity *= efProgress;
          }
          else if (activeEffect.effect === 'fadeout') {
            finalOpacity *= (1 - efProgress);
          }
        }

        let transOffsetX = 0;
        let transOffsetY = 0;
        let clipPath = '';
        const activeTrans = clips.find(t => t.type === 'transition' && currentTime >= t.startTime && currentTime <= t.startTime + getEffectiveDur(t));
        if (activeTrans) {
          const isEntering = (clip.startTime >= activeTrans.startTime - 1.0 && clip.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
          const cEnd = clip.startTime + getEffectiveDur(clip);
          const isLeaving = (cEnd >= activeTrans.startTime - 1.0 && cEnd <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
          const p = Math.max(0, Math.min(1, (currentTime - activeTrans.startTime) / getEffectiveDur(activeTrans)));
          
          if (isEntering) {
            // Slides deslizam
            if (activeTrans.effect === 'trans_up') transOffsetY = (1-p)*100;
            if (activeTrans.effect === 'trans_down') transOffsetY = -(1-p)*100;
            if (activeTrans.effect === 'trans_left') transOffsetX = (1-p)*100;
            if (activeTrans.effect === 'trans_right') transOffsetX = -(1-p)*100;
            
            // Wipes cortam
            if (activeTrans.effect === 'wipeup') clipPath = `inset(${(1-p)*100}% 0 0 0)`;
            if (activeTrans.effect === 'wipedown') clipPath = `inset(0 0 ${(1-p)*100}% 0)`;
            if (activeTrans.effect === 'wipeleft') clipPath = `inset(0 0 0 ${(1-p)*100}%)`;
            if (activeTrans.effect === 'wiperight') clipPath = `inset(0 ${(1-p)*100}% 0 0)`;
            
            // Fades
            if (activeTrans.effect === 'fade' || activeTrans.effect === 'trans_flash') {
              finalOpacity *= p;
            }
          } else if (isLeaving) {
            // Slides deslizam
            if (activeTrans.effect === 'trans_up') transOffsetY = -p*100;
            if (activeTrans.effect === 'trans_down') transOffsetY = p*100;
            if (activeTrans.effect === 'trans_left') transOffsetX = -p*100;
            if (activeTrans.effect === 'trans_right') transOffsetX = p*100;
            
            // Wipes cortam
            if (activeTrans.effect === 'wipeup') clipPath = `inset(0 0 ${p*100}% 0)`;
            if (activeTrans.effect === 'wipedown') clipPath = `inset(${p*100}% 0 0 0)`;
            if (activeTrans.effect === 'wipeleft') clipPath = `inset(0 ${p*100}% 0 0)`;
            if (activeTrans.effect === 'wiperight') clipPath = `inset(0 0 0 ${p*100}%)`;
            
            // Fades
            if (activeTrans.effect === 'fade' || activeTrans.effect === 'trans_flash') {
              finalOpacity *= (1-p);
            }
          }
        }

        container.style.transform = `translate(calc(-50% + ${transOffsetX}%), calc(-50% + ${transOffsetY}%)) translate(${currentX * (previewHeight / 360)}px, ${currentY * (previewHeight / 360)}px) scale(${currentScale / 100})${effectTransform}`;
        container.style.clipPath = clipPath;
        container.style.opacity = String(finalOpacity);
        container.style.zIndex = `${100 + clip.track}`;
        if (vid) {
          vid.style.opacity = cfg.chromaKey ? '0' : '1';
          vid.style.pointerEvents = cfg.chromaKey ? 'none' : 'auto';
          vid.volume = 1;
        }
      }
    });
  }, [currentTime, clips, previewHeight, isPlaying]);

  const pickChromaColor = async () => {
    if (!selectedClip) return;
    try {
      // @ts-ignore
      if (typeof EyeDropper === 'undefined') {
        onAddToTerminal("Seu navegador não suporta o conta-gotas. Use o seletor de cor.");
        return;
      }
      // @ts-ignore
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      setClips(prev => prev.map(c => c.id === selectedClip.id ? { 
        ...c, 
        config: { ...c.config!, chromaKey: true, chromaColor: result.sRGBHex } 
      } : c));
      onAddToTerminal(`Chroma Key: Cor ${result.sRGBHex} selecionada`);
    } catch (e) {
      console.log('Eyedropper cancelled');
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastMouseMoveEventRef.current = e;
    if (draggingVideoId) {
      const ratio = 360 / Math.max(1, previewHeight);
      const newX = (e.clientX - videoDragOffset.x) * ratio;
      const newY = (e.clientY - videoDragOffset.y) * ratio;
      let finalX = newX; let finalY = newY;
      if (Math.abs(newX) < 10) finalX = 0;
      if (Math.abs(newY) < 10) finalY = 0;
      setSnapGuide({ x: finalX === 0, y: finalY === 0 });
      setClips(prev => prev.map(c => c.id === draggingVideoId && c.config ? { ...c, config: { ...c.config, x: finalX, y: finalY } } : c));
      return; // Previne arrasto de timeline ou texto ao mesmo tempo
    }

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = timelineRef.current?.scrollLeft || 0;
    const x = (e.clientX - rect.left + scrollLeft - 70) / zoom;
    let finalX = x;

    // Snapping logic (Imã) para redimensionamento
    if (resizingClipId) {
      const snapThreshold = 10 / zoom;
      const snapPoints = [0, currentTime, ...clips.filter(c => c.id !== resizingClipId).flatMap(c => [c.startTime, c.startTime + getEffectiveDur(c)])];

      for (const sp of snapPoints) {
        if (Math.abs(x - sp) < snapThreshold) { finalX = sp; break; }
      }
    }

    if (draggingVideoId) {
      const ratio = 360 / Math.max(1, previewHeight);
      const newX = (e.clientX - videoDragOffset.x) * ratio;
      const newY = (e.clientY - videoDragOffset.y) * ratio;
      setClips(prev => prev.map(c => c.id === draggingVideoId && c.config ? { ...c, config: { ...c.config, x: newX, y: newY } } : c));
    } else if (resizingTextId) {
      const delta = (e.clientX - dragOffset.x);
      const scaleRatio = 360 / Math.max(1, previewHeight);
      const newSize = Math.max(8, Math.round(initialFontSize + (delta * scaleRatio)));
      setClips(prev => prev.map(c => c.id === resizingTextId && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontSize: newSize } } : c));
    } else if (resizingTextWidthId) {
      const delta = (e.clientX - dragOffset.x);
      const scaleRatio = 360 / Math.max(1, previewHeight);
      const newWidth = Math.max(50, Math.round((initialTextWidth || 200) + (delta * scaleRatio)));
      setClips(prev => prev.map(c => c.id === resizingTextWidthId && c.textConfig ? { ...c, textConfig: { ...c.textConfig, width: newWidth } } : c));
    } else if (isScrubbing || isScrubbingRef.current) {
      setCurrentTime(Math.max(0, Math.min(totalDuration, finalX)));
    } else if (potentialDragClipId && !draggingClipId) {
      // Potencial drag: verifica se moveu mais de 15px pra ativar o drag de verdade
      const origin = dragOriginRef.current;
      if (origin) {
        const distMoved = Math.sqrt(Math.pow(e.clientX - origin.x, 2) + Math.pow(e.clientY - origin.y, 2));
        console.log('[Potential Drag]', { distMoved, threshold: 15, willActivate: distMoved > 15 });
        if (distMoved > 15) {
          // Ativa o drag
          console.log('[Drag Activated]', potentialDragClipId);
          dragActivatedRef.current = true; // Marca que drag foi ativado
          setDraggingClipId(potentialDragClipId);
          setPotentialDragClipId(null);
        }
      }
    } else if (draggingClipId && dragActivatedRef.current) {
      const c = clips.find(clip => clip.id === draggingClipId);
      let newStartTime = Math.max(0, x - dragOffset.x / zoom);
      if (c) {
        const effDur = getEffectiveDur(c);
        const tentativeEnd = newStartTime + effDur;
        const snapThreshold = 10 / zoom;
        const snapPoints = [0, currentTime, ...clips.filter(clip => clip.id !== draggingClipId).flatMap(clip => [clip.startTime, clip.startTime + getEffectiveDur(clip)])];
        
        for (const sp of snapPoints) {
          if (c.type === 'transition') {
            const center = newStartTime + effDur / 2;
            if (Math.abs(center - sp) < snapThreshold) {
              newStartTime = sp - effDur / 2;
              break;
            }
          } else {
            // Snapping Magnético do início do clipe
            if (Math.abs(newStartTime - sp) < snapThreshold) {
              newStartTime = sp;
              break;
            }
            // Snapping Magnético do fim do clipe
            if (Math.abs(tentativeEnd - sp) < snapThreshold) {
              newStartTime = sp - effDur;
              break;
            }
          }
        }
      }
      newStartTime = Math.max(0, newStartTime);

      const origin = dragOriginRef.current;
      const originY = origin ? origin.y : dragOffset.y;
      const originTrack = origin ? origin.track : dragOffset.track;
      const deltaY = e.clientY - originY;
      // Deadzone de 10px â€” evita trocar trilha em cliques simples
      const TRACK_DEADZONE = 10;
      const trackDiff = Math.abs(deltaY) > TRACK_DEADZONE ? Math.round(deltaY / TRACK_HEIGHT) : 0;
      const newTrack = Math.max(1, originTrack - trackDiff); // Puxar pra cima = trilha maior
      setClips(prev => prev.map(c => c.id === draggingClipId ? { ...c, startTime: newStartTime, track: newTrack } : c));
    } else if (resizingClipId && resizeSide) {
      setClips(prev => prev.map(c => {
        if (c.id !== resizingClipId) return c;
        if (resizeSide === 'l') {
          const diff = finalX - c.startTime;
          
          if (c.type === 'text' || c.type === 'effect' || c.type === 'transition' || c.type === 'image') {
            return { ...c, startTime: c.startTime + diff, duration: Math.max(0.1, c.duration - diff) };
          }
          
          const newTrimStart = Math.max(0, c.trimStart + diff);
          const maxTrim = c.duration - c.trimEnd - 0.1;
          const finalTrimStart = Math.min(newTrimStart, maxTrim);
          return { ...c, startTime: c.startTime + (finalTrimStart - c.trimStart), trimStart: finalTrimStart };
        } else {
          if (c.type === 'text' || c.type === 'effect' || c.type === 'transition' || c.type === 'image') {
            const newDur = finalX - c.startTime + (c.trimStart || 0) + (c.trimEnd || 0);
            return { ...c, duration: Math.max(0.1, newDur) };
          }
          
          const newTrimEnd = Math.max(0, c.duration - c.trimStart - (finalX - c.startTime));
          const maxTrim = c.duration - c.trimStart - 0.1;
          return { ...c, trimEnd: Math.min(newTrimEnd, maxTrim) };
        }
      }));
    } else if (draggingTextId) {
      const textClip = clips.find(c => c.id === draggingTextId);
      if (!textClip) return;
      
      const container = document.querySelector('.ve-preview-screen');
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      
      // Se o texto tem tracking, atualiza o offset
      if (textClip.config?.trackId) {
        if (!dragOffset) return;
        
        const currentX = e.clientX - cRect.left;
        const currentY = e.clientY - cRect.top;
        
        // Calcula o deslocamento desde o último frame
        const deltaX = currentX - dragOffset.x;
        const deltaY = currentY - dragOffset.y;
        
        const currentOffsetX = textClip.textConfig?.trackOffsetX || 0;
        const currentOffsetY = textClip.textConfig?.trackOffsetY || 0;
        
        console.log('[Drag Track Text]', {
          deltaX,
          deltaY,
          currentOffsetX,
          currentOffsetY,
          newOffsetX: currentOffsetX + deltaX,
          newOffsetY: currentOffsetY + deltaY
        });
        
        setClips(prev => prev.map(c => (c.id === draggingTextId && c.textConfig) ? { 
          ...c, 
          textConfig: { 
            ...c.textConfig, 
            trackOffsetX: currentOffsetX + deltaX,
            trackOffsetY: currentOffsetY + deltaY
          } 
        } : c));
        
        // Atualiza o dragOffset para o próximo frame
        setDragOffset({ x: currentX, y: currentY, track: 0 });
      } else {
        // Texto sem tracking: comportamento normal (posição percentual)
        let tx = ((e.clientX - cRect.left) / cRect.width) * 100;
        let ty = ((e.clientY - cRect.top) / cRect.height) * 100;
        if (Math.abs(tx - 50) < 2) tx = 50;
        if (Math.abs(ty - 50) < 2) ty = 50;
        setSnapGuide({ x: tx === 50, y: ty === 50 });
        setClips(prev => prev.map(c => (c.id === draggingTextId && c.textConfig) ? { ...c, textConfig: { ...c.textConfig, x: tx.toFixed(1) + '%', y: ty.toFixed(1) + '%' } } : c));
      }
    }
  }, [draggingClipId, potentialDragClipId, resizingClipId, resizeSide, dragOffset, zoom, draggingTextId, resizingTextId, resizingTextWidthId, draggingVideoId, videoDragOffset, previewHeight, initialFontSize, initialTextWidth, isScrubbing, totalDuration]);

  const handleMouseUp = useCallback(() => {
    dragOriginRef.current = null; // Limpa origem do drag â€” evita estado vazado entre drags
    setDraggingClipId(null); setPotentialDragClipId(null); setResizingClipId(null); setResizeSide(null); setDraggingTextId(null); setResizingTextId(null); setResizingTextWidthId(null); setDraggingVideoId(null); setIsScrubbing(false); isScrubbingRef.current = false;
    dragActivatedRef.current = false; // Reseta flag de drag ativado
    setSnapGuide({ x: false, y: false });
    recalcDuration(clips);
  }, [clips, recalcDuration]);

  useEffect(() => {
    if (draggingClipId || potentialDragClipId || resizingClipId || draggingTextId || resizingTextId || resizingTextWidthId || draggingVideoId || isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [draggingClipId, potentialDragClipId, resizingClipId, draggingTextId, resizingTextId, resizingTextWidthId, draggingVideoId, isScrubbing, handleMouseMove, handleMouseUp]);

  // Timeline Edge Autoscroll when dragging, resizing or scrubbing
  useEffect(() => {
    const isDragging = draggingClipId || potentialDragClipId || resizingClipId || isScrubbing;
    if (!isDragging) return;
    
    let active = true;
    const scrollContainer = timelineRef.current;
    if (!scrollContainer) return;
    
    const autoScrollLoop = () => {
      if (!active) return;
      
      const e = lastMouseMoveEventRef.current;
      if (e) {
        const rect = scrollContainer.getBoundingClientRect();
        const leftLimit = rect.left + 70; // 70px fixed track labels
        const rightLimit = rect.right;
        const threshold = 50; // px near edge to trigger scroll
        
        let scrollAmount = 0;
        if (e.clientX > rightLimit - threshold) {
          const overshoot = e.clientX - (rightLimit - threshold);
          scrollAmount = Math.min(20, Math.max(3, overshoot * 0.4));
        } else if (e.clientX < leftLimit + threshold) {
          const undershoot = (leftLimit + threshold) - e.clientX;
          scrollAmount = -Math.min(20, Math.max(3, undershoot * 0.4));
        }
        
        if (scrollAmount !== 0) {
          scrollContainer.scrollLeft += scrollAmount;
          handleMouseMove(e);
        }
      }
      
      requestAnimationFrame(autoScrollLoop);
    };
    
    const animationFrameId = requestAnimationFrame(autoScrollLoop);
    
    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [draggingClipId, potentialDragClipId, resizingClipId, isScrubbing, handleMouseMove]);

  const addText = () => {
    const duration = 5;
    const track = getAvailableTrack(currentTime, duration, 'text');
    const newClip: VideoClip = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'TEXTO', path: '', url: '', duration, startTime: currentTime, trimStart: 0, trimEnd: 0,
      type: 'text', volume: 0, track, textConfig: { content: 'TEXTO', fontSize: 32, color: '#ffffff', x: '50%', y: '50%', fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', strokeColor: '#000000', strokeWidth: 0 }
    };
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    setActiveTab('text');
    setPanelOpen(true);
  };

  const handleAutoCut = async () => {
    let targetClipId = selectedClipId;
    if (!targetClipId) {
      const firstVideo = clips.find(c => c.type === 'video');
      if (firstVideo) targetClipId = firstVideo.id;
    }
    if (!targetClipId) {
      onAddToTerminal('âš ï¸ Selecione um clipe de Vídeo para remover silêncios.');
      return;
    }
    const clip = clips.find(c => c.id === targetClipId);
    if (!clip || clip.type !== 'video') {
      onAddToTerminal('âš ï¸ Selecione um clipe de Vídeo válido.');
      return;
    }

    const api = (window as any).electronAPI;
    if (!api?.detectSilence) {
      onAddToTerminal('âŒ Erro: API de detecçãoo de silêncio não disponível.');
      return;
    }

    setIsAutoCutting(true);

    // â”€â”€ PASSO 1: Isolar voz (denoiser FFmpeg) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Usa o áudio limpo APENAS para detecçãoo â€” os clipes finais usam o Vídeo original.
    onAddToTerminal(`ðŸ”‡ Passo 1/2: Isolando voz de: ${clip.name}...`);
    let analysisPath = clip.path; // fallback: usa original se denoising falhar
    try {
      if (api.isolateVoice) {
        const denoiseRes = await api.isolateVoice(clip.path);
        if (denoiseRes.success && denoiseRes.path) {
          analysisPath = denoiseRes.path;
          onAddToTerminal(`✅ Voz isolada com sucesso. Usando áudio limpo para análise.`);
        } else {
          onAddToTerminal(`âš ï¸ Isolamento de voz falhou (${denoiseRes.error || 'erro desconhecido'}). Usando áudio original.`);
        }
      }
    } catch (e: any) {
      onAddToTerminal(`âš ï¸ Erro no isolamento: ${e.message}. Continuando com áudio original.`);
    }

    // â”€â”€ PASSO 2: Detectar silêncios no áudio limpo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    onAddToTerminal(`🎙️ Passo 2/2: Detectando silêncios no áudio limpo...`);
    try {
      // analysisPath = arquivo com voz isolada (ou original como fallback)
      // Os clipes resultantes SEMPRE apontam para clip.path (Vídeo original)
      const res = await api.detectSilence(analysisPath, -30, 0.6);
      if (!res.success || !res.segments || res.segments.length === 0) {
        onAddToTerminal('âš ï¸ Nenhuma voz detectada mesmo após isolamento.');
        setIsAutoCutting(false);
        return;
      }

      onAddToTerminal(`ðŸŽ¤ ${res.segments.length} segmentos de voz identificados. Cortando...`);

      // Coordenadas do trecho VISÁVEL do clipe no arquivo bruto
      const fileStart = clip.trimStart;
      const fileEnd   = clip.duration - clip.trimEnd;

      onAddToTerminal(`ðŸ“Š Filtrando no range [${fileStart.toFixed(2)}s â†’ ${fileEnd.toFixed(2)}s]...`);

      // O silencedetect já retorna segmentos de FALA (não silêncio).
      // Só precisamos recortar pelo range visível do clipe (trim).
      const MIN_SEG_DUR = 0.3;

      let rawSegments = res.segments
        .filter((seg: any) => seg.end > fileStart && seg.start < fileEnd)
        .map((seg: any) => ({
          start: Math.max(fileStart, seg.start),
          end:   Math.min(fileEnd,   seg.end),
        }))
        .filter((seg: any) => seg.end - seg.start >= MIN_SEG_DUR);

      if (rawSegments.length === 0) {
        onAddToTerminal('âš ï¸ Nenhum áudio audível no trecho visível deste clipe.');
        setIsAutoCutting(false);
        return;
      }

      // 2. Ordenar por tempo de início
      rawSegments.sort((a: any, b: any) => a.start - b.start);

      // 3. Mesclar segmentos muito próximos (pausas naturais de respiraçãoo, vírgulas)
      const MIN_GAP = 0.3; // une segmentos separados por menos de 300ms
      const merged: Array<{start: number; end: number}> = [rawSegments[0]];
      for (let i = 1; i < rawSegments.length; i++) {
        const last = merged[merged.length - 1];
        const curr = rawSegments[i];
        if (curr.start - last.end < MIN_GAP) {
          last.end = Math.max(last.end, curr.end);
        } else {
          merged.push({ ...curr });
        }
      }

      onAddToTerminal(`❌‚ï¸ ${merged.length} blocos de áudio identificados após mesclagem. Cortando silêncios...`);

      // 4. Construir clipes â€” cada bloco de fala vira um clipe na timeline
      const newClips: any[] = [];
      let timelineCursor = clip.startTime; // posição atual na timeline

      merged.forEach((seg, index) => {
        const segDur = seg.end - seg.start;
        if (segDur < MIN_SEG_DUR) return;

        newClips.push({
          ...clip,
          id: `${clip.id}_ac_${index}_${Math.random().toString(36).substr(2,5)}`,
          // trimStart/trimEnd são coordenadas no arquivo bruto (em segundos absolutos do Vídeo)
          trimStart: seg.start,
          trimEnd: clip.duration - seg.end,
          startTime: timelineCursor,
        });
        timelineCursor += segDur;
      });

      if (newClips.length === 0) {
        onAddToTerminal('âš ï¸ Não foi possível gerar nenhum clipe após o corte automático.');
        setIsAutoCutting(false);
        return;
      }

      // 5. Substituir clipe original pelos novos, ajustando posição dos clipes seguintes
      const originalDur = fileEnd - fileStart;
      const newTotalDur = timelineCursor - clip.startTime;
      const shift = newTotalDur - originalDur;

      setClips(prev => {
        const filtered = prev.filter(c => c.id !== clip.id);
        const shifted = filtered.map(c => {
          if (c.track === clip.track && c.startTime >= clip.startTime + originalDur) {
            return { ...c, startTime: c.startTime + shift };
          }
          return c;
        });
        return [...shifted, ...newClips].sort((a, b) => a.startTime - b.startTime);
      });

      onAddToTerminal(`✅ Auto Corte finalizado! ${newClips.length} blocos de fala, ${(originalDur - newTotalDur).toFixed(1)}s de silêncio removidos.`);
    } catch (err: any) {
      onAddToTerminal(`âŒ Falha no Auto Corte: ${err.message}`);
    } finally {
      setIsAutoCutting(false);
    }
  };
  // Ref para a IA poder chamar handleAutoCut via applyAIAction
  handleAutoCutRef.current = handleAutoCut;
  
  const handleAutoSubtitle = async (mode: 'normal' | 'word-by-word' | 'karaoke' = 'normal') => {
    // Se tem clip selecionado, legenda só ele. Senão, legenda todos.
    let videoClips = clips.filter(c => c.type === 'video');
    
    if (selectedClipId) {
      const selectedClip = clips.find(c => c.id === selectedClipId && c.type === 'video');
      if (selectedClip) {
        videoClips = [selectedClip];
        onAddToTerminal(`📌 Legendando apenas o clip selecionado: ${selectedClip.name}`);
      }
    }
    
    if (videoClips.length === 0) {
      onAddToTerminal('⚠️ Não há clipes de vídeo para legendar.');
      return;
    }

    const api = (window as any).electronAPI;
    if (!api?.transcribeVideo) {
      onAddToTerminal('❌ Erro: API de transcrição não disponível.');
      return;
    }

    setIsTranscribing(true);
    onAddToTerminal(`🎙️ Iniciando legenda automática para ${videoClips.length} clipe(s)...`);
    onAddToTerminal(`💡 Nota: A primeira execução pode demorar alguns minutos para baixar o motor de IA (Whisper).`);
    
    try {
      const transcripts: Record<string, any> = {};

      // Para cada clip de vídeo, extrai e transcreve individualmente
      for (const vClip of videoClips) {
        const clipEffectiveStart = vClip.trimStart;
        const clipEffectiveEnd = vClip.duration - vClip.trimEnd;
        const clipEffectiveDuration = clipEffectiveEnd - clipEffectiveStart;
        
        onAddToTerminal(`📹 Processando: ${vClip.name} (${clipEffectiveDuration.toFixed(1)}s)`);
        
        let pathToTranscribe = vClip.path;
        let extractedTempFile: string | null = null;
        let timeOffset = clipEffectiveStart;
        
        // Se o clip está cortado, extrai apenas a parte usada
        if (vClip.trimStart > 0 || vClip.trimEnd > 0) {
          onAddToTerminal(`✂️ Extraindo trecho (${clipEffectiveStart.toFixed(1)}s - ${clipEffectiveEnd.toFixed(1)}s)...`);
          
          try {
            const extractResult = await api.extractVideoSegment(vClip.path, clipEffectiveStart, clipEffectiveDuration);
            
            if (extractResult.success && extractResult.path) {
              extractedTempFile = extractResult.path;
              pathToTranscribe = extractResult.path;
              timeOffset = clipEffectiveStart;
              onAddToTerminal(`✅ Trecho extraído com sucesso`);
            } else {
              onAddToTerminal(`⚠️ Erro ao extrair, usando vídeo completo...`);
              timeOffset = 0;
            }
          } catch (err) {
            onAddToTerminal(`⚠️ Erro ao extrair, usando vídeo completo...`);
            timeOffset = 0;
          }
        } else {
          timeOffset = 0;
        }
        
        onAddToTerminal(`🎤 Transcrevendo áudio...`);
        const result = await api.transcribeVideo(pathToTranscribe);
        
        // Limpa arquivo temporário
        if (extractedTempFile && api.deleteFile) {
          try {
            await api.deleteFile(extractedTempFile);
          } catch {}
        }
        
        if (result.success && result.segments) {
          // Ajusta timestamps se extraímos um trecho
          const adjustedSegments = result.segments.map((seg: any) => ({
            ...seg,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset
          }));
          
          // Usa um ID único por clip (não só path) para suportar múltiplos clips do mesmo vídeo
          transcripts[vClip.id] = { segments: adjustedSegments, clip: vClip };
          onAddToTerminal(`✅ ${adjustedSegments.length} segmentos encontrados`);
        } else {
          onAddToTerminal(`❌ Erro na transcrição: ${result.error}`);
        }
      }

      onAddToTerminal(`✅ Transcrição concluída! Sincronizando legendas...`);
      onAddToTerminal(`🎨 Aplicando modo: ${mode === 'normal' ? 'Normal' : mode === 'word-by-word' ? 'Palavra por Palavra' : 'Karaoke'}...`);

      
      const newClips: VideoClip[] = [];
      const maxChars = 28;
      const textWidth = videoAspectRatio < 1 ? 180 : 600;
      const responsiveFontSize = videoAspectRatio < 1 ? 14 : 22;
      const responsiveY = videoAspectRatio < 1 ? '75%' : '85%';

      // Processa cada clip individualmente
      for (const clipId in transcripts) {
        const { segments, clip: vClip } = transcripts[clipId];
        if (!segments) continue;

        const speed = vClip.config?.speed || 1;
        const clipEffectiveEnd = vClip.duration - vClip.trimEnd;
        
        const filteredSegments = segments.filter((seg: any) => {
          return seg.end > vClip.trimStart && seg.start < clipEffectiveEnd;
        });

        for (const seg of filteredSegments) {
          const start = Math.max(seg.start, vClip.trimStart);
          const end = Math.min(seg.end, clipEffectiveEnd);
          const totalDuration = end - start;
          const text = (seg.text || '').trim();
          
          if (!text) continue;
          
          const words = text.split(/\s+/);
          
          // MODO PALAVRA POR PALAVRA: cada palavra é uma legenda separada
          if (mode === 'word-by-word') {
            const wordDuration = totalDuration / words.length;
            words.forEach((word, idx) => {
              const wordStart = start + (wordDuration * idx);
              const startTimeInTimeline = vClip.startTime + (wordStart - vClip.trimStart) / speed;
              const durationInTimeline = wordDuration / speed;
              
              newClips.push({
                id: Math.random().toString(36).substr(2, 9),
                name: 'LEGENDA', path: '', url: '', 
                duration: durationInTimeline, 
                startTime: startTimeInTimeline, 
                trimStart: 0, trimEnd: 0,
                type: 'text', volume: 0, track: -1,
                textConfig: { 
                  content: word, 
                  fontSize: responsiveFontSize,
                  width: textWidth,
                  color: '#ffff00',
                  x: '50%', y: responsiveY,
                  fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal',
                  strokeColor: '#000000',
                  strokeWidth: 2
                }
              });
            });
            continue; // Pula o resto do processamento normal
          }
          
          if (words.length <= 3 && text.length <= maxChars) {
            const startTimeInTimeline = vClip.startTime + (start - vClip.trimStart) / speed;
            const durationInTimeline = totalDuration / speed;
            newClips.push({
              id: Math.random().toString(36).substr(2, 9),
              name: 'LEGENDA', path: '', url: '', 
              duration: durationInTimeline, 
              startTime: startTimeInTimeline, 
              trimStart: 0, trimEnd: 0,
              type: 'text', volume: 0, track: -1,
              textConfig: { 
                content: text, 
                fontSize: responsiveFontSize,
                width: textWidth,
                color: '#ffff00',
                x: '50%', y: responsiveY,
                fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal',
                strokeColor: '#000000',
                strokeWidth: 2
              }
            });
            continue;
          }

          const chunks: { text: string; start: number; end: number }[] = [];
          let currentChunkWords: string[] = [];
          let currentLength = 0;
          let accumulatedChars = 0;
          const charsCount = text.length;

          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (currentChunkWords.length > 0 && currentLength + 1 + word.length > maxChars) {
              const chunkText = currentChunkWords.join(' ');
              const chunkChars = chunkText.length;
              const chunkStart = start + (accumulatedChars / charsCount) * totalDuration;
              accumulatedChars += chunkChars + 1;
              const chunkEnd = start + (accumulatedChars / charsCount) * totalDuration;
              
              chunks.push({ text: chunkText, start: chunkStart, end: chunkEnd });
              currentChunkWords = [];
              currentLength = 0;
            }
            currentChunkWords.push(word);
            currentLength += (currentLength > 0 ? 1 : 0) + word.length;
          }

          if (currentChunkWords.length > 0) {
            const chunkText = currentChunkWords.join(' ');
            const chunkStart = start + (accumulatedChars / charsCount) * totalDuration;
            chunks.push({ text: chunkText, start: chunkStart, end: end });
          }

          for (const ch of chunks) {
            if (!ch.text.trim()) continue;
            const chunkDuration = ch.end - ch.start;
            const startTimeInTimeline = vClip.startTime + (ch.start - vClip.trimStart) / speed;
            const durationInTimeline = chunkDuration / speed;

            newClips.push({
              id: Math.random().toString(36).substr(2, 9),
              name: 'LEGENDA', path: '', url: '', 
              duration: durationInTimeline, 
              startTime: startTimeInTimeline, 
              trimStart: 0, trimEnd: 0,
              type: 'text', volume: 0, track: -1,
              textConfig: { 
                content: ch.text, 
                fontSize: responsiveFontSize,
                width: textWidth,
                color: '#ffff00',
                x: '50%', y: responsiveY,
                fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal',
                strokeColor: '#000000',
                strokeWidth: 2
              }
            });
          }
        }
      }
      
      setClips(prev => [...prev, ...newClips]);
      recalcDuration([...clips, ...newClips]);
      onAddToTerminal(`✅ ${newClips.length} legendas adicionadas!`);
    } catch (err: any) {
      onAddToTerminal(`⚠️ Falha ao legendar: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };
  // Ref para a IA poder chamar handleAutoSubtitle via applyAIAction
  handleAutoSubtitleRef.current = handleAutoSubtitle;


  const handleStartExport = async () => {
    const api = (window as any).electronAPI;
    if (!api) {
      onAddToTerminal('âŒ Erro: API do Electron não disponível.');
      return;
    }

    if (!exportSettings.outputPath) {
      onAddToTerminal('âŒ Erro: Selecione uma pasta de destino na aba "Exportar".');
      return;
    }

    if (!clips || clips.length === 0) {
      onAddToTerminal('âŒ Erro: Nenhum clipe na timeline para exportar.');
      return;
    }

    const videoClips = clips.filter(c => c.type === 'video');
    if (videoClips.length === 0) {
      onAddToTerminal('âŒ Erro: Nenhum clipe de Vídeo para processar.');
      return;
    }

    setIsExporting(true);
    setExportProgress(5);
    onAddToTerminal('ðŸŽ¬ Iniciando Motor NLE Nativo...');

    // Avaliar resoluçãoo real se "original"
    const evaluatedSettings = { ...exportSettings, title: projectTitle };
    if (evaluatedSettings.resolution === 'original') {
      const mainClip = clips.find(c => c.type === 'video' && c.track === 1);
      const mainVid = mainClip ? mediaRefs.current[mainClip.id] : Object.values(mediaRefs.current).find(v => !!v);
      evaluatedSettings.resolution = mainVid?.videoWidth
        ? `${mainVid.videoWidth}x${mainVid.videoHeight}`
        : '1920x1080';
    }

    // Garantir que a pasta de saída existe
    try {
      await api.createDirectory(evaluatedSettings.outputPath);
    } catch (e) {}

    // Registrar listeners de progresso e log em tempo real
    let unsubProgress: (() => void) | null = null;
    let unsubLog: (() => void) | null = null;
    if (api.onExportProgress) {
      unsubProgress = api.onExportProgress((p: number) => {
        setExportProgress(p);
      });
    }
    if (api.onExportLog) {
      unsubLog = api.onExportLog((msg: string) => {
        // Filtra linhas CMD muito longas para não entupir o terminal
        if (!msg.startsWith('[CMD]')) onAddToTerminal(msg);
      });
    }

    try {
      // Sempre usa FFmpeg direto (sem efeitos complexos)
      onAddToTerminal('🎬 Iniciando Motor NLE Nativo...');
      const result = await api.startNativeExport(clips, evaluatedSettings, trackingData);
      if (result.success && result.finalPath) { setExportProgress(100); onAddToTerminal('✅ Video exportado: ' + result.finalPath); setTimeout(() => setIsExporting(false), 3000); }
      else { setExportProgress(0); onAddToTerminal('❌ Erro: ' + (result.error || 'desconhecido')); setIsExporting(false); }
      setExportProgress(0);
    } catch (err: any) {
      onAddToTerminal(`âš ï¸ Falha na exportaçãoo: ${err.message}`);
      setIsExporting(false);
    } finally {
      if (unsubProgress) unsubProgress();
      if (unsubLog) unsubLog();
    }
  };
  // Ref para a IA poder chamar handleStartExport via applyAIAction
  handleStartExportRef.current = handleStartExport;


  const selectedClip = clips.find(c => c.id === selectedClipId);

  return (
    <>
      <div className={`ve-root ${isTimelineExpanded ? 'timeline-expanded' : ''}`}>
      {(isTranscribing || isAutoCutting) && (
        <div className="ve-transcribing-overlay">
          <div className="ve-loading-spinner" />
          <span>{isTranscribing ? 'Legendando Vídeo...' : 'Cortando silêncios...'}</span>
          <small>Acompanhe o progresso no terminal</small>
        </div>
      )}
      <div className="ve-main">
        {/* BOTÁ•ES DE TOGGLE PERSISTENTES (FORA DOS PAINÁ‰IS) */}
        <button className="ve-panel-toggle-btn left" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}</button>
        <button className="ve-panel-toggle-btn right" onClick={() => setRightPanelOpen(!rightPanelOpen)}>{rightPanelOpen ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}</button>

        <div className="ve-left-sidebar">
          <button className={`ve-side-tab ${activeTab === 'media' ? 'active' : ''}`} onClick={() => { setActiveTab('media'); setPanelOpen(true); }}><Film size={18} /></button>
          <button className={`ve-side-tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => { setActiveTab('text'); setPanelOpen(true); }}><Type size={18} /></button>
          <button className={`ve-side-tab ${activeTab === 'effects' ? 'active' : ''}`} onClick={() => { setActiveTab('effects'); setPanelOpen(true); }}><Sparkles size={18} /></button>
          <button className={`ve-side-tab ${activeTab === 'filters' ? 'active' : ''}`} onClick={() => { setActiveTab('filters'); setPanelOpen(true); }}><Filter size={18} /></button>
          <button className={`ve-side-tab ${activeTab === 'transitions' ? 'active' : ''}`} onClick={() => { setActiveTab('transitions'); setPanelOpen(true); }}><Layers size={18} /></button>
          <button className={`ve-side-tab ${activeTab === 'narrator' ? 'active' : ''}`} onClick={() => { setActiveTab('narrator'); setActiveRightTab('narrator'); setPanelOpen(true); setRightPanelOpen(true); }}><Zap size={18} /></button>
          <div style={{ marginTop: 'auto', marginBottom: '15px' }}><button className={`ve-side-tab ${activeTab === 'export' ? 'active' : ''}`} onClick={() => { setActiveTab('export'); setPanelOpen(true); }}><Download size={18} /></button></div>
        </div>

        <div className={`ve-left-panel ${panelOpen ? 'open' : 'closed'}`}>
          <div className="ve-panel-header"><span>{activeTab === 'export' ? 'Exportar Vídeo' : 'Mídia / Texto'}</span></div>
          <div className="ve-panel-content">
            {activeTab === 'media' && (
              <div className="ve-panel-inner">
                <div style={{ marginBottom: '20px', borderBottom: '1px solid #1a1a24', paddingBottom: '15px' }}>
                  <label style={{ fontSize: '8px', fontWeight: 900, color: '#555', display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>TÍTULO DO PROJETO</label>
                  <input 
                    type="text" 
                    value={projectTitle} 
                    onChange={e => setProjectTitle(e.target.value)} 
                    placeholder="Nome do seu Vídeo..."
                    style={{ 
                      width: '100%', background: '#000', border: '1px solid #1a1a24', color: '#fff', 
                      padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      outline: 'none', transition: 'border-color 0.3s'
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = '#1a1a24'}
                  />
                </div>
                <button 
                  onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.onchange = async (e) => { for (const f of Array.from((e.target as any).files)) await addFile(f as File) }; i.click(); }}
                  style={{ 
                    width: '100%', padding: '12px', background: 'rgba(124, 92, 252, 0.08)', border: '1px solid rgba(124, 92, 252, 0.2)', 
                    borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '15px', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 92, 252, 0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.08)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <FilePlus size={16} /> <span>IMPORTAR</span>
                </button>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <button 
                    onClick={handleSaveProject} 
                    style={{ 
                      flex: 1, padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a24', 
                      borderRadius: '6px', color: '#888', fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#1a1a24'; }}
                  >
                    <Save size={12} /> SALVAR
                  </button>
                  <button 
                    onClick={handleLoadProject} 
                    style={{ 
                      flex: 1, padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a24', 
                      borderRadius: '6px', color: '#888', fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#1a1a24'; }}
                  >
                    <FolderOpen size={12} /> ABRIR
                  </button>
                </div>
                <div className="ve-media-list">
                  {clips.filter(c => c.type !== 'text').map(c => (
                    <div key={c.id} className="ve-media-item" onClick={() => { setSelectedClipId(c.id); if (c.type === 'video') setPreviewUrl(c.url); }} style={{ padding: '8px', cursor: 'pointer', fontSize: '10px', color: '#555', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {c.type === 'video' ? <Film size={12} /> : <Music size={12} />} <span>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'effects' && (
              <div className="ve-panel-inner">
                <div className="ve-panel-title" style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginBottom: '15px' }}>EFEITOS</div>

                {/* Controles do efeito selecionado */}
                {selectedClip && selectedClip.type === 'effect' && (
                  <div style={{ background: '#0a0a0f', border: '1px solid #1a1a24', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#7c5cfc', marginBottom: '10px', letterSpacing: '1px' }}>
                      {selectedClip.name}
                    </div>
                    {selectedClip.effect === 'blur' && (
                      <div className="ve-prop-row">
                        <span>Intensidade</span>
                        <input type="range" min="1" max="20" step="0.5"
                          value={selectedClip.config?.effectIntensity ?? 8}
                          onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, effectIntensity: Number(e.target.value) } } : c))}
                        />
                        <span>{selectedClip.config?.effectIntensity ?? 8}px</span>
                      </div>
                    )}
                    {selectedClip.effect === 'blur_tracked' && (
                      <div className="ve-prop-row">
                        <span>Intensidade</span>
                        <input type="range" min="1" max="50" step="1"
                          value={selectedClip.config?.blur ?? 20}
                          onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, blur: Number(e.target.value) } } : c))}
                        />
                        <span>{selectedClip.config?.blur ?? 20}px</span>
                      </div>
                    )}
                    {(selectedClip.effect === 'shake') && (
                      <div className="ve-prop-row">
                        <span>Intensidade</span>
                        <input type="range" min="1" max="10" step="0.5"
                          value={selectedClip.config?.effectIntensity ?? 5}
                          onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, effectIntensity: Number(e.target.value) } } : c))}
                        />
                        <span>{selectedClip.config?.effectIntensity ?? 5}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'blur', name: 'Desfoque', icon: '◎' },
                    { id: 'rotate', name: 'Girar', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> },
                    { id: 'fadein', name: 'Fade In', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
                    { id: 'fadeout', name: 'Fade Out', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/></svg> },
                    { id: 'flipv', name: 'Flip Vertical', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="16 8 12 3 8 8"/><polyline points="8 16 12 21 16 16"/></svg> },
                    { id: 'fliph', name: 'Flip Horizontal', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="8 16 3 12 8 8"/><polyline points="16 8 21 12 16 16"/></svg> },
                  ].map(eff => (
                    <button key={eff.id} onClick={() => {
                      const duration = 3;
                      const track = getAvailableTrack(currentTime, duration, 'effect');
                      const newEffect: VideoClip = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: eff.name.toUpperCase(), path: '', url: '', duration,
                        startTime: currentTime, trimStart: 0, trimEnd: 0,
                        type: 'effect', volume: 0, track, effect: eff.id
                      };
                      setClips(prev => [...prev, newEffect]);
                      recalcDuration([...clips, newEffect]);
                      setSelectedClipId(newEffect.id);
                    }} style={{
                      background: '#050507', border: '1px solid #1a1a24',
                      padding: '12px', borderRadius: '8px', color: '#aaa',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '8px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c5cfc'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a24'; e.currentTarget.style.color = '#aaa'; }}
                    >
                      {eff.icon}
                      <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>{eff.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'transitions' && (
              <div className="ve-panel-inner">
                <div className="ve-panel-title" style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginBottom: '15px' }}>TRANSICOES</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'fade', name: 'Dissolver', icon: <Activity size={14} /> },
                    { id: 'trans_flash', name: 'Flash Branco', icon: <Sun size={14} /> },
                    { id: 'wipeleft', name: 'Varrer Esq', icon: <ArrowLeft size={14} /> },
                    { id: 'wiperight', name: 'Varrer Dir', icon: <ArrowRight size={14} /> },
                    { id: 'wipeup', name: 'Varrer Cima', icon: <ArrowUp size={14} /> },
                    { id: 'wipedown', name: 'Varrer Baixo', icon: <ArrowDown size={14} /> },
                    { id: 'trans_up', name: 'Slide Cima', icon: <ArrowUp size={14} /> },
                    { id: 'trans_down', name: 'Slide Baixo', icon: <ArrowDown size={14} /> },
                    { id: 'trans_left', name: 'Slide Esq', icon: <ArrowLeft size={14} /> },
                    { id: 'trans_right', name: 'Slide Dir', icon: <ArrowRight size={14} /> },
                  ].map(trans => (
                    <button key={trans.id} onClick={() => {
                      const duration = 1.5;
                      let startT = currentTime - duration / 2;
                      let bestDiff = 5.0; // 5 segundos de tolerância magnética na agulha
                      let snappedCenter = currentTime;
                      let snappedTrack = 1;
                      clips.filter(c => c.type === 'video').forEach(c => {
                         if (Math.abs(c.startTime - currentTime) < bestDiff) { bestDiff = Math.abs(c.startTime - currentTime); snappedCenter = c.startTime; snappedTrack = c.track; }
                         if (Math.abs(c.startTime + getEffectiveDur(c) - currentTime) < bestDiff) { bestDiff = Math.abs(c.startTime + getEffectiveDur(c) - currentTime); snappedCenter = c.startTime + getEffectiveDur(c); snappedTrack = c.track; }
                      });
                      if (bestDiff < 5.0) startT = snappedCenter - duration / 2;
                      startT = Math.max(0, startT);
                      
                      const track = snappedTrack;
                      const newTrans: VideoClip = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: trans.name.toUpperCase(), path: '', url: '', duration,
                        startTime: startT, trimStart: 0, trimEnd: 0,
                        type: 'transition', volume: 0, track, effect: trans.id
                      };
                      setClips(prev => [...prev, newTrans]);
                      recalcDuration([...clips, newTrans]);
                      setSelectedClipId(newTrans.id);
                    }} style={{
                      background: '#050507', border: '1px solid #1a1a24',
                      padding: '12px', borderRadius: '8px', color: '#aaa',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '8px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#9b59b6'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a24'; e.currentTarget.style.color = '#aaa'; }}
                    >
                      {trans.icon}
                      <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>{trans.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'filters' && (
              <div className="ve-panel-inner">
                <div className="ve-panel-title" style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginBottom: '15px' }}>FILTROS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'sepia_pro', name: 'Sépia', icon: <Camera size={14} /> },
                    { id: 'bw_classic', name: 'P&B', icon: <Film size={14} /> },
                    { id: 'dramatic', name: 'Dramático', icon: <Zap size={14} /> },
                    { id: 'pastel', name: 'Pastel', icon: <Palette size={14} /> },
                  ].map(filt => (
                    <button key={filt.id} onClick={() => {
                      const duration = 3;
                      const track = getAvailableTrack(currentTime, duration, 'effect');
                      const newFilter: VideoClip = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: filt.name.toUpperCase(), path: '', url: '', duration,
                        startTime: currentTime, trimStart: 0, trimEnd: 0,
                        type: 'effect', volume: 0, track, effect: filt.id
                      };
                      setClips(prev => [...prev, newFilter]);
                      recalcDuration([...clips, newFilter]);
                      setSelectedClipId(newFilter.id);
                    }} style={{
                      background: '#050507', border: '1px solid #1a1a24',
                      padding: '12px', borderRadius: '8px', color: '#aaa',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '8px', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c5cfc'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a24'; e.currentTarget.style.color = '#aaa'; }}
                    >
                      {filt.icon}
                      <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>{filt.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'text' && (
              <div className="ve-panel-inner">
                {selectedClip && selectedClip.type === 'text' ? (<div className="ve-text-editor">
                    <textarea value={selectedClip.textConfig?.content} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, content: e.target.value } } : c))} className="ve-text-textarea" style={{ width: '100%', height: '60px', background: '#000', color: '#fff', border: '1px solid #222', borderRadius: '6px', fontSize: '11px', padding: '8px' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <div><label style={{ fontSize: '7px' }}>TAMANHO</label><input type="number" value={selectedClip.textConfig?.fontSize} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontSize: Number(e.target.value) } } : c))} style={{ width: '100%', background: '#050507', border: '1px solid #1a1a24', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '10px' }} /></div>
                      <div><label style={{ fontSize: '7px' }}>COR</label><input type="color" value={selectedClip.textConfig?.color} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, color: e.target.value } } : c))} style={{ width: '100%', height: '28px', background: '#000', border: 'none', cursor: 'pointer' }} /></div>
                    </div>

                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '7px' }}>FONTE</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <select value={selectedClip.textConfig?.fontFamily} onChange={e => {
                          const newFont = e.target.value;
                          const noItalic = ['Impact', 'Comic Sans MS', 'Tahoma'].includes(newFont);
                          setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontFamily: newFont, fontStyle: noItalic ? 'normal' : c.textConfig.fontStyle } } : c))
                        }} style={{ flex: 1, background: '#050507', border: '1px solid #1a1a24', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '10px' }}>
                          {fontFamilies.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                        </select>
                        <input type="text" placeholder="Nome da fonte..." onChange={e => {
                          const newFont = e.target.value;
                          const noItalic = ['Impact', 'Comic Sans MS', 'Tahoma'].includes(newFont);
                          setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontFamily: newFont, fontStyle: noItalic ? 'normal' : c.textConfig.fontStyle } } : c))
                        }} style={{ width: '80px', background: '#050507', border: '1px solid #1a1a24', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '9px' }} />
                      </div>
                    </div>

                    {(() => {
                      const noItalicFonts = ['Impact', 'Comic Sans MS', 'Tahoma'];
                      const isNoItalic = noItalicFonts.includes(selectedClip.textConfig?.fontFamily || '');
                      return (
                        <>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button onClick={() => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontWeight: c.textConfig.fontWeight === 'bold' ? 'normal' : 'bold' } } : c))} style={{ flex: 1, padding: '8px', background: selectedClip.textConfig?.fontWeight === 'bold' ? '#7c5cfc' : '#050507', border: '1px solid #1a1a24', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: 800 }}>B</button>
                            <button disabled={isNoItalic} onClick={() => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, fontStyle: c.textConfig.fontStyle === 'italic' ? 'normal' : 'italic' } } : c))} style={{ flex: 1, padding: '8px', background: isNoItalic ? '#111' : (selectedClip.textConfig?.fontStyle === 'italic' ? '#7c5cfc' : '#050507'), border: '1px solid #1a1a24', borderRadius: '4px', color: isNoItalic ? '#444' : '#fff', fontSize: '10px', fontStyle: 'italic', cursor: isNoItalic ? 'not-allowed' : 'pointer', opacity: isNoItalic ? 0.5 : 1 }}>I</button>
                          </div>

                          <div style={{ marginTop: '15px', borderTop: '1px solid #1a1a24', paddingTop: '10px' }}>
                            <label style={{ fontSize: '7px', fontWeight: 900 }}>CONTORNO</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                              <div>
                                <label style={{ fontSize: '6px' }}>ESPESSURA</label>
                                <input type="range" min="0" max="10" step="0.5" value={selectedClip.textConfig?.strokeWidth || 0} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, strokeWidth: Number(e.target.value) } } : c))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '6px' }}>COR</label>
                                <input type="color" value={selectedClip.textConfig?.strokeColor || '#000000'} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id && c.textConfig ? { ...c, textConfig: { ...c.textConfig, strokeColor: e.target.value } } : c))} style={{ width: '100%', height: '20px', background: 'transparent', border: 'none', cursor: 'pointer' }} />
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <button className="ve-close-editor" onClick={() => setSelectedClipId(null)} style={{ width: '100%', marginTop: '15px', padding: '10px', background: '#222', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>CONCLUIR</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      onClick={addText}
                      style={{ 
                        width: '100%', padding: '12px', background: 'rgba(124, 92, 252, 0.08)', border: '1px solid rgba(124, 92, 252, 0.2)', 
                        borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 92, 252, 0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.08)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <Sparkles size={16} /> <span>ADICIONAR TEXTO</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'export' && (
              <div className="ve-panel-inner">
                <div style={{ marginBottom: '20px', borderBottom: '1px solid #1a1a24', paddingBottom: '15px' }}>
                  <label style={{ fontSize: '8px', fontWeight: 900, color: '#555', display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>NOME DO VÍDEO (ARQUIVO)</label>
                  <input 
                    type="text" 
                    value={projectTitle} 
                    onChange={e => setProjectTitle(e.target.value)} 
                    placeholder="Nome do seu Vídeo..."
                    style={{ 
                      width: '100%', background: '#000', border: '1px solid #1a1a24', color: '#fff', 
                      padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      outline: 'none', transition: 'border-color 0.3s'
                    }}
                  />
                </div>
                <div className="ve-prop-section">
                  <label>Configurações de Exportação</label>
                  <div className="ve-prop-row">
                    <span>Formato</span>
                    <select value={exportSettings.format} onChange={e => setExportSettings({ ...exportSettings, format: e.target.value })} style={{ background: '#050507', color: '#fff', border: '1px solid #1a1a24', fontSize: '10px', padding: '4px' }}>
                      <option value="mp4">MP4 (H.264)</option>
                      <option value="mkv">MKV</option>
                      <option value="mov">MOV</option>
                      <option value="webm">WebM</option>
                    </select>
                  </div>
                  <div className="ve-prop-row">
                    <span>Resoluçãoo</span>
                    <select value={exportSettings.resolution} onChange={e => setExportSettings({ ...exportSettings, resolution: e.target.value })} style={{ background: '#050507', color: '#fff', border: '1px solid #1a1a24', fontSize: '10px', padding: '4px' }}>
                      <option value="original">Igual ao Clipe (Original)</option>
                      <option value="1920x1080">1080p Full HD</option>
                      <option value="1280x720">720p HD</option>
                      <option value="3840x2160">4K Ultra HD</option>
                      <option value="1080x1920">Vertical (TikTok/Reels)</option>
                    </select>
                  </div>
                  <div className="ve-prop-row">
                    <span>FPS</span>
                    <select value={exportSettings.fps} onChange={e => setExportSettings({ ...exportSettings, fps: Number(e.target.value) })} style={{ background: '#050507', color: '#fff', border: '1px solid #1a1a24', fontSize: '10px', padding: '4px' }}>
                      <option value={24}>24 fps</option>
                      <option value={30}>30 fps</option>
                      <option value={60}>60 fps</option>
                    </select>
                  </div>
                  <div className="ve-prop-row">
                    <span>Qualidade</span>
                    <select value={exportSettings.quality} onChange={e => setExportSettings({ ...exportSettings, quality: e.target.value })} style={{ background: '#050507', color: '#fff', border: '1px solid #1a1a24', fontSize: '10px', padding: '4px' }}>
                      <option value="low">Baixa (Fast)</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta (Pro)</option>
                    </select>
                  </div>
                </div>

                <div className="ve-prop-section">
                  <label>Destino</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="text" value={exportSettings.outputPath} onChange={e => setExportSettings({ ...exportSettings, outputPath: e.target.value })} style={{ flex: 1, background: '#050507', border: '1px solid #1a1a24', color: '#888', padding: '6px', borderRadius: '4px', fontSize: '8px' }} />
                    <button onClick={async () => {
                      const result = await (window as any).electronAPI.selectFolder();
                      if (result.success) setExportSettings({ ...exportSettings, outputPath: result.path });
                    }} style={{ background: '#1a1a24', border: 'none', color: '#fff', borderRadius: '4px', padding: '0 8px' }}><Upload size={12} /></button>
                  </div>
                </div>

                {isExporting ? (
                  <div className="ve-export-progress" style={{ marginTop: '20px' }}>
                    <div style={{ fontSize: '8px', marginBottom: '5px', color: 'var(--primary)' }}>Exportando... {exportProgress}%</div>
                    <div style={{ height: '4px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${exportProgress}%`, background: 'var(--primary)', boxShadow: '0 0 10px var(--primary-glow)', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                ) : (
                  <button className="ve-tool-btn" onClick={handleStartExport} style={{ marginTop: '20px' }}>
                    <Zap size={16} /> <span>Renderizar Vídeo</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="ve-preview-area">
          <div className="ve-preview-screen"
            ref={previewScreenRef}
            onWheel={e => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setPreviewZoom(z => Math.max(0.2, Math.min(5, z * delta)));
            }}
            onMouseDown={e => {
              if (e.ctrlKey) {
                previewPanningRef.current = true;
                previewPanStartRef.current = { x: e.clientX, y: e.clientY, px: previewPan.x, py: previewPan.y };
                e.preventDefault();
                e.stopPropagation();

                const onMove = (ev: MouseEvent) => {
                  if (!previewPanningRef.current) return;
                  setPreviewPan({
                    x: previewPanStartRef.current.px + (ev.clientX - previewPanStartRef.current.x),
                    y: previewPanStartRef.current.py + (ev.clientY - previewPanStartRef.current.y),
                  });
                };
                const onUp = () => {
                  previewPanningRef.current = false;
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }
            }}
            style={{ cursor: previewPanningRef.current ? 'grabbing' : undefined }}
          >
            {/* Audio clips are now rendered as multiple elements for sync support */}
            {clips.filter(c => c.type === 'audio')
              .map(clip => (
                <audio 
                  key={clip.id} 
                  ref={el => {
                    mediaRefs.current[clip.id] = el;
                    if (el) connectSingleAudioNode(clip, el);
                  }}
                  src={clip.url}
                  preload="auto"
                />
              ))
            }
            {(() => {
              const isOriginal = previewQuality === 'Original';
              const calculatedBlockSize = isOriginal ? 1 : (
                previewQuality === '144p' 
                  ? Math.max(4, Math.round(previewHeight / 90)) 
                  : Math.max(2, Math.round(previewHeight / 180))
              );
              const virtualHeight = previewHeight; // Mantém legendas 100% fiéis ao original em tamanho e posição
              
              const bufferStyle: React.CSSProperties = {
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
              };

              return (
                <div className={`ve-canvas ${calculatedBlockSize > 1 ? 'low-res' : ''}`} ref={canvasRef} style={{
                  aspectRatio: videoAspectRatio,
                  width: videoAspectRatio > (previewScreenSize.w / previewScreenSize.h) ? '100%' : 'auto',
                  height: videoAspectRatio > (previewScreenSize.w / previewScreenSize.h) ? 'auto' : '100%',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  position: 'relative',
                  transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                  transformOrigin: 'center center',
                  transition: previewPanningRef.current ? 'none' : 'transform 0.05s',
                  filter: calculatedBlockSize > 1 ? 'url(#dynamic-pixelate)' : 'none'
                }}>
                  <div className="ve-canvas-render-buffer" style={bufferStyle}>
                     {clips.filter(c => c.type === 'video' || c.type === 'image')
                      .sort((a,b) => a.track - b.track)
                      .map(clip => {
                        let isActive = currentTime >= clip.startTime - 0.01 && currentTime <= clip.startTime + getEffectiveDur(clip) + 0.01;
                        
                        // Processar transições direcionais para clips entrando e saindo (Preview)
                        let transOffsetX = 0;
                        let transOffsetY = 0;
                        const activeTrans = clips.find(c => c.type === 'transition' && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c));
                        
                        if (activeTrans) {
                          const isEntering = (clip.startTime >= activeTrans.startTime - 1.0 && clip.startTime <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
                          const cEnd = clip.startTime + getEffectiveDur(clip);
                          const isLeaving = (cEnd >= activeTrans.startTime - 1.0 && cEnd <= activeTrans.startTime + getEffectiveDur(activeTrans) + 1.0);
                          const p = Math.max(0, Math.min(1, (currentTime - activeTrans.startTime) / getEffectiveDur(activeTrans)));

                          if (isEntering) {
                            isActive = true; // Força a visibilidade mesmo se currentTime < clip.startTime
                            if (activeTrans.effect === 'trans_up') transOffsetY = (1-p)*100;
                            if (activeTrans.effect === 'trans_down') transOffsetY = -(1-p)*100;
                            if (activeTrans.effect === 'trans_left') transOffsetX = (1-p)*100;
                            if (activeTrans.effect === 'trans_right') transOffsetX = -(1-p)*100;
                          } else if (isLeaving) {
                            isActive = true; // Força a visibilidade mesmo se currentTime > cEnd
                            if (activeTrans.effect === 'trans_up') transOffsetY = -p*100;
                            if (activeTrans.effect === 'trans_down') transOffsetY = p*100;
                            if (activeTrans.effect === 'trans_left') transOffsetX = -p*100;
                            if (activeTrans.effect === 'trans_right') transOffsetX = p*100;
                          }
                        }

                        return (
                          <div 
                            key={clip.id} 
                            ref={el => previewRefs.current[clip.id] = el}
                            style={{ 
                              position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%',
                              transform: `translate(calc(-50% + ${transOffsetX}%), calc(-50% + ${transOffsetY}%)) scale(${(clip.config?.scale || 100) / 100})`,
                              // CRÁTICO: visibility+opacity ao invés de display:none.
                              // display:none suspende o decodificador de Vídeo da GPU, causando stutter na troca de clipes.
                              // Com visibility:hidden o decoder permanece ativo e o play é instantâneo.
                              opacity: isActive ? (clip.config?.opacity || 100) / 100 : 0,
                              visibility: isActive ? 'visible' : 'hidden',
                              filter: `brightness(${clip.config?.brightness || 100}%) contrast(${clip.config?.contrast || 100}%) saturate(${clip.config?.saturation || 100}%)`,
                              zIndex: isActive ? clip.track : -1,
                              pointerEvents: isActive ? 'auto' : 'none'
                            }}
                          >
                            <div className="ve-preview-inner" style={{ width: '100%', height: '100%', position: 'relative' }}>
                               {/* Elemento de Vídeo Fonte (Sempre presente para Áudio e Chroma) */}
                              {clip.type === 'video' && (
                                <video 
                                  ref={el => {
                                    mediaRefs.current[clip.id] = el;
                                    if (el) connectSingleAudioNode(clip, el);
                                  }}
                                  src={clip.url} 
                                  className={`ve-video-el ${clip.effect ? `effect-${clip.effect.toLowerCase().replace(/\s+/g, '')}` : ''}`}
                                  style={{ 
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    display: clip.config?.chromaKey ? 'none' : 'block',
                                    pointerEvents: 'auto', cursor: 'move'
                                  }}
                                  playsInline
                                  preload="auto"
                                  onMouseDown={(e) => { if (e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); setSelectedClipId(clip.id); setDraggingVideoId(clip.id);
                                    const ratio = 360 / Math.max(1, previewHeight);
                                    setVideoDragOffset({
                                      x: e.clientX - ((clip.config?.x || 0) / ratio),
                                      y: e.clientY - ((clip.config?.y || 0) / ratio)
                                    });
                                  }}
                                  onLoadedMetadata={(e) => {
                                    const v = e.currentTarget;
                                    if (v.videoWidth && v.videoHeight && clip.track === 1) {
                                      if (exportSettings.resolution !== '1080x1920') {
                                        setVideoAspectRatio(v.videoWidth / v.videoHeight);
                                      }
                                    }
                                  }}
                                />
                              )}

                              {/* WebGL Preview — efeitos via shader GPU, preview = export */}
                              {clip.type === 'video' && (() => {
                                const activeEff = clips.find(c => c.type === 'effect' && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c));
                                if (!activeEff) return null;
                                return (
                                  <WebGLPreview
                                    key={clip.id + '-webgl'}
                                    videoRef={mediaRefs.current[clip.id] as HTMLVideoElement}
                                    effectId={activeEff.effect || null}
                                    effectIntensity={activeEff.config?.effectIntensity ?? 5}
                                    width={previewHeight * (videoAspectRatio || 1.77)}
                                    height={previewHeight}
                                    isPlaying={isPlaying}
                                  />
                                );
                              })()}

                              {/* Camada de Chroma Key (Se ativo) */}
                              {clip.config?.chromaKey && (
                                <ChromaCanvas
                                  clipId={clip.id}
                                  mediaRefs={mediaRefs}
                                  config={clip.config}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'auto', cursor: 'move' }}
                                  className={`ve-video-el ${clip.effect ? `effect-${clip.effect.toLowerCase().replace(/\s+/g, '')}` : ''}`}
                                  onMouseDown={(e: any) => {
                                    if (e.ctrlKey) return;
                                    e.preventDefault(); e.stopPropagation();
                                    setSelectedClipId(clip.id);
                                    setDraggingVideoId(clip.id);
                                    const ratio = 360 / Math.max(1, previewHeight);
                                    setVideoDragOffset({
                                      x: e.clientX - ((clip.config?.x || 0) / ratio),
                                      y: e.clientY - ((clip.config?.y || 0) / ratio)
                                    });
                                  }}
                                />
                              )}

                              {clip.type === 'image' && (
                                <img 
                                  ref={el => {
                                    mediaRefs.current[clip.id] = el;
                                  }}
                                  src={clip.url} 
                                  className={`ve-video-el ${clip.effect ? `effect-${clip.effect.toLowerCase().replace(/\s+/g, '')}` : ''}`} 
                                  style={{ 
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    display: clip.config?.chromaKey ? 'none' : 'block',
                                    pointerEvents: 'auto', cursor: 'move'
                                  }}
                                  onMouseDown={(e) => { if (e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); setSelectedClipId(clip.id); setDraggingVideoId(clip.id);
                                    const ratio = 360 / Math.max(1, previewHeight);
                                    setVideoDragOffset({
                                      x: e.clientX - ((clip.config?.x || 0) / ratio),
                                      y: e.clientY - ((clip.config?.y || 0) / ratio)
                                    });
                                  }}
                                  onLoad={(e) => {
                                    const img = e.currentTarget;
                                    if (img.naturalWidth && img.naturalHeight && clip.track === 1) {
                                      if (exportSettings.resolution !== '1080x1920') {
                                        setVideoAspectRatio(img.naturalWidth / img.naturalHeight);
                                      }
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </div>
                      );
                      })
                    }
                    {!clips.some(c => c.type === 'video' && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c)) && (
                      <div style={{ color: 'transparent' }} />
                    )}
                    {snapGuide.x && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,51,102,0.7)', zIndex: 9999, pointerEvents: 'none' }} />}
                    {snapGuide.y && <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: 'rgba(255,51,102,0.7)', zIndex: 9999, pointerEvents: 'none' }} />}
                    {(() => {
                      const activeTrans = clips.find(c => c.type === 'transition' && c.effect === 'trans_flash' && currentTime >= c.startTime && currentTime <= c.startTime + getEffectiveDur(c));
                      if (activeTrans) {
                        const p = Math.max(0, Math.min(1, (currentTime - activeTrans.startTime) / getEffectiveDur(activeTrans)));
                        const opacity = p < 0.5 ? p * 2 : (1 - p) * 2;
                        return <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', opacity, pointerEvents: 'none', zIndex: 9998 }} />;
                      }
                      return null;
                    })()}

                    {clips.filter(c => c.type === 'text').map(clip => {
                      const active = currentTime >= clip.startTime && currentTime <= clip.startTime + getEffectiveDur(clip);
                      if (!active) return null;
                      
                      // Calcula dimensões virtuais do preview
                      const localVirtualHeight = virtualHeight;
                      const localVirtualWidth = virtualHeight * (videoAspectRatio || 1.77);
                      
                      // Se o clip tem trackId, calcula posição baseada no track
                      let trackPosition: { x: number; y: number; width: number; height: number } | null = null;
                      if (clip.config?.trackId) {
                        const track = trackingData.find(t => t.id === clip.config!.trackId);
                        if (track && track.tracking_data && track.tracking_data.length > 0) {
                          try {
                            // Calcula o tempo relativo dentro do clip
                            const relativeTime = currentTime - clip.startTime;
                            const frameIndex = Math.max(0, Math.floor(relativeTime * track.fps));
                            const trackFrame = track.tracking_data[Math.min(frameIndex, track.tracking_data.length - 1)];
                            
                            console.log('[Track Debug]', {
                              clipId: clip.id,
                              trackId: clip.config.trackId,
                              clipStartTime: clip.startTime,
                              clipDuration: clip.duration,
                              clipEffectiveDur: getEffectiveDur(clip),
                              currentTime,
                              relativeTime,
                              trackFps: track.fps,
                              frameIndex,
                              totalFrames: track.tracking_data.length,
                              calculatedDuration: track.tracking_data.length / track.fps,
                              trackFrame,
                              trackFrameX: trackFrame.x,
                              trackFrameY: trackFrame.y,
                              trackFrameTracked: trackFrame.tracked,
                              virtualWidth: localVirtualWidth,
                              virtualHeight: localVirtualHeight
                            });
                            
                            if (trackFrame && localVirtualWidth > 0 && localVirtualHeight > 0) {
                              // Detecta dimensões reais do vídeo da primeira clip de vídeo
                              const videoClip = clips.find(c => c.type === 'video');
                              let videoWidth = 1280;
                              let videoHeight = 720;
                              
                              // Tenta pegar as dimensões reais do vídeo
                              if (videoClip && mediaRefs.current[videoClip.id]) {
                                const videoEl = mediaRefs.current[videoClip.id] as HTMLVideoElement;
                                if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                                  videoWidth = videoEl.videoWidth;
                                  videoHeight = videoEl.videoHeight;
                                }
                              }
                              
                              const scaleX = localVirtualWidth / videoWidth;
                              const scaleY = localVirtualHeight / videoHeight;
                              
                              // Adiciona offset manual se existir
                              const offsetX = clip.textConfig?.trackOffsetX || 0;
                              const offsetY = clip.textConfig?.trackOffsetY || 0;
                              
                              trackPosition = {
                                x: trackFrame.x * scaleX + (trackFrame.width * scaleX / 2) + offsetX,
                                y: trackFrame.y * scaleY + (trackFrame.height * scaleY / 2) + offsetY,
                                width: trackFrame.width * scaleX,
                                height: trackFrame.height * scaleY
                              };
                              
                              console.log('[Track Position Calculated]', {
                                trackPosition,
                                videoWidth,
                                videoHeight,
                                scaleX,
                                scaleY,
                                offsetX,
                                offsetY,
                                trackFrameOriginal: { x: trackFrame.x, y: trackFrame.y, w: trackFrame.width, h: trackFrame.height }
                              });
                            }
                          } catch (err) {
                            console.error('[Track Position] Erro ao calcular:', err);
                          }
                        } else {
                          console.log('[Track Debug] Track not found or no data:', {
                            hasTrack: !!track,
                            hasData: track?.tracking_data?.length
                          });
                        }
                      }
                      
                      // Define posição: usa track se disponível, senão usa textConfig
                      const posX = trackPosition ? `${trackPosition.x}px` : clip.textConfig?.x;
                      const posY = trackPosition ? `${trackPosition.y}px` : clip.textConfig?.y;
                      
                      console.log('[Text Render]', { clipId: clip.id, posX, posY, hasTrack: !!trackPosition });
                      
                      return (
                        <div key={clip.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            setDraggingTextId(clip.id);
                            // Inicializa dragOffset com a posição atual do mouse relativa ao container
                            const container = document.querySelector('.ve-preview-screen');
                            if (container) {
                              const cRect = container.getBoundingClientRect();
                              setDragOffset({ x: e.clientX - cRect.left, y: e.clientY - cRect.top, track: 0 });
                            }
                          }}
                          style={{
                            position: 'absolute', 
                            top: posY, 
                            left: posX, 
                            transform: 'translate(-50%, -50%)',
                            color: clip.textConfig?.color, 
                            fontSize: ((clip.textConfig?.fontSize || 32) * (localVirtualHeight / 360)) + 'px', 
                            fontFamily: clip.textConfig?.fontFamily,
                            fontWeight: clip.textConfig?.fontWeight, 
                            fontStyle: clip.textConfig?.fontStyle,
                            textShadow: clip.textConfig?.strokeWidth ? 
                              `-${clip.textConfig.strokeWidth}px -${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor}, 
                               ${clip.textConfig.strokeWidth}px -${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor}, 
                               -${clip.textConfig.strokeWidth}px ${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor}, 
                               ${clip.textConfig.strokeWidth}px ${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor},
                               0px ${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor},
                               0px -${clip.textConfig.strokeWidth}px 0 ${clip.textConfig.strokeColor},
                               ${clip.textConfig.strokeWidth}px 0px 0 ${clip.textConfig.strokeColor},
                               -${clip.textConfig.strokeWidth}px 0px 0 ${clip.textConfig.strokeColor}` : 'none',
                            zIndex: 1000, cursor: 'move', userSelect: 'none',
                            border: selectedClipId === clip.id ? '2px dashed #7c5cfc' : 'none',
                            padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: clip.textConfig?.width ? ((clip.textConfig.width) * (localVirtualHeight / 360)) + 'px' : 'auto',
                            whiteSpace: clip.textConfig?.width ? 'normal' : 'nowrap',
                            wordBreak: 'break-word',
                            textAlign: 'center'
                          }}>
                          {clip.textConfig?.content}
                          {selectedClipId === clip.id && (
                            <>
                              {/* Ponto na lateral direita para redimensionamento de largura */}
                              <div
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setResizingTextWidthId(clip.id);
                                  const el = e.currentTarget.parentElement;
                                  const currentWidth = el ? el.getBoundingClientRect().width : 200;
                                  const ratio = 360 / Math.max(1, previewHeight);
                                  setInitialTextWidth(currentWidth * ratio);
                                  setDragOffset({ x: e.clientX, track: 0, y: 0 });
                                }}
                                style={{
                                  position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12,
                                  background: '#ff3366', cursor: 'ew-resize', borderRadius: '50%',
                                  border: '2px solid #fff', zIndex: 1002, pointerEvents: 'auto'
                                }}
                              />
                              {/* Ponto no canto inferior direito para tamanho da fonte */}
                              <div
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setResizingTextId(clip.id);
                                  setInitialFontSize(clip.textConfig?.fontSize || 32);
                                  setDragOffset({ x: e.clientX, track: 0, y: 0 });
                                }}
                                style={{
                                  position: 'absolute', right: -6, bottom: -6, width: 12, height: 12,
                                  background: '#7c5cfc', cursor: 'nwse-resize', borderRadius: '50%',
                                  border: '2px solid #fff', zIndex: 1002, pointerEvents: 'auto'
                                }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Blur Rastreado (blur_tracked) */}
                    {clips.filter(c => c.type === 'effect' && c.effect === 'blur_tracked').map(clip => {
                      const active = currentTime >= clip.startTime && currentTime <= clip.startTime + getEffectiveDur(clip);
                      if (!active) return null;
                      
                      // Calcula dimensões virtuais do preview
                      const localVirtualHeight = virtualHeight;
                      const localVirtualWidth = virtualHeight * (videoAspectRatio || 1.77);
                      
                      // Se o clip tem trackId, calcula posição baseada no track
                      let trackPosition: { x: number; y: number; width: number; height: number } | null = null;
                      if (clip.config?.trackId) {
                        const track = trackingData.find(t => t.id === clip.config!.trackId);
                        if (track && track.tracking_data && track.tracking_data.length > 0) {
                          try {
                            // Calcula o tempo relativo dentro do clip
                            const relativeTime = currentTime - clip.startTime;
                            const frameIndex = Math.max(0, Math.floor(relativeTime * track.fps));
                            const trackFrame = track.tracking_data[Math.min(frameIndex, track.tracking_data.length - 1)];
                            
                            if (trackFrame && localVirtualWidth > 0 && localVirtualHeight > 0) {
                              // Detecta dimensões do vídeo
                              const videoWidth = 1280;
                              const videoHeight = 720;
                              const scaleX = localVirtualWidth / videoWidth;
                              const scaleY = localVirtualHeight / videoHeight;
                              
                              trackPosition = {
                                x: trackFrame.x * scaleX,
                                y: trackFrame.y * scaleY,
                                width: trackFrame.width * scaleX,
                                height: trackFrame.height * scaleY
                              };
                            }
                          } catch (err) {
                            console.error('[Blur Track Position] Erro ao calcular:', err);
                          }
                        }
                      }
                      
                      if (!trackPosition) return null;
                      
                      const blurIntensity = clip.config?.blur || 20;
                      
                      return (
                        <div 
                          key={clip.id}
                          style={{
                            position: 'absolute',
                            left: `${trackPosition.x}px`,
                            top: `${trackPosition.y}px`,
                            width: `${trackPosition.width}px`,
                            height: `${trackPosition.height}px`,
                            backdropFilter: `blur(${blurIntensity}px)`,
                            WebkitBackdropFilter: `blur(${blurIntensity}px)`,
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            border: selectedClipId === clip.id ? '2px solid #7c5cfc' : 'none',
                            borderRadius: '4px',
                            zIndex: 999,
                            pointerEvents: 'auto',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="ve-player-controls">
            {/* Progress bar */}
            <div className="ve-progress-bar-wrap"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setCurrentTime(Math.max(0, Math.min(totalDuration, pct * totalDuration)));
              }}
            >
              <div className="ve-progress-bar-fill" ref={progressBarRef} style={{ width: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%' }} />
            </div>
            {/* Controls row */}
            <div className="ve-controls-row">
              <div className="ve-time-display">
                <span>{formatTime(currentTime)}</span> / {formatTime(totalDuration)}
              </div>
              <div className="ve-ctrl-group">
                <button className="ve-ctrl-sec-btn" onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}><SkipBack size={18} /></button>
                <button className="ve-ctrl-main-btn" onClick={handlePlay}>{isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}</button>
                <button className="ve-ctrl-sec-btn" onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}><SkipForward size={18} /></button>
              </div>
              <select
                className="ve-quality-badge"
                value={previewQuality}
                onChange={(e) => setPreviewQuality(e.target.value as any)}
              >
                <option value="144p">144p</option>
                <option value="480p">480p</option>
                <option value="Original">Original</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`ve-right-panel ${rightPanelOpen ? 'open' : 'closed'}`}>
          <div className="ve-panel-header">
            <div className="ve-segmented-tabs">
              <button className={`ve-tab-btn ${activeRightTab === 'video' ? 'active' : ''}`} onClick={() => setActiveRightTab('video')} title="VÁDEO"><Film size={16} /></button>
              <button className={`ve-tab-btn ${activeRightTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveRightTab('audio')} title="ÁUDIO"><Music size={16} /></button>
              <button className={`ve-tab-btn ${activeRightTab === 'narrator' ? 'active' : ''}`} onClick={() => setActiveRightTab('narrator')} title="NARRADOR"><Zap size={16} /></button>
              <button className={`ve-tab-btn ${activeRightTab === 'image-ai' ? 'active' : ''}`} onClick={() => setActiveRightTab('image-ai')} title="IMAGEM IA"><Image size={16} /></button>
              <button className={`ve-tab-btn ${activeRightTab === 'subtitle' ? 'active' : ''}`} onClick={() => setActiveRightTab('subtitle')} title="LEGENDA"><Type size={16} /></button>
              <button className={`ve-tab-btn ${activeRightTab === 'tracks' ? 'active' : ''}`} onClick={() => setActiveRightTab('tracks')} title="MOTION TRACKS"><Target size={16} /></button>
            </div>
          </div>
          <div className="ve-panel-content">
            {activeRightTab === 'narrator' ? (
              <div className="ve-prop-editor" style={{ padding: '20px' }}>
                <div className="ve-prop-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <div style={{ width: '3px', height: '15px', background: 'var(--primary)', borderRadius: '2px' }} />
                    <label style={{ margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>NARRAÇÃO PROFISSIONAL</label>
                  </div>
                  
                  <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <textarea 
                      className="ve-narrator-input"
                      placeholder="Digite o roteiro da NARRAÇÃO..."
                      value={narratorText}
                      onChange={e => setNarratorText(e.target.value)}
                      style={{ 
                        width: '100%', minHeight: '160px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', 
                        color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '12px', outline: 'none',
                        resize: 'none', transition: 'all 0.3s ease', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                        fontFamily: 'inherit', lineHeight: '1.5'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                    />
                    <div style={{ position: 'absolute', bottom: '10px', right: '15px', fontSize: '9px', color: '#444' }}>
                      {narratorText.length} caracteres
                    </div>
                  </div>

                  <div className="ve-prop-section" style={{ border: 'none', padding: 0 }}>
                    <label style={{ fontSize: '9px', opacity: 0.6, marginBottom: '8px', display: 'block' }}>ESCOLHER VOZ NEURAL</label>
                    <select 
                      value={narratorVoice}
                      onChange={(e) => setNarratorVoice(e.target.value)}
                      style={{ 
                        width: '100%',
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: '#0d0d12',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer',
                        marginBottom: '25px'
                      }}
                    >
                      <optgroup label="Piper (Offline)">
                        <option value="faber">Faber (masculina)</option>
                        <option value="cadu">Cadu (masculina)</option>
                        <option value="edresson">Edresson (masculina)</option>
                        <option value="jeff">Jeff (masculina)</option>
                      </optgroup>
                      <optgroup label="Edge-TTS (Microsoft - Online)">
                        <option value="pt-BR-AntonioNeural">Antonio (masculina)</option>
                        <option value="pt-BR-FranciscaNeural">Francisca (feminina)</option>
                        <option value="pt-BR-ThalitaMultilingualNeural">Thalita (feminina multilíngue)</option>
                      </optgroup>
                    </select>
                  </div>

                  <button 
                    className="ve-narrator-apply-btn"
                    disabled={isGeneratingTTS || !narratorText.trim()}
                    style={{ 
                      width: '100%', height: '50px', borderRadius: '12px', border: 'none',
                      background: isGeneratingTTS ? '#111' : 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                      color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      boxShadow: '0 10px 20px rgba(124, 92, 252, 0.2)', transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={e => !isGeneratingTTS && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => !isGeneratingTTS && (e.currentTarget.style.transform = 'translateY(0)')}
                    onClick={async () => {
                      try {
                        setIsGeneratingTTS(true);
                        onAddToTerminal(`🎙️ [IA] Iniciando NARRAÇÃO neural (${narratorVoice.toUpperCase()})...`);
                        const result = await (window as any).electronAPI.generateTTS({ text: narratorText, voice: narratorVoice });
                        
                        if (result && result.success) {
                          const newClip: VideoClip = {
                            id: Math.random().toString(36).substr(2, 9),
                            type: 'audio',
                            name: `NARRAÇÃO ${narratorVoice}`,
                            path: result.path,
                            url: `file://${result.path}`,
                            startTime: currentTime,
                            duration: result.duration || 5,
                            trimStart: 0,
                            trimEnd: 0,
                            track: 100,
                            config: { volume: 100, speed: 1 }
                          };
                          setClips(prev => {
                            const next = [...prev, newClip];
                            recalcDuration(next);
                            return next;
                          });
                          setNarratorText("");
                          onAddToTerminal(`✅ [IA] NARRAÇÃO concluída (${(result.duration || 0).toFixed(1)}s).`);
                        } else {
                          onAddToTerminal(`âŒ [IA] Falha na síntese: ${result?.error || 'Erro desconhecido'}`);
                        }
                      } catch (e: any) {
                        onAddToTerminal(`âš ï¸ [IA] Erro crítico: ${e.message}`);
                      } finally {
                        setIsGeneratingTTS(false);
                      }
                    }}
                  >
                    {isGeneratingTTS ? (
                      <>
                        <div className="ve-spinner" /> GERANDO ÁUDIO...
                      </>
                    ) : (
                      <>
                        <Mic size={16} /> GERAR E APLICAR NARRAÇÃO
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : activeRightTab === 'subtitle' ? (
              <div className="ve-prop-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0' }}>
                {/* Edição Global - Compacta */}
                <div style={{ 
                  padding: '15px 20px', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: 'rgba(124, 92, 252, 0.03)'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(124, 92, 252, 1)', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    ⚡ EDITAR TODAS
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: '#ffffff', marginBottom: '4px' }}>Cor</div>
                      <input 
                        type="color" 
                        value={clips.find(c => c.type === 'text' && c.name === 'LEGENDA')?.textConfig?.color || '#ffff00'}
                        onChange={e => {
                          const newColor = e.target.value;
                          setClips(prev => prev.map(c => 
                            c.type === 'text' && c.name === 'LEGENDA' 
                              ? { ...c, textConfig: { ...c.textConfig, color: newColor } }
                              : c
                          ));
                        }}
                        style={{ width: '100%', height: '32px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: '#ffffff', marginBottom: '4px' }}>Contorno</div>
                      <input 
                        type="color" 
                        value={clips.find(c => c.type === 'text' && c.name === 'LEGENDA')?.textConfig?.strokeColor || '#000000'}
                        onChange={e => {
                          const newColor = e.target.value;
                          setClips(prev => prev.map(c => 
                            c.type === 'text' && c.name === 'LEGENDA' 
                              ? { ...c, textConfig: { ...c.textConfig, strokeColor: newColor } }
                              : c
                          ));
                        }}
                        style={{ width: '100%', height: '32px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '9px', color: '#ffffff', marginBottom: '4px' }}>Fonte</div>
                    <select 
                      value={clips.find(c => c.type === 'text' && c.name === 'LEGENDA')?.textConfig?.fontFamily || 'Arial'}
                      onChange={e => {
                        const newFont = e.target.value;
                        setClips(prev => prev.map(c => 
                          c.type === 'text' && c.name === 'LEGENDA' 
                            ? { ...c, textConfig: { ...c.textConfig, fontFamily: newFont } }
                            : c
                        ));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#000000',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {fontFamilies.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: '#ffffff', marginBottom: '4px' }}>Tamanho</div>
                      <input 
                        type="range" 
                        min="10" 
                        max="60" 
                        value={clips.find(c => c.type === 'text' && c.name === 'LEGENDA')?.textConfig?.fontSize || 22}
                        onChange={e => {
                          const newSize = Number(e.target.value);
                          setClips(prev => prev.map(c => 
                            c.type === 'text' && c.name === 'LEGENDA' 
                              ? { ...c, textConfig: { ...c.textConfig, fontSize: newSize } }
                              : c
                          ));
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: '#ffffff', marginBottom: '4px' }}>Borda</div>
                      <input 
                        type="range" 
                        min="0" 
                        max="8" 
                        value={clips.find(c => c.type === 'text' && c.name === 'LEGENDA')?.textConfig?.strokeWidth || 2}
                        onChange={e => {
                          const newWidth = Number(e.target.value);
                          setClips(prev => prev.map(c => 
                            c.type === 'text' && c.name === 'LEGENDA' 
                              ? { ...c, textConfig: { ...c.textConfig, strokeWidth: newWidth } }
                              : c
                          ));
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Lista de legendas - SEM scroll interno, ocupa o resto */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#4ade80', marginBottom: '12px', letterSpacing: '0.5px' }}>
                    📝 LEGENDAS ({clips.filter(c => c.type === 'text' && c.name === 'LEGENDA').length})
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {clips
                      .filter(c => c.type === 'text' && c.name === 'LEGENDA')
                      .sort((a, b) => a.startTime - b.startTime)
                      .map((subtitle, idx) => (
                        <div 
                          key={subtitle.id}
                          onClick={() => setSelectedClipId(subtitle.id)}
                          style={{
                            background: selectedClipId === subtitle.id ? '#000000' : '#000000',
                            border: `1px solid ${selectedClipId === subtitle.id ? '#ffffff' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: '8px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%'
                          }}
                          onMouseEnter={e => {
                            if (selectedClipId !== subtitle.id) {
                              e.currentTarget.style.background = '#000000';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (selectedClipId !== subtitle.id) {
                              e.currentTarget.style.background = '#000000';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', color: '#ffffff', fontWeight: 700 }}>#{idx + 1}</span>
                            <span style={{ fontSize: '9px', color: '#ffffff' }}>
                              {subtitle.startTime.toFixed(1)}s - {(subtitle.startTime + subtitle.duration).toFixed(1)}s
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.5', marginBottom: '10px', wordBreak: 'break-word' }}>
                            {subtitle.textConfig?.content}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setClips(prev => prev.filter(c => c.id !== subtitle.id));
                            }}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              color: '#ef4444',
                              fontSize: '9px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                            }}
                          >
                            🗑️ EXCLUIR
                          </button>
                        </div>
                      ))
                    }
                    {clips.filter(c => c.type === 'text' && c.name === 'LEGENDA').length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px', 
                        color: '#444', 
                        fontSize: '11px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        border: '1px dashed rgba(255,255,255,0.1)'
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.3 }}>📝</div>
                        Nenhuma legenda criada ainda.<br/>
                        <span style={{ color: '#666', fontSize: '10px' }}>Use "Legenda Automática" para gerar.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeRightTab === 'image-ai' ? (
              <div className="ve-prop-editor" style={{ padding: '20px' }}>
                <div className="ve-prop-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <div style={{ width: '3px', height: '15px', background: 'var(--primary)', borderRadius: '2px' }} />
                    <label style={{ margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>GERAÇÃO DE IMAGEM IA</label>
                  </div>
                  
                  <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <textarea 
                      className="ve-narrator-input"
                      placeholder="Descreva a imagem que deseja gerar..."
                      value={imageAIPrompt}
                      onChange={e => setImageAIPrompt(e.target.value)}
                      style={{ 
                        width: '100%', minHeight: '160px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', 
                        color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '12px', outline: 'none',
                        resize: 'none', transition: 'all 0.3s ease', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                        fontFamily: 'inherit', lineHeight: '1.5'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                    />
                  </div>

                  <button 
                    disabled={isGeneratingImage || !imageAIPrompt.trim()}
                    style={{ 
                      width: '100%', padding: '12px', background: 'rgba(124, 92, 252, 0.08)', border: '1px solid rgba(124, 92, 252, 0.2)', 
                      borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: isGeneratingImage || !imageAIPrompt.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px', transition: 'all 0.2s',
                      opacity: isGeneratingImage || !imageAIPrompt.trim() ? 0.5 : 1
                    }}
                    onMouseEnter={e => { if (!isGeneratingImage && imageAIPrompt.trim()) { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(124, 92, 252, 0.2)'; } }}
                    onMouseLeave={e => { if (!isGeneratingImage && imageAIPrompt.trim()) { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.08)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.2)'; e.currentTarget.style.boxShadow = 'none'; } }}
                    onClick={async () => {
                      try {
                        setIsGeneratingImage(true);
                        onAddToTerminal(`ðŸŽ¨ [IA] Solicitando imagem via Pollinations API...`);
                        const result = await (window as any).electronAPI.generateImage({ prompt: imageAIPrompt });
                        
                        if (result && result.success) {
                          const newClip: VideoClip = {
                            id: Math.random().toString(36).substr(2, 9),
                            type: 'image',
                            name: `IA: ${imageAIPrompt.slice(0, 15)}...`,
                            path: result.path,
                            url: `file://${result.path.replace(/\\/g, '/')}`,
                            startTime: currentTime,
                            duration: 5,
                            trimStart: 0,
                            trimEnd: 0,
                            track: 2, // Assume image sits on top
                            config: { scale: 100, opacity: 100, brightness: 100, contrast: 100, saturation: 100, highlight: 100, shadow: 100, vignette: 0, volume: 100 }
                          };
                          setClips(prev => {
                            const next = [...prev, newClip];
                            recalcDuration(next);
                            return next;
                          });
                          setImageAIPrompt("");
                          onAddToTerminal(`✅ [IA] Imagem baixada e adicionada Á  timeline!`);
                        } else {
                          onAddToTerminal(`âŒ [IA] Falha na geraçãoo: ${result?.error || 'Erro desconhecido'}`);
                        }
                      } catch (e: any) {
                        onAddToTerminal(`âš ï¸ [IA] Erro crítico: ${e.message}`);
                      } finally {
                        setIsGeneratingImage(false);
                      }
                    }}
                  >
                    {isGeneratingImage ? (
                      <>
                        <div className="ve-spinner" /> GERANDO IMAGEM...
                      </>
                    ) : (
                      <>
                        <Image size={16} /> GERAR E APLICAR
                      </>
                    )}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '9px', color: '#555', marginTop: '8px' }}>
                    Gerado por Pollinations.ai
                  </div>
                </div>
              </div>
            ) : activeRightTab === 'tracks' ? (
              <div className="ve-prop-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                  <Target size={18} color="var(--primary)" />
                  <label style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>MOTION TRACKS</label>
                </div>

                {trackingData.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <Target size={48} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p style={{ fontSize: '12px', textAlign: 'center', margin: '0', color: '#999' }}>
                      Nenhum track criado ainda.<br/>
                      <span style={{ fontSize: '10px' }}>Clique em "MOTION TRACKER" na timeline.</span>
                    </p>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    {trackingData.map((track) => (
                      <div 
                        key={track.id}
                        style={{
                          background: 'rgba(124, 92, 252, 0.05)',
                          border: '1px solid rgba(124, 92, 252, 0.2)',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600 }}>{track.name}</span>
                          <button
                            onClick={() => {
                              setTrackingData(trackingData.filter(t => t.id !== track.id));
                              onAddToTerminal(`🗑️ Track "${track.name}" removido`);
                            }}
                            style={{
                              background: 'rgba(255, 0, 0, 0.1)',
                              border: '1px solid rgba(255, 0, 0, 0.3)',
                              color: '#ff6b6b',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        
                        <div style={{ fontSize: '10px', color: '#999', marginBottom: '8px' }}>
                          {track.tracking_data.length} frames • {track.fps} FPS
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              // Calcula tamanho inicial do blur baseado no tamanho do track
                              const firstFrame = track.tracking_data[0];
                              const trackWidth = firstFrame ? firstFrame.width : 100;
                              const trackHeight = firstFrame ? firstFrame.height : 50;
                              
                              // Calcula intensidade do blur proporcional ao tamanho do track
                              // Quanto maior o objeto, maior o blur
                              const calculatedBlur = Math.max(10, Math.min(50, Math.round((trackWidth + trackHeight) / 20)));
                              
                              const newEffect: VideoClip = {
                                id: Math.random().toString(36).substr(2, 9),
                                name: `Blur Track`,
                                path: '',
                                url: '',
                                type: 'effect',
                                effect: 'blur_tracked',
                                duration: track.tracking_data.length / track.fps,
                                startTime: currentTime,
                                trimStart: 0,
                                trimEnd: 0,
                                track: 3,
                                config: {
                                  blur: calculatedBlur,
                                  trackId: track.id,
                                  initialWidth: trackWidth,
                                  initialHeight: trackHeight
                                }
                              };
                              setClips([...clips, newEffect]);
                              onAddToTerminal(`✅ Efeito de blur adicionado ao track "${track.name}" (${calculatedBlur}px)`);
                            }}
                            style={{
                              background: 'rgba(124, 92, 252, 0.1)',
                              border: '1px solid rgba(124, 92, 252, 0.3)',
                              color: 'var(--primary)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            + Blur
                          </button>

                          <button
                            onClick={() => {
                              // Calcula tamanho do texto baseado no tamanho do track
                              const firstFrame = track.tracking_data[0];
                              const trackWidth = firstFrame ? firstFrame.width : 100;
                              const trackHeight = firstFrame ? firstFrame.height : 50;
                              
                              // Calcula fontSize proporcional Á altura do track
                              // Assumindo altura base de 50px = fontSize 32
                              const calculatedFontSize = Math.max(12, Math.round((trackHeight / 50) * 32));
                              
                              const newText: VideoClip = {
                                id: Math.random().toString(36).substr(2, 9),
                                name: `Texto Track`,
                                path: '',
                                url: '',
                                type: 'text',
                                duration: track.tracking_data.length / track.fps,
                                startTime: currentTime,
                                trimStart: 0,
                                trimEnd: 0,
                                track: 3,
                                textConfig: {
                                  content: 'TEXTO',
                                  fontSize: calculatedFontSize,
                                  color: '#ffffff',
                                  fontFamily: 'Arial',
                                  x: '50%',
                                  y: '50%',
                                  strokeColor: '#000000',
                                  strokeWidth: 2
                                },
                                config: {
                                  trackId: track.id
                                }
                              };
                              setClips([...clips, newText]);
                              onAddToTerminal(`✅ Texto adicionado ao track "${track.name}" (${calculatedFontSize}px)`);
                            }}
                            style={{
                              background: 'rgba(124, 92, 252, 0.1)',
                              border: '1px solid rgba(124, 92, 252, 0.3)',
                              color: 'var(--primary)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            + Texto
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio' || selectedClip.type === 'image') ? (
              <div className="ve-prop-editor">
                {activeRightTab === 'video' ? (
                  <>
                    <div className="ve-prop-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ margin: 0 }}>Transformaçãoo {selectedKeyframeTime !== null ? '(EDITANDO KEYFRAME)' : ''}</label>
                        <button 
                          onClick={addKeyframe} 
                          style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <PlusCircle size={10} /> KEYFRAME
                        </button>
                      </div>
                      <div className="ve-prop-row">
                        <span>Escala</span>
                        <input 
                          type="range" min="10" max="5000" 
                          value={selectedKeyframeTime !== null && selectedClip.keyframes ? (selectedClip.keyframes.find(k => k.time === selectedKeyframeTime)?.scale ?? selectedClip.config?.scale) : selectedClip.config?.scale} 
                          onChange={e => {
                            const val = Number(e.target.value);
                            if (selectedKeyframeTime !== null) {
                              setClips(prev => prev.map(c => c.id === selectedClip.id ? {
                                ...c,
                                keyframes: (c.keyframes || []).map(k => k.time === selectedKeyframeTime ? { ...k, scale: val } : k)
                              } : c));
                            } else {
                              setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, scale: val } } : c));
                            }
                          }} 
                        />
                      </div>
                      <div className="ve-prop-row">
                        <span>Opacidade</span>
                        <input 
                          type="range" min="0" max="100" 
                          value={selectedKeyframeTime !== null && selectedClip.keyframes ? (selectedClip.keyframes.find(k => k.time === selectedKeyframeTime)?.opacity ?? selectedClip.config?.opacity) : selectedClip.config?.opacity} 
                          onChange={e => {
                            const val = Number(e.target.value);
                            if (selectedKeyframeTime !== null) {
                              setClips(prev => prev.map(c => c.id === selectedClip.id ? {
                                ...c,
                                keyframes: (c.keyframes || []).map(k => k.time === selectedKeyframeTime ? { ...k, opacity: val } : k)
                              } : c));
                            } else {
                              setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, opacity: val } } : c));
                            }
                          }} 
                        />
                      </div>
                      
                      {selectedClip.keyframes && selectedClip.keyframes.length > 0 && (
                        <div style={{ marginTop: '10px', borderTop: '1px solid #1a1a24', paddingTop: '10px' }}>
                          <label style={{ fontSize: '7px', color: 'var(--primary)' }}>LISTA DE KEYFRAMES {selectedKeyframeTime !== null ? '(CLIQUE PARA DESELECIONAR)' : ''}</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                            {selectedClip.keyframes.map((kf, i) => (
                              <div 
                                key={i} 
                                onClick={() => setSelectedKeyframeTime(selectedKeyframeTime === kf.time ? null : kf.time)}
                                style={{ 
                                  background: selectedKeyframeTime === kf.time ? 'var(--primary)' : '#111', 
                                  padding: '3px 6px', borderRadius: '4px', fontSize: '7px', display: 'flex', alignItems: 'center', gap: '5px',
                                  cursor: 'pointer', border: selectedKeyframeTime === kf.time ? '1px solid #fff' : '1px solid transparent'
                                }}
                              >
                                <span style={{ color: selectedKeyframeTime === kf.time ? '#fff' : (i === 0 ? '#4ade80' : i === selectedClip.keyframes!.length - 1 ? '#ff4d4d' : '#fff') }}>
                                  {kf.time.toFixed(1)}s
                                </span>
                                <Trash2 size={8} style={{ cursor: 'pointer', color: selectedKeyframeTime === kf.time ? '#fff' : '#666' }} onClick={(e) => { e.stopPropagation(); removeKeyframe(kf.time); }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="ve-prop-section">
                      <label>Ajustes de Cor</label>
                      <div className="ve-prop-row"><span>Brilho</span><input type="range" min="0" max="200" value={selectedClip.config?.brightness} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, brightness: Number(e.target.value) } } : c))} /></div>
                      <div className="ve-prop-row"><span>Contraste</span><input type="range" min="0" max="200" value={selectedClip.config?.contrast} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, contrast: Number(e.target.value) } } : c))} /></div>
                      <div className="ve-prop-row"><span>Saturaçãoo</span><input type="range" min="0" max="200" value={selectedClip.config?.saturation} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, saturation: Number(e.target.value) } } : c))} /></div>
                      <div className="ve-prop-row"><span>Velocidade</span><input type="range" min="0.5" max="2" step="0.1" value={selectedClip.config?.speed || 1} onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, speed: Number(e.target.value) } } : c))} /> <span>{selectedClip.config?.speed || 1}x</span></div>
                    </div>
                    <div className="ve-prop-section">
                      <label>Efeitos Especiais</label>
                      <button 
                        className={`ve-timeline-btn ${selectedClip.config?.chromaKey ? 'active' : ''}`}
                        style={{ width: '100%', justifyContent: 'center', marginBottom: '10px', background: selectedClip.config?.chromaKey ? 'var(--primary)' : '#111' }}
                        onClick={() => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, chromaKey: !c.config?.chromaKey } } : c))}
                      >
                        <Zap size={14} /> {selectedClip.config?.chromaKey ? 'DESATIVAR CHROMA KEY' : 'ATIVAR CHROMA KEY'}
                      </button>

                      {selectedClip.config?.chromaKey && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                          <div className="ve-prop-row">
                            <span>Cor Alvo</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <input 
                                type="color" 
                                style={{ flex: 1, height: '24px', background: 'transparent', border: 'none' }}
                                value={selectedClip.config?.chromaColor || '#00ff00'} 
                                onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, chromaColor: e.target.value } } : c))} 
                              />
                              <button 
                                onClick={pickChromaColor}
                                title="Conta-gotas"
                                style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', width: '30px', cursor: 'pointer' }}
                              >
                                <Palette size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="ve-prop-row">
                            <span>Força</span>
                            <input 
                              type="range" min="0" max="100" 
                              value={selectedClip.config?.chromaSimilarity || 50} 
                              onChange={e => setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, config: { ...c.config!, chromaSimilarity: Number(e.target.value) } } : c))} 
                            />
                          </div>
                          <div className="ve-prop-row">
                            <span>Borda</span>
                            <input 
                              type="range" min="0" max="50" 
                              value={selectedClip.config?.chromaSmoothness || 10} 
                              onChange={e => setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, config: { ...(c.config || {}), chromaSmoothness: Number(e.target.value) } } : c))} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="ve-prop-section">
                    <label>Áudio / Vídeo</label>
                    {!selectedClip ? (
                      <div style={{ textAlign: 'center', color: '#333', fontSize: '9px', marginTop: '20px' }}>SELECIONE UM CLIPE</div>
                    ) : (
                      <>
                        <div className="ve-prop-row">
                          <span>Volume</span>
                          <input 
                            type="range" min="0" max="200" 
                            value={selectedClip?.config?.volume ?? 100} 
                            onChange={e => {
                              const val = Number(e.target.value);
                              setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, config: { ...(c.config || {}), volume: val } } : c));
                            }} 
                          />
                        </div>
                        <div className="ve-prop-row">
                          <span>Velocidade</span>
                          <input 
                            type="range" min="0.5" max="2" step="0.1" 
                            value={selectedClip?.config?.speed ?? 1} 
                            onChange={e => {
                              const val = Number(e.target.value);
                              setClips(prev => prev.map(c => c.id === selectedClipId ? { ...c, config: { ...(c.config || {}), speed: val } } : c));
                            }} 
                          /> 
                          <span>{selectedClip?.config?.speed ?? 1}x</span>
                        </div>
                        
                        {selectedClip?.config?.aiDenoised ? (
                          <div className="ve-prop-row" style={{ marginTop: '10px', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '9px', color: '#7c5cfc', fontWeight: 'bold' }}>❌¨ ÁUDIO COM IA</span>
                            <button 
                              className="ve-timeline-btn"
                              onClick={() => {
                                const original = selectedClip?.config?.originalPath;
                                if (original) {
                                  setClips(prev => prev.map(c => c.id === selectedClipId ? { 
                                    ...c, 
                                    path: original, 
                                    url: `file://${original}?t=${Date.now()}`,
                                    config: { ...(c.config || {}), aiDenoised: false }
                                  } : c));
                                  onAddToTerminal(`â™»ï¸ Áudio original restaurado.`);
                                }
                              }}
                              title="Remover reduçãoo de ruído"
                            >
                              <Trash2 size={12} color="#ff4d4d" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            className="ve-timeline-btn"
                            disabled={isIsolatingVoice}
                            onClick={async () => {
                              if (!selectedClip) return;
                              try {
                                setIsIsolatingVoice(true);
                                onAddToTerminal(`ðŸ§  IA: Isolando voz em "${selectedClip.name}"...`);
                                const result = await (window as any).electronAPI.isolateVoice(selectedClip.path);
                                
                                if (result && result.success) {
                                  onAddToTerminal(`✅ Sucesso! Áudio limpo.`);
                                  setClips(prev => prev.map(c => c.id === selectedClipId ? { 
                                    ...c, 
                                    path: result.path, 
                                    url: `file://${result.path}?t=${Date.now()}`,
                                    config: { ...(c.config || {}), aiDenoised: true, originalPath: c.path }
                                  } : c));
                                } else {
                                  onAddToTerminal(`âŒ Erro: ${result?.error || 'Falha'}`);
                                }
                              } catch (e: any) {
                                onAddToTerminal(`âš ï¸ Erro: ${e.message}`);
                              } finally {
                                setIsIsolatingVoice(false);
                              }
                            }}
                            style={{ marginTop: '10px', color: isIsolatingVoice ? '#666' : '#7c5cfc' }}
                          >
                            <Zap size={10} fill={isIsolatingVoice ? '#666' : '#7c5cfc'} />
                            {isIsolatingVoice ? 'ISOLANDO...' : 'ISOLAR VOZ (IA)'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#111', fontSize: '9px', marginTop: '60px', fontWeight: 900 }}>SELECIONE UM CLIPE</div>
            )}
          </div>
        </div>

      </div>

      <div className="ve-timeline-area">
        <div className="ve-timeline-tabs">
          <button className={`ve-timeline-tab ${activeTimelineTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTimelineTab('timeline')}>
            <Layers size={10} /> TIMELINE
          </button>
          <button className={`ve-timeline-tab ${activeTimelineTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTimelineTab('workflow')}>
            <GitMerge size={10} /> WORKFLOW
          </button>
        </div>
        
        {activeTimelineTab === 'timeline' ? (
          <>
            <div className="ve-timeline-toolbar">
          <button className="ve-timeline-btn" onClick={handleUndo} title="Desfazer (Ctrl+Z)"><Undo2 size={14} /></button>
          <button className="ve-timeline-btn" onClick={handleRedo} title="Refazer (Ctrl+Y)"><Redo2 size={14} /></button>
          <button className="ve-timeline-btn" onClick={handleSplitClip}><Scissors size={14} /> CORTAR</button>
          <button className="ve-timeline-btn" onClick={handleDeleteClip}><Trash2 size={14} /> EXCLUIR</button>
          
          <button className="ve-timeline-btn" onClick={addKeyframe}><PlusCircle size={14} /> KEYFRAME</button>
          
          <button 
            className="ve-timeline-btn" 
            onClick={() => setShowSubtitleModeModal(true)} 
            disabled={isTranscribing || isAutoCutting}
          >
            <Zap size={14} /> {isTranscribing ? 'LEGENDANDO...' : 'LEGENDA AUTO'}
          </button>

          <button 
            className="ve-timeline-btn" 
            onClick={handleAutoCut} 
            disabled={isTranscribing || isAutoCutting}
            title="Remove ruído de fundo e silêncio â€” detecta apenas voz humana (WebRTC VAD)"
          >
            <Scissors size={14} /> {isAutoCutting ? 'CORTANDO...' : 'CORTE AUTO'}
          </button>


          <button 
            className="ve-timeline-btn" 
            onClick={() => {
              console.log('[MOTION TRACKER] Botão clicado');
              const videoClip = clips.find(c => c.type === 'video');
              console.log('[MOTION TRACKER] Video clip:', videoClip);
              if (!videoClip) {
                alert('Adicione um vídeo primeiro');
                return;
              }
              console.log('[MOTION TRACKER] Abrindo modal');
              setShowMotionTracker(true);
            }}
            disabled={isTranscribing || isAutoCutting || !clips.find(c => c.type === 'video')}
            title="Rastreia movimento de objetos/pessoas no vídeo"
          >
            <Target size={14} /> MOTION TRACKER
          </button>
          <div className="ve-zoom-ctrl"><input type="range" min={10} max={200} value={zoom} onChange={e => setZoom(Number(e.target.value))} /><span>{zoom}px/s</span></div>
          <button 
            className="ve-timeline-btn" 
            onClick={() => {
              setIsTimelineExpanded(!isTimelineExpanded);
              if (!isTimelineExpanded) {
                setPanelOpen(false);
                setRightPanelOpen(false);
              }
            }}
            title={isTimelineExpanded ? "Recolher Timeline" : "Expandir Timeline"}
            style={{ marginLeft: '10px' }}
          >
            {isTimelineExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
        <div className="ve-timeline-scroll" ref={timelineRef}>
          <div className="ve-timeline-content" style={{ position: 'relative', width: Math.max(totalDuration * zoom + 1070, 2070), minHeight: '100%' }}>
            <div className="ve-playhead" style={{ left: currentTime * zoom + 70, pointerEvents: 'none', zIndex: 9999 }}>
              <div className="ve-playhead-handle" style={{ pointerEvents: 'auto', cursor: 'ew-resize' }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setIsScrubbing(true); isScrubbingRef.current = true; if (isPlaying) setIsPlaying(false); }} />
              <div className="ve-playhead-scissor-btn" style={{ pointerEvents: 'auto' }} onClick={(e) => { e.stopPropagation(); handleSplitClip(); }}>
                <Scissors size={10} />
              </div>
              <div className="ve-playhead-line" />
            </div>
            <div className="ve-ruler"
              style={{ width: 'calc(100% - 70px)', cursor: isScrubbing ? 'ew-resize' : 'default' }}
              onMouseDown={e => {
                e.preventDefault();
                const timelineRect = timelineRef.current?.getBoundingClientRect();
                if (!timelineRect) return;
                const scrollLeft = timelineRef.current?.scrollLeft || 0;
                const x = (e.clientX - timelineRect.left + scrollLeft - 70) / zoom;
                setCurrentTime(Math.max(0, Math.min(totalDuration, x)));
                setIsScrubbing(true); isScrubbingRef.current = true;
                if (isPlaying) setIsPlaying(false); // Pausa playback ao scrub
              }}
            >
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                <div key={i} className="ve-ruler-tick" style={{ left: i * zoom }}><span>{i}s</span></div>
              ))}
            </div>
            <div className="ve-tracks-container" style={{ width: '100%' }}>
              <div className="ve-track-labels-sticky">
                {Array.from(new Set([...clips.map(c => c.track), 1, 100])).sort((a, b) => {
                  if (a < 100 && b >= 100) return -1;
                  if (a >= 100 && b < 100) return 1;
                  if (a < 100) return b - a;
                  return a - b;
                }).map(trackIdx => {
                  const typeInTrack = clips.find(c => c.track === trackIdx)?.type;
                  let label = trackIdx < 100 ? `Vídeo ${trackIdx}` : `Áudio ${trackIdx - 99}`;
                  if (typeInTrack === 'effect') label = "Efeito";
                  else if (typeInTrack === 'transition') label = "Transiçãoo";
                  else if (typeInTrack === 'text') label = "Texto";
                  
                  return (
                    <div key={trackIdx} className="ve-track-label">
                      {label}
                    </div>
                  );
                })}
              </div>
              <div className="ve-tracks-scrollable"
                onMouseDown={e => {
                  e.preventDefault();
                  if (draggingClipId || potentialDragClipId || resizingClipId) return;
                  const timelineRect = timelineRef.current?.getBoundingClientRect();
                  if (!timelineRect) return;
                  const scrollLeft = timelineRef.current?.scrollLeft || 0;
                  const x = (e.clientX - timelineRect.left + scrollLeft - 70) / zoom;
                  setCurrentTime(Math.max(0, Math.min(totalDuration, x)));
                  setIsScrubbing(true); isScrubbingRef.current = true;
                  if (isPlaying) setIsPlaying(false); // Pausa playback ao scrub
                }}
              >
                {Array.from(new Set([...clips.map(c => c.track), 1, 100])).sort((a, b) => {
                  if (a < 100 && b >= 100) return -1;
                  if (a >= 100 && b < 100) return 1;
                  if (a < 100) return b - a;
                  return a - b;
                }).map(trackIdx => (
                  <div key={trackIdx} className="ve-track">
                    {clips.filter(c => c.track === trackIdx).map((clip) => {
                      const d = getEffectiveDur(clip);
                      return (
                        <div key={clip.id} className={`ve-clip ${clip.type} ${selectedClipId === clip.id ? 'selected' : ''}`}
                          style={{
                            left: clip.startTime * zoom,
                            width: d * zoom,
                            background: clip.type === 'effect' ? 'linear-gradient(90deg, #f39c12, #e67e22)' : 
                                       clip.type === 'transition' ? 'linear-gradient(90deg, #9b59b6, #8e44ad)' : 
                                       clip.type === 'audio' ? 'linear-gradient(90deg, #3498db, #2980b9)' : 
                                       clip.type === 'image' ? 'linear-gradient(90deg, #133a1e, #0c2012)' :
                                       (clip.track > 1 && clip.type === 'video') ? 'linear-gradient(90deg, #f39c12, #e67e22)' : undefined,
                            borderColor: clip.type === 'effect' ? '#d35400' : 
                                        clip.type === 'transition' ? '#71368a' : 
                                        clip.type === 'audio' ? '#2980b9' : 
                                        clip.type === 'image' ? '#2ecc71' :
                                        (clip.track > 1 && clip.type === 'video') ? '#d35400' : undefined,
                            zIndex: selectedClipId === clip.id ? 100 : 10
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation(); setSelectedClipId(clip.id);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const xInClip = e.clientX - rect.left;
                            if (xInClip < 12) { setResizingClipId(clip.id); setResizeSide('l'); }
                            else if (xInClip > rect.width - 12) { setResizingClipId(clip.id); setResizeSide('r'); }
                            else { setPotentialDragClipId(clip.id); const xOff = e.clientX - rect.left; dragOriginRef.current = { x: e.clientX, y: e.clientY, track: clip.track }; setDragOffset({ x: xOff, track: clip.track, y: e.clientY }); }
                          }}>
                          <div className="ve-resize-handle left" onMouseDown={e => { e.stopPropagation(); setResizingClipId(clip.id); setResizeSide('l'); }} />
                          {clip.type === 'audio' && clipPeaks[clip.id] && (
                            <svg 
                              viewBox={`0 0 ${getEffectiveDur(clip) * zoom} 60`} 
                              preserveAspectRatio="none"
                              style={{ 
                                position: 'absolute', 
                                top: 0, 
                                bottom: 0, 
                                left: 0, 
                                width: '100%', 
                                height: '100%', 
                                pointerEvents: 'none'
                              }}
                            >
                              {(() => {
                                const widthPx = getEffectiveDur(clip) * zoom;
                                const heightPx = 60; // Altura padrão do track em pixels
                                
                                // 1 barra a cada 6px de largura física
                                const targetCount = Math.max(10, Math.floor(widthPx / 6));
                                
                                // Slice de picos baseado no Trim atual do clipe
                                const trimmed = getTrimmedPeaks(clipPeaks[clip.id], clip.trimStart, clip.trimEnd, clip.duration);
                                const peaks = downsamplePeaks(trimmed, targetCount);
                                
                                const playheadProgress = (currentTime - clip.startTime) / getEffectiveDur(clip);
                                
                                const totalBarWidth = widthPx / targetCount;
                                const w = 3.0; // Largura exata da listra vertical em pixels
                                
                                return peaks.map((peak, idx) => {
                                  const barProgress = idx / targetCount;
                                  
                                  let scaleY = 1.0;
                                  let fillColor = 'rgba(255, 255, 255, 0.4)';
                                  
                                  const isActiveClip = currentTime >= clip.startTime && currentTime <= clip.startTime + getEffectiveDur(clip);
                                  if (isActiveClip) {
                                    const playheadIdx = playheadProgress * targetCount;
                                    const indexDist = Math.abs(idx - playheadIdx);
                                    
                                    // Limit growth and highlight to exactly 6 lines (3 on each side of the playhead)
                                    if (indexDist <= 3) {
                                      const norm = indexDist / 3;
                                      const influence = Math.cos((norm * Math.PI) / 2); // 1 no centro, 0 nas bordas
                                      scaleY = 1.0 + influence * 0.8; // Crescimento dinâmico de até 1.8x
                                      fillColor = '#ffffff'; // Destaque branco brilhante
                                    }
                                  }
                                  
                                  const finalHeight = Math.min(heightPx - 4, Math.max(4, peak * (heightPx - 10) * scaleY));
                                  const y = (heightPx - finalHeight) / 2;
                                  const x = idx * totalBarWidth + (totalBarWidth - w) / 2;
                                  
                                  return (
                                    <rect
                                      key={idx}
                                      x={x}
                                      y={y}
                                      width={w}
                                      height={finalHeight}
                                      fill={fillColor}
                                      rx={1.5}
                                      ry={1.5}
                                      style={{ transition: 'all 0.04s ease-out' }}
                                    />
                                  );
                                });
                              })()}
                            </svg>
                          )}
                          {/* Desabilitado para teste de performance solicitado pelo usuário */}
                          <span className="ve-clip-name" style={{ position: 'relative', zIndex: 2 }}>{clip.name}</span>
                          
                          {/* Indicador de Motion Tracking */}
                          {(() => {
                            // Para clips de texto/efeito: mostra se tem trackId
                            if ((clip.type === 'text' || clip.type === 'effect') && clip.config?.trackId) {
                              const track = trackingData.find(t => t.id === clip.config!.trackId);
                              if (!track) return null;
                              const trackDuration = track.tracking_data.length / track.fps;
                              const trackWidth = trackDuration * zoom;
                              return (
                                <div style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: `${trackWidth}px`,
                                  height: '3px',
                                  background: 'linear-gradient(90deg, #10b981, #059669)',
                                  borderRadius: '0 0 2px 2px',
                                  zIndex: 3,
                                  pointerEvents: 'none'
                                }} title={`Motion tracked: ${trackDuration.toFixed(1)}s`} />
                              );
                            }
                            
                            // Para clips de vídeo: mostra se foi usado para criar tracking
                            if (clip.type === 'video') {
                              const tracks = trackingData.filter(t => (t as any).sourceVideoClipId === clip.id);
                              if (tracks.length === 0) return null;
                              
                              return tracks.map((track, idx) => {
                                const trackDuration = track.tracking_data.length / track.fps;
                                const trackWidth = trackDuration * zoom;
                                return (
                                  <div key={track.id} style={{
                                    position: 'absolute',
                                    top: `${idx * 4}px`,
                                    left: 0,
                                    width: `${trackWidth}px`,
                                    height: '3px',
                                    background: 'linear-gradient(90deg, #10b981, #059669)',
                                    borderRadius: '0 0 2px 2px',
                                    zIndex: 3,
                                    pointerEvents: 'none'
                                  }} title={`Motion track ${idx + 1}: ${trackDuration.toFixed(1)}s`} />
                                );
                              });
                            }
                            
                            return null;
                          })()}
                          
                          {/* KEYFRAME DOTS ON TIMELINE */}
                          {clip.keyframes && clip.keyframes.length > 0 && (
                            <div className="ve-clip-keyframes-row">
                              {clip.keyframes.map((kf, idx) => {
                                const pos = (kf.time / (clip.config?.speed || 1)) * zoom;
                                let color = '#fff';
                                if (idx === 0) color = '#4ade80'; // Verde no início
                                else if (idx === clip.keyframes!.length - 1) color = '#ff4d4d'; // Vermelho no fim
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className={`ve-timeline-kf-dot ${selectedKeyframeTime === kf.time ? 'active' : ''}`}
                                    style={{ left: pos, backgroundColor: color }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedKeyframeTime(kf.time);
                                      const speed = clip.config?.speed || 1;
                                      setCurrentTime(clip.startTime + kf.time / speed);
                                      onAddToTerminal(`ðŸ“ Selecionado keyframe em ${kf.time.toFixed(2)}s`);
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      removeKeyframe(kf.time);
                                      onAddToTerminal(`ðŸ—‘ï¸ Keyframe removido`);
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                          
                          <div className="ve-resize-handle right" onMouseDown={e => { e.stopPropagation(); setResizingClipId(clip.id); setResizeSide('r'); }} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    ) : (
          <div 
            className="ve-workflow-container"
            onMouseDown={(e) => {
              if (e.button === 1 || e.button === 0) {
                setIsPanning(true);
                setContextMenu(null);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenu({ 
                x: e.clientX, 
                y: e.clientY, 
                localX: (e.clientX - rect.left - workflowOffset.x) / workflowZoom,
                localY: (e.clientY - rect.top - workflowOffset.y) / workflowZoom,
                visible: true 
              });
            }}
            onWheel={(e) => {
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              setWorkflowZoom(prev => Math.max(0.3, Math.min(2, prev * delta)));
            }}
            onMouseMove={(e) => {
              const dx = e.movementX;
              const dy = e.movementY;

              if (draggedNodeId) {
                // Mover clips dinâmicos (e seus filhos)
                if (clips.some(c => c.id === draggedNodeId)) {
                  setDynamicNodePositions(prev => ({
                    ...prev,
                    [draggedNodeId]: {
                      x: (prev[draggedNodeId]?.x || 380) + dx / workflowZoom,
                      y: (prev[draggedNodeId]?.y || 30) + dy / workflowZoom
                    }
                  }));
                  // Mover filhos (notas e ícones grudados)
                  setWorkflowNotes(prev => prev.map(n => n.parentId === draggedNodeId ? { ...n, x: n.x + dx / workflowZoom, y: n.y + dy / workflowZoom } : n));
                  setWorkflowStatusIcons(prev => prev.map(i => i.parentId === draggedNodeId ? { ...i, x: i.x + dx / workflowZoom, y: i.y + dy / workflowZoom } : i));
                } 
                // Mover Notas (com Magnetismo no canto inferior direito dos blocos)
                else if (workflowNotes.some(n => n.id === draggedNodeId)) {
                  let nx = (workflowNotes.find(n => n.id === draggedNodeId)?.x || 0) + dx / workflowZoom;
                  let ny = (workflowNotes.find(n => n.id === draggedNodeId)?.y || 0) + dy / workflowZoom;
                  let parentId = undefined;

                  const targetNode = activeNodes.find(n => {
                    const dist = Math.sqrt(Math.pow(nx - (n.x + 100), 2) + Math.pow(ny - (n.y + 50), 2));
                    return dist < 60;
                  });

                  if (targetNode) {
                    nx = targetNode.x + 120;
                    ny = targetNode.y + 60;
                    parentId = targetNode.id;
                  }

                  setWorkflowNotes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: nx, y: ny, parentId } : n));
                }
                // Mover Ácones (com Magnetismo e Parentesco)
                else if (workflowStatusIcons.some(i => i.id === draggedNodeId)) {
                  let nx = (workflowStatusIcons.find(i => i.id === draggedNodeId)?.x || 0) + dx / workflowZoom;
                  let ny = (workflowStatusIcons.find(i => i.id === draggedNodeId)?.y || 0) + dy / workflowZoom;
                  let parentId = undefined;
                  
                  const targetNode = [...activeNodes, ...workflowNotes].find(n => {
                    const dist = Math.sqrt(Math.pow(nx - n.x, 2) + Math.pow(ny - n.y, 2));
                    return dist < 40;
                  });

                  if (targetNode) {
                    nx = targetNode.x - 10;
                    ny = targetNode.y - 10;
                    parentId = targetNode.id;
                  }
                  
                  setWorkflowStatusIcons(prev => prev.map(i => i.id === draggedNodeId ? { ...i, x: nx, y: ny, parentId } : i));
                }
                // Mover Nós Fixos (e seus filhos)
                else {
                  setWorkflowNodes(prev => prev.map(node => 
                    node.id === draggedNodeId 
                      ? { ...node, x: node.x + dx / workflowZoom, y: node.y + dy / workflowZoom } 
                      : node
                  ));
                  // Mover filhos vinculados a este nó fixo
                  setWorkflowNotes(prev => prev.map(n => n.parentId === draggedNodeId ? { ...n, x: n.x + dx / workflowZoom, y: n.y + dy / workflowZoom } : n));
                  setWorkflowStatusIcons(prev => prev.map(i => i.parentId === draggedNodeId ? { ...i, x: i.x + dx / workflowZoom, y: i.y + dy / workflowZoom } : i));
                }
              } else if (isDraggingProps) {
                setPropsPanelPos(prev => ({ x: prev.x - dx, y: prev.y + dy }));
              } else if (isPanning) {
                setWorkflowOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              }
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseUp={() => { setDraggedNodeId(null); setIsPanning(false); setIsDraggingProps(false); }}
            onMouseLeave={() => { setDraggedNodeId(null); setIsPanning(false); setIsDraggingProps(false); }}
          >
            <div className="ve-workflow-toolbar">
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#333', marginLeft: '10px' }}>PROCESSO DE VÍDEO (NODES)</span>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: '8px', color: '#444', marginRight: '15px' }}>ZOOM: {Math.round(workflowZoom * 100)}%</div>
              <button 
                className="ve-timeline-btn" 
                onClick={() => {
                  setIsTimelineExpanded(!isTimelineExpanded);
                  if (!isTimelineExpanded) {
                    setPanelOpen(false);
                    setRightPanelOpen(false);
                  }
                }}
                style={{ marginRight: '10px' }}
              >
                {isTimelineExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            <div 
              className="ve-workflow-mouse-glow" 
              style={{ left: mousePos.x, top: mousePos.y }} 
            />

            <div className="ve-workflow-canvas" style={{ transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
              <div className="ve-workflow-grid" style={{ 
                transform: `translate(${workflowOffset.x}px, ${workflowOffset.y}px) scale(${workflowZoom})`,
                backgroundPosition: `${workflowOffset.x % 30}px ${workflowOffset.y % 30}px`
              }} />
              
              <div className="ve-workflow-content" style={{ 
                transform: `translate(${workflowOffset.x}px, ${workflowOffset.y}px) scale(${workflowZoom})`,
                transformOrigin: '0 0',
                position: 'absolute', inset: 0, pointerEvents: 'none'
              }}>
                <svg className="ve-workflow-svg" style={{ width: 5000, height: 5000 }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#444" />
                    </marker>
                  </defs>
                  {activeNodes.map((node, idx) => {
                    if (idx === activeNodes.length - 1) return null;
                    const next = activeNodes[idx + 1];
                    return (
                      <path 
                        key={`edge-${node.id}-${next.id}`}
                        d={`M ${node.x + 140} ${node.y + 40} L ${next.x} ${next.y + 40}`} 
                        stroke="#333" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" 
                      />
                    );
                  })}
                  {/* ConexÁµes de Usuário (Links) */}
                  {workflowConnections.map((conn, idx) => {
                    const fromNode = [...activeNodes, ...workflowNotes].find(n => n.id === conn.from);
                    const toNode = [...activeNodes, ...workflowNotes].find(n => n.id === conn.to);
                    if (!fromNode || !toNode) return null;
                    return (
                      <path 
                        key={`conn-${idx}`}
                        d={`M ${fromNode.x + 70} ${fromNode.y + 40} C ${fromNode.x + 140} ${fromNode.y + 40}, ${toNode.x - 70} ${toNode.y + 40}, ${toNode.x} ${toNode.y + 40}`}
                        stroke="rgba(124, 92, 252, 0.4)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)"
                      />
                    );
                  })}

                  {/* Linha temporária de Link */}
                  {linkingFromId && (
                    <line 
                      x1={([...activeNodes, ...workflowNotes].find(n => n.id === linkingFromId)?.x || 0) + 70}
                      y1={([...activeNodes, ...workflowNotes].find(n => n.id === linkingFromId)?.y || 0) + 40}
                      x2={(mousePos.x - workflowOffset.x) / workflowZoom}
                      y2={(mousePos.y - workflowOffset.y) / workflowZoom}
                      stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5"
                    />
                  )}
                </svg>
                
                {activeNodes.map(node => (
                  <div 
                    key={node.id}
                    className={`ve-workflow-node ${node.type} ${selectedNodeId === node.id ? 'selected' : ''}`}
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      if (linkingFromId) {
                        setWorkflowConnections(prev => [...prev, { from: linkingFromId, to: node.id }]);
                        setLinkingFromId(null);
                      } else {
                        setDraggedNodeId(node.id); 
                        setSelectedNodeId(node.id); 
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect();
                      setContextMenu({ 
                        x: e.clientX, y: e.clientY, 
                        localX: (e.clientX - rect.left - workflowOffset.x) / workflowZoom,
                        localY: (e.clientY - rect.top - workflowOffset.y) / workflowZoom,
                        visible: true, targetId: node.id 
                      });
                    }}
                    style={{ left: node.x, top: node.y, borderColor: node.color, pointerEvents: 'auto' }}
                  >
                    <div className="node-header" style={{ background: node.color }}>{node.label}</div>
                    <div className="node-body">
                      <div className="node-thumb">
                        <Monitor size={18} color={node.color} />
                      </div>
                      <div className="node-info">
                        <strong>{node.id.toUpperCase()}</strong>
                        {node.id === 'color' && <span>Correçãoo de Cor</span>}
                        {node.id === 'subs' && <span>AI Subtitles</span>}
                        {node.id === 'voice' && <span>Neural TTS</span>}
                        {node.subLabel && <span>{node.subLabel}</span>}
                      </div>
                    </div>
                    <div className="node-port input" />
                    <div className="node-port output" />
                  </div>
                ))}

                {/* Renderizar Notas Adesivas */}
                {workflowNotes.map(note => (
                  <div 
                    key={note.id}
                    className="ve-workflow-note"
                    style={{ left: note.x, top: note.y, pointerEvents: 'auto', zIndex: 200 }}
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      setDraggedNodeId(note.id); 
                      setSelectedNodeId(note.id); 
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                      setContextMenu({ 
                        x: e.clientX, y: e.clientY, 
                        localX: (e.clientX - rect.left - workflowOffset.x) / workflowZoom,
                        localY: (e.clientY - rect.top - workflowOffset.y) / workflowZoom,
                        visible: true, targetId: note.id 
                      });
                    }}
                  >
                    <textarea 
                      value={note.text} 
                      onChange={(e) => setWorkflowNotes(prev => prev.map(n => n.id === note.id ? { ...n, text: e.target.value } : n))}
                      placeholder="Sua nota..."
                    />
                    <div className="note-pin" />
                    <button className="note-delete" onClick={(e) => { e.stopPropagation(); setWorkflowNotes(prev => prev.filter(n => n.id !== note.id)); }}>Á—</button>
                  </div>
                ))}

                {/* Renderizar Ácones de Status */}
                {workflowStatusIcons.map(icon => (
                  <div 
                    key={icon.id}
                    className={`ve-workflow-status-icon ${icon.type}`}
                    style={{ left: icon.x, top: icon.y, pointerEvents: 'auto', zIndex: 201 }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggedNodeId(icon.id); setSelectedNodeId(icon.id); }}
                  >
                    {icon.type === 'check' ? <UserCheck size={20} /> : <Trash2 size={20} />}
                    <button className="icon-delete" onClick={(e) => { e.stopPropagation(); setWorkflowStatusIcons(prev => prev.filter(i => i.id !== icon.id)); }}>Á—</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Menu de Contexto */}
            {contextMenu && contextMenu.visible && (
              <div 
                className="ve-workflow-context-menu"
                style={{ left: contextMenu.x, top: contextMenu.y, zIndex: 10000 }}
                onMouseDown={e => e.stopPropagation()}
              >
                {contextMenu.targetId ? (
                  <>
                    {!contextMenu.targetId.startsWith('note-') && (
                      <div className="menu-item" onClick={() => { setLinkingFromId(contextMenu.targetId!); setContextMenu(null); }}>
                        <GitMerge size={10} color="var(--primary)" /> CRIAR LINK (CONEXÁƒO)
                      </div>
                    )}
                    <div className="menu-item" onClick={() => {
                      if (contextMenu.targetId?.startsWith('note-')) {
                        setWorkflowNotes(prev => prev.filter(n => n.id !== contextMenu.targetId));
                      } else {
                        // Deletar conexão se for o alvo? Por enquanto apenas remover nó
                        alert('Nó de sistema não pode ser deletado');
                      }
                      setContextMenu(null);
                    }}>
                      <Trash2 size={10} color="#ff4d4d" /> EXCLUIR ELEMENTO
                    </div>
                  </>
                ) : (
                  <>
                    <div className="menu-item" onClick={(e) => {
                      e.stopPropagation();
                      if (contextMenu) {
                        const newNote = { id: 'note-' + Date.now(), x: contextMenu.localX - 60, y: contextMenu.localY - 50, text: '' };
                        setWorkflowNotes(prev => [...prev, newNote]);
                      }
                      setContextMenu(null);
                    }}>
                      <Plus size={10} /> ADICIONAR BLOCO DE NOTAS
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-item" onClick={(e) => {
                      e.stopPropagation();
                      if (contextMenu) {
                        const newIcon = { id: 'icon-' + Date.now(), x: contextMenu.localX - 15, y: contextMenu.localY - 15, type: 'check' as const };
                        setWorkflowStatusIcons(prev => [...prev, newIcon]);
                      }
                      setContextMenu(null);
                    }}>
                      <UserCheck size={10} color="#4ade80" /> MARCAR COMO VERIFICADO
                    </div>
                    <div className="menu-item" onClick={(e) => {
                      e.stopPropagation();
                      if (contextMenu) {
                        const newIcon = { id: 'icon-' + Date.now(), x: contextMenu.localX - 15, y: contextMenu.localY - 15, type: 'x' as const };
                        setWorkflowStatusIcons(prev => [...prev, newIcon]);
                      }
                      setContextMenu(null);
                    }}>
                      <Trash2 size={10} color="#ff4d4d" /> MARCAR COM ERRO (X)
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedNodeId && (
              <div 
                className="ve-workflow-props-panel" 
                style={{ top: propsPanelPos.y, left: 'auto', right: propsPanelPos.x, position: 'absolute' }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div 
                  className="props-header" 
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => { e.preventDefault(); setIsDraggingProps(true); }}
                >
                  <span>PROPRIEDADES: {selectedNodeId.toUpperCase()}</span>
                  <button onClick={() => setSelectedNodeId(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                </div>
                <div className="props-content">
                  {/* Ediçãoo do Próprio Nó */}
                  <div className="ve-prop-section" style={{ borderBottom: '1px solid #1a1a24', paddingBottom: '10px', marginBottom: '15px' }}>
                    <label>ESTILO DO BLOCO</label>
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', alignItems: 'center' }}>
                      {['#7c5cfc', '#f472b6', '#4ade80', '#ff4d4d', '#444'].map(c => (
                        <div 
                          key={c} 
                          onClick={() => setWorkflowNodes(nodes => nodes.map(n => n.id === selectedNodeId ? { ...n, color: c } : n))}
                          style={{ width: '15px', height: '15px', background: c, borderRadius: '2px', cursor: 'pointer', border: '1px solid #fff' }} 
                        />
                      ))}
                      <input 
                        type="color" 
                        style={{ width: '20px', height: '20px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        onChange={(e) => {
                          const c = e.target.value;
                          setWorkflowNodes(nodes => nodes.map(n => n.id === selectedNodeId ? { ...n, color: c } : n));
                        }}
                      />
                    </div>
                  </div>

                  {selectedNodeId === 'color' && (
                    <div className="ve-prop-section">
                      <label>AJUSTES GLOBAIS</label>
                      <div className="ve-prop-row"><span>Brilho</span><input type="range" min={0} max={200} onChange={(e) => applyGlobalAdjustment('brightness', Number(e.target.value))} /></div>
                      <div className="ve-prop-row"><span>Contraste</span><input type="range" min={0} max={200} onChange={(e) => applyGlobalAdjustment('contrast', Number(e.target.value))} /></div>
                      <div className="ve-prop-row"><span>Saturaçãoo</span><input type="range" min={0} max={200} onChange={(e) => applyGlobalAdjustment('saturation', Number(e.target.value))} /></div>
                      <div className="ve-studio-btn" onClick={() => onAddToTerminal('❌¨ Filtros aplicados em todos os clipes!')}>APLICAR EM TODOS</div>
                    </div>
                  )}
                  {selectedNodeId === 'subs' && (
                    <div className="ve-prop-section">
                      <label>ESTILO DE LEGENDA</label>
                      <div className="ve-prop-row">
                        <span>Fonte</span>
                        <select 
                          style={{ background: '#111', border: '1px solid #333', color: '#fff', fontSize: '9px' }}
                          value={clips.find(c => c.type === 'text')?.textConfig?.fontFamily || 'Arial'}
                          onChange={(e) => {
                            const font = e.target.value;
                            setClips(prev => prev.map(c => c.type === 'text' ? { ...c, textConfig: { ...c.textConfig, fontFamily: font } } : c));
                          }}
                        >
                          {fontFamilies.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                        </select>
                      </div>
                      <div className="ve-prop-row">
                        <span>Tamanho</span>
                        <input type="range" min={10} max={5000} onChange={(e) => {
                          const val = Number(e.target.value);
                          setClips(prev => prev.map(c => c.type === 'text' ? { ...c, textConfig: { ...c.textConfig, fontSize: val } } : c));
                        }} />
                      </div>
                      <div className="ve-prop-row">
                        <span>Contorno</span>
                        <input type="range" min={0} max={10} onChange={(e) => {
                          const val = Number(e.target.value);
                          setClips(prev => prev.map(c => c.type === 'text' ? { ...c, textConfig: { ...c.textConfig, strokeWidth: val } } : c));
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <input type="color" onChange={(e) => {
                             const color = e.target.value;
                             setClips(prev => prev.map(c => c.type === 'text' ? { ...c, textConfig: { ...c.textConfig, color } } : c));
                           }} />
                           <span style={{ fontSize: '7px' }}>COR</span>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <input type="color" onChange={(e) => {
                             const color = e.target.value;
                             setClips(prev => prev.map(c => c.type === 'text' ? { ...c, textConfig: { ...c.textConfig, strokeColor: color } } : c));
                           }} />
                           <span style={{ fontSize: '7px' }}>CONTORNO</span>
                         </div>
                      </div>
                      <div className="ve-studio-btn" style={{ marginTop: '15px' }}>SINCRONIZAR TODAS</div>
                    </div>
                  )}
                  {selectedNodeId === 'keyframes' && (
                    <div className="ve-prop-section">
                      <label>GERENCIAR KEYFRAMES</label>
                      <div style={{ fontSize: '8px', color: '#666', marginBottom: '10px' }}>
                        Clique para suavizar ou resetar animaçÁµes de todos os clipes.
                      </div>
                      <div className="ve-studio-btn" onClick={() => onAddToTerminal('Smooth Ease aplicado aos Keyframes')}>SMOOTH EASE</div>
                      <div className="ve-studio-btn" style={{ background: '#444', marginTop: '5px' }}>RESETAR ANIMAÁ‡Á•ES</div>
                    </div>
                  )}
                  {selectedNodeId && clips.find(c => c.id === selectedNodeId) && (
                    <div className="ve-prop-section">
                      {(() => {
                        const clip = clips.find(c => c.id === selectedNodeId)!;
                        
                        if (clip.type === 'image') {
                          return (
                             <>
                               <label>AJUSTES DA IMAGEM</label>
                               <div className="ve-prop-row"><span>Brilho</span><input type="range" min={0} max={200} value={clip.config?.brightness ?? 100} onChange={(e) => setClips(prev => prev.map(c => c.id === clip.id ? { ...c, config: { ...c.config!, brightness: Number(e.target.value) } } : c))} /></div>
                               <div className="ve-prop-row"><span>Contraste</span><input type="range" min={0} max={200} value={clip.config?.contrast ?? 100} onChange={(e) => setClips(prev => prev.map(c => c.id === clip.id ? { ...c, config: { ...c.config!, contrast: Number(e.target.value) } } : c))} /></div>
                               <div className="ve-prop-row"><span>Saturaçãoo</span><input type="range" min={0} max={200} value={clip.config?.saturation ?? 100} onChange={(e) => setClips(prev => prev.map(c => c.id === clip.id ? { ...c, config: { ...c.config!, saturation: Number(e.target.value) } } : c))} /></div>
                             </>
                          );
                        }

                        const isFilter = ['sepia_pro', 'bw_classic', 'dramatic', 'pastel'].includes(clip.effect || '');
                        const isTrans = clip.type === 'transition';
                        const typeLabel = isTrans ? 'TRANSIÇÃO' : (isFilter ? 'FILTRO' : 'EFEITO VFX');
                        
                        return (
                          <>
                            <label>EDITAR {typeLabel}</label>
                            <div className="ve-prop-row">
                              <span>OpçÁµes de {typeLabel}</span>
                              <select 
                                style={{ background: '#111', border: '1px solid #333', color: '#fff', fontSize: '9px' }}
                                value={clip.effect}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const allItems = [
                                    { id: 'noir', name: 'NOIR' }, { id: 'vhs', name: 'VHS RETRO' }, { id: 'vibrant', name: 'VIBRANTE' }, { id: 'cinema', name: 'CINEMA' }, { id: 'glitch', name: 'GLITCH' }, { id: 'horror', name: 'HORROR' }, { id: 'dream', name: 'SONHO' }, { id: 'retro80s', name: '80S RETRO' }, { id: 'sepia', name: 'SÁ‰PIA GOLD' }, { id: 'negative', name: 'NEGATIVO' }, { id: 'shake', name: 'TREMOR' }, { id: 'pulse', name: 'PULSO' }, { id: 'oldfilm', name: 'FILME ANTIGO' }, { id: 'sway', name: 'BARCO (MAR)' }, { id: 'rainbow', name: 'ARCO-ÁRIS' }, { id: 'flash', name: 'FLASH' }, { id: 'ghost', name: 'FANTASMA' }, { id: 'crt', name: 'CRT ANTIGO' }, { id: 'zoom', name: 'ZOOM PUMP' }, { id: 'blur', name: 'DESFOQUE' }, { id: 'blurpulse', name: 'DESFOQUE PULSO' }, { id: 'colorshift', name: 'TROCA COR' }, { id: 'slowzoom', name: 'ZOOM LENTO' },
                                    { id: 'sepia_pro', name: 'SÁ‰PIA PRO' }, { id: 'warm', name: 'QUENTE' }, { id: 'cold', name: 'FRIO' }, { id: 'bw_classic', name: 'P&B CLÁSSICO' }, { id: 'bw_high_con', name: 'P&B CONTRASTE' }, { id: 'bw_muted', name: 'P&B SUAVE' }, { id: 'horror_red', name: 'TERROR VERMELHO' }, { id: 'cinema_scope', name: 'CINEMA SCOPE' }, { id: 'iso_red', name: 'FOCAR VERMELHO' }, { id: 'cyberpunk', name: 'CYBERPUNK' }, { id: 'night_vision', name: 'VISÁƒO NOTURNA' }, { id: 'dramatic', name: 'DRAMÁTICO' }, { id: 'vintage_70s', name: 'VINTAGE 70S' }, { id: 'pastel', name: 'TONS PASTEL' },
                                    { id: 'fade', name: 'DISSOLVER' }, { id: 'slideleft', name: 'DESLIZAR ESQ' }, { id: 'slideright', name: 'DESLIZAR DIR' }, { id: 'slideup', name: 'SUBIR' }, { id: 'slidedown', name: 'DESCER' }, { id: 'zoomin', name: 'ZOOM IN' }, { id: 'zoomout', name: 'ZOOM OUT' }, { id: 'wipe', name: 'VARREDURA' }, { id: 'spin', name: 'GIRAR' }, { id: 'blurtrans', name: 'BLUR TRANS' }, { id: 'glitchtrans', name: 'GLITCH TRANS' }, { id: 'flashwhite', name: 'FLASH BRANCO' }, { id: 'pixelate', name: 'PIXELAR' }, { id: 'iris', name: 'ÁRIS CIRCULAR' }, { id: 'flip', name: 'VIRA-PÁGINA' }
                                  ];
                                  const item = allItems.find(i => i.id === val);
                                  setClips(prev => prev.map(c => c.id === selectedNodeId ? { ...c, effect: val, name: item?.name || val } : c));
                                }}
                              >
                                {isTrans ? (
                                  <>
                                    <option value="fade">Dissolver</option>
                                    <option value="trans_flash">Flash Branco</option>
                                    <option value="wipeleft">Varrer Esq</option>
                                    <option value="wiperight">Varrer Dir</option>
                                    <option value="wipeup">Varrer Cima</option>
                                    <option value="wipedown">Varrer Baixo</option>
                                    <option value="trans_up">Slide Cima</option>
                                    <option value="trans_down">Slide Baixo</option>
                                    <option value="trans_left">Slide Esq</option>
                                    <option value="trans_right">Slide Dir</option>
                                  </>
                                ) : isFilter ? (
                                  <>
                                    <option value="sepia_pro">Sépia Pro</option>
                                    <option value="bw_classic">P&B Clássico</option>
                                    <option value="dramatic">Dramático</option>
                                    <option value="pastel">Tons Pastel</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="blur">Desfoque</option>
                                    <option value="rotate">Girar</option>
                                    <option value="fadein">Fade In</option>
                                    <option value="fadeout">Fade Out</option>
                                    <option value="flipv">Flip Vertical</option>
                                    <option value="fliph">Flip Horizontal</option>
                                  </>
                                )}
                              </select>
                            </div>
                            <div className="ve-prop-row">
                              <span>Intensidade</span>
                              <input type="range" min={0} max={100} value={clip.config?.opacity ?? 100} onChange={(e) => {
                                const val = Number(e.target.value);
                                setClips(prev => prev.map(c => c.id === selectedNodeId ? { ...c, config: { ...c.config, opacity: val } } : c));
                              }} />
                            </div>
                          </>
                        );
                      })()}
                      <div className="ve-studio-btn" onClick={() => onAddToTerminal('❌¨ Configurações aplicadas!')}>APLICAR</div>
                    </div>
                  )}
                  {selectedNodeId === 'input-v' && (
                    <div className="ve-prop-section">
                      <label>AJUSTES GLOBAIS VÍDEO</label>
                      <div className="ve-prop-row"><span>Escala</span><input type="range" min={10} max={200} onChange={(e) => {
                         const val = Number(e.target.value);
                         setClips(prev => prev.map(c => c.type === 'video' ? { ...c, config: { ...c.config, scale: val } } : c));
                      }} /></div>
                      <div className="ve-prop-row"><span>Opacidade</span><input type="range" min={0} max={100} onChange={(e) => {
                         const val = Number(e.target.value);
                         setClips(prev => prev.map(c => c.type === 'video' ? { ...c, config: { ...c.config, opacity: val } } : c));
                      }} /></div>
                    </div>
                  )}
                  {selectedNodeId === 'input-a' && (
                    <div className="ve-prop-section">
                      <label>AJUSTES GLOBAIS ÁUDIO</label>
                      <div className="ve-prop-row"><span>Volume</span><input type="range" min={0} max={200} onChange={(e) => {
                         const val = Number(e.target.value);
                         setClips(prev => prev.map(c => c.type === 'audio' ? { ...c, config: { ...c.config, volume: val } } : c));
                      }} /></div>
                    </div>
                  )}
                  {selectedNodeId === 'output' && <span>Configurações de Exportação</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
      <defs>
        {(() => {
          const bs = previewQuality === 'Original' ? 1 : (
            previewQuality === '144p' 
              ? Math.max(4, Math.round(previewHeight / 90)) 
              : Math.max(2, Math.round(previewHeight / 180))
          );
          const floodSize = Math.max(1, Math.ceil(bs / 4));
          const floodOffset = Math.floor(bs / 2);
          const morphologyRadius = bs / 2;

          return (
            <filter id="dynamic-pixelate" x="0%" y="0%" width="100%" height="100%">
              <feFlood x={floodOffset} y={floodOffset} height={floodSize} width={floodSize} />
              <feComposite width={bs} height={bs} />
              <feTile result="a" />
              <feComposite in="SourceGraphic" in2="a" operator="in" />
              <feMorphology operator="dilate" radius={morphologyRadius} />
            </filter>
          );
        })()}
        <filter id="f_sepia_pro">
          <feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_warm">
          <feColorMatrix type="matrix" values="1.2 0.1 0 0 0 0.1 1.1 0 0 0 0 0 0.8 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_cold">
          <feColorMatrix type="matrix" values="0.8 0 0 0 0 0 0.9 0 0 0 0.1 0.2 1.3 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_horror_red">
          <feColorMatrix type="matrix" values="1.5 0 0 0 0 0 0.5 0 0 0 0 0 0.5 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_iso_red">
          <feColorMatrix type="matrix" values="1 0 0 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_cyberpunk">
          <feColorMatrix type="matrix" values="1.1 0 0.6 0 0 0 1.3 0.3 0 0 0.5 0 1.4 0 0 0 0 0 1 0" />
        </filter>
        <filter id="f_night_vision">
          <feColorMatrix type="matrix" values="0 0.8 0 0 0 0 1.5 0 0 0 0 0.8 0 0 0 0 0 1 0" />
        </filter>
      </defs>
    </svg>
    </div>

      {/* Modal de Modos de Legenda */}
      {showSubtitleModeModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(5px)'
          }}
          onClick={() => setShowSubtitleModeModal(false)}
        >
          <div 
            style={{
              background: '#0d0d12',
              borderRadius: '16px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              🎬 Modo de Legenda
            </h3>
            <p style={{ margin: '0 0 25px 0', fontSize: '12px', color: '#888' }}>
              Escolha como as legendas serão exibidas
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
              {/* Modo Normal */}
              <div
                onClick={() => setSelectedSubtitleMode('normal')}
                style={{
                  padding: '16px',
                  background: selectedSubtitleMode === 'normal' ? 'rgba(124, 92, 252, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${selectedSubtitleMode === 'normal' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    border: `2px solid ${selectedSubtitleMode === 'normal' ? 'var(--primary)' : '#444'}`,
                    background: selectedSubtitleMode === 'normal' ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedSubtitleMode === 'normal' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>📝 Normal</span>
                </div>
                <p style={{ margin: '0 0 0 32px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
                  Frases completas aparecem de uma vez.<br/>
                  <span style={{ color: '#666', fontSize: '10px' }}>Ex: "Hoje você vai entender tudo"</span>
                </p>
              </div>
              
              {/* Modo Palavra por Palavra */}
              <div
                onClick={() => setSelectedSubtitleMode('word-by-word')}
                style={{
                  padding: '16px',
                  background: selectedSubtitleMode === 'word-by-word' ? 'rgba(124, 92, 252, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${selectedSubtitleMode === 'word-by-word' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    border: `2px solid ${selectedSubtitleMode === 'word-by-word' ? 'var(--primary)' : '#444'}`,
                    background: selectedSubtitleMode === 'word-by-word' ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedSubtitleMode === 'word-by-word' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>⚡ Palavra por Palavra</span>
                </div>
                <p style={{ margin: '0 0 0 32px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
                  Uma palavra aparece de cada vez.<br/>
                  <span style={{ color: '#666', fontSize: '10px' }}>Ex: "Hoje" → "você" → "vai"...</span>
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowSubtitleModeModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#888',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  setShowSubtitleModeModal(false);
                  handleAutoSubtitle(selectedSubtitleMode);
                }}
                style={{
                  flex: 2,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(124, 92, 252, 0.4)'
                }}
              >
                GERAR LEGENDAS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Motion Tracker Modal */}
      {showMotionTracker && (() => {
        const videoClip = clips.find(c => c.type === 'video' && c.id === selectedClipId) || clips.find(c => c.type === 'video');
        if (!videoClip) return null;
        
        return (
          <MotionTracker
            currentTime={videoClip.startTime}
            duration={videoClip.duration - videoClip.trimStart - videoClip.trimEnd}
            videoPath={videoClip.path}
            videoUrl={videoClip.url}
            clipStartTime={videoClip.startTime}
            clipTrimStart={videoClip.trimStart}
            clipTrimEnd={videoClip.trimEnd}
            clipDuration={videoClip.duration}
            onTrackingComplete={(data) => {
              // Adiciona referência ao clip de vídeo no tracking data
              const trackDataWithClip = {
                ...data,
                sourceVideoClipId: videoClip.id
              };
              setTrackingData([...trackingData, trackDataWithClip]);
              onAddToTerminal(`✅ Motion Tracker concluído: ${data.tracking_data.length} frames rastreados`);
            }}
            onClose={() => setShowMotionTracker(false)}
          />
        );
      })()}
      
      {/* Debug - remover depois */}
      {showMotionTracker && !clips.find(c => c.type === 'video') && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'red',
          color: 'white',
          padding: '20px',
          zIndex: 99999
        }}>
          Nenhum vídeo encontrado!
        </div>
      )}
  </>
);
});


export default VideoEditor;
