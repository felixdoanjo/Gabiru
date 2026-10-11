import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './PhotoEditor.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type ElementType = 'text' | 'shape' | 'image' | 'drawing' | 'eraser_stroke' | 'mockup';
type ShapeKind = 'rect' | 'circle' | 'triangle' | 'star' | 'heart' | 'arrow' | 'line' | 'diamond' | 'cross' | 'hexagon';
type TextAlign = 'left' | 'center' | 'right';
type SidePanel = 'templates' | 'elements' | 'text' | 'uploads' | 'background' | 'ai' | 'draw' | 'reference' | 'mockup';

// ── Color Theory Palettes ──────────────────────────────────
const COLOR_PALETTES = [
  { name: 'Complementar Roxo', colors: ['#7c3aed','#c084fc','#ddd6fe','#f59e0b','#fbbf24','#fef3c7'] },
  { name: 'Análoga Fria', colors: ['#06b6d4','#3b82f6','#7c3aed','#6d28d9','#1e3a8a','#0ea5e9'] },
  { name: 'Análoga Quente', colors: ['#ef4444','#f97316','#eab308','#f59e0b','#dc2626','#fbbf24'] },
  { name: 'Tríade Vibrante', colors: ['#ef4444','#3b82f6','#22c55e','#fca5a5','#93c5fd','#86efac'] },
  { name: 'Monocromático Azul', colors: ['#1e3a8a','#1d4ed8','#3b82f6','#60a5fa','#93c5fd','#dbeafe'] },
  { name: 'Monocromático Roxo', colors: ['#3b0764','#6d28d9','#7c3aed','#a78bfa','#c084fc','#ede9fe'] },
  { name: 'Neutros Quentes', colors: ['#1c1917','#44403c','#78716c','#a8a29e','#d6d3d1','#fafaf9'] },
  { name: 'Sunset', colors: ['#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fed7aa'] },
  { name: 'Ocean Deep', colors: ['#0c4a6e','#0369a1','#0284c7','#38bdf8','#7dd3fc','#e0f2fe'] },
  { name: 'Forest', colors: ['#14532d','#166534','#15803d','#16a34a','#4ade80','#bbf7d0'] },
  { name: 'Neon', colors: ['#ff006e','#fb5607','#ffbe0b','#3a86ff','#8338ec','#06ffb4'] },
  { name: 'Pastel Dream', colors: ['#ffd6e7','#ffafcc','#bde0fe','#a2d2ff','#cdb4db','#ffc8dd'] },
  { name: 'Skin Tones', colors: ['#3d1c02','#6b3a2a','#a0522d','#c68642','#e8beac','#fdd9b5'] },
  { name: 'Anime Dark', colors: ['#0a0a0f','#1a1a2e','#16213e','#0f3460','#533483','#e94560'] },
  { name: 'Preto & Branco', colors: ['#000000','#1a1a1a','#404040','#808080','#bfbfbf','#ffffff'] },
];

interface DesignElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  zIndex: number;
  // Metadata para IA (tags customizadas pelo usuário)
  customName?: string; // Nome customizado pelo usuário (ex: "Montanha Verde", "Logo Principal")
  customCategory?: 'pessoa' | 'objeto' | 'animal' | 'cenario' | 'efeito' | 'texto' | 'outro'; // Categoria do elemento
  // Text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: TextAlign;
  textColor?: string;
  textStrokeColor?: string;
  textCurve?: number; // Curvatura do texto em graus (-180 a 180, 0 = reto)
  textStrokeWidth?: number;
  textShadowColor?: string;
  textShadowDistance?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textHollowEnabled?: boolean;
  textStretchY?: number;  // vertical stretch multiplier, 1 = normal, >1 = taller
  deformEnabled?: boolean;
  deformCorners?: {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
  };
  // Shape
  shapeKind?: ShapeKind;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  // Image
  imageSrc?: string;
  imageObjectFit?: 'cover' | 'contain' | 'fill';
  cropOffsetX?: number;  // px offset for crop (negative = shift left/up)
  cropOffsetY?: number;  // px offset for crop
  cropImgW?: number;     // rendered image width in px (for crop mode)
  cropImgH?: number;     // rendered image height in px (for crop mode)
  flipX?: boolean;
  flipY?: boolean;
  // Image Filters
  brightness?: number;
  contrast?: number;
  saturation?: number;
  shadow?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  vignette?: number;
  blur?: number;

  hueRotate?: number;
  noiseIntensity?: number;
  // Overlay custom colors
  overlayType?: 'fade' | 'fade-inferior' | 'fade-left' | 'fade-right' | 'fade-bottom' | 'fade-radial' | 'fade-diag-tl' | 'fade-diag-tr' | 'fade-diag-bl' | 'fade-diag-br' | 'fade-duplo-v' | 'fade-duplo-h' | 'degrade' | 'degrade-horizontal' | 'degrade-vertical' | 'degrade-radial' | 'degrade-tricolor' | 'glow' | 'glow-multicolor' | 'glow-top' | 'glow-bottom' | 'glow-neon' | 'glow-dual' | 'xadrez' | 'dots' | 'stripes' | 'stripes-h' | 'stripes-v' | 'grid' | 'zigzag' | 'waves' | 'hexgrid' | 'diamonds' | 'cross-pattern' | 'triangles-pattern' | 'noise' | 'scanlines' | 'halftone' | 'duotone' | 'vignette-overlay';
  overlayColor1?: string;
  // Drawing path points
  points?: { x: number; y: number }[];
  duotoneEnabled?: boolean;
  duotoneColor1?: string;
  duotoneColor2?: string;
  // Eraser strokes for non-drawing elements
  eraserStrokes?: { id: string; points: { x: number; y: number }[]; size: number; opacity: number }[];
  // Mockup
  mockupPath?: { x: number; y: number }[];
  mockupImageId?: string;
}

interface CanvasPreset {
  name: string;
  w: number;
  h: number;
}

interface CanvasPage {
  id: string;
  name: string;
  w: number;
  h: number;
  bg: string;
  elements: DesignElement[];
  zCounter: number;
  x?: number;
  y?: number;
  pageKind?: 'design' | 'draft';
  draftForPageId?: string;
  draftLinkedElementIds?: string[];
}

interface Template {
  id: string;
  name: string;
  category: string;
  bg: string;
  baseH?: number; // optional base height (default 360); use 620 for square Instagram templates
  elements: Partial<DesignElement>[];
}

interface PhotoEditorProps {
  activeProject?: { id: string; name: string; description: string; blockType: string; workFolder?: string; saveId?: string } | null;
  onAddToTerminal?: (msg: string) => void;
  onSendToAI?: (prompt: string) => void;
  onProjectAction?: (action: string) => void;
  onUpdatePreview?: (previewDataUrl: string) => void;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const CANVAS_PRESETS: CanvasPreset[] = [
  { name: 'Apresentação', w: 1280, h: 720 },
  { name: 'Post Instagram', w: 1080, h: 1080 },
  { name: 'Instagram Retrato', w: 1080, h: 1350 },
  { name: 'Story', w: 1080, h: 1920 },
  { name: 'Capa YouTube', w: 2560, h: 1440 },
  { name: 'A4 Vertical', w: 794, h: 1123 },
  { name: 'Banner Web', w: 1200, h: 628 },
];

const FONT_FAMILIES = [
  'Inter', 'Outfit', 'Poppins', 'Montserrat', 'Playfair Display',
  'Roboto', 'Open Sans', 'Lato', 'Raleway', 'Oswald',
  'Bebas Neue', 'Anton', 'Permanent Marker', 'Righteous', 'Bangers',
  'Georgia', 'Arial', 'Times New Roman', 'Courier New',
];

const BG_COLORS = [
  // Brancos & Cinzas
  '#ffffff', '#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6',
  '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40',
  '#212529', '#000000',
  // Azuis
  '#1a1a2e', '#0f3460', '#2980b9', '#0984e3', '#74b9ff',
  '#70a1ff', '#a9d1ff', '#0652DD', '#1B1464', '#0a3d62',
  // Roxos
  '#533483', '#6c5ce7', '#a29bfe', '#8e44ad', '#9b59b6',
  '#b388ff', '#e1bee7', '#7c5cfc', '#5f27cd', '#341f97',
  // Vermelhos & Rosas
  '#e94560', '#e74c3c', '#d63031', '#ff6b6b', '#fd79a8',
  '#f8a5c2', '#fab1a0', '#ff4757', '#ff6348', '#c44569',
  // Laranjas & Amarelos
  '#f5a623', '#e67e22', '#e17055', '#fdcb6e', '#ffeaa7',
  '#f9ca24', '#ffbe76', '#f39c12', '#ff9f43', '#feca57',
  // Verdes
  '#7bed9f', '#27ae60', '#00b894', '#55efc4', '#badc58',
  '#2ed573', '#26de81', '#A3CB38', '#009432', '#006266',
  // Teals & Cyans
  '#00cec9', '#81ecec', '#48dbfb', '#0abde3', '#7efff5',
  '#00d2d3', '#01a3a4', '#34e7e4',
  // Escuros
  '#16213e', '#2c3e50', '#2d3436', '#636e72', '#0a0a0a',
  '#1e272e', '#485460', '#1B1B2F', '#162447', '#1a1a2e',
];

const BG_GRADIENTS = [
  { name: 'Oceano', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Pôr do sol', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Aurora', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Floresta', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { name: 'Lavanda', css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { name: 'Fogo', css: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)' },
  { name: 'Noite', css: 'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%, #6b8cce 100%)' },
  { name: 'Menta', css: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { name: 'Cosmos', css: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { name: 'Flamingo', css: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)' },
  { name: 'Cyberpunk', css: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)' },
  { name: 'Arco-Íris', css: 'linear-gradient(90deg, #f5af19 0%, #f12711 25%, #e100ff 50%, #7f00ff 75%, #00dbde 100%)' },
  { name: 'Glacial', css: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)' },
  { name: 'Ouro', css: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
  { name: 'Vinho', css: 'linear-gradient(135deg, #642b73 0%, #c6426e 100%)' },
  { name: 'Elétrico', css: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { name: 'Salmão', css: 'linear-gradient(135deg, #ffc3a0 0%, #ffafbd 100%)' },
  { name: 'Neon', css: 'linear-gradient(135deg, #b721ff 0%, #21d4fd 100%)' },
  { name: 'Petróleo', css: 'linear-gradient(135deg, #093028 0%, #237a57 100%)' },
  { name: 'Amanhecer', css: 'linear-gradient(135deg, #f83600 0%, #f9d423 100%)' },
  { name: 'Galáxia', css: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { name: 'Candy', css: 'linear-gradient(135deg, #d558c8 0%, #24d292 100%)' },
  { name: 'Inverno', css: 'linear-gradient(135deg, #e6dada 0%, #274046 100%)' },
  { name: 'Turquesa', css: 'linear-gradient(135deg, #136a8a 0%, #267871 100%)' },
  { name: 'Sangria', css: 'linear-gradient(135deg, #9e1c3d 0%, #d4145a 50%, #fbb03b 100%)' },
  { name: 'Midnight', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Pastel', css: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { name: 'Tropical', css: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)' },
  { name: 'Ultravioleta', css: 'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)' },
  { name: 'Prata', css: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' },
  { name: 'Sunrise', css: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)' },
  { name: 'Deep Space', css: 'linear-gradient(135deg, #000428 0%, #004e92 100%)' },
];

const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect',     label: 'Retângulo' },
  { kind: 'circle',   label: 'Círculo'   },
  { kind: 'triangle', label: 'Triângulo' },
  { kind: 'star',     label: 'Estrela'   },
  { kind: 'heart',    label: 'Coração'   },
  { kind: 'diamond',  label: 'Losango'   },
  { kind: 'cross',    label: 'Cruz'      },
  { kind: 'hexagon',  label: 'Hexágono'  },
];

const TEMPLATES: Template[] = [];

// ═══════════════════════════════════════════════════════════
// SHAPE SVG RENDERER
// ═══════════════════════════════════════════════════════════

function renderShapeSVG(kind: ShapeKind, fill: string, stroke: string, strokeWidth: number): React.ReactNode {
  const common = { fill, stroke, strokeWidth, vectorEffect: 'non-scaling-stroke' as const };
  switch (kind) {
    case 'rect': return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><rect x="2" y="2" width="96" height="96" rx="4" {...common} /></svg>;
    case 'circle': return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><circle cx="50" cy="50" r="48" {...common} /></svg>;
    case 'triangle': return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><polygon points="50,4 96,96 4,96" {...common} /></svg>;
    case 'star': return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" {...common} />
      </svg>
    );
    case 'heart': return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <path d="M50 88 C50 88 10 60 10 30 C10 17 20 8 35 8 C43 8 50 14 50 14 C50 14 57 8 65 8 C80 8 90 17 90 30 C90 60 50 88 50 88Z" {...common} />
      </svg>
    );
    case 'diamond': return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><polygon points="50,4 96,50 50,96 4,50" {...common} /></svg>;
    case 'arrow': return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <polygon points="5,35 65,35 65,10 95,50 65,90 65,65 5,65" {...common} />
      </svg>
    );
    case 'line': return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><line x1="4" y1="50" x2="96" y2="50" stroke={fill} strokeWidth={Math.max(strokeWidth, 4)} strokeLinecap="round" /></svg>;
    case 'hexagon': return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" {...common} />
      </svg>
    );
    case 'cross': return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35" {...common} />
      </svg>
    );
    default: return <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}><rect x="2" y="2" width="96" height="96" {...common} /></svg>;
  }
}

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════

function genId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getMockupBounds(points: { x: number; y: number }[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Helper para renderizar eraserStrokes com acúmulo suave de opacidade
// IMPORTANTE: Esta função cria uma máscara que será aplicada APENAS ao elemento atual
// não afetando outros elementos no canvas
function renderEraserStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: { id: string; points: { x: number; y: number }[]; size: number; opacity: number }[],
  offsetX: number,
  offsetY: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  
  strokes.forEach(stroke => {
    if (!stroke.points || stroke.points.length === 0) return;
    
    const radius = (stroke.size || 15) / 2;
    const opacity = (stroke.opacity || 100) / 100;
    
    // Desenhar círculo em cada ponto para cobertura uniforme
    stroke.points.forEach((point, idx) => {
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(point.x - offsetX, point.y - offsetY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'black';
      ctx.fill();
      
      // Conectar com linha para evitar gaps
      if (idx > 0) {
        const prevPoint = stroke.points[idx - 1];
        ctx.beginPath();
        ctx.moveTo(prevPoint.x - offsetX, prevPoint.y - offsetY);
        ctx.lineTo(point.x - offsetX, point.y - offsetY);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = stroke.size || 15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = opacity;
        ctx.stroke();
      }
    });
  });
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// Helper: renderizar elemento com borracha isolada usando canvas temporário
function renderElementWithIsolatedEraser(
  mainCtx: CanvasRenderingContext2D,
  el: DesignElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
  renderContentFn: (tempCtx: CanvasRenderingContext2D, x1: number, y1: number, w: number, h: number) => void
) {
  const hasEraser = el.eraserStrokes && el.eraserStrokes.length > 0;
  
  if (!hasEraser) {
    // Sem borracha, renderizar direto
    renderContentFn(mainCtx, -w / 2, -h / 2, w, h);
    return;
  }
  
  // Com borracha: usar canvas temporário
  const margin = Math.max(w, h) * 0.5;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = Math.ceil(w + margin * 2);
  tempCanvas.height = Math.ceil(h + margin * 2);
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) {
    renderContentFn(mainCtx, -w / 2, -h / 2, w, h);
    return;
  }
  
  // Renderizar elemento no canvas temp (centralizado)
  tempCtx.save();
  tempCtx.translate(margin + w / 2, margin + h / 2);
  renderContentFn(tempCtx, -w / 2, -h / 2, w, h);
  tempCtx.restore();
  
  // Aplicar borracha no canvas temp
  tempCtx.globalCompositeOperation = 'destination-out';
  el.eraserStrokes.forEach(stroke => {
    if (!stroke.points || stroke.points.length === 0) return;
    
    const radius = (stroke.size || 15) / 2;
    const opacity = (stroke.opacity || 100) / 100;
    
    stroke.points.forEach((point, idx) => {
      tempCtx.globalAlpha = opacity;
      tempCtx.beginPath();
      // Converter coordenadas globais -> locais do temp canvas
      const localX = point.x - cx + margin + w / 2;
      const localY = point.y - cy + margin + h / 2;
      tempCtx.arc(localX, localY, radius, 0, Math.PI * 2);
      tempCtx.fillStyle = 'black';
      tempCtx.fill();
      
      if (idx > 0) {
        const prevPoint = stroke.points[idx - 1];
        const prevLocalX = prevPoint.x - cx + margin + w / 2;
        const prevLocalY = prevPoint.y - cy + margin + h / 2;
        tempCtx.beginPath();
        tempCtx.moveTo(prevLocalX, prevLocalY);
        tempCtx.lineTo(localX, localY);
        tempCtx.strokeStyle = 'black';
        tempCtx.lineWidth = stroke.size || 15;
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';
        tempCtx.globalAlpha = opacity;
        tempCtx.stroke();
      }
    });
  });
  
  // Desenhar resultado no canvas principal
  mainCtx.drawImage(tempCanvas, -margin - w / 2, -margin - h / 2);
}

// Helper para aplicar borracha de forma isolada
// Renderiza o conteúdo em um canvas temporário, aplica a máscara, e desenha no canvas principal
function applyEraserToElement(
  mainCtx: CanvasRenderingContext2D,
  elementBounds: { x: number; y: number; w: number; h: number },
  eraserStrokes: { id: string; points: { x: number; y: number }[]; size: number; opacity: number }[],
  renderContent: (tempCtx: CanvasRenderingContext2D) => void
) {
  const { x, y, w, h } = elementBounds;
  
  // Criar canvas temporário para este elemento
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  
  // Renderizar o conteúdo do elemento no canvas temporário
  tempCtx.save();
  tempCtx.translate(-x, -y); // Ajustar para coordenadas locais
  renderContent(tempCtx);
  tempCtx.restore();
  
  // Aplicar borracha no canvas temporário
  if (eraserStrokes && eraserStrokes.length > 0) {
    tempCtx.save();
    tempCtx.globalCompositeOperation = 'destination-out';
    
    eraserStrokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      
      const radius = (stroke.size || 15) / 2;
      const opacity = (stroke.opacity || 100) / 100;
      
      stroke.points.forEach((point, idx) => {
        tempCtx.globalAlpha = opacity;
        tempCtx.beginPath();
        tempCtx.arc(point.x - x, point.y - y, radius, 0, Math.PI * 2);
        tempCtx.fillStyle = 'black';
        tempCtx.fill();
        
        if (idx > 0) {
          const prevPoint = stroke.points[idx - 1];
          tempCtx.beginPath();
          tempCtx.moveTo(prevPoint.x - x, prevPoint.y - y);
          tempCtx.lineTo(point.x - x, point.y - y);
          tempCtx.strokeStyle = 'black';
          tempCtx.lineWidth = stroke.size || 15;
          tempCtx.lineCap = 'round';
          tempCtx.lineJoin = 'round';
          tempCtx.globalAlpha = opacity;
          tempCtx.stroke();
        }
      });
    });
    
    tempCtx.globalCompositeOperation = 'source-over';
    tempCtx.restore();
  }
  
  // Desenhar o resultado no canvas principal
  mainCtx.drawImage(tempCanvas, x, y);
}

function getDesignPageId(pages: CanvasPage[], pageId: string): string {
  const page = pages.find(p => p.id === pageId);
  if (page?.pageKind === 'draft' && page.draftForPageId) return page.draftForPageId;
  return pageId;
}

function getDraftPageForDesign(pages: CanvasPage[], designPageId: string): CanvasPage | undefined {
  return pages.find(p => p.pageKind === 'draft' && p.draftForPageId === designPageId);
}

// --- Rascunho em modo texto
function startDraftTextMode(
  activeElements: DesignElement[],
  onAddToTerminal: ((msg: string) => void) | undefined,
  setDraftImagesList: React.Dispatch<React.SetStateAction<{ id: string; index: number }[]>>,
  setSelectedDraftImageIndex: React.Dispatch<React.SetStateAction<number | null>>,
  setDraftInstruction: React.Dispatch<React.SetStateAction<string>>,
  setShowDraftTextMode: React.Dispatch<React.SetStateAction<boolean>>
) {
  const images = activeElements.filter(el => el.type === 'image');
  if (images.length === 0) {
    onAddToTerminal?.('❌ Nenhuma imagem encontrada no canvas para criar rascunho.');
    return;
  }
  const imagesList = images.map((img, idx) => ({ id: img.id, index: idx + 1 }));
  setDraftImagesList(imagesList);
  setSelectedDraftImageIndex(null);
  setDraftInstruction('');
  setShowDraftTextMode(true);
  onAddToTerminal?.(`📋 Rascunho em modo texto iniciado. ${images.length} imagem(ns) encontrada(s).`);
}

function renderPageToDataURL(page: CanvasPage): string | null {
  // This function is deprecated - use performExportPage instead
  // Kept for backward compatibility but returns null
  return null;
}

function pointsToPath(points?: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// Shared word-wrap helper — mirrors CSS `white-space: pre-wrap` + `overflow-wrap: break-word`.
// Splits each \n-separated raw line into words, joining them with a single space (no trailing
// spaces), which matches how the browser collapses whitespace at line-break boundaries.
function wrapTextToLines(text: string, ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
  const result: string[] = [];
  const rawLines = text.split('\n');
  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) { result.push(''); continue; }
    let current = '';
    for (const word of words) {
      const test = current === '' ? word : current + ' ' + word;
      if (current !== '' && ctx.measureText(test).width > maxWidth) {
        result.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current !== '') result.push(current);
  }
  return result;
}

function measureTextLines(text: string, fontSize: number, fontFamily: string, fontWeight: string, fontStyle: string, maxWidth: number): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
  return wrapTextToLines(text, ctx, maxWidth).length;
}

type DeformCornerKey = 'tl' | 'tr' | 'br' | 'bl';
type DeformCorners = NonNullable<DesignElement['deformCorners']>;

function createDefaultDeformCorners(w: number, h: number): DeformCorners {
  return {
    tl: { x: 0, y: 0 },
    tr: { x: w, y: 0 },
    br: { x: w, y: h },
    bl: { x: 0, y: h },
  };
}

function getDeformCorners(el: DesignElement): DeformCorners {
  return el.deformCorners ?? createDefaultDeformCorners(el.w, el.h);
}

function supportsDeform(el: DesignElement): boolean {
  return el.type === 'text' || el.type === 'image';
}

function isDefaultDeformCorners(corners: DeformCorners, w: number, h: number): boolean {
  const eps = 0.5;
  const def = createDefaultDeformCorners(w, h);
  return (
    Math.abs(corners.tl.x - def.tl.x) < eps && Math.abs(corners.tl.y - def.tl.y) < eps &&
    Math.abs(corners.tr.x - def.tr.x) < eps && Math.abs(corners.tr.y - def.tr.y) < eps &&
    Math.abs(corners.br.x - def.br.x) < eps && Math.abs(corners.br.y - def.br.y) < eps &&
    Math.abs(corners.bl.x - def.bl.x) < eps && Math.abs(corners.bl.y - def.bl.y) < eps
  );
}

function computeCssMatrix3d(corners: DeformCorners, w: number, h: number): string | undefined {
  if (isDefaultDeformCorners(corners, w, h)) return undefined;

  const x0 = corners.tl.x, y0 = corners.tl.y;
  const x1 = corners.tr.x, y1 = corners.tr.y;
  const x2 = corners.br.x, y2 = corners.br.y;
  const x3 = corners.bl.x, y3 = corners.bl.y;

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-8) return undefined;

  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h_ = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h_ * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h_ * y3;
  const f = y0;

  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${h_ / h},0,0,1,0,${c},${f},0,1)`;
}

function clientToElementLocal(
  el: DesignElement,
  clientX: number,
  clientY: number,
  zoom: number,
  canvasEl: HTMLDivElement | null
): { x: number; y: number } {
  if (!canvasEl) return { x: 0, y: 0 };
  const rect = canvasEl.getBoundingClientRect();
  const canvasX = (clientX - rect.left) / zoom;
  const canvasY = (clientY - rect.top) / zoom;
  const relX = canvasX - el.x;
  const relY = canvasY - el.y;
  const cx = el.w / 2;
  const cy = el.h / 2;
  const rad = (-el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cos * (relX - cx) - sin * (relY - cy) + cx,
    y: sin * (relX - cx) + cos * (relY - cy) + cy,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: { x: number; y: number },
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  d0: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number }
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-6) { ctx.restore(); return; }

  const m11 = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const m12 = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const m21 = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denom;
  const m22 = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denom;
  const dx = d0.x - m11 * s0.x - m21 * s0.y;
  const dy = d0.y - m12 * s0.x - m22 * s0.y;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function drawPlainTextToOffscreen(
  octx: CanvasRenderingContext2D,
  el: DesignElement,
  w: number,
  h: number
): void {
  console.log('[drawPlainTextToOffscreen] textCurve:', el.textCurve);
  
  const fontFamilyClean = (el.fontFamily || 'Inter').replace(/['"]/g, '').trim();
  const fontFamily = fontFamilyClean.includes(' ') ? `"${fontFamilyClean}"` : fontFamilyClean;
  octx.font = `${el.fontStyle || 'normal'} ${el.fontWeight || '400'} ${el.fontSize || 16}px ${fontFamily}`;
  octx.textBaseline = 'top';

  const maxTextWidth = Math.max(1, w - 8);
  const lines = wrapTextToLines(el.text || '', octx, maxTextWidth);
  const fontSize = el.fontSize || 16;
  const lineHeight = fontSize * 1.4;
  const halfLead = (lineHeight - fontSize) / 2;

  // Se tem curvatura, desenha texto curvado
  if (el.textCurve && el.textCurve !== 0) {
    console.log('[drawPlainTextToOffscreen] Usando texto curvado!');
    drawCurvedText(octx, el, w, h, lines, fontSize, lineHeight, halfLead);
    return;
  }

  // Desenha texto reto normal
  lines.forEach((line, index) => {
    let startX = 4;
    if (el.textAlign === 'center') startX = w / 2;
    else if (el.textAlign === 'right') startX = w - 4;

    const startY = 2 + halfLead + index * lineHeight;
    const strokeWidthVal = el.textStrokeWidth && el.textStrokeWidth > 0
      ? el.textStrokeWidth
      : (el.textHollowEnabled ? 1.5 : 0);

    if (el.textShadowOffsetX || el.textShadowOffsetY) {
      octx.shadowColor = el.textShadowColor || 'rgba(0,0,0,0.5)';
      octx.shadowBlur = el.textShadowBlur ?? 4;
      octx.shadowOffsetX = el.textShadowOffsetX ?? 0;
      octx.shadowOffsetY = el.textShadowOffsetY ?? 0;
    }

    if (strokeWidthVal > 0) {
      octx.strokeStyle = el.textStrokeColor || '#000000';
      octx.lineWidth = el.textHollowEnabled ? strokeWidthVal : strokeWidthVal * 2;
      octx.textAlign = el.textAlign || 'center';
      octx.strokeText(line, startX, startY);
    }

    if (!el.textHollowEnabled) {
      octx.fillStyle = el.textColor || '#1a1a2e';
      octx.textAlign = el.textAlign || 'center';
      octx.fillText(line, startX, startY);
    }

    octx.shadowColor = 'transparent';
    octx.shadowBlur = 0;
    octx.shadowOffsetX = 0;
    octx.shadowOffsetY = 0;
  });
}

function drawCurvedText(
  octx: CanvasRenderingContext2D,
  el: DesignElement,
  w: number,
  h: number,
  lines: string[],
  fontSize: number,
  lineHeight: number,
  halfLead: number
): void {
  const curveDegrees = el.textCurve || 0;
  const strokeWidthVal = el.textStrokeWidth && el.textStrokeWidth > 0
    ? el.textStrokeWidth
    : (el.textHollowEnabled ? 1.5 : 0);

  octx.textBaseline = 'middle';
  octx.textAlign = 'center';

  lines.forEach((line, lineIndex) => {
    const text = line;
    if (!text) return;
    
    const chars = text.split('');
    
    // Se curvatura muito pequena, não faz nada (deixa drawPlainTextToOffscreen desenhar reto)
    if (Math.abs(curveDegrees) < 1) return;
    
    // Configura a fonte primeiro
    const fontFamilyClean = (el.fontFamily || 'Inter').replace(/['"]/g, '').trim();
    const fontFamily = fontFamilyClean.includes(' ') ? `"${fontFamilyClean}"` : fontFamilyClean;
    octx.font = `${el.fontStyle || 'normal'} ${el.fontWeight || '400'} ${fontSize}px ${fontFamily}`;
    
    const textWidth = octx.measureText(text).width;
    
    // Raio do arco - quanto maior a curvatura, mais fechado o arco
    // Fórmula simples: divide largura do texto pelo fator de curvatura
    const curveFactor = Math.abs(curveDegrees) / 180; // 0 a 1
    const radius = textWidth / (curveFactor * 2); // Raio inversamente proporcional à curvatura
    
    // Posição do centro do círculo
    const cx = w / 2;
    const cy = curveDegrees > 0 ? h / 2 + radius : h / 2 - radius;
    
    // Ângulo total que o texto vai ocupar
    const totalAngle = textWidth / radius;
    
    // Começa do lado esquerdo do texto
    let angle = -totalAngle / 2;

    // Shadow
    if (el.textShadowOffsetX || el.textShadowOffsetY) {
      octx.shadowColor = el.textShadowColor || 'rgba(0,0,0,0.5)';
      octx.shadowBlur = el.textShadowBlur ?? 4;
      octx.shadowOffsetX = el.textShadowOffsetX ?? 0;
      octx.shadowOffsetY = el.textShadowOffsetY ?? 0;
    }

    // Desenha cada caractere
    chars.forEach((char) => {
      const charWidth = octx.measureText(char).width;
      const charAngle = charWidth / radius;
      
      // Calcula posição deste caractere no arco
      const charCenterAngle = angle + charAngle / 2;
      
      // Posição X,Y no círculo
      const x = cx + Math.sin(charCenterAngle) * radius;
      const y = cy - Math.cos(charCenterAngle) * radius + lineIndex * lineHeight;
      
      octx.save();
      octx.translate(x, y);
      octx.rotate(charCenterAngle); // Rotaciona o caractere

      // Desenha stroke
      if (strokeWidthVal > 0) {
        octx.strokeStyle = el.textStrokeColor || '#000000';
        octx.lineWidth = el.textHollowEnabled ? strokeWidthVal : strokeWidthVal * 2;
        octx.strokeText(char, 0, 0);
      }

      // Desenha fill
      if (!el.textHollowEnabled) {
        octx.fillStyle = el.textColor || '#1a1a2e';
        octx.fillText(char, 0, 0);
      }

      octx.restore();
      
      angle += charAngle; // Avança para o próximo caractere
    });

    octx.shadowColor = 'transparent';
    octx.shadowBlur = 0;
    octx.shadowOffsetX = 0;
    octx.shadowOffsetY = 0;
  });
}

function drawWarpedOffscreenOnCanvas(
  ctx: CanvasRenderingContext2D,
  offscreen: HTMLCanvasElement,
  corners: DeformCorners,
  offsetX: number,
  offsetY: number
): void {
  const w = offscreen.width;
  const h = offscreen.height;
  // Restore original high slice count — necessary for accurate perspective approximation
  const slices = Math.max(24, Math.ceil(Math.max(w, h) / 4));

  // Element-center-relative corners
  const pts = [
    { x: corners.tl.x + offsetX, y: corners.tl.y + offsetY },
    { x: corners.tr.x + offsetX, y: corners.tr.y + offsetY },
    { x: corners.br.x + offsetX, y: corners.br.y + offsetY },
    { x: corners.bl.x + offsetX, y: corners.bl.y + offsetY },
  ];

  // Get full CTM (includes translate+rotate already applied to ctx)
  const ctm = ctx.getTransform();

  // Transform corners to screen-space to find bounding box for intermediate canvas
  const sx = pts.map(p => ctm.a * p.x + ctm.c * p.y + ctm.e);
  const sy = pts.map(p => ctm.b * p.x + ctm.d * p.y + ctm.f);
  const bx0 = Math.floor(Math.min(...sx)) - 2;
  const by0 = Math.floor(Math.min(...sy)) - 2;
  const bx1 = Math.ceil(Math.max(...sx)) + 2;
  const by1 = Math.ceil(Math.max(...sy)) + 2;
  const bw = Math.max(1, bx1 - bx0);
  const bh = Math.max(1, by1 - by0);

  // Intermediate TRANSPARENT canvas in screen-space coordinates.
  // Drawing triangles here avoids the "colored background shows through clip boundary" artifact:
  // adjacent triangle anti-aliased edges complement each other on transparent bg instead of gapping.
  const inter = document.createElement('canvas');
  inter.width = bw;
  inter.height = bh;
  const ictx = inter.getContext('2d')!;
  // High-quality interpolation avoids blocky pixels during perspective warp
  ictx.imageSmoothingEnabled = true;
  ictx.imageSmoothingQuality = 'high';

  // Apply same CTM to intermediate canvas, shifted by the bounding box origin
  ictx.setTransform(ctm.a, ctm.b, ctm.c, ctm.d, ctm.e - bx0, ctm.f - by0);

  // Pixel overlap between adjacent slices to eliminate anti-aliasing seam artifacts
  const sliceOverlap = 1.5;

  for (let i = 0; i < slices; i++) {
    const t0 = i / slices;
    const t1 = (i + 1) / slices;
    const srcY = t0 * h;
    // Extend source slice slightly beyond boundary to cover anti-aliasing gap
    const srcSliceH = h / slices + (i < slices - 1 ? sliceOverlap : 0);

    const lx0 = lerp(corners.tl.x, corners.bl.x, t0) + offsetX;
    const ly0 = lerp(corners.tl.y, corners.bl.y, t0) + offsetY;
    const lx1 = lerp(corners.tl.x, corners.bl.x, t1) + offsetX;
    const ly1 = lerp(corners.tl.y, corners.bl.y, t1) + offsetY;
    const rx0 = lerp(corners.tr.x, corners.br.x, t0) + offsetX;
    const ry0 = lerp(corners.tr.y, corners.br.y, t0) + offsetY;
    const rx1 = lerp(corners.tr.x, corners.br.x, t1) + offsetX;
    const ry1 = lerp(corners.tr.y, corners.br.y, t1) + offsetY;

    // Extend destination bottom edge proportionally to match the src overlap
    const overlapFrac = sliceOverlap / h;
    const lx1e = lx1 + (lx1 - lx0) * overlapFrac * slices;
    const ly1e = ly1 + (ly1 - ly0) * overlapFrac * slices;
    const rx1e = rx1 + (rx1 - rx0) * overlapFrac * slices;
    const ry1e = ry1 + (ry1 - ry0) * overlapFrac * slices;
    const bottomLX = i < slices - 1 ? lx1e : lx1;
    const bottomLY = i < slices - 1 ? ly1e : ly1;
    const bottomRX = i < slices - 1 ? rx1e : rx1;
    const bottomRY = i < slices - 1 ? ry1e : ry1;

    drawTexturedTriangle(ictx, offscreen,
      { x: 0, y: srcY }, { x: w, y: srcY }, { x: w, y: srcY + srcSliceH },
      { x: lx0, y: ly0 }, { x: rx0, y: ry0 }, { x: bottomRX, y: bottomRY }
    );
    drawTexturedTriangle(ictx, offscreen,
      { x: 0, y: srcY }, { x: w, y: srcY + srcSliceH }, { x: 0, y: srcY + srcSliceH },
      { x: lx0, y: ly0 }, { x: bottomRX, y: bottomRY }, { x: bottomLX, y: bottomLY }
    );
  }

  // Composite intermediate canvas back at screen coordinates (identity CTM)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(inter, bx0, by0);
  ctx.restore();
}

function drawPlainImageToOffscreen(
  octx: CanvasRenderingContext2D,
  loadedImg: HTMLImageElement,
  el: DesignElement,
  w: number,
  h: number
): void {
  const brightness = el.brightness ?? 100;
  const contrast = el.contrast ?? 100;
  const saturation = el.saturation ?? 100;
  const shadowOffsetX = el.shadowOffsetX ?? 0;
  const shadowOffsetY = el.shadowOffsetY ?? 0;
  const shadowBlur = el.shadowBlur ?? 15;
  const shadowColor = el.shadowColor || 'rgba(0,0,0,0.5)';
  
  octx.filter = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    `saturate(${saturation}%)`,
    `blur(${el.blur ?? 0}px)`,
    `hue-rotate(${el.hueRotate ?? 0}deg)`,
    (shadowOffsetX !== 0 || shadowOffsetY !== 0) ? `drop-shadow(${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor})` : '',
  ].filter(Boolean).join(' ');

  const fit = el.imageObjectFit || 'cover';
  const flipX = el.flipX ? -1 : 1;
  const flipY = el.flipY ? -1 : 1;

  octx.save();
  octx.translate(w / 2, h / 2);
  octx.scale(flipX, flipY);
  octx.translate(-w / 2, -h / 2);

  if (el.cropImgW) {
    octx.beginPath();
    octx.rect(0, 0, w, h);
    octx.clip();
    octx.drawImage(loadedImg, el.cropOffsetX ?? 0, el.cropOffsetY ?? 0, el.cropImgW, el.cropImgH ?? el.h);
  } else if (fit === 'fill') {
    octx.drawImage(loadedImg, 0, 0, w, h);
  } else {
    const imgW = loadedImg.width;
    const imgH = loadedImg.height;
    const imgRatio = imgW / imgH;
    const boxRatio = w / h;

    if (fit === 'cover') {
      let srcX = 0, srcY = 0, srcW = imgW, srcH = imgH;
      if (imgRatio > boxRatio) {
        srcW = imgH * boxRatio;
        srcX = (imgW - srcW) / 2;
      } else {
        srcH = imgW / boxRatio;
        srcY = (imgH - srcH) / 2;
      }
      octx.drawImage(loadedImg, srcX, srcY, srcW, srcH, 0, 0, w, h);
    } else if (imgRatio > boxRatio) {
      const drawH = w / imgRatio;
      octx.drawImage(loadedImg, 0, (h - drawH) / 2, w, drawH);
    } else {
      const drawW = h * imgRatio;
      octx.drawImage(loadedImg, (w - drawW) / 2, 0, drawW, h);
    }
  }

  octx.restore();
  octx.filter = 'none';

  const vignette = el.vignette ?? 0;
  if (vignette > 0) {
    const grad = octx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${vignette / 100})`);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, w, h);
  }

  const noiseIntensity = el.noiseIntensity ?? 0;
  if (noiseIntensity > 0) {
    const imageData = octx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const amount = noiseIntensity * 0.6; // Reduced intensity for subtler effect
    
    for (let i = 0; i < data.length; i += 4) {
      // Generate fine grain noise with lower amplitude
      const grain = (Math.random() - 0.5) * amount;
      data[i] = Math.max(0, Math.min(255, data[i] + grain));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain)); // B
    }
    
    octx.putImageData(imageData, 0, 0);
  }
}

function drawWarpedTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  el: DesignElement,
  corners: DeformCorners,
  offsetX: number,
  offsetY: number
): void {
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.round(el.w));
  offscreen.height = Math.max(1, Math.round(el.h));
  const octx = offscreen.getContext('2d');
  if (!octx) return;

  drawPlainTextToOffscreen(octx, el, offscreen.width, offscreen.height);
  drawWarpedOffscreenOnCanvas(ctx, offscreen, corners, offsetX, offsetY);
}

function drawWarpedImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  el: DesignElement,
  loadedImg: HTMLImageElement,
  corners: DeformCorners,
  offsetX: number,
  offsetY: number
): void {
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.round(el.w));
  offscreen.height = Math.max(1, Math.round(el.h));
  const octx = offscreen.getContext('2d');
  if (!octx) return;

  drawPlainImageToOffscreen(octx, loadedImg, el, offscreen.width, offscreen.height);
  drawWarpedOffscreenOnCanvas(ctx, offscreen, corners, offsetX, offsetY);
}

// ── SVG ASSETS GENERATORS FOR DYNAMIC COLORS ────────────────
export function getFadeSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getDegradeSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getGlowSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getXadrezSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <defs>
    <pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="${color}" fill-opacity="0.5"/>
      <rect x="10" y="10" width="10" height="10" fill="${color}" fill-opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getDotsSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <defs>
    <pattern id="p" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="15" r="2" fill="${color}"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getFadeInferiorSVG(color: string): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
  <defs>
    <radialGradient id="g" cx="50%" cy="100%" r="55%">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="25%" stop-color="${color}" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="${color}" stop-opacity="0.4"/>
      <stop offset="75%" stop-color="${color}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ── OVERLAY SVG DISPATCHER ─────────────────────────────────

export function getOverlaySVG(type: string, color: string): string {
  const b = (s: string) => `data:image/svg+xml;base64,${btoa(s)}`;
  const lg = (x1:number,y1:number,x2:number,y2:number,stops?:string) => b(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops||`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const rg = (cx:string,cy:string,r:string,stops?:string) => b(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${r}">${stops||`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`}</radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const pat = (w:number,h:number,inner:string) => b(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><pattern id="p" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${inner}</pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`);

  switch(type) {
    // Fades
    case 'fade': return getFadeSVG(color);
    case 'fade-inferior': return getFadeInferiorSVG(color);
    case 'fade-left': return lg(0,0,1,0);
    case 'fade-right': return lg(1,0,0,0);
    case 'fade-bottom': return lg(0,1,0,0);
    case 'fade-radial': return rg('50%','50%','50%');
    case 'fade-diag-tl': return rg('0%','0%','100%',`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="55%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'fade-diag-tr': return rg('100%','0%','100%',`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="55%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'fade-diag-bl': return rg('0%','100%','100%',`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="55%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'fade-diag-br': return rg('100%','100%','100%',`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="55%" stop-color="${color}" stop-opacity="0.25"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'fade-duplo-v': return lg(0,0,0,1,`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="35%" stop-color="${color}" stop-opacity="0"/><stop offset="65%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="1"/>`);
    case 'fade-duplo-h': return lg(0,0,1,0,`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="35%" stop-color="${color}" stop-opacity="0"/><stop offset="65%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="1"/>`);
    // Degradês
    case 'degrade': return getDegradeSVG(color);
    case 'degrade-horizontal': return lg(0,0,1,0,`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="50%" stop-color="${color}" stop-opacity="0.4"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'degrade-vertical': return lg(0,0,0,1,`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="50%" stop-color="${color}" stop-opacity="0.4"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'degrade-radial': return rg('50%','50%','50%',`<stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="55%" stop-color="${color}" stop-opacity="0.4"/><stop offset="100%" stop-color="${color}" stop-opacity="1"/>`);
    case 'degrade-tricolor': return lg(0,0,1,1,`<stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="50%" stop-color="${color}" stop-opacity="0.5"/><stop offset="100%" stop-color="${color}" stop-opacity="0.12"/>`);
    // Glows
    case 'glow': return getGlowSVG(color);
    case 'glow-top': return rg('50%','0%','60%',`<stop offset="0%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'glow-bottom': return rg('50%','100%','60%',`<stop offset="0%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'glow-neon': return rg('50%','50%','50%',`<stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="55%" stop-color="${color}" stop-opacity="0"/><stop offset="72%" stop-color="${color}" stop-opacity="0.85"/><stop offset="85%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>`);
    case 'glow-dual': return b(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><defs><radialGradient id="a" cx="25%" cy="30%" r="40%"><stop offset="0%" stop-color="${color}" stop-opacity="0.7"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient><radialGradient id="b" cx="75%" cy="70%" r="40%"><stop offset="0%" stop-color="${color}" stop-opacity="0.7"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#a)"/><rect width="100%" height="100%" fill="url(#b)"/></svg>`);
    // Padrões
    case 'xadrez': return getXadrezSVG(color);
    case 'dots': return getDotsSVG(color);
    case 'stripes': return b(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><pattern id="p" width="14.14" height="14.14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14.14" fill="${color}" fill-opacity="0.45"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`);
    case 'stripes-h': return pat(200,12,`<rect width="200" height="5" fill="${color}" fill-opacity="0.4"/>`);
    case 'stripes-v': return pat(12,200,`<rect width="5" height="200" fill="${color}" fill-opacity="0.4"/>`);
    case 'grid': return pat(25,25,`<path d="M 25 0 L 0 0 0 25" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.35"/>`);
    case 'zigzag': return pat(40,20,`<polyline points="0,10 10,0 20,10 30,0 40,10" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.45"/>`);
    case 'waves': return pat(60,20,`<path d="M 0 10 Q 15 0, 30 10 Q 45 20, 60 10" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.4"/>`);
    case 'hexgrid': return pat(28,49,`<path d="M14,0 L28,12.25 L28,36.75 L14,49 L0,36.75 L0,12.25 Z" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.3"/>`);
    case 'diamonds': return pat(24,24,`<polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.35"/>`);
    case 'cross-pattern': return pat(20,20,`<line x1="10" y1="4" x2="10" y2="16" stroke="${color}" stroke-width="2" stroke-opacity="0.35"/><line x1="4" y1="10" x2="16" y2="10" stroke="${color}" stroke-width="2" stroke-opacity="0.35"/>`);
    case 'triangles-pattern': return pat(30,26,`<polygon points="15,2 28,24 2,24" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.35"/>`);
    // Texturas
    case 'noise': return b(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs><rect width="100%" height="100%" filter="url(#n)" opacity="0.15"/><rect width="100%" height="100%" fill="${color}" fill-opacity="0.08"/></svg>`);
    case 'scanlines': return pat(200,4,`<rect width="200" height="2" fill="${color}" fill-opacity="0.12"/>`);
    case 'halftone': return pat(10,10,`<circle cx="5" cy="5" r="2.5" fill="${color}" fill-opacity="0.25"/>`);
    case 'duotone': return lg(0,0,1,1,`<stop offset="0%" stop-color="${color}" stop-opacity="0.7"/><stop offset="100%" stop-color="${color}" stop-opacity="0.15"/>`);
    case 'vignette-overlay': return rg('50%','50%','50%',`<stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="65%" stop-color="${color}" stop-opacity="0.2"/><stop offset="100%" stop-color="${color}" stop-opacity="0.85"/>`);
    default: return getFadeSVG(color);
  }
}

// ── OVERLAY ELEMENTS DATA ──────────────────────────────────

interface OverlayElementDef {
  name: string;
  type: string;
  defColor: string;
  category: string;
  multicolor?: boolean;
}

const OVERLAY_ELEMENTS: OverlayElementDef[] = [
  // Fades
  { name: 'Fade Superior', type: 'fade', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Inferior', type: 'fade-inferior', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Esquerda', type: 'fade-left', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Direita', type: 'fade-right', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Baixo', type: 'fade-bottom', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Radial', type: 'fade-radial', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Canto ↗', type: 'fade-diag-tl', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Canto ↖', type: 'fade-diag-tr', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Canto ↘', type: 'fade-diag-bl', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Canto ↙', type: 'fade-diag-br', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Duplo V', type: 'fade-duplo-v', defColor: '#7c5cfc', category: 'Fades' },
  { name: 'Fade Duplo H', type: 'fade-duplo-h', defColor: '#7c5cfc', category: 'Fades' },
  // Degradês
  { name: 'Degradê Diagonal', type: 'degrade', defColor: '#7c5cfc', category: 'Degradês' },
  { name: 'Degradê Horizontal', type: 'degrade-horizontal', defColor: '#7c5cfc', category: 'Degradês' },
  { name: 'Degradê Vertical', type: 'degrade-vertical', defColor: '#7c5cfc', category: 'Degradês' },
  { name: 'Degradê Radial', type: 'degrade-radial', defColor: '#7c5cfc', category: 'Degradês' },
  { name: 'Degradê Tricolor', type: 'degrade-tricolor', defColor: '#7c5cfc', category: 'Degradês' },
  // Glows
  { name: 'Glow Central', type: 'glow', defColor: '#7c5cfc', category: 'Glows' },
  { name: 'Glow Superior', type: 'glow-top', defColor: '#7c5cfc', category: 'Glows' },
  { name: 'Glow Inferior', type: 'glow-bottom', defColor: '#7c5cfc', category: 'Glows' },
  { name: 'Glow Neon', type: 'glow-neon', defColor: '#00ff88', category: 'Glows' },
  { name: 'Glow Dual', type: 'glow-dual', defColor: '#7c5cfc', category: 'Glows' },
  { name: 'Glow Multicolor', type: 'glow-multicolor', defColor: '', category: 'Glows', multicolor: true },
  // Padrões
  { name: 'Xadrez', type: 'xadrez', defColor: '#e0e0e0', category: 'Padrões' },
  { name: 'Pontos', type: 'dots', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Listras Diagonal', type: 'stripes', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Listras Horizontal', type: 'stripes-h', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Listras Vertical', type: 'stripes-v', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Grade', type: 'grid', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Zigzag', type: 'zigzag', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Ondas', type: 'waves', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Hexagonal', type: 'hexgrid', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Losangos', type: 'diamonds', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Cruzes', type: 'cross-pattern', defColor: '#7c5cfc', category: 'Padrões' },
  { name: 'Triângulos', type: 'triangles-pattern', defColor: '#7c5cfc', category: 'Padrões' },
  // Texturas
  { name: 'Ruído', type: 'noise', defColor: '#ffffff', category: 'Texturas' },
  { name: 'Scanlines', type: 'scanlines', defColor: '#000000', category: 'Texturas' },
  { name: 'Halftone', type: 'halftone', defColor: '#7c5cfc', category: 'Texturas' },
  { name: 'Duotone', type: 'duotone', defColor: '#7c5cfc', category: 'Texturas' },
  { name: 'Vinheta', type: 'vignette-overlay', defColor: '#000000', category: 'Texturas' },
];

// ── SVG ASSETS FOR ELEMENTS ────────────────────────────────
const FADE_SVG = getFadeSVG('#7c5cfc');
const DEGRADE_SVG = getDegradeSVG('#7c5cfc');
const XADREZ_SVG = getXadrezSVG('#e0e0e0');
const GLOW_SVG = getGlowSVG('#7c5cfc');
const DOTS_SVG = getDotsSVG('rgba(124, 92, 252, 0.4)');
const FADE_INFERIOR_SVG = getFadeInferiorSVG('#7c5cfc');

const GLOW_MULTICOLOR_SVG = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9d7dff" stop-opacity="0.8"/>
      <stop offset="45%" stop-color="#ff007f" stop-opacity="0.4"/>
      <stop offset="75%" stop-color="#00f2fe" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#00f2fe" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`.trim())}`;

function hexToNormalizedRGB(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }
  return {
    r: Number((r / 255).toFixed(4)),
    g: Number((g / 255).toFixed(4)),
    b: Number((b / 255).toFixed(4)),
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export interface PhotoEditorRef {
  getEditorState: () => any;
  applyAIAction: (action: string, payload: any) => string;
  getDraftVisionContent: () => { text: string; imageDataUrl: string } | null;
  getCanvasSnapshot: () => Promise<string | null>;
  loadProjectById: (projectId: string) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════
// TOGGLE SWITCH COMPONENT
// ═══════════════════════════════════════════════════════════
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked
          ? 'linear-gradient(135deg, #7c5cfc, #a78bfa)'
          : 'rgba(255,255,255,0.12)',
        border: checked ? '1.5px solid #7c5cfc' : '1.5px solid rgba(255,255,255,0.18)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.22s, border-color 0.22s',
        boxShadow: checked ? '0 0 8px rgba(124,92,252,0.45)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: checked ? '#fff' : 'rgba(255,255,255,0.5)',
        transition: 'left 0.22s cubic-bezier(.4,0,.2,1), background 0.22s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

const PhotoEditor = React.forwardRef<PhotoEditorRef, PhotoEditorProps>(({ activeProject, onAddToTerminal, onSendToAI, onProjectAction, onUpdatePreview }, ref) => {
  // ── Multi-Page State ──────────────────────────────────
  const [pages, setPages] = useState<CanvasPage[]>([{
    id: 'page-1',
    name: 'Canvas 1',
    w: 1280,
    h: 720,
    bg: '#ffffff',
    elements: [],
    zCounter: 1,
    x: 0,
    y: 0,
    pageKind: 'design',
  }]);
  // ── History (per page) ────────────────────────────────
  // Map<pageId, { stack: snap[], idx: number }>
  const historyMapRef = useRef<Map<string, { stack: { elements: DesignElement[]; bg: string }[]; idx: number }>>(new Map([
    ['page-1', { stack: [{ elements: [], bg: '#ffffff' }], idx: 0 }]
  ]));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activePageId, setActivePageId] = useState<string>('page-1');

  // ── Derived from active page ───────────────────────────
  const activePage = pages.find(p => p.id === activePageId) ?? pages[0];
  const canvasW = activePage.w;
  const canvasH = activePage.h;
  const canvasBg = activePage.bg;
  const elements = activePage.elements;
  const zCounter = activePage.zCounter;

  // ── Setters that operate on the active page ────────────
  const setCanvasW = (w: number) => setPages(prev => prev.map(p => p.id === activePageId ? { ...p, w } : p));
  const setCanvasH = (h: number) => setPages(prev => prev.map(p => p.id === activePageId ? { ...p, h } : p));
  const setCanvasBg = (bg: string) => setPages(prev => prev.map(p => p.id === activePageId ? { ...p, bg } : p));
  const setElements = (updater: DesignElement[] | ((prev: DesignElement[]) => DesignElement[])) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p;
      const next = typeof updater === 'function' ? updater(p.elements) : updater;
      return { ...p, elements: next };
    }));
  };
  const setZCounter = (updater: number | ((prev: number) => number)) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p;
      const next = typeof updater === 'function' ? updater(p.zCounter) : updater;
      return { ...p, zCounter: next };
    }));
  };

  const [designTitle, setDesignTitle] = useState('Design sem título');

  // ── Selection ─────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  const canvasDragRef = useRef<{
    active: boolean;
    pageId: string | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    pageId: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });



  // ── Viewport ─────────────────────────────────────────
  const [zoom, setZoom] = useState(0.25);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // ── UI State ─────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<SidePanel>('templates');
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [carouselCount, setCarouselCount] = useState(4);
  const [carouselFormat, setCarouselFormat] = useState<'square' | 'portrait' | 'landscape'>('square');
  const [carouselViewSlice, setCarouselViewSlice] = useState<number | null>(null);

  // ── Reference panel (Google Images) ──────────────────────
  const [showRefSearch, setShowRefSearch] = useState(false);
  const [refQuery, setRefQuery] = useState('');
  const [refSearchPos, setRefSearchPos] = useState({ x: 120, y: 60 });
  const [refSearchSize, setRefSearchSize] = useState({ w: 700, h: 520 });
  const refSearchDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refSearchResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const refWebviewRef = useRef<any>(null);
  const [refWebviewUrl, setRefWebviewUrl] = useState('about:blank'); // Persiste a URL
  const [refPanel, setRefPanel] = useState<{ src: string; x: number; y: number; w: number; h: number; zoom: number } | null>(null);
  const refDragRef2 = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refResizeRef2 = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  // Mini choice menu after clicking image
  const [refChoiceMenu, setRefChoiceMenu] = useState<{ dataUrl: string; x: number; y: number } | null>(null);

  // ── Color theory palette states ────────────────────────────
  const [showPaletteBox, setShowPaletteBox] = useState(false);
  const [activePalette, setActivePalette] = useState<string[] | null>(null);
  const [paletteLocked, setPaletteLocked] = useState(false);
  const [paletteActiveColor, setPaletteActiveColor] = useState<string | null>(null);
  const [imageColorSlots, setImageColorSlots] = useState<{ id: string; label: string; colors: string[]; locked: boolean; offsetX: number; offsetY: number; w: number; h: number }[]>([]);
  const slotDragRef = useRef<{ id: string; startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const slotResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

  // ── Color extraction (K-means) ────────────────────────────
  const extractColors = (src: string, count = 8): Promise<string[]> => {
    return new Promise(resolve => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cvs = document.createElement('canvas');
        const size = 80;
        cvs.width = size; cvs.height = size;
        const ctx = cvs.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const pixels: [number,number,number][] = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] < 128) continue;
          pixels.push([data[i], data[i+1], data[i+2]]);
        }
        const toHex = (r: number, g: number, b: number) =>
          '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
        const step = Math.max(1, Math.floor(pixels.length / (count * 8)));
        const sampled = pixels.filter((_, i) => i % step === 0);
        if (sampled.length === 0) { resolve([]); return; }
        let centers = sampled.slice(0, count).map(p => [...p] as [number,number,number]);
        for (let iter = 0; iter < 10; iter++) {
          const clusters: [number,number,number][][] = Array.from({length: count}, () => []);
          for (const p of sampled) {
            let best = 0, bestD = Infinity;
            for (let k = 0; k < count; k++) {
              const d = (p[0]-centers[k][0])**2 + (p[1]-centers[k][1])**2 + (p[2]-centers[k][2])**2;
              if (d < bestD) { bestD = d; best = k; }
            }
            clusters[best].push(p);
          }
          for (let k = 0; k < count; k++) {
            if (clusters[k].length === 0) continue;
            const avg = clusters[k].reduce((a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]] as [number,number,number], [0,0,0] as [number,number,number]);
            centers[k] = [avg[0]/clusters[k].length, avg[1]/clusters[k].length, avg[2]/clusters[k].length];
          }
        }
        resolve(centers.map(c => toHex(c[0], c[1], c[2])));
      };
      img.onerror = () => resolve([]);
      img.src = src;
    });
  };

  const addImageColorSlot = async (src: string, label: string) => {
    const id = 'slot_' + Date.now();
    const colors = await extractColors(src, 8);
    if (colors.length > 0) {
      setImageColorSlots(prev => [...prev, { id, label, colors, locked: true, offsetX: 0, offsetY: 0, w: 0, h: 52 }]);
    }
  };

  // Apply palette color: pen, draw mode, selected element, clipboard
  const applyPaletteColor = (c: string) => {
    setPaletteActiveColor(c);
    setPenColor(c); // draw mode brush color
    navigator.clipboard.writeText(c).catch(() => {});
    // If element selected, apply to its color property
    if (selectedId) {
      const el = elements.find(e => e.id === selectedId);
      if (el) {
        if (el.type === 'text') updateElement(selectedId, { textColor: c });
        else if (el.type === 'shape') updateElement(selectedId, { fillColor: c });
        else if (el.type === 'drawing') {/* drawing uses penColor already set above */}
      }
    }
    showToast(`Cor aplicada: ${c}`);
  };

  const doRefSearch = () => {
    const wv = refWebviewRef.current; if (!wv) return;
    const q = refQuery.trim() || 'photo reference art';
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}&hl=pt-BR`;
    wv.src = url;
    setRefWebviewUrl(url); // Salva a URL
  };

  const injectRefClickListener = () => {
    const wv = refWebviewRef.current; if (!wv) return;
    const script = `(function() {
      if (window.__refInjected) return; window.__refInjected = true;
      document.addEventListener('contextmenu', function(e) {
        var el = e.target;
        for (var i = 0; i < 8; i++) {
          if (!el) break;
          if (el.tagName === 'IMG' && el.src && el.src.startsWith('http') && !el.src.includes('google.com') && el.naturalWidth > 50) {
            e.preventDefault(); e.stopPropagation();
            document.title = '__REF_IMG__' + el.src;
            setTimeout(function(){ document.title = document.title.replace('__REF_IMG__',''); }, 100);
            break;
          }
          el = el.parentElement;
        }
      }, true);
    })()`;
    wv.executeJavaScript(script).catch(() => {});
  };

  useEffect(() => {
    if (!showRefSearch) return;
    const timer = setTimeout(() => {
      const wv = refWebviewRef.current; if (!wv) return;
      
      // Restaura a URL salva quando abre o modal novamente
      if (refWebviewUrl && refWebviewUrl !== 'about:blank' && wv.src === 'about:blank') {
        wv.src = refWebviewUrl;
      }
      
      const onLoad = () => setTimeout(injectRefClickListener, 600);
      const onNavigation = (e: any) => {
        // Salva a URL atual quando o usuário navega
        if (e.url && e.url !== 'about:blank') {
          setRefWebviewUrl(e.url);
        }
      };
      const onTitleUpdate = (e: any) => {
        const title: string = e.title || '';
        if (title.startsWith('__REF_IMG__')) {
          const imgUrl = title.replace('__REF_IMG__', '');
          if (imgUrl) {
            (window as any).electronAPI.fetchImageAsDataUrl(imgUrl)
              .then((res: any) => {
                if (res.success && res.dataUrl) {
                  // Show choice menu near the search box
                  const rect = refWebviewRef.current?.getBoundingClientRect();
                  const mx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
                  const my = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
                  setRefChoiceMenu({ dataUrl: res.dataUrl, x: mx - 100, y: my - 50 });
                }
              });
          }
        }
      };
      wv.addEventListener('did-finish-load', onLoad);
      wv.addEventListener('did-navigate', onNavigation);
      wv.addEventListener('did-navigate-in-page', onNavigation);
      wv.addEventListener('page-title-updated', onTitleUpdate);
      injectRefClickListener();
      return () => {
        wv.removeEventListener('did-finish-load', onLoad);
        wv.removeEventListener('did-navigate', onNavigation);
        wv.removeEventListener('did-navigate-in-page', onNavigation);
        wv.removeEventListener('page-title-updated', onTitleUpdate);
      };
    }, 100);
    return () => clearTimeout(timer);
  }, [showRefSearch]);

  // Close choice menu on outside click
  useEffect(() => {
    if (!refChoiceMenu) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('ref-choice-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setRefChoiceMenu(null);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [refChoiceMenu]);
  const [imagePenMaskEl, setImagePenMaskEl] = useState<DesignElement | null>(null);
  const [maskPoints, setMaskPoints] = useState<{ x: number; y: number }[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [maskMousePos, setMaskMousePos] = useState<{ x: number; y: number } | null>(null);
  const [penMaskImgSize, setPenMaskImgSize] = useState({ w: 0, h: 0 });
  const [penMaskDisplaySize, setPenMaskDisplaySize] = useState({ w: 0, h: 0 });
  const penMaskImageRef = useRef<HTMLImageElement | null>(null);
  const [imageAIPrompt, setImageAIPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isEnhancingImage, setIsEnhancingImage] = useState(false);
  const [drawMode, setDrawMode] = useState<'pen' | 'eraser' | null>(null);
  const [penColor, setPenColor] = useState('#7c5cfc');
  const [penSize, setPenSize] = useState(5);
  
  // ── Mockup Mode ────────────────────────────────────────
  const [mockupMode, setMockupMode] = useState(false);
  const [mockupPoints, setMockupPoints] = useState<{ x: number; y: number }[]>([]);
  const [mockupClosed, setMockupClosed] = useState(false);
  const [mockupMousePos, setMockupMousePos] = useState<{ x: number; y: number } | null>(null);
  const [penOpacity, setPenOpacity] = useState(100);
  const [eraserSize, setEraserSize] = useState(15);
  const [eraserOpacity, setEraserOpacity] = useState(100);
  const isDrawingRef = useRef(false);
  const eraserChangedRef = useRef(false);
  const activeDrawIdRef = useRef<string | null>(null);
  const activeEraserStrokeIdRef = useRef<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState({ x: 0, y: 0 });
  const [imageEraserEl, setImageEraserEl] = useState<DesignElement | null>(null);
  const [modalZoom, setModalZoom] = useState(1);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [modalPanX, setModalPanX] = useState(0);
  // Modo texto rascunho
  const [showDraftTextMode, setShowDraftTextMode] = useState(false);
  const [draftImagesList, setDraftImagesList] = useState<{ id: string; index: number }[]>([]);
  const [selectedDraftImageIndex, setSelectedDraftImageIndex] = useState<number | null>(null);
  const [draftInstruction, setDraftInstruction] = useState('');
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);
  // Rascunho interativo — boxes de instrução por elemento
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftGlobalNote, setDraftGlobalNote] = useState('');
  const [activeDraftNoteId, setActiveDraftNoteId] = useState<string | null>(null);
  const [draftNoteBoxPos, setDraftNoteBoxPos] = useState<{ x: number; y: number } | null>(null);
  const [modalPanY, setModalPanY] = useState(0);
  const [isModalPanning, setIsModalPanning] = useState(false);
  const modalPanStartRef = useRef({ x: 0, y: 0 });
  const [timelinePosition, setTimelinePosition] = useState<'horizontal' | 'vertical'>('horizontal');
  const [layersDockMode, setLayersDockMode] = useState<'bottom' | 'right' | 'left' | 'top' | 'floating'>('bottom');
  const [isTimelineMinimized, setIsTimelineMinimized] = useState(false);
  const [timelineScale, setTimelineScale] = useState<number>(0.7);
  const [timelineX, setTimelineX] = useState<number>(30);
  const [timelineY, setTimelineY] = useState<number>(420);
  const [draggedTimelineIdx, setDraggedTimelineIdx] = useState<number | null>(null);
  const panelDragRef = useRef<{ active: boolean; didMove: boolean; startX: number; startY: number; origX: number; origY: number; currentX: number; currentY: number }>({
    active: false, didMove: false, startX: 0, startY: 0, origX: 0, origY: 0, currentX: 30, currentY: 420
  });
  const timelinePanelRef = useRef<HTMLDivElement | null>(null);

  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const eraserHistoryRef = useRef<ImageData[]>([]);
  const isFirstMountRef = useRef(true);
  const prevActivePageIdRef = useRef<string>(activePageId);
  const [fontFamilies, setFontFamilies] = useState<string[]>(FONT_FAMILIES);

  // Estado do modal de export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  // Cache das máscaras da borracha para evitar recriação a cada render
  const eraserMasks = useMemo(() => {
    const masks = new Map<string, string>();
    elements.forEach(el => {
      if (el.eraserStrokes && el.eraserStrokes.length > 0) {
        const cvs = document.createElement('canvas');
        cvs.width = Math.round(el.w);
        cvs.height = Math.round(el.h);
        const ctx = cvs.getContext('2d');
        if (!ctx) return;
        
        // Começar com tudo visível (branco = opaco)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        
        // Criar um canvas temporário para renderizar TODOS os strokes juntos
        // permitindo que a opacidade se acumule naturalmente
        const tempCvs = document.createElement('canvas');
        tempCvs.width = cvs.width;
        tempCvs.height = cvs.height;
        const tempCtx = tempCvs.getContext('2d');
        if (!tempCtx) return;
        
        // Renderizar todos os strokes no canvas temporário com acúmulo
        tempCtx.globalCompositeOperation = 'source-over';
        el.eraserStrokes.forEach(stroke => {
          if (!stroke.points || stroke.points.length === 0) return;
          
          const radius = (stroke.size || 15) / 2;
          const opacity = (stroke.opacity || 100) / 100;
          
          // Desenhar cada ponto como círculo + linha conectora
          stroke.points.forEach((point, idx) => {
            // Círculo no ponto atual
            tempCtx.globalAlpha = opacity;
            tempCtx.beginPath();
            tempCtx.arc(point.x - el.x, point.y - el.y, radius, 0, Math.PI * 2);
            tempCtx.fillStyle = 'black';
            tempCtx.fill();
            
            // Linha para o ponto anterior (evita gaps)
            if (idx > 0) {
              const prevPoint = stroke.points[idx - 1];
              tempCtx.beginPath();
              tempCtx.moveTo(prevPoint.x - el.x, prevPoint.y - el.y);
              tempCtx.lineTo(point.x - el.x, point.y - el.y);
              tempCtx.strokeStyle = 'black';
              tempCtx.lineWidth = stroke.size || 15;
              tempCtx.lineCap = 'round';
              tempCtx.lineJoin = 'round';
              tempCtx.globalAlpha = opacity;
              tempCtx.stroke();
            }
          });
        });
        
        // Aplicar o canvas temporário como máscara (destination-out)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.drawImage(tempCvs, 0, 0);
        
        masks.set(el.id, cvs.toDataURL());
      }
    });
    return masks;
  }, [elements]);

  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).electronAPI.getSystemFonts();
        if (res && res.success && res.fonts) {
          const merged = Array.from(new Set([...FONT_FAMILIES, ...res.fonts])).sort();
          setFontFamilies(merged);
        }
      } catch (e) {}
    })();
  }, []);

  // Initialize and load image once when imageEraserEl is selected
  useEffect(() => {
    if (!imageEraserEl) return;
    // Timeout gives React time to render the modal DOM so canvas is available
    const timer = setTimeout(() => {
      const canvas = modalCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = (maxDim / w) * h;
            w = maxDim;
          } else {
            w = (maxDim / h) * w;
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        // Clear history stack and push initial state
        eraserHistoryRef.current = [ctx.getImageData(0, 0, w, h)];
      };
      img.src = imageEraserEl.imageSrc!;
    }, 50);
    return () => clearTimeout(timer);
  }, [imageEraserEl]);

  useEffect(() => {
    if (!imagePenMaskEl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 600;
      let w = img.width;
      let h = img.height;
      setPenMaskImgSize({ w, h });
      
      // Calculate display size (fitting within maxDim)
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = (maxDim / w) * h;
          w = maxDim;
        } else {
          w = (maxDim / h) * w;
          h = maxDim;
        }
      }
      setPenMaskDisplaySize({ w, h });
      penMaskImageRef.current = img;
    };
    img.src = imagePenMaskEl.imageSrc!;
  }, [imagePenMaskEl]);
  const [newW, setNewW] = useState(1280);
  const [newH, setNewH] = useState(720);
  const [selectedPreset, setSelectedPreset] = useState<string>('Apresentação');
  const [toast, setToast] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [backgroundContextMenu, setBackgroundContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeGuides, setActiveGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const snapLockRef = useRef({ x: false, y: false });
  const shiftPressedRef = useRef(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  
  // ── Register Modal State ───────────────────────────────
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registeringElementId, setRegisteringElementId] = useState<string | null>(null);
  const [registerName, setRegisterName] = useState('');
  const [registerCategory, setRegisterCategory] = useState<'pessoa' | 'objeto' | 'animal' | 'cenario' | 'efeito' | 'texto' | 'outro'>('outro');
  const [registerModalPos, setRegisterModalPos] = useState({ x: 200, y: 100 });
  const registerModalDragging = useRef(false);
  const registerModalDragOffset = useRef({ x: 0, y: 0 });

  // ── Register Modal Drag ────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!registerModalDragging.current) return;
      setRegisterModalPos({
        x: e.clientX - registerModalDragOffset.current.x,
        y: e.clientY - registerModalDragOffset.current.y
      });
    };
    const onMouseUp = () => {
      registerModalDragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Drag/Resize State ─────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    type: 'move' | 'resize' | 'rotate' | 'deform';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origRot: number;
    handle?: string;
    elCx?: number;
    elCy?: number;
    origFontSize?: number;
    origCropX?: number;
    origCropY?: number;
    origCropImgW?: number;
    origCropH?: number;
    deformCorner?: DeformCornerKey;
    origDeformCorners?: DeformCorners;
    // Cross-canvas drag support
    sourcePageId?: string;
    sourcePageRect?: DOMRect;
    origEl?: DesignElement;
    // Multi-select drag support
    multiDragIds?: string[];
    multiDragOrig?: { id: string, origX: number, origY: number, origW?: number, origH?: number }[];
  }>({
    active: false, type: 'move', startX: 0, startY: 0,
    origX: 0, origY: 0, origW: 0, origH: 0, origRot: 0
  });

  // Map of pageId → canvas div DOM element for cross-canvas hit-testing
  const pageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  // ID of the page the cursor is currently hovering over during a cross-canvas drag
  const [crossCanvasTargetId, setCrossCanvasTargetId] = useState<string | null>(null);

  // ── Multi-selection (marquee) ──────────────────────────
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const multiSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => { multiSelectedIdsRef.current = multiSelectedIds; }, [multiSelectedIds]);
  const marqueeRef = useRef<{
    active: boolean;
    startX: number; // canvas-space
    startY: number;
    endX: number;
    endY: number;
  }>({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 });
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const selectedEl = elements.find(e => e.id === selectedId) ?? null;

  // ═══════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════

  const saveHistory = useCallback((els: DesignElement[], bg: string, pageId?: string) => {
    const pid = pageId ?? activePageId;
    if (!historyMapRef.current.has(pid)) {
      historyMapRef.current.set(pid, { stack: [], idx: -1 });
    }
    const h = historyMapRef.current.get(pid)!;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push({ elements: JSON.parse(JSON.stringify(els)), bg });
    if (h.stack.length > 50) h.stack.shift();
    h.idx = h.stack.length - 1;
    setCanUndo(h.idx > 0);
    setCanRedo(false);
  }, [activePageId]);

  const undo = useCallback(() => {
    const h = historyMapRef.current.get(activePageId);
    if (!h || h.idx <= 0) return;
    h.idx--;
    const snap = h.stack[h.idx];
    setElements(JSON.parse(JSON.stringify(snap.elements)));
    setCanvasBg(snap.bg);
    setCanUndo(h.idx > 0);
    setCanRedo(true);
    setSelectedId(null);
  }, [activePageId]);

  const redo = useCallback(() => {
    const h = historyMapRef.current.get(activePageId);
    if (!h || h.idx >= h.stack.length - 1) return;
    h.idx++;
    const snap = h.stack[h.idx];
    setElements(JSON.parse(JSON.stringify(snap.elements)));
    setCanvasBg(snap.bg);
    setCanUndo(true);
    setCanRedo(h.idx < h.stack.length - 1);
    setSelectedId(null);
  }, [activePageId]);

  // Sync undo/redo availability when switching pages
  useEffect(() => {
    const h = historyMapRef.current.get(activePageId);
    if (!h) { setCanUndo(false); setCanRedo(false); return; }
    setCanUndo(h.idx > 0);
    setCanRedo(h.idx < h.stack.length - 1);
  }, [activePageId]);

  // Initial history save
  useEffect(() => { saveHistory([], '#ffffff'); }, []);

  // Auto-save pages to localStorage when activeProject has a saveId
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[PhotoEditor] Sem saveId, não salvando');
      return;
    }
    
    const saveKey = `bill-photo-${activeProject.saveId}`;
    console.log('[PhotoEditor] Auto-salvando com chave:', saveKey);
    
    // Debounce para não salvar a cada mudança
    const timer = setTimeout(() => {
      try {
        const saveData = {
          pages: pages.map(p => ({
            ...p,
            // Não salva o canvas ref, só os dados serializáveis
          })),
          activePageId,
          designTitle,
        };
        
        localStorage.setItem(saveKey, JSON.stringify(saveData));
        console.log('[PhotoEditor] Salvo com sucesso');
        
        // Atualiza preview do projeto usando performExportPage
        if (onUpdatePreview) {
          setTimeout(async () => {
            const designPageId = pages.find(p => p.id === activePageId && p.pageKind === 'design')?.id || 
                               pages.find(p => p.pageKind === 'design')?.id;
            
            if (designPageId) {
              const page = pages.find(p => p.id === designPageId);
              if (page) {
                try {
                  // Use performExportPage to correctly render all elements (images, text, shapes, drawings)
                  const previewUrl = await performExportPage(page, 0, true);
                  if (previewUrl) {
                    console.log('[PhotoEditor] Preview capturado via performExportPage, tamanho:', previewUrl.length);
                    onUpdatePreview(previewUrl);
                  } else {
                    console.log('[PhotoEditor] performExportPage retornou null');
                  }
                } catch (err) {
                  console.error('[PhotoEditor] Erro ao capturar preview:', err);
                }
              }
            } else {
              console.log('[PhotoEditor] Nenhuma página de design encontrada');
            }
          }, 100);
        }
      } catch (err) {
        console.error('[PhotoEditor] Erro ao salvar:', err);
      }
    }, 2000); // Salva 2s após última mudança
    
    return () => clearTimeout(timer);
  }, [pages, activePageId, designTitle, activeProject, onUpdatePreview]);

  // Auto-load pages when activeProject changes
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[PhotoEditor] Sem saveId no projeto, usando canvas limpo');
      return;
    }
    
    const saveKey = `bill-photo-${activeProject.saveId}`;
    console.log('[PhotoEditor] Tentando carregar save com chave:', saveKey);
    
    try {
      const savedData = localStorage.getItem(saveKey);
      if (!savedData) {
        console.log('[PhotoEditor] Nenhum save encontrado, usando canvas limpo');
        return;
      }
      
      const data = JSON.parse(savedData);
      console.log('[PhotoEditor] Save encontrado, restaurando...');
      
      setPages(data.pages || [{
        id: 'page-1',
        name: 'Canvas 1',
        w: 1280,
        h: 720,
        bg: '#ffffff',
        elements: [],
        zCounter: 1,
        x: 0,
        y: 0,
        pageKind: 'design',
      }]);
      
      setActivePageId(data.activePageId || 'page-1');
      setDesignTitle(data.designTitle || 'Design sem título');
      
      console.log('[PhotoEditor] Canvas restaurado com sucesso');
    } catch (err) {
      console.error('[PhotoEditor] Erro ao carregar save:', err);
    }
  }, [activeProject?.saveId]); // Só recarrega quando o saveId mudar

  // Limpa canvas quando activeProject fica null (usuário fechou o projeto)
  useEffect(() => {
    if (!activeProject) {
      console.log('[PhotoEditor] Projeto fechado - limpando canvas');
      setPages([{
        id: 'page-1',
        name: 'Design',
        w: 1080,
        h: 1350,
        bg: '#ffffff',
        elements: [],
        zCounter: 1,
        x: 0,
        y: 0,
        pageKind: 'design',
      }]);
      setActivePageId('page-1');
      setDesignTitle('Design sem título');
      setSelectedId(null);
    }
  }, [activeProject]);

  React.useImperativeHandle(ref, () => ({
    getEditorState: () => {
      const designPageId = getDesignPageId(pages, activePageId);
      const page = pages.find(p => p.id === designPageId) ?? pages[0];
      const draftPage = getDraftPageForDesign(pages, designPageId);
      const linkedIds = draftPage?.draftLinkedElementIds ?? (selectedId ? [selectedId] : []);
      const linkedElements = page.elements.filter(el => linkedIds.includes(el.id));
      const selected = page.elements.find(el => el.id === selectedId) ?? linkedElements[0] ?? null;

      return {
        canvasWidth: page.w,
        canvasHeight: page.h,
        canvasBg: page.bg,
        designPageId: page.id,
        isDraftMode: (pages.find(p => p.id === activePageId)?.pageKind === 'draft'),
        selectedElement: selected ? {
          id: selected.id,
          type: selected.type,
          x: selected.x,
          y: selected.y,
          w: selected.w,
          h: selected.h,
          rotation: selected.rotation,
          opacity: selected.opacity,
          locked: selected.locked,
          zIndex: selected.zIndex,
          text: selected.text,
          fontSize: selected.fontSize,
          fontFamily: selected.fontFamily,
          textColor: selected.textColor,
          textStrokeWidth: selected.textStrokeWidth,
          textStrokeColor: selected.textStrokeColor,
          textHollowEnabled: selected.textHollowEnabled,
          textShadowOffsetX: selected.textShadowOffsetX,
          textShadowOffsetY: selected.textShadowOffsetY,
          textShadowColor: selected.textShadowColor,
          textShadowBlur: selected.textShadowBlur,
          fillColor: selected.fillColor,
          strokeColor: selected.strokeColor,
          strokeWidth: selected.strokeWidth,
          shapeKind: selected.shapeKind,
          brightness: selected.brightness,
          contrast: selected.contrast,
          saturation: selected.saturation,
          blur: selected.blur,
          hueRotate: selected.hueRotate,
          duotoneEnabled: selected.duotoneEnabled,
          duotoneColor1: selected.duotoneColor1,
          duotoneColor2: selected.duotoneColor2,
          deformEnabled: selected.deformEnabled,
          deformCorners: selected.deformCorners,
        } : null,
        elements: page.elements.map(el => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          text: el.type === 'text' ? el.text : undefined,
          shapeKind: el.type === 'shape' ? el.shapeKind : undefined,
          zIndex: el.zIndex,
          customName: el.customName,
          customCategory: el.customCategory,
        })),
        draft: draftPage ? {
          pageId: draftPage.id,
          hasContent: draftPage.elements.some(el => el.type === 'drawing' && (el.points?.length ?? 0) > 1),
          linkedElementIds: linkedIds,
          linkedElements: linkedElements.map(el => ({
            id: el.id,
            type: el.type,
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            text: el.text,
            shapeKind: el.shapeKind,
            zIndex: el.zIndex,
          })),
        } : null,
        pageCount: pages.filter(p => p.pageKind !== 'draft').length,
        activePageId: activePageId,
      };
    },

    getDraftVisionContent: () => {
      const designPageId = getDesignPageId(pages, activePageId);
      const draftPage = getDraftPageForDesign(pages, designPageId);
      if (!draftPage) return null;
      const hasDrawings = draftPage.elements.some(el => el.type === 'drawing' && (el.points?.length ?? 0) > 1);
      const hasNotes = Object.keys(draftNotes).length > 0 || !!draftGlobalNote;
      if (!hasDrawings && !hasNotes) return null;

      const imageDataUrl = hasDrawings ? renderPageToDataURL(draftPage) : null;
      const designPage = pages.find(p => p.id === designPageId);

      // Build structured notes text
      const notesLines: string[] = [];
      if (draftGlobalNote) {
        notesLines.push(`🎯 INSTRUÇÃO GERAL: ${draftGlobalNote}`);
      }
      if (Object.keys(draftNotes).length > 0) {
        notesLines.push('\n📌 INSTRUÇÕES POR ELEMENTO:');
        Object.entries(draftNotes).forEach(([elId, note]) => {
          if (!note) return;
          const el = designPage?.elements.find(e => e.id === elId);
          if (el) {
            const label = el.type === 'text' ? `Texto "${(el.text ?? '').substring(0, 20)}"` : el.type === 'image' ? 'Imagem' : `Forma (${el.shapeKind ?? ''})`;
            notesLines.push(`  • Elemento [${elId}] (${label}): ${note}`);
          }
        });
      }
      const notesText = notesLines.join('\n');

      const linked = draftPage.draftLinkedElementIds ?? [];
      const linkedDesc = linked.length > 0
        ? `Elementos vinculados (IDs no canvas principal): ${linked.join(', ')}`
        : 'Sem elementos pré-vinculados — aplique conforme as instruções.';

      const drawingDesc = hasDrawings
        ? ' Um esboço à mão também está incluído na imagem — interprete anotações, setas e posições desenhadas.'
        : '';

      const cw = designPage?.w ?? 1080;
      const ch = designPage?.h ?? 1350;

      // Interpreta as notas de cada elemento e sugere ações concretas
      const actionSuggestions: string[] = [];
      if (Object.keys(draftNotes).length > 0) {
        Object.entries(draftNotes).forEach(([elId, note]) => {
          if (!note) return;
          const el = designPage?.elements.find(e => e.id === elId);
          if (!el || el.type !== 'image') return;

          const ratio = el.w > 0 && el.h > 0 ? el.w / el.h : 0.75;
          const hTarget = Math.round(ch * 0.9);
          const wTarget = Math.round(hTarget * ratio);
          const noteLower = note.toLowerCase();

          // Detecta posição horizontal
          let xPos = Math.round((cw - wTarget) / 2); // centro padrão
          let posLabel = 'centralizado';
          if (noteLower.includes('esquerda') || noteLower.includes('left')) {
            xPos = 0;
            posLabel = 'esquerda (x=0)';
          } else if (noteLower.includes('direita') || noteLower.includes('right')) {
            xPos = Math.round(cw - wTarget);
            posLabel = `direita (x=${Math.round(cw - wTarget)})`;
          }

          // Detecta posição vertical
          let yPos = Math.round((ch - hTarget) / 2);
          if (noteLower.includes('topo') || noteLower.includes('cima') || noteLower.includes('top')) {
            yPos = 0;
          } else if (noteLower.includes('base') || noteLower.includes('baixo') || noteLower.includes('bottom')) {
            yPos = Math.round(ch - hTarget);
          }

          actionSuggestions.push(
            `\nACAO SUGERIDA para [${elId}] ("${note.slice(0, 60)}"):\n   update-element: elementId="${elId}", x=${xPos}, y=${yPos}, w=${wTarget}, h=${hTarget}\n   Posicao: ${posLabel}, y=${yPos}`
          );
        });
      }

      const actionSuggestionsText = actionSuggestions.length > 0
        ? `\n\nACOES PRE-CALCULADAS (execute exatamente assim):${actionSuggestions.join('')}`
        : '';

      // Calcula proporção de cada elemento de imagem para incluir na dica
      const imageRatios = (designPage?.elements || [])
        .filter((e: any) => e.type === 'image')
        .map((e: any) => {
          const ratio = e.w > 0 && e.h > 0 ? (e.w / e.h) : null;
          if (!ratio) return '';
          const isPortrait = ratio < 1;
          // Para altura h=ch*0.9, qual w preserva a proporção?
          const hTarget = Math.round(ch * 0.9);
          const wFromRatio = Math.round(hTarget * ratio);
          // Centralizado com esse w
          const xCenter = Math.round((cw - wFromRatio) / 2);
          const xLeft = 0;
          const xRight = Math.round(cw - wFromRatio);
          return `  - Elemento ${e.id} (${isPortrait ? 'portrait' : 'landscape'}, ratio=${ratio.toFixed(2)}): para h=${hTarget}, use w=${wFromRatio} | centralizado: x=${xCenter} | esquerda: x=${xLeft} | direita: x=${xRight > 0 ? xRight : 0}`;
        }).filter(Boolean).join('\n');

      const positioningHint = `\n\nCOORDENADAS DE REFERENCIA (canvas ${cw}x${ch}px):\n\nPROPORCOES DOS ELEMENTOS DE IMAGEM (USE ESSES VALORES):\n${imageRatios || '  (nenhum elemento de imagem no canvas)'}\n\nPOSICOES:\n- "preencher canvas": x=0, y=0, w=${cw}, h=${ch}\n- "metade esquerda" ou "centralizado na esquerda" ou "esquerda": x=0, y=0, w=${Math.round(cw/2)}, h=${ch}\n- "metade direita" ou "centralizado na direita" ou "direita": x=${Math.round(cw/2)}, y=0, w=${Math.round(cw/2)}, h=${ch}\n- "topo": x=0, y=0, w=${cw}, h=${Math.round(ch/2)}\n- "base": x=0, y=${Math.round(ch/2)}, w=${cw}, h=${Math.round(ch/2)}\n\nDEFINICAO:\n- ESQUERDA = x=0\n- DIREITA = x=${Math.round(cw/2)}\n- "atras de" / "por baixo de" = zIndex MENOR (nao muda x,y)\n- "na frente de" / "em cima de" = zIndex MAIOR\n\nREGRA: Use SEMPRE os valores de w calculados acima para preservar proporcao. IMPORTANTE: Use esses valores EXATOS.`;

      const notesWithHints = notesLines.join('\n');

      return {
        text: `RASCUNHO DO USUARIO (${cw}x${ch}px).${drawingDesc} ${linkedDesc}\n\n${notesWithHints}${actionSuggestionsText}${positioningHint}\n\nEdite o canvas PRINCIPAL - nunca o rascunho.`,
        imageDataUrl: imageDataUrl ?? '',
      };
    },

    getCanvasSnapshot: async (): Promise<string | null> => {
      try {
        const designPageId = getDesignPageId(pages, activePageId);
        const page = pages.find(p => p.id === designPageId) ?? pages[0];

        // Tamanho de saída: máx 768px (ideal para modelos de visão)
        const maxSize = 768;
        const scale = Math.min(1, maxSize / Math.max(page.w, page.h));
        const tw = Math.round(page.w * scale);
        const th = Math.round(page.h * scale);

        const cvs = document.createElement('canvas');
        cvs.width = tw;
        cvs.height = th;
        const ctx = cvs.getContext('2d')!;

        // Clip para os bounds do canvas
        ctx.beginPath();
        ctx.rect(0, 0, tw, th);
        ctx.clip();

        // Fundo
        ctx.fillStyle = page.bg?.startsWith('linear') || page.bg?.startsWith('radial')
          ? '#1a1a2e' : (page.bg || '#ffffff');
        ctx.fillRect(0, 0, tw, th);

        // Desenha elementos em ordem de zIndex
        const sorted = [...page.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        for (const el of sorted) {
          if (el.type === 'image' && el.imageSrc) {
            // Tenta pegar a imagem já carregada no DOM (muito mais rápido que recarregar)
            const domImg = document.querySelector(`img[src="${el.id}"], [data-elid="${el.id}"] img`) as HTMLImageElement | null;
            const drawImg = (img: HTMLImageElement) => {
              ctx.save();
              ctx.globalAlpha = (el.opacity ?? 100) / 100;
              const sx = el.x * scale;
              const sy = el.y * scale;
              const sw = el.w * scale;
              const sh = el.h * scale;
              ctx.translate(sx + sw / 2, sy + sh / 2);
              ctx.rotate((el.rotation || 0) * Math.PI / 180);
              ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
              ctx.restore();
            };

            await new Promise<void>((res) => {
              const img = new Image();
              const timeout = setTimeout(() => res(), 2000);
              img.onload = () => { clearTimeout(timeout); drawImg(img); res(); };
              img.onerror = () => { clearTimeout(timeout); res(); };
              // Para data URLs grandes, usa createObjectURL se possível
              if (el.imageSrc!.startsWith('data:')) {
                const byteStr = el.imageSrc!.split(',')[1];
                if (byteStr && byteStr.length > 500000) {
                  // Imagem grande — desenha direto sem esperar
                  clearTimeout(timeout);
                  res();
                  return;
                }
              }
              img.src = el.imageSrc!;
            });
          } else if (el.type === 'shape') {
            ctx.save();
            ctx.globalAlpha = (el.opacity ?? 100) / 100;
            ctx.fillStyle = el.fillColor || '#7c5cfc';
            const sx = el.x * scale, sy = el.y * scale;
            const sw = el.w * scale, sh = el.h * scale;
            ctx.translate(sx + sw / 2, sy + sh / 2);
            ctx.rotate((el.rotation || 0) * Math.PI / 180);
            ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
            ctx.restore();
          } else if (el.type === 'text' && el.text) {
            ctx.save();
            ctx.globalAlpha = (el.opacity ?? 100) / 100;
            ctx.fillStyle = el.textColor || '#ffffff';
            const fs = Math.round((el.fontSize || 32) * scale);
            ctx.font = `${el.fontStyle || 'normal'} ${fs}px ${el.fontFamily || 'Arial'}`;
            ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'center';
            const sx = el.x * scale, sy = el.y * scale;
            const sw = el.w * scale, sh = el.h * scale;
            ctx.translate(sx + sw / 2, sy + sh / 2);
            ctx.rotate((el.rotation || 0) * Math.PI / 180);
            // Multiline
            const lines = (el.text || '').split('\n').slice(0, 6);
            lines.forEach((line, i) => {
              ctx.fillText(line.slice(0, 60), 0, i * fs * 1.2 - (lines.length - 1) * fs * 0.6);
            });
            ctx.restore();
          }
        }

        // PNG para máxima qualidade (Moondream prefere)
        return cvs.toDataURL('image/png');
      } catch {
        return null;
      }
    },

    applyAIAction: (action: string, payload: any): string => {
      const designPageId = getDesignPageId(pages, activePageId);
      const page = pages.find(p => p.id === designPageId) ?? pages[0];
      const draftPage = getDraftPageForDesign(pages, designPageId);

      // Se a página ativa for um rascunho e a ação modificar o design, ativa a página principal
      const onDraftPage = pages.find(p => p.id === activePageId)?.pageKind === 'draft';
      if (onDraftPage && action !== 'apply-from-draft' && action !== 'select-element' && action !== 'undo' && action !== 'redo') {
        setActivePageId(designPageId);
      }

      const patchDesignPage = (patch: Partial<CanvasPage>) => {
        setPages(prev => prev.map(p => p.id === designPageId ? { ...p, ...patch } : p));
      };

      const patchDesignElements = (updater: (els: DesignElement[]) => DesignElement[]) => {
        setPages(prev => prev.map(p => {
          if (p.id !== designPageId) return p;
          return { ...p, elements: updater(p.elements) };
        }));
      };

      const resolveElement = (targetId?: string) => {
        if (!targetId || targetId === 'selected' || targetId === 'selecionado') {
          if (selectedId && page.elements.find(el => el.id === selectedId)) {
            return page.elements.find(el => el.id === selectedId) || null;
          }
          const linkedId = draftPage?.draftLinkedElementIds?.[0];
          if (linkedId) return page.elements.find(el => el.id === linkedId) || null;
          return null;
        }
        return page.elements.find(el => el.id === targetId || (el.type === 'text' && el.text?.toLowerCase().includes(targetId.toLowerCase()))) || null;
      };

      switch (action) {
        case 'add-text': {
          const text = payload.text || 'Texto';
          const fontSize = payload.fontSize || 32;
          const textColor = payload.textColor || '#1a1a2e';
          const w = payload.w || 300;
          const h = payload.h || 80;
          const x = payload.x != null ? payload.x : (page.w / 2 - w / 2);
          const y = payload.y != null ? payload.y : (page.h / 2 - h / 2);
          
          const newEl: DesignElement = {
            id: genId(),
            type: 'text',
            text,
            fontSize,
            textColor,
            w,
            h,
            x,
            y,
            rotation: 0,
            opacity: 100,
            locked: false,
            zIndex: page.zCounter,
            fontFamily: payload.fontFamily || 'Inter',
            fontStyle: 'normal',
            textAlign: payload.textAlign || 'center',
          };
          const newZ = page.zCounter;
          patchDesignPage({ zCounter: newZ + 1 });
          patchDesignElements(prev => {
            const next = [...prev, { ...newEl, zIndex: newZ }];
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          setSelectedId(newEl.id);
          onAddToTerminal?.(`📝 AI adicionou texto: "${text}"`);
          return `✅ Texto "${text}" adicionado com sucesso.`;
        }

        case 'add-shape': {
          const shapeKind = payload.shapeKind || 'rect';
          const fillColor = payload.fillColor || '#7c5cfc';
          const w = payload.w || 160;
          const h = payload.h || 160;
          const x = payload.x != null ? payload.x : (page.w / 2 - w / 2);
          const y = payload.y != null ? payload.y : (page.h / 2 - h / 2);

          const newEl: DesignElement = {
            id: genId(),
            type: 'shape',
            shapeKind,
            fillColor,
            strokeColor: payload.strokeColor || 'transparent',
            strokeWidth: payload.strokeWidth || 0,
            w,
            h,
            x,
            y,
            rotation: 0,
            opacity: 100,
            locked: false,
            zIndex: page.zCounter,
          };
          const newZ = page.zCounter;
          patchDesignPage({ zCounter: newZ + 1 });
          patchDesignElements(prev => {
            const next = [...prev, newEl];
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          setSelectedId(newEl.id);
          onAddToTerminal?.(`🟦 AI adicionou forma: "${shapeKind}"`);
          return `✅ Forma "${shapeKind}" adicionada com sucesso.`;
        }

        case 'set-background': {
          const color = payload.color;
          if (!color) return '❌ Cor de fundo não informada';
          patchDesignPage({ bg: color });
          patchDesignElements(prev => {
            saveHistory(prev, color, designPageId);
            return prev;
          });
          onAddToTerminal?.(`🎨 AI mudou fundo do canvas para: ${color}`);
          return `✅ Cor de fundo alterada para "${color}"`;
        }

        case 'update-element': {
          const el = resolveElement(payload.elementId);
          if (!el) return '❌ Nenhum elemento selecionado ou encontrado';
          
          const changes: Partial<DesignElement> = {};
          const props = [
            'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign', 'textColor', 'textStrokeWidth', 'textStrokeColor', 'textCurve',
            'textHollowEnabled', 'textShadowOffsetX', 'textShadowOffsetY', 'textShadowColor', 'textShadowBlur',
            'fillColor', 'strokeColor', 'strokeWidth', 'opacity', 'rotation', 'locked', 'zIndex',
            'x', 'y', 'w', 'h',
            'brightness', 'contrast', 'saturation', 'blur', 'hueRotate',
            'duotoneEnabled', 'duotoneColor1', 'duotoneColor2',
            'flipX', 'flipY',
            'deformEnabled', 'deformCorners', 'imageObjectFit',
            'overlayType', 'overlayColor1',
          ];
          
          props.forEach(p => {
            if (payload[p] !== undefined) {
              if (typeof payload[p] === 'string' && !isNaN(Number(payload[p]))) {
                (changes as any)[p] = Number(payload[p]);
              } else {
                (changes as any)[p] = payload[p];
              }
            }
          });

          // Se a IA está reposicionando uma imagem (mudando x,y,w,h),
          // força contain para não cortar a pessoa
          if (el.type === 'image' && (payload.x !== undefined || payload.y !== undefined || payload.w !== undefined || payload.h !== undefined)) {
            if (payload.imageObjectFit === undefined) {
              changes.imageObjectFit = 'contain';
            }
          }
          
          patchDesignElements(prev => {
            const next = prev.map(item => item.id === el.id ? { ...item, ...changes } : item);
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          onAddToTerminal?.(`🛠️ AI atualizou propriedades do elemento: ${JSON.stringify(changes)}`);
          return `✅ Propriedades atualizadas no elemento "${el.type}".`;
        }

        case 'set-filter': {
          const el = resolveElement(payload.elementId);
          if (!el || el.type !== 'image') return '❌ Nenhum elemento do tipo imagem selecionado ou encontrado';

          const changes: Partial<DesignElement> = {};
          const filters = ['brightness', 'contrast', 'saturation', 'blur', 'hueRotate', 'duotoneEnabled', 'duotoneColor1', 'duotoneColor2', 'flipX', 'flipY'];
          filters.forEach(p => {
            if (payload[p] !== undefined) {
              if (typeof payload[p] === 'string' && !isNaN(Number(payload[p]))) {
                (changes as any)[p] = Number(payload[p]);
              } else {
                (changes as any)[p] = payload[p];
              }
            }
          });
          patchDesignElements(prev => {
            const next = prev.map(item => item.id === el.id ? { ...item, ...changes } : item);
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          onAddToTerminal?.(`🎨 AI atualizou filtros da imagem: ${JSON.stringify(changes)}`);
          return `✅ Filtros da imagem atualizados com sucesso.`;
        }

        case 'delete-element': {
          const el = resolveElement(payload.elementId);
          if (!el) return '❌ Nenhum elemento selecionado ou encontrado';
          patchDesignElements(prev => {
            const next = prev.filter(item => item.id !== el.id);
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          setSelectedId(null);
          onAddToTerminal?.(`🗑️ AI deletou elemento: ${el.id}`);
          return `✅ Elemento deletado.`;
        }

        case 'duplicate-element': {
          const el = resolveElement(payload.elementId);
          if (!el) return '❌ Nenhum elemento selecionado ou encontrado';
          const newEl: DesignElement = { ...el, id: genId(), x: el.x + 20, y: el.y + 20, zIndex: page.zCounter };
          patchDesignPage({ zCounter: page.zCounter + 1 });
          patchDesignElements(prev => {
            const next = [...prev, newEl];
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          setSelectedId(newEl.id);
          onAddToTerminal?.(`➕ AI duplicou elemento: ${el.id}`);
          return `✅ Elemento duplicado.`;
        }

        case 'clear-canvas': {
          patchDesignElements(() => {
            saveHistory([], page.bg, designPageId);
            return [];
          });
          onAddToTerminal?.(`🧼 AI limpou o canvas`);
          return `✅ Todos os elementos foram removidos do canvas.`;
        }

        case 'set-canvas-size': {
          const w = Number(payload.w);
          const h = Number(payload.h);
          if (isNaN(w) || isNaN(h)) {
            if (payload.preset) {
              const preset = CANVAS_PRESETS.find(p => p.name.toLowerCase().includes(payload.preset.toLowerCase()));
              if (preset) {
                patchDesignPage({ w: preset.w, h: preset.h });
                onAddToTerminal?.(`📐 AI mudou tamanho do canvas para preset: ${preset.name}`);
                return `✅ Tamanho do canvas alterado para preset "${preset.name}" (${preset.w}x${preset.h}).`;
              }
            }
            return '❌ Dimensões inválidas';
          }
          patchDesignPage({ w, h });
          onAddToTerminal?.(`📐 AI mudou tamanho do canvas para: ${w}x${h}`);
          return `✅ Tamanho do canvas alterado para ${w}x${h}.`;
        }

        case 'apply-from-draft': {
          if (!draftPage) return '❌ Nenhum rascunho encontrado para este canvas.';
          setActivePageId(designPageId);
          onAddToTerminal?.(`📋 IA aplicando roteiro do rascunho no canvas principal...`);
          return `✅ Canvas principal ativo. Interprete o rascunho e aplique as edições nos elementos vinculados.`;
        }

        case 'select-element': {
          const el = resolveElement(payload.elementId);
          if (!el) {
            setSelectedId(null);
            return '✅ Seleção limpa.';
          }
          setSelectedId(el.id);
          return `✅ Elemento "${el.type}" selecionado.`;
        }

        case 'undo': {
          undo();
          return '✅ Desfazer executado.';
        }

        case 'redo': {
          redo();
          return '✅ Refazer executado.';
        }

        case 'export': {
          performExportPage(page, 0);
          return '✅ Exportação iniciada.';
        }

        case 'add-page': {
          // Limita a 10 páginas
          if (pages.length >= 10) {
            return '❌ Limite de 10 canvas atingido!';
          }

          // Define tamanho do novo canvas
          let newW = page.w; // Por padrão, usa o tamanho do canvas atual
          let newH = page.h;
          let pageName = `Canvas ${pages.filter(p => p.pageKind !== 'draft').length + 1}`;

          // Se especificou tamanho customizado
          if (payload.w && payload.h) {
            newW = payload.w;
            newH = payload.h;
          }
          // Se especificou preset (banner, carrossel, post, etc)
          else if (payload.preset) {
            const presetLower = payload.preset.toLowerCase();
            const preset = CANVAS_PRESETS.find(p => p.name.toLowerCase().includes(presetLower));
            if (preset) {
              newW = preset.w;
              newH = preset.h;
              pageName = preset.name;
            }
          }

          // Se especificou nome custom
          if (payload.name) {
            pageName = payload.name;
          }

          const newId = `page-${Date.now()}`;
          const newPage: CanvasPage = {
            id: newId,
            name: pageName,
            w: newW,
            h: newH,
            bg: payload.bgColor || '#ffffff',
            elements: [],
            zCounter: 1,
            x: 0,
            y: 0,
            pageKind: 'design',
          };
          
          historyMapRef.current.set(newId, { stack: [{ elements: [], bg: newPage.bg }], idx: 0 });
          setPages(prev => [...prev, newPage]);
          setActivePageId(newId);
          setSelectedId(null);
          showToast(`🎨 ${pageName} criado!`);
          onAddToTerminal?.(`🎨 AI adicionou nova página: "${pageName}" (${newW}x${newH})`);
          return `✅ Nova página "${pageName}" (${newW}x${newH}) adicionada com sucesso.`;
        }

        case 'generate-image': {
          const prompt = payload.prompt || '';
          if (!prompt) return '❌ Nenhum prompt de imagem fornecido.';
          
          onAddToTerminal?.(`🎨 [IA] Solicitando imagem via Pollinations API...`);
          (window as any).electronAPI.generateImage({ prompt })
            .then((result: any) => {
              if (result && result.success) {
                const safePath = result.path.replace(/\\/g, '/');
                addElement({
                  type: 'image',
                  imageSrc: `file://${safePath}`,
                  imageObjectFit: 'cover',
                  x: canvasW / 2 - 200,
                  y: canvasH / 2 - 150,
                  w: 400,
                  h: 300,
                });
                showToast(`✅ [IA] Imagem adicionada ao canvas!`);
                onAddToTerminal?.(`✅ [IA] Imagem gerada e adicionada: "${prompt}"`);
              } else {
                showToast(`❌ [IA] Falha ao gerar imagem!`);
                onAddToTerminal?.(`❌ [IA] Falha ao gerar imagem: ${result?.error || 'Erro desconhecido'}`);
              }
            })
            .catch((e: any) => {
              showToast(`⚠️ [IA] Erro na geração!`);
              onAddToTerminal?.(`⚠️ [IA] Erro crítico na geração: ${e.message}`);
            });
          return '✅ Geração de imagem por IA iniciada. Aguarde...';
        }

        case 'remove-background': {
          const el = resolveElement(payload.elementId);
          if (!el || el.type !== 'image') {
            return '❌ Selecione uma imagem para remover o fundo.';
          }
          if (!el.imageSrc) {
            return '❌ A imagem selecionada não possui dados de imagem.';
          }
          handleRemoveBackground(el);
          return '✅ Remoção de fundo iniciada. Aguarde...';
        }

        case 'enhance-image': {
          const el = resolveElement(payload.elementId);
          if (!el || el.type !== 'image') return '❌ Selecione uma imagem para melhorar a qualidade.';
          if (!el.imageSrc) return '❌ A imagem selecionada não possui dados de imagem.';
          handleEnhanceImage(el);
          return '✅ Melhora de qualidade iniciada. Aguarde...';
        }

        case 'set-overlay':
        case 'add-overlay': {
          const overlayType = payload.overlayType || payload.type || 'fade';
          const overlayColor1 = payload.overlayColor1 || payload.color || '#7c5cfc';
          const src = overlayType === 'glow-multicolor' ? GLOW_MULTICOLOR_SVG : getOverlaySVG(overlayType, overlayColor1);
          
          if (!src || src.length < 10) {
            return `Erro: overlay SVG nao gerado para tipo "${overlayType}"`;
          }

          const w = payload.w ?? page.w;
          const h = payload.h ?? page.h;
          const x = payload.x ?? 0;
          const y = payload.y ?? 0;
          // Força opacity 100 — ignora qualquer valor 0 ou undefined da IA
          const opacity = 100;
          const newEl: DesignElement = {
            id: genId(),
            type: 'image',
            imageSrc: src,
            imageObjectFit: 'fill',
            x, y, w, h,
            rotation: 0,
            opacity: opacity,
            locked: false,
            zIndex: (page.zCounter ?? 0) + 100, // garante que fica na frente
            overlayType: overlayType as any,
            overlayColor1,
          };
          patchDesignPage({ zCounter: (page.zCounter ?? 0) + 101 });
          patchDesignElements(prev => {
            const next = [...prev, newEl];
            saveHistory(next, page.bg, designPageId);
            return next;
          });
          setSelectedId(newEl.id);
          onAddToTerminal?.(`Overlay "${overlayType}" adicionado como elemento (zIndex=${newEl.zIndex}).`);
          return `Overlay "${overlayType}" adicionado com cor ${overlayColor1}.`;
        }

        case 'set-as-background': {
          const el = resolveElement(payload.elementId);
          if (!el || el.type !== 'image') {
            return '❌ Selecione uma imagem para defini-la como fundo.';
          }
          // Vai para o zIndex mínimo (abaixo de todos os outros elementos)
          patchDesignElements(prev => {
            const others = prev.filter(e => e.id !== el.id);
            const minZ = others.length > 0 ? Math.min(...others.map(e => e.zIndex)) : 1;
            const next = prev.map(e => e.id === el.id ? { ...e, zIndex: minZ - 1 } : e);
            // Normalize z-indexes
            const sorted = [...next].sort((a, b) => a.zIndex - b.zIndex);
            const normalized = sorted.map((e, i) => ({ ...e, zIndex: i + 1 }));
            saveHistory(normalized, page.bg, designPageId);
            return normalized;
          });
          // Redimensionar para cobrir o canvas inteiro
          patchDesignElements(prev => {
            return prev.map(e => e.id === el.id ? { ...e, x: 0, y: 0, w: page.w, h: page.h, imageObjectFit: 'cover' } : e);
          });
          setSelectedId(el.id);
          onAddToTerminal?.(`🎨 IA definiu imagem como fundo do canvas (ocupa ${page.w}×${page.h}px, zIndex mínimo).`);
          return `✅ Imagem definida como fundo do canvas.`;
        }

        case 'add-image': {
          const src = payload.imageSrc || payload.src || payload.url || '';
          if (!src) return '❌ Nenhuma URL de imagem fornecida.';

          // Descobre as dimensões reais da imagem antes de adicionar
          const doAdd = (natW: number, natH: number) => {
            // Usa 90% do canvas como limite (igual ao upload e referência)
            const maxW = page.w * 0.9;
            const maxH = page.h * 0.9;
            
            let w = natW, h = natH;
            
            // Escala para caber em 90% do canvas mantendo proporção
            if (w > maxW || h > maxH) {
              const scaleW = maxW / w;
              const scaleH = maxH / h;
              const scale = Math.min(scaleW, scaleH);
              w = Math.round(w * scale);
              h = Math.round(h * scale);
            }
            
            const x = payload.x != null ? payload.x : (page.w / 2 - w / 2);
            const y = payload.y != null ? payload.y : (page.h / 2 - h / 2);
            const newEl: DesignElement = {
              id: genId(),
              type: 'image',
              imageSrc: src,
              imageObjectFit: 'cover',
              x, y, w, h,
              rotation: 0,
              opacity: 100,
              locked: false,
              zIndex: page.zCounter,
            };
            const newZ = page.zCounter;
            patchDesignPage({ zCounter: newZ + 1 });
            patchDesignElements(prev => {
              const next = [...prev, { ...newEl, zIndex: newZ }];
              saveHistory(next, page.bg, designPageId);
              return next;
            });
            setSelectedId(newEl.id);
            onAddToTerminal?.(`🖼️ Imagem adicionada ao canvas (${w}×${h}px).`);
          };

          // Tenta descobrir dimensões reais
          const probe = new Image();
          probe.onload = () => doAdd(probe.naturalWidth || 400, probe.naturalHeight || 300);
          probe.onerror = () => doAdd(400, 300);
          probe.src = src;

          return `✅ Imagem sendo carregada no canvas...`;
        }

        case 'add-reference': {
          const src = payload.imageSrc || payload.src || payload.url || '';
          if (!src) return '❌ Nenhuma URL de imagem fornecida.';
          
          const label = payload.label || 'Referência';
          const firstPage = pages[0];
          const px = firstPage ? (firstPage.x || 0) : 0;
          const py = firstPage ? (firstPage.y || 0) : 0;
          const canvasWidth = firstPage ? firstPage.w : 1280;
          const canvasHeight = firstPage ? firstPage.h : 720;
          
          // Carrega imagem para obter dimensões naturais e ajustar proporcionalmente
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const naturalW = img.naturalWidth;
            const naturalH = img.naturalHeight;
            const maxW = canvasWidth * 0.90;
            const maxH = canvasHeight * 0.90;
            const scaleX = maxW / naturalW;
            const scaleY = maxH / naturalH;
            const scale = Math.min(scaleX, scaleY, 1);
            const fitW = Math.round(naturalW * scale);
            const fitH = Math.round(naturalH * scale);
            
            setRefPanel({ 
              src, 
              x: px + Math.round(canvasWidth / 2 - fitW / 2), 
              y: py + Math.round(canvasHeight / 2 - fitH / 2), 
              w: fitW, 
              h: fitH, 
              zoom: 1 
            });
          };
          img.onerror = () => {
            setRefPanel({ src, x: px, y: py, w: canvasWidth, h: canvasHeight, zoom: 1 });
          };
          img.src = src;
          
          addImageColorSlot(src, label);
          onAddToTerminal?.(`🎨 IA adicionou referência "${label}" com paleta de cores!`);
          return `✅ Referência "${label}" adicionada com paleta de cores extraída!`;
        }

        default:
          return `❌ Ação desconhecida: ${action}`;
      }
    },
    
    loadProjectById: async (projectId: string) => {
      await loadProjectById(projectId);
    },
  }));


  // Load sidebar visibility from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('photoEditorSidebars');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.left === 'boolean') setShowLeftSidebar(parsed.left);
        if (typeof parsed.right === 'boolean') setShowRightSidebar(parsed.right);
      }
    } catch { /* ignore */ }
  }, []);

  // Monitor panel changes to automatically toggle drawing mode
  useEffect(() => {
    if (activePanel !== 'draw') {
      setDrawMode(null);
    } else {
      setDrawMode('pen');
    }
  }, [activePanel]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (e.clientX - rect.left) / (rect.width / canvasW);
    const y = (e.clientY - rect.top) / (rect.height / canvasH);
    return { x: Math.round(x), y: Math.round(y) };
  };

  const checkEraserCollision = (ex: number, ey: number) => {
    setElements(prev => {
      const next: DesignElement[] = [];
      let changed = false;
      
      prev.forEach(el => {
        // Se houver algo selecionado e não for este elemento, não apaga
        if (selectedId && el.id !== selectedId) {
          next.push(el);
          return;
        }

        if (el.type === 'drawing' && el.points) {
          const points = el.points;
          const eraserRadius = eraserSize;
          
          const isPointErased = points.map((p, i) => {
            const dx = p.x - ex;
            const dy = p.y - ey;
            const distToPoint = Math.sqrt(dx * dx + dy * dy);
            if (distToPoint < eraserRadius) return true;
            
            // Check segment to previous point
            if (i > 0) {
              const prevP = points[i - 1];
              const l2 = (p.x - prevP.x) ** 2 + (p.y - prevP.y) ** 2;
              if (l2 === 0) return false;
              let t = ((ex - prevP.x) * (p.x - prevP.x) + (ey - prevP.y) * (p.y - prevP.y)) / l2;
              t = Math.max(0, Math.min(1, t));
              const projX = prevP.x + t * (p.x - prevP.x);
              const projY = prevP.y + t * (p.y - prevP.y);
              const distToSeg = Math.sqrt((ex - projX) ** 2 + (ey - projY) ** 2);
              if (distToSeg < eraserRadius) return true;
            }
            return false;
          });
          
          const hasErasedPoints = isPointErased.some(x => x);
          if (hasErasedPoints) {
            changed = true;
            const segments: { x: number; y: number }[][] = [];
            let currentSegment: { x: number; y: number }[] = [];
            
            for (let i = 0; i < points.length; i++) {
              if (isPointErased[i]) {
                if (currentSegment.length > 0) {
                  segments.push(currentSegment);
                  currentSegment = [];
                }
              } else {
                currentSegment.push(points[i]);
              }
            }
            if (currentSegment.length > 0) {
              segments.push(currentSegment);
            }
            
            segments.forEach((seg, idx) => {
              if (seg.length > 1) { // Only keep segments with at least 2 points
                next.push({
                  ...el,
                  id: idx === 0 ? el.id : genId(),
                  points: seg,
                  zIndex: el.zIndex
                });
              }
            });
          } else {
            next.push(el);
          }
        } else {
          // A borracha não deve deletar elementos inteiros (como textos, imagens e formas)
          next.push(el);
        }
      });
      
      if (changed) {
        eraserChangedRef.current = true;
        return next;
      }
      return prev;
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Mockup mode: add points
    if (mockupMode && !mockupClosed) {
      e.stopPropagation();
      const { x, y } = getCanvasCoords(e);
      
      // Se tem pontos e clicar perto do primeiro, fecha o polígono
      if (mockupPoints.length >= 3) {
        const first = mockupPoints[0];
        const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
        if (dist < 20) {
          setMockupClosed(true);
          showToast('✓ Área fechada! Confirme para criar o mockup');
          return;
        }
      }
      
      setMockupPoints(prev => [...prev, { x, y }]);
      return;
    }
    
    // Draw mode: handle pen/eraser
    if (drawMode) {
      e.stopPropagation();
      const { x, y } = getCanvasCoords(e);
      if (drawMode === 'pen') {
        isDrawingRef.current = true;
        const newId = genId();
        const newEl: DesignElement = {
          id: newId,
          type: 'drawing',
          x: 0,
          y: 0,
          w: canvasW,
          h: canvasH,
          rotation: 0,
          opacity: penOpacity,
          locked: false,
          zIndex: zCounter,
          points: [{ x, y }],
          strokeColor: penColor,
          strokeWidth: penSize,
        };
        setZCounter(p => p + 1);
        setElements(prev => {
          const next = [...prev, newEl];
          return next;
        });
        activeDrawIdRef.current = newId;
      } else if (drawMode === 'eraser') {
        let targetId = selectedId;
        if (!targetId) {
          // Use elementos da página ativa em vez de pgSorted
          const activePage = pages.find(p => p.id === activePageId);
          if (!activePage) return;
          const sorted = [...activePage.elements].sort((a, b) => a.zIndex - b.zIndex);
          const target = [...sorted].reverse().find(el => {
            if (el.locked) return false;
            const elX = el.x ?? 0;
            const elY = el.y ?? 0;
            const elW = el.w ?? (el.type === 'drawing' ? canvasW : 100);
            const elH = el.h ?? (el.type === 'drawing' ? canvasH : 100);
            return x >= elX && x <= elX + elW && y >= elY && y <= elY + elH;
          });
          targetId = target?.id || null;
        }

        if (targetId) {
          isDrawingRef.current = true;
          activeDrawIdRef.current = targetId;
          const strokeId = genId();
          activeEraserStrokeIdRef.current = strokeId;
          eraserChangedRef.current = false;
          
          setElements(prev => prev.map(el => {
            if (el.id === targetId) {
              const newStroke = { id: strokeId, points: [{x, y}], size: eraserSize, opacity: eraserOpacity };
              return {
                ...el,
                eraserStrokes: [...(el.eraserStrokes || []), newStroke]
              };
            }
            return el;
          }));
        } else {
          // If drawing clicked nothing, we just try to use the legacy point collision for drawing paths just in case
          isDrawingRef.current = true;
          eraserChangedRef.current = false;
          checkEraserCollision(x, y);
        }
      }
      return;
    }

    // No element was clicked (event came from canvas background) — start marquee selection
    if (e.target === e.currentTarget && !selectedId) {
      if (e.button !== 0) return; // Only left click
      const { x, y } = getCanvasCoords(e);
      marqueeRef.current = { active: true, startX: x, startY: y, endX: x, endY: y };
      setMarqueeRect({ x, y, w: 0, h: 0 });
      setMultiSelectedIds([]);
      e.stopPropagation();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setCursorCoords({ x: e.clientX, y: e.clientY });
    
    // Mockup mode: track mouse position
    if (mockupMode && !mockupClosed) {
      const { x, y } = getCanvasCoords(e);
      setMockupMousePos({ x, y });
    }
    
    if (!drawMode || !isDrawingRef.current) return;
    e.stopPropagation();
    
    const { x, y } = getCanvasCoords(e);
    
    if (drawMode === 'pen' && activeDrawIdRef.current) {
      setElements(prev => {
        const next = prev.map(el => {
          if (el.id === activeDrawIdRef.current && el.points) {
            return {
              ...el,
              points: [...el.points, { x, y }]
            };
          }
          return el;
        });
        return next;
      });
    } else if (drawMode === 'eraser') {
      // If we have an active target element with eraserStrokes, add points to the active stroke
      if (activeDrawIdRef.current && activeEraserStrokeIdRef.current) {
        setElements(prev => prev.map(el => {
          if (el.id === activeDrawIdRef.current && el.eraserStrokes) {
            return {
              ...el,
              eraserStrokes: el.eraserStrokes.map(stroke => {
                if (stroke.id === activeEraserStrokeIdRef.current) {
                  return {
                    ...stroke,
                    points: [...stroke.points, { x, y }]
                  };
                }
                return stroke;
              })
            };
          }
          return el;
        }));
      } else {
        // Fallback: legacy collision check for drawing elements
        checkEraserCollision(x, y);
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {

    if (!drawMode) return;
    e.stopPropagation();
    
    if (isDrawingRef.current) {
      if (drawMode === 'pen' && activeDrawIdRef.current) {
        setElements(prev => {
          saveHistory(prev, canvasBg);
          return prev;
        });
      } else if (drawMode === 'eraser') {
        // Save history if we made any changes
        if (activeEraserStrokeIdRef.current || eraserChangedRef.current) {
          setElements(prev => {
            saveHistory(prev, canvasBg);
            return prev;
          });
          eraserChangedRef.current = false;
        }
      }
      isDrawingRef.current = false;
      activeDrawIdRef.current = null;
      activeEraserStrokeIdRef.current = null;
    }
  };

  // Save sidebar visibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('photoEditorSidebars', JSON.stringify({ left: showLeftSidebar, right: showRightSidebar }));
    } catch { /* ignore */ }
  }, [showLeftSidebar, showRightSidebar]);

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // ZOOM & FIT
  // ═══════════════════════════════════════════════════════════

  const fitToScreen = useCallback(() => {
    const area = viewportRef.current;
    if (!area) return;
    const r = area.getBoundingClientRect();
    const zw = (r.width - 40) / canvasW;
    const zh = (r.height - 40) / canvasH;
    const nz = Math.max(0.65, Math.min(zw, zh, 1.15));
    setZoom(nz);
    setPanX(0);
    setPanY(0);
  }, [canvasW, canvasH]);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevActivePageIdRef.current = activePageId;
      return;
    }
    // Only auto-fit when the canvas was resized on the SAME page.
    // When switching pages or adding new ones, keep the current zoom level.
    if (prevActivePageIdRef.current !== activePageId) {
      prevActivePageIdRef.current = activePageId;
      return;
    }
    prevActivePageIdRef.current = activePageId;
    setTimeout(fitToScreen, 100);
  }, [canvasW, canvasH, fitToScreen, activePageId]);

  // ═══════════════════════════════════════════════════════════
  // ELEMENT CREATION
  // ═══════════════════════════════════════════════════════════

  const addElement = useCallback((el: Partial<DesignElement>) => {
    const newEl: DesignElement = {
      id: genId(),
      type: 'text',
      x: canvasW / 2 - 150,
      y: canvasH / 2 - 40,
      w: 300,
      h: 80,
      rotation: 0,
      opacity: 100,
      locked: false,
      zIndex: zCounter,
      ...el,
    };
    setZCounter(p => p + 1);
    setElements(prev => {
      const next = [...prev, newEl];
      saveHistory(next, canvasBg);
      return next;
    });
    setSelectedId(newEl.id);
    
    // Log da ação
    if (newEl.type === 'text') {
      // onProjectAction?.(`Texto adicionado: "${newEl.text || 'novo texto'}"`);
    } else if (newEl.type === 'image') {
      // onProjectAction?.('Imagem adicionada ao canvas');
    } else if (newEl.type === 'shape') {
      // onProjectAction?.(`Forma adicionada: ${newEl.shapeKind || 'desconhecida'}`);
    }
    
    return newEl.id;
  }, [canvasW, canvasH, zCounter, canvasBg, saveHistory, onProjectAction]);

  const addText = useCallback((preset: 'h1' | 'h2' | 'body') => {
    const configs = {
      h1: { text: 'Título Principal', fontSize: 48, fontWeight: '700', w: 500, h: 80 },
      h2: { text: 'Subtítulo', fontSize: 28, fontWeight: '600', w: 400, h: 60 },
      body: { text: 'Adicione seu texto aqui...', fontSize: 16, fontWeight: '400', w: 350, h: 80 },
    };
    const c = configs[preset];
    addElement({
      type: 'text',
      ...c,
      x: canvasW / 2 - c.w / 2,
      y: canvasH / 2 - c.h / 2,
      fontFamily: 'Inter',
      fontStyle: 'normal',
      textAlign: 'center',
      textColor: '#ffffff',
    });
  }, [addElement, canvasW, canvasH]);

  const addShape = useCallback((kind: ShapeKind) => {
    addElement({
      type: 'shape',
      shapeKind: kind,
      x: canvasW / 2 - 80,
      y: canvasH / 2 - 80,
      w: kind === 'line' ? 200 : 160,
      h: kind === 'line' ? 40 : 160,
      fillColor: '#7c5cfc',
      strokeColor: 'transparent',
      strokeWidth: 0,
    });
  }, [addElement, canvasW, canvasH]);

  const applyTemplate = useCallback((tpl: Template) => {
    setCanvasBg(tpl.bg);
    const baseH = tpl.baseH ?? 360;
    const scale = Math.min(canvasW / 620, canvasH / baseH);
    const newEls: DesignElement[] = tpl.elements.map((el, i) => ({
      id: genId(),
      type: (el.type ?? 'text') as ElementType,
      x: (el.x ?? 0) * scale,
      y: (el.y ?? 0) * scale,
      w: (el.w ?? 200) * scale,
      h: (el.h ?? 60) * scale,
      rotation: 0,
      opacity: 100,
      locked: false,
      zIndex: i + 1,
      ...el,
      fontSize: el.fontSize ? el.fontSize * scale : 16,
    }));
    setElements(newEls);
    setZCounter(newEls.length + 1);
    saveHistory(newEls, tpl.bg);
    setSelectedId(null);
    showToast(`✨ Template "${tpl.name}" aplicado!`);
  }, [canvasW, canvasH, saveHistory, showToast]);


  const handleRemoveBackground = async (el: DesignElement) => {
    if (!el.imageSrc) return;
    try {
      setIsRemovingBg(true);
      onAddToTerminal?.(`✨ [Removedor de Fundo] Iniciando...`);

      // Sempre opera na página de DESIGN (principal), não na de rascunho
      const designPageId = getDesignPageId(pages, activePageId);
      const designPage = pages.find(p => p.id === designPageId) ?? pages[0];

      // Busca o elemento atualizado na página de design
      const currentEl = designPage.elements.find(e => e.id === el.id) || el;

      // Função auxiliar para atualizar elemento na página de design (não na ativa)
      const updateDesignElement = (id: string, changesOrFn: Partial<DesignElement> | ((current: DesignElement) => Partial<DesignElement>)) => {
        setPages(prev => prev.map(p => {
          if (p.id !== designPageId) return p;
          const next = p.elements.map(e => {
            if (e.id !== id) return e;
            const changes = typeof changesOrFn === 'function' ? changesOrFn(e) : changesOrFn;
            return { ...e, ...changes };
          });
          saveHistory(next, p.bg, designPageId);
          return { ...p, elements: next };
        }));
      };

      let src = el.imageSrc;

      // Converter file:// para base64 via Canvas
      if (!src.startsWith('data:')) {
        onAddToTerminal?.(` 📝 [Removedor de Fundo] Convertendo imagem para base64...`);
        src = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const cvs = document.createElement('canvas');
            cvs.width = img.naturalWidth;
            cvs.height = img.naturalHeight;
            cvs.getContext('2d')!.drawImage(img, 0, 0);
            resolve(cvs.toDataURL('image/png'));
          };
          img.onerror = () => reject(new Error('Falha ao carregar imagem'));
          img.src = currentEl.imageSrc!;
        });
      }

      onAddToTerminal?.(` ⚙️ [Removedor de Fundo] Executando rembg...`);
      const result = await (window as any).electronAPI.removeBackground(src);

      if (result?.success && result.base64) {
        const newSrc = `data:image/png;base64,${result.base64}`;

        // Detecta bbox e faz CROP REAL da imagem — gera PNG menor sem bordas transparentes
        // Retorna valores brutos de pixels para recalcular com coordenadas atuais do elemento
        const cropToContent = (): Promise<{src: string; _origW: number; _origH: number; _minX: number; _minY: number; _cropW: number; _cropH: number; x: number; y: number; w: number; h: number} | null> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const iw = img.naturalWidth;
              const ih = img.naturalHeight;
              const tmp = document.createElement('canvas');
              tmp.width = iw; tmp.height = ih;
              const ctx = tmp.getContext('2d')!;
              ctx.drawImage(img, 0, 0);
              const data = ctx.getImageData(0, 0, iw, ih).data;

              let minX = iw, minY = ih, maxX = 0, maxY = 0;
              let found = false;
              for (let py = 0; py < ih; py++) {
                for (let px = 0; px < iw; px++) {
                  if (data[(py * iw + px) * 4 + 3] > 10) {
                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;
                    found = true;
                  }
                }
              }

              if (!found) { resolve(null); return; }

              const cropW = maxX - minX + 1;
              const cropH = maxY - minY + 1;

              // Se bbox é quase igual ao original, não precisa recortar
              if (cropW >= iw * 0.98 && cropH >= ih * 0.98) {
                resolve({ src: newSrc, _origW: iw, _origH: ih, _minX: 0, _minY: 0, _cropW: iw, _cropH: ih, x: currentEl.x, y: currentEl.y, w: currentEl.w, h: currentEl.h });
                return;
              }

              // Cria canvas recortado
              const cropped = document.createElement('canvas');
              cropped.width = cropW;
              cropped.height = cropH;
              cropped.getContext('2d')!.drawImage(tmp, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
              const croppedSrc = cropped.toDataURL('image/png');

              // Retorna também valores brutos para recalcular depois com coords frescas
              const scaleX = currentEl.w / iw;
              const scaleY = currentEl.h / ih;
              resolve({
                src: croppedSrc,
                _origW: iw, _origH: ih,
                _minX: minX, _minY: minY,
                _cropW: cropW, _cropH: cropH,
                x: Math.round(currentEl.x + minX * scaleX),
                y: Math.round(currentEl.y + minY * scaleY),
                w: Math.round(cropW * scaleX),
                h: Math.round(cropH * scaleY),
              });
            };
            img.onerror = () => resolve(null);
            img.src = newSrc;
          });
        };

        const cropped = await cropToContent();
        
        // Lê o elemento ATUALIZADO do state (após o rembg, a IA pode ter posicionado o elemento)
        updateDesignElement(el.id, (currentUpdated) => {
          const updates: Partial<DesignElement> = { imageSrc: newSrc, imageObjectFit: 'cover' };
          if (cropped && cropped.w > 10 && cropped.h > 10) {
            // Recalcula com as coordenadas ATUAIS do elemento (não as do início da função)
            const freshEl = currentUpdated;
            const iw = cropped._origW ?? 1;
            const ih = cropped._origH ?? 1;
            const scaleX = freshEl.w / (iw || freshEl.w);
            const scaleY = freshEl.h / (ih || freshEl.h);
            updates.imageSrc = cropped.src;
            updates.x = Math.round(freshEl.x + (cropped._minX ?? 0) * scaleX);
            updates.y = Math.round(freshEl.y + (cropped._minY ?? 0) * scaleY);
            updates.w = Math.round((cropped._cropW ?? freshEl.w) * scaleX);
            updates.h = Math.round((cropped._cropH ?? freshEl.h) * scaleY);
            onAddToTerminal?.(` 📐 [Removedor de Fundo] Recortado para ${updates.w}×${updates.h}px`);
          }
          return updates;
        });
        showToast(`✨ Fundo removido!`);
        onAddToTerminal?.(` ✅ [Removedor de Fundo] Concluído!`);
      } else {
        throw new Error(result?.error || 'Erro desconhecido no script Python.');
      }
    } catch (e: any) {
      showToast(`❌ Falha ao remover fundo!`);
      onAddToTerminal?.(` ❌ [Removedor de Fundo] ${e.message}`);
    } finally {
      setIsRemovingBg(false);
    }
  };


  const handleEnhanceImage = async (el: DesignElement) => {
    if (!el.imageSrc) return;
    try {
      setIsEnhancingImage(true);
      onAddToTerminal?.(`✨ [Melhorar Qualidade] Iniciando otimização da imagem...`);
      onAddToTerminal?.(` ⚙️ [Melhorar Qualidade] Processando nitidez, contraste e resolução...`);

      const result = await (window as any).electronAPI.enhanceImagePython(el.imageSrc);

      if (result && result.success && result.newSrc) {
        updateElement(el.id, { imageSrc: result.newSrc });
        showToast(`✨ Qualidade da imagem melhorada!`);
        onAddToTerminal?.(` ✅ [Melhorar Qualidade] Concluído com sucesso!`);
      } else {
        throw new Error(result?.error || 'Script de melhoria de qualidade falhou.');
      }
    } catch (e: any) {
      showToast(`❌ Falha ao melhorar qualidade!`);
      onAddToTerminal?.(` ❌ [Melhorar Qualidade] Erro: ${e.message}`);
    } finally {
      setIsEnhancingImage(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // UPDATE ELEMENT
  // ═══════════════════════════════════════════════════════════

  const updateElement = useCallback((id: string, changes: Partial<DesignElement>, noHistory = false) => {
    if ('textCurve' in changes) {
      console.log('[updateElement] Atualizando textCurve:', changes.textCurve);
    }
    setElements(prev => {
      const isMulti = multiSelectedIdsRef.current.includes(id) && multiSelectedIdsRef.current.length > 1;
      const isPositional = 'x' in changes || 'y' in changes || 'w' in changes || 'h' in changes || 'rotation' in changes || 'points' in changes || 'cropOffsetX' in changes;
      const targetIds = (isMulti && !isPositional) ? multiSelectedIdsRef.current : [id];
      const next = prev.map(el => {
        if (targetIds.includes(el.id)) {
          const updated = { ...el, ...changes };
          if ('textCurve' in changes) {
            console.log('[updateElement] Elemento atualizado:', updated.id, 'textCurve:', updated.textCurve);
          }
          return updated;
        }
        return el;
      });
      if (!noHistory) saveHistory(next, canvasBg);
      return next;
    });
  }, [canvasBg, saveHistory]);

  const applyPenMask = useCallback(() => {
    if (!imagePenMaskEl || !penMaskImageRef.current || maskPoints.length < 3) return;
    const img = penMaskImageRef.current;
    
    // Scale points from display size back to original image size
    const scaleX = img.width / penMaskDisplaySize.w;
    const scaleY = img.height / penMaskDisplaySize.h;
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(maskPoints[0].x * scaleX, maskPoints[0].y * scaleY);
    for (let i = 1; i < maskPoints.length; i++) {
      ctx.lineTo(maskPoints[i].x * scaleX, maskPoints[i].y * scaleY);
    }
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(img, 0, 0);
    
    const base64 = canvas.toDataURL('image/png');
    updateElement(imagePenMaskEl.id, { imageSrc: base64 });
    setImagePenMaskEl(null);
    showToast('✨ Imagem recortada!');
    onAddToTerminal?.(`✅ [Recorte de Caneta] Recorte aplicado com sucesso!`);
  }, [imagePenMaskEl, maskPoints, penMaskDisplaySize, updateElement, showToast, onAddToTerminal]);

  const reorderLayers = useCallback((fromIdx: number, toIdx: number) => {
    setElements(prev => {
      const list = [...prev].sort((a, b) => b.zIndex - a.zIndex);
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      
      const updated = list.map((el, index) => ({
        ...el,
        zIndex: list.length - index
      }));
      
      saveHistory(updated, canvasBg);
      return updated;
    });
  }, [canvasBg, saveHistory]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTimelineIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTimelineIdx === null || draggedTimelineIdx === index) return;
    reorderLayers(draggedTimelineIdx, index);
    setDraggedTimelineIdx(null);
  };

  const deleteElement = useCallback((id: string) => {
    setElements(prev => {
      const next = prev.filter(el => el.id !== id);
      saveHistory(next, canvasBg);
      return next;
    });
    setSelectedId(null);
  }, [canvasBg, saveHistory]);

  const duplicateElement = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const newEl: DesignElement = { ...el, id: genId(), x: el.x + 20, y: el.y + 20, zIndex: zCounter };
    setZCounter(p => p + 1);
    setElements(prev => {
      const next = [...prev, newEl];
      saveHistory(next, canvasBg);
      return next;
    });
    setSelectedId(newEl.id);
  }, [elements, zCounter, canvasBg, saveHistory]);

  // ═══════════════════════════════════════════════════════════
  // Z-ORDER
  // ═══════════════════════════════════════════════════════════

  const bringForward = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const above = elements.filter(e => e.zIndex > el.zIndex);
    if (above.length === 0) return;
    const next = Math.min(...above.map(e => e.zIndex));
    updateElement(id, { zIndex: next + 0.5 });
    // Normalize z-indexes
    setElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      return sorted.map((e, i) => ({ ...e, zIndex: i + 1 }));
    });
  }, [elements, updateElement]);

  const sendBackward = useCallback((id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    const below = elements.filter(e => e.zIndex < el.zIndex);
    if (below.length === 0) return;
    const prev = Math.max(...below.map(e => e.zIndex));
    updateElement(id, { zIndex: prev - 0.5 });
    setElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      return sorted.map((e, i) => ({ ...e, zIndex: i + 1 }));
    });
  }, [elements, updateElement]);

  // ═══════════════════════════════════════════════════════════
  // DRAG / RESIZE / ROTATE
  // ═══════════════════════════════════════════════════════════

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const onElementMouseDown = useCallback((e: React.MouseEvent, id: string, handle?: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId === id) return; // allow text editing

    setContextMenu(null);

    const el = elements.find(en => en.id === id);
    if (!el || el.locked) return;

    // Check if clicking a grouped element
    let targetIds = [id];
    if (el.groupId) {
      targetIds = elements.filter(en => en.groupId === el.groupId).map(en => en.id);
    }
    
    const isMultiClick = multiSelectedIds.includes(id);
    const draggingIds = (isMultiClick && multiSelectedIds.length > 1) ? multiSelectedIds : targetIds;

    if (draggingIds.length > 1) {
      if (!isMultiClick && targetIds.length > 1) {
        setMultiSelectedIds(targetIds);
        setSelectedId(id);
      }
    } else {
      setMultiSelectedIds([]);
      setSelectedId(id);
    }

    const pt = getCanvasPoint(e.clientX, e.clientY);

    let bx = el.x, by = el.y, bw = el.w, bh = el.h;
    if (draggingIds.length > 1) {
      const mels = elements.filter(e => draggingIds.includes(e.id));
      const minX = Math.min(...mels.map(e => e.x));
      const minY = Math.min(...mels.map(e => e.y));
      const maxX = Math.max(...mels.map(e => e.x + e.w));
      const maxY = Math.max(...mels.map(e => e.y + e.h));
      bx = minX; by = minY; bw = maxX - minX; bh = maxY - minY;
    }

    if (handle === 'rotate') {
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      dragRef.current = {
        active: true, type: 'rotate',
        startX: e.clientX, startY: e.clientY,
        origX: bx, origY: by, origW: bw, origH: bh,
        origRot: el.rotation, handle,
        elCx: cx, elCy: cy
      };
    } else if (handle?.startsWith('deform-')) {
      const corner = handle.replace('deform-', '') as DeformCornerKey;
      dragRef.current = {
        active: true, type: 'deform',
        startX: pt.x, startY: pt.y,
        origX: bx, origY: by, origW: bw, origH: bh,
        origRot: el.rotation, handle,
        deformCorner: corner,
        origDeformCorners: JSON.parse(JSON.stringify(getDeformCorners(el))),
      };
    } else if (handle) {
      const mels = elements.filter(e => draggingIds.includes(e.id));
      dragRef.current = {
        active: true, type: 'resize',
        startX: pt.x, startY: pt.y,
        origX: bx, origY: by, origW: bw, origH: bh,
        origRot: el.rotation, handle,
        origFontSize: el.type === 'text' ? (el.fontSize ?? 16) : undefined,
        origCropX: el.cropOffsetX ?? 0,
        origCropY: el.cropOffsetY ?? 0,
        origCropImgW: el.cropImgW ?? el.w,
        origCropH: el.cropImgH ?? el.h,
        multiDragIds: draggingIds.length > 1 ? draggingIds : undefined,
        multiDragOrig: draggingIds.length > 1 ? mels.map(m => ({ id: m.id, origX: m.x, origY: m.y, origW: m.w, origH: m.h })) : undefined
      };
    } else {
      snapLockRef.current = { x: false, y: false };
      const mels = elements.filter(e => draggingIds.includes(e.id));
      dragRef.current = {
        active: true, type: 'move',
        startX: pt.x - bx, startY: pt.y - by,
        origX: bx, origY: by, origW: bw, origH: bh,
        origRot: el.rotation,
        sourcePageId: activePageId,
        sourcePageRect: canvasRef.current?.getBoundingClientRect(),
        origEl: JSON.parse(JSON.stringify(el)),
        multiDragIds: draggingIds.length > 1 ? draggingIds : undefined,
        multiDragOrig: draggingIds.length > 1 ? mels.map(m => ({ id: m.id, origX: m.x, origY: m.y, origW: m.w, origH: m.h })) : undefined
      };
    }
    e.preventDefault();
  }, [elements, editingId, getCanvasPoint]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // Marquee update
      if (marqueeRef.current.active) {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        marqueeRef.current.endX = pt.x;
        marqueeRef.current.endY = pt.y;
        const rx = Math.min(marqueeRef.current.startX, pt.x);
        const ry = Math.min(marqueeRef.current.startY, pt.y);
        const rw = Math.abs(pt.x - marqueeRef.current.startX);
        const rh = Math.abs(pt.y - marqueeRef.current.startY);
        setMarqueeRect({ x: rx, y: ry, w: rw, h: rh });
        return;
      }

      // Canvas / Page dragging
      if (canvasDragRef.current.active && canvasDragRef.current.pageId) {
        const dx = (e.clientX - canvasDragRef.current.startX) / zoom;
        const dy = (e.clientY - canvasDragRef.current.startY) / zoom;
        const pageId = canvasDragRef.current.pageId;
        setPages(prev => prev.map(p => {
          if (p.id === pageId) {
            return {
              ...p,
              x: canvasDragRef.current.origX + dx,
              y: canvasDragRef.current.origY + dy,
            };
          }
          return p;
        }));
        return;
      }

      // Panel drag — convert screen delta to canvas coords by dividing by zoom
      if (panelDragRef.current.active) {
        const dx = e.clientX - panelDragRef.current.startX;
        const dy = e.clientY - panelDragRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panelDragRef.current.didMove = true;

        if (layersDockMode === 'floating') {
            if (e.clientX > window.innerWidth - 80) {
                setLayersDockMode('right');
                panelDragRef.current.active = false;
                showToast('Painel ancorado à direita');
                return;
            } else if (e.clientX < 80) {
                setLayersDockMode('left');
                panelDragRef.current.active = false;
                showToast('Painel ancorado à esquerda');
                return;
            } else if (e.clientY > window.innerHeight - 80) {
                setLayersDockMode('bottom');
                panelDragRef.current.active = false;
                showToast('Painel ancorado abaixo');
                return;
            } else if (e.clientY < 80) {
                setLayersDockMode('top');
                panelDragRef.current.active = false;
                showToast('Painel ancorado no topo');
                return;
            }
        }

        const nx = panelDragRef.current.origX + dx;
        const ny = panelDragRef.current.origY + dy;
        panelDragRef.current.currentX = nx;
        panelDragRef.current.currentY = ny;
        if (timelinePanelRef.current) {
          timelinePanelRef.current.style.left = `${nx}px`;
          timelinePanelRef.current.style.top  = `${ny}px`;
        }
        return;
      }

      if (!dragRef.current.active || (!selectedId && !dragRef.current.multiDragIds)) return;
      const el = elements.find(en => en.id === selectedId);
      if (!el && !dragRef.current.multiDragIds) return;

      const { type, handle } = dragRef.current;

      if (type === 'move') {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const nx = pt.x - dragRef.current.startX;
        const ny = pt.y - dragRef.current.startY;

        // ── CROSS-CANVAS: detect hover target ──
        let hoveredPageId: string | null = null;
        const sourceId = dragRef.current.sourcePageId;
        for (const [pgId, div] of pageRefsMap.current) {
          if (pgId === sourceId) continue;
          const r = div.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            hoveredPageId = pgId;
            break;
          }
        }
        setCrossCanvasTargetId(hoveredPageId);

        // ── MULTI-DRAG ──
        if (dragRef.current.multiDragIds && dragRef.current.multiDragOrig) {
          const dx = nx - dragRef.current.origX;
          const dy = ny - dragRef.current.origY;
          setElements(prev => prev.map(en => {
            if (dragRef.current.multiDragIds!.includes(en.id)) {
              const orig = dragRef.current.multiDragOrig!.find(m => m.id === en.id);
              if (orig) return { ...en, x: orig.origX + dx, y: orig.origY + dy };
            }
            return en;
          }));
          setActiveGuides({ x: false, y: false });
          return;
        }
        
        // ── SNAP & ALIGNMENT GUIDES ──
        const SNAP_ENTER = 26;
        const SNAP_RELEASE = 40;
        const centerX = nx + el.w / 2;
        const centerY = ny + el.h / 2;
        
        let snappedX = nx;
        let snappedY = ny;
        let guideX = false;
        let guideY = false;

        const distCenterX = Math.abs(centerX - canvasW / 2);
        if (snapLockRef.current.x ? distCenterX < SNAP_RELEASE : distCenterX < SNAP_ENTER) {
          snappedX = canvasW / 2 - el.w / 2;
          guideX = true;
          snapLockRef.current.x = true;
        } else {
          snapLockRef.current.x = false;
        }

        const distCenterY = Math.abs(centerY - canvasH / 2);
        if (snapLockRef.current.y ? distCenterY < SNAP_RELEASE : distCenterY < SNAP_ENTER) {
          snappedY = canvasH / 2 - el.h / 2;
          guideY = true;
          snapLockRef.current.y = true;
        } else {
          snapLockRef.current.y = false;
        }
        
        updateElement(selectedId, { x: snappedX, y: snappedY }, true);
        setActiveGuides({ x: guideX, y: guideY });
      } else if (type === 'rotate') {
        const cx = dragRef.current.elCx!;
        const cy = dragRef.current.elCy!;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ex = (e.clientX - rect.left) / zoom;
        const ey = (e.clientY - rect.top) / zoom;
        const angle = Math.atan2(ey - cy, ex - cx) * (180 / Math.PI) + 90;
        updateElement(selectedId, { rotation: angle }, true);
      } else if (type === 'resize') {
        const pt = getCanvasPoint(e.clientX, e.clientY);
        const dx = pt.x - dragRef.current.startX;
        const dy = pt.y - dragRef.current.startY;
        const { origX, origY, origW, origH, origFontSize } = dragRef.current;
        let nx = origX, ny = origY, nw = origW, nh = origH;

        // ── CROP MODO CANVA: Recorta para dentro e expande para fora ──
        if (el.type === 'image' && handle && handle.length === 1) {
          const origPxX = dragRef.current.origCropX ?? 0;
          const origPxY = dragRef.current.origCropY ?? 0;
          const imgW = el.cropImgW ?? origW;
          const imgH = el.cropImgH ?? origH;

          if (handle === 'w') {
            const maxW = origW - origPxX;
            const newW = Math.max(20, Math.min(maxW, origW - dx));
            const moved = origW - newW;
            const newX = origX + moved;
            const newPxX = origPxX - moved;
            updateElement(selectedId, { x: newX, w: newW, cropOffsetX: newPxX, cropOffsetY: origPxY, cropImgW: imgW, cropImgH: imgH }, true);
          } else if (handle === 'e') {
            const maxW = imgW + origPxX;
            const newW = Math.max(20, Math.min(maxW, origW + dx));
            updateElement(selectedId, { w: newW, cropOffsetX: origPxX, cropOffsetY: origPxY, cropImgW: imgW, cropImgH: imgH }, true);
          } else if (handle === 'n') {
            const maxH = origH - origPxY;
            const newH = Math.max(20, Math.min(maxH, origH - dy));
            const moved = origH - newH;
            const newY = origY + moved;
            const newPxY = origPxY - moved;
            updateElement(selectedId, { y: newY, h: newH, cropOffsetX: origPxX, cropOffsetY: newPxY, cropImgW: imgW, cropImgH: imgH }, true);
          } else if (handle === 's') {
            const maxH = imgH + origPxY;
            const newH = Math.max(20, Math.min(maxH, origH + dy));
            updateElement(selectedId, { h: newH, cropOffsetX: origPxX, cropOffsetY: origPxY, cropImgW: imgW, cropImgH: imgH }, true);
          }
          return;
        }

        if (handle?.includes('e')) { nw = Math.max(20, origW + dx); }
        if (handle?.includes('s')) { nh = Math.max(20, origH + dy); }
        if (handle?.includes('w')) { nw = Math.max(20, origW - dx); nx = origX + (origW - nw); }
        if (handle?.includes('n')) { nh = Math.max(20, origH - dy); ny = origY + (origH - nh); }

        // Shift = manter proporção (aspect ratio) de forma linear
        if (shiftPressedRef.current && origW > 0 && origH > 0) {
          const aspectRatio = origW / origH;
          const isCorner = handle && handle.length === 2; // e.g. 'se', 'sw', 'ne', 'nw'
          if (isCorner) {
            // Decide which dimension leads based on the larger relative change
            const relW = Math.abs(nw - origW) / origW;
            const relH = Math.abs(nh - origH) / origH;
            if (relW >= relH) {
              // Width leads — lock height
              const lockedH = Math.max(20, nw / aspectRatio);
              if (handle?.includes('n')) {
                ny = origY + (origH - lockedH);
              }
              nh = lockedH;
            } else {
              // Height leads — lock width
              const lockedW = Math.max(20, nh * aspectRatio);
              if (handle?.includes('w')) {
                nx = origX + (origW - lockedW);
              }
              nw = lockedW;
            }
          } else {
            // Edge handle: use the moved dimension to compute the other
            if (handle === 'e' || handle === 'w') {
              const lockedH = Math.max(20, nw / aspectRatio);
              const dh = lockedH - origH;
              ny = origY - dh / 2;
              nh = lockedH;
            } else if (handle === 'n' || handle === 's') {
              const lockedW = Math.max(20, nh * aspectRatio);
              const dw = lockedW - origW;
              nx = origX - dw / 2;
              nw = lockedW;
            }
          }
        }

        const updates: Partial<DesignElement> = { x: nx, y: ny, w: nw, h: nh };
        
        if (dragRef.current.multiDragIds && dragRef.current.multiDragOrig) {
          const scaleX = nw / dragRef.current.origW;
          const scaleY = nh / dragRef.current.origH;
          
          setElements(prev => prev.map(pEl => {
            if (dragRef.current.multiDragIds!.includes(pEl.id)) {
              const orig = dragRef.current.multiDragOrig!.find(m => m.id === pEl.id);
              if (orig && orig.origW !== undefined && orig.origH !== undefined) {
                return {
                  ...pEl,
                  x: nx + (orig.origX - dragRef.current.origX) * scaleX,
                  y: ny + (orig.origY - dragRef.current.origY) * scaleY,
                  w: orig.origW * scaleX,
                  h: orig.origH * scaleY
                };
              }
            }
            return pEl;
          }));
          return;
        }

        // Ao puxar as pontas de uma imagem cortada: escala o crop proporcionalmente mantendo o recorte intacto!
        if (el.type === 'image' && el.cropImgW && handle && handle.length === 2) {
          const scaleX = nw / origW;
          const scaleY = nh / origH;
          const scale = Math.max(scaleX, scaleY);
          updates.cropImgW = (dragRef.current.origCropImgW ?? el.cropImgW) * scale;
          updates.cropImgH = (dragRef.current.origCropH ?? el.cropImgH) * scale;
          updates.cropOffsetX = (dragRef.current.origCropX ?? 0) * scale;
          updates.cropOffsetY = (dragRef.current.origCropY ?? 0) * scale;
        }
        if (el.type === 'text' && origFontSize) {
          const scale = nh / origH;
          updates.fontSize = Math.max(6, Math.round(origFontSize * scale));
        }
        if (el.type === 'text' && (handle?.includes('e') || handle?.includes('w')) && !shiftPressedRef.current) {
          const lineCount = measureTextLines(
            el.text || '',
            el.fontSize || 16,
            el.fontFamily || 'Inter',
            el.fontWeight || '400',
            el.fontStyle || 'normal',
            nw - 16
          );
          const lineHeight = (el.fontSize || 16) * 1.4;
          updates.h = Math.max(20, Math.round(lineCount * lineHeight + 8));
        }
        updateElement(selectedId, updates, true);
      } else if (type === 'deform') {
        const localPt = clientToElementLocal(el, e.clientX, e.clientY, zoom, canvasRef.current);
        const corner = dragRef.current.deformCorner;
        if (!corner) return;
        const corners = { ...dragRef.current.origDeformCorners! };
        corners[corner] = { x: localPt.x, y: localPt.y };
        updateElement(selectedId, { deformCorners: corners }, true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      // Marquee finalise
      if (marqueeRef.current.active) {
        marqueeRef.current.active = false;
        const { startX, startY, endX, endY } = marqueeRef.current;
        const rx = Math.min(startX, endX);
        const ry = Math.min(startY, endY);
        const rw = Math.abs(endX - startX);
        const rh = Math.abs(endY - startY);
        setMarqueeRect(null);
        if (rw > 4 || rh > 4) {
          const hit = elements.filter(el => {
            if (el.locked || el.type === 'drawing') return false;
            return el.x < rx + rw && el.x + el.w > rx && el.y < ry + rh && el.y + el.h > ry;
          }).map(el => el.id);
          
          if (hit.length > 0) {
            if (hit.length === 1) {
              setSelectedId(hit[0]);
              setMultiSelectedIds([]);
            } else {
              setMultiSelectedIds(hit);
              setSelectedId(null);
            }
          }
        }
        return;
      }

      if (canvasDragRef.current.active) {
        canvasDragRef.current.active = false;
      }
      if (panelDragRef.current.active) {
        panelDragRef.current.active = false;
        setTimelineX(panelDragRef.current.currentX);
        setTimelineY(panelDragRef.current.currentY);
      }
      if (dragRef.current.active) {
        const wasMove = dragRef.current.type === 'move';
        const sourcePageId = dragRef.current.sourcePageId;
        const origEl = dragRef.current.origEl;

        dragRef.current.active = false;
        snapLockRef.current = { x: false, y: false };
        shiftPressedRef.current = false;
        setActiveGuides({ x: false, y: false });
        setCrossCanvasTargetId(null);

        // ── CROSS-CANVAS DROP ──
        if (wasMove && sourcePageId && origEl && (selectedId || dragRef.current.multiDragIds)) {
          let droppedOnPageId: string | null = null;
          for (const [pgId, div] of pageRefsMap.current) {
            if (pgId === sourcePageId) continue;
            const r = div.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
              droppedOnPageId = pgId;
              break;
            }
          }

          if (droppedOnPageId) {
            const targetDiv = pageRefsMap.current.get(droppedOnPageId);
            if (targetDiv) {
              const targetRect = targetDiv.getBoundingClientRect();
              const pt = { x: (e.clientX - targetRect.left) / zoom, y: (e.clientY - targetRect.top) / zoom };
              const mIds = dragRef.current.multiDragIds || [origEl.id];

              setPages(prev => {
                const next = [...prev];
                const srcPage = next.find(p => p.id === sourcePageId);
                const dstPage = next.find(p => p.id === droppedOnPageId);
                if (srcPage && dstPage) {
                  const movingEls = srcPage.elements.filter(el => mIds.includes(el.id));
                  
                  // Calculate where the main element should go in the target canvas
                  const nx = pt.x - origEl.w / 2;
                  const ny = pt.y - origEl.h / 2;

                  const nextSrcElements = srcPage.elements.filter(el => !mIds.includes(el.id));
                  const nextDstElements = [...dstPage.elements];
                  let nextZ = dstPage.zCounter ?? 0;

                  movingEls.forEach(mel => {
                    nextZ++;
                    let targetX = nx;
                    let targetY = ny;
                    
                    if (dragRef.current.multiDragOrig) {
                      const origMel = dragRef.current.multiDragOrig.find(m => m.id === mel.id);
                      if (origMel) {
                        targetX = nx + (origMel.origX - origEl.x);
                        targetY = ny + (origMel.origY - origEl.y);
                      }
                    }

                    nextDstElements.push({ ...mel, x: targetX, y: targetY, zIndex: nextZ });
                  });
                  
                  next.forEach(pg => {
                    if (pg.id === sourcePageId) {
                      pg.elements = nextSrcElements;
                    }
                    if (pg.id === droppedOnPageId) {
                      pg.elements = nextDstElements;
                      pg.zCounter = nextZ;
                    }
                  });

                  if (srcPage) saveHistory(nextSrcElements, srcPage.bg, sourcePageId);
                  if (dstPage) saveHistory(nextDstElements, dstPage.bg, droppedOnPageId!);
                }
                return next;
              });
              
              // Switch active page to destination and select the moved elements
              setActivePageId(droppedOnPageId);
              if (mIds.length === 1) {
                setSelectedId(mIds[0]);
                setMultiSelectedIds([]);
              } else {
                setMultiSelectedIds(mIds);
                setSelectedId(mIds[0]);
              }
              return;
            }
          }
        }

        // Normal same-canvas drag end — save history
        setElements(prev => {
          saveHistory(prev, canvasBg);
          return prev;
        });
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [selectedId, elements, zoom, getCanvasPoint, updateElement, canvasBg, saveHistory, layersDockMode, timelinePosition, showToast, activePageId, setPages, setActivePageId]);

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') {
        // Prevent page scroll when space is held down for panning
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (e.key === 'Shift') {
        shiftPressedRef.current = true;
      }

      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (imagePenMaskEl) {
          setMaskPoints(prev => prev.slice(0, -1));
          setIsClosed(false);
        } else if (imageEraserEl) {
          if (eraserHistoryRef.current.length > 1) {
            eraserHistoryRef.current.pop(); // Pop current state
            const prevState = eraserHistoryRef.current[eraserHistoryRef.current.length - 1];
            const canvas = modalCanvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.putImageData(prevState, 0, 0);
              }
            }
          }
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); if (selectedId) duplicateElement(selectedId); }
      if (e.key === 'Delete' || e.key === 'Backspace') { 
        if (selectedId && editingId !== selectedId) { 
          const el = elements.find(en => en.id === selectedId);
          if (el && !el.locked) {
            e.preventDefault(); 
            deleteElement(selectedId); 
          }
        } 
      }
      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); setContextMenu(null); }

      // Nudge
      if (selectedId && !e.ctrlKey) {
        const d = e.shiftKey ? 10 : 1;
        const el = elements.find(en => en.id === selectedId);
        if (!el || el.locked) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); updateElement(selectedId, { x: el.x - d }); }
        if (e.key === 'ArrowRight') { e.preventDefault(); updateElement(selectedId, { x: el.x + d }); }
        if (e.key === 'ArrowUp') { e.preventDefault(); updateElement(selectedId, { y: el.y - d }); }
        if (e.key === 'ArrowDown') { e.preventDefault(); updateElement(selectedId, { y: el.y + d }); }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'Shift') {
        shiftPressedRef.current = false;
      }
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };

    const onBlur = () => {
      setIsCtrlPressed(false);
      setIsSpacePressed(false);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [selectedId, editingId, elements, undo, redo, duplicateElement, deleteElement, updateElement, imagePenMaskEl, imageEraserEl]);

  // ═══════════════════════════════════════════════════════════
  // WHEEL ZOOM
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(z => Math.max(0.05, Math.min(5, z * delta)));
    };
    const area = viewportRef.current;
    if (area) { area.addEventListener('wheel', onWheel, { passive: false }); }
    return () => { if (area) area.removeEventListener('wheel', onWheel); };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // IMAGE UPLOAD
  // ═══════════════════════════════════════════════════════════

  const handleUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        // Load image to get natural dimensions, then fit inside canvas (contain)
        const img = new Image();
        img.onload = () => {
          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;
          const maxW = canvasW * 0.90;
          const maxH = canvasH * 0.90;
          const scaleX = maxW / naturalW;
          const scaleY = maxH / naturalH;
          const scale = Math.min(scaleX, scaleY, 1); // never upscale beyond natural size
          const fitW = Math.round(naturalW * scale);
          const fitH = Math.round(naturalH * scale);
          addElement({
            type: 'image',
            imageSrc: src,
            imageObjectFit: 'cover',
            x: Math.round(canvasW / 2 - fitW / 2),
            y: Math.round(canvasH / 2 - fitH / 2),
            w: fitW,
            h: fitH,
          });
          showToast('Imagem adicionada!');
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }, [addElement, canvasW, canvasH, showToast]);

  const handleSaveProject = async () => {
    const projectData = {
      type: 'photo-editor',
      designTitle,
      pages,
      activePageId
    };
    
    // Gera thumbnail do canvas ativo usando a mesma lógica do export
    let thumbnailBase64: string | undefined;
    try {
      const activePage = pages.find(p => p.id === activePageId);
      console.log('[Save] Página ativa encontrada:', activePage ? 'SIM' : 'NÃO');
      
      if (activePage) {
        console.log('[Save] Gerando thumbnail via performExportPage...');
        // Usa performExportPage para gerar o thumbnail (mesma função do export)
        const fullDataUrl = await performExportPage(activePage, 0, true);
        console.log('[Save] performExportPage retornou:', fullDataUrl ? `dataURL de ${fullDataUrl.length} caracteres` : 'NULL');
        
        if (fullDataUrl) {
          // Redimensiona para thumbnail
          const img = new globalThis.Image();
          img.src = fullDataUrl;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          
          console.log('[Save] Imagem carregada:', img.width, 'x', img.height);
          
          const thumbCanvas = document.createElement('canvas');
          const thumbSize = 300;
          const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
          thumbCanvas.width = img.width * scale;
          thumbCanvas.height = img.height * scale;
          
          console.log('[Save] Thumbnail redimensionado para:', thumbCanvas.width, 'x', thumbCanvas.height);
          
          const ctx = thumbCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
            thumbnailBase64 = thumbCanvas.toDataURL('image/png');
            console.log('[Save] Thumbnail gerado com sucesso:', thumbnailBase64.substring(0, 50));
          } else {
            console.error('[Save] Falha ao obter contexto 2D do canvas');
          }
        }
      }
    } catch (e) {
      console.error('[Save] Erro ao gerar thumbnail:', e);
    }
    
    console.log('[Save] Salvando projeto com thumbnail:', thumbnailBase64 ? 'SIM' : 'NÃO');
    const result = await (window as any).electronAPI.saveProject('photo', projectData, thumbnailBase64);
    if (result.success) {
      showToast("Projeto salvo com sucesso!");
      onAddToTerminal?.("✅ Projeto de imagem salvo: " + (result.projectId || ''));
      // Atualiza preview do planejamento
      if (thumbnailBase64) {
        console.log('[PhotoEditor] Chamando onUpdatePreview com thumbnail de', thumbnailBase64.length, 'caracteres');
        onUpdatePreview?.(thumbnailBase64);
      } else {
        console.log('[PhotoEditor] Nenhum thumbnail para atualizar preview');
      }
    } else {
      showToast("❌ Erro ao salvar: " + (result.error || 'desconhecido'));
    }
  };

  const handleLoadProject = async () => {
    const result = await (window as any).electronAPI.loadBillProject();
    if (result.success && result.clips) {
      const data = result.clips;
      if (data.type === 'photo-editor') {
        if (data.designTitle) setDesignTitle(data.designTitle);
        if (data.pages && Array.isArray(data.pages)) {
          setPages(data.pages);
          const firstPageId = data.pages[0]?.id || 'page-1';
          setActivePageId(data.activePageId || firstPageId);
          data.pages.forEach((p: CanvasPage) => {
            historyMapRef.current.set(p.id, {
              stack: [{ elements: JSON.parse(JSON.stringify(p.elements)), bg: p.bg }],
              idx: 0
            });
          });
          setCanUndo(false);
          setCanRedo(false);
        }
      }
    }
  };

  const loadProjectById = async (projectId: string) => {
    const result = await (window as any).electronAPI.loadProject('photo', projectId);
    if (result.success && result.data) {
      const data = result.data;
      if (data.type === 'photo-editor') {
        if (data.designTitle) setDesignTitle(data.designTitle);
        if (data.pages && Array.isArray(data.pages)) {
          setPages(data.pages);
          const firstPageId = data.pages[0]?.id || 'page-1';
          setActivePageId(data.activePageId || firstPageId);
          data.pages.forEach((p: CanvasPage) => {
            historyMapRef.current.set(p.id, {
              stack: [{ elements: JSON.parse(JSON.stringify(p.elements)), bg: p.bg }],
              idx: 0
            });
          });
          setCanUndo(false);
          setCanRedo(false);
          showToast("✅ Projeto carregado!");
        }
      }
    } else {
      showToast("❌ Erro ao carregar: " + (result.error || 'desconhecido'));
    }
  };

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  const performExportPage = async (page: CanvasPage, pageIndex: number, preventDownload = false): Promise<string | undefined> => {
    const pageW = page.w;
    const pageH = page.h;
    const pageBg = page.bg;
    const pageElements = page.elements;

    // 1. Preload all image elements first
    const imageElements = pageElements.filter(e => e.type === 'image' && e.imageSrc);
    const loadedImagesMap: { [id: string]: HTMLImageElement } = {};
    
    await Promise.all(
      imageElements.map(async el => {
        if (el.imageSrc) {
          const img = await new Promise<HTMLImageElement | null>((resolve) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
            i.src = el.imageSrc!;
          });
          if (img) {
            loadedImagesMap[el.id] = img;
          }
        }
      })
    );

    // Ensure all web fonts are fully loaded before measuring/drawing
    await document.fonts.ready;

    // Use an offscreen canvas to render the design
    const canvas = document.createElement('canvas');
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext('2d')!;

    // Draw background
    if (pageBg.startsWith('linear-gradient') || pageBg.startsWith('radial-gradient')) {
      try {
        const angleMatch = pageBg.match(/(\d+)deg/);
        const angle = angleMatch ? parseInt(angleMatch[1]) : 180;
        const angleRad = (angle * Math.PI) / 180;
        const length = Math.abs(pageW * Math.sin(angleRad)) + Math.abs(pageH * Math.cos(angleRad));
        const halfLength = length / 2;
        const bgCx = pageW / 2;
        const bgCy = pageH / 2;
        const x0 = bgCx - halfLength * Math.sin(angleRad);
        const y0 = bgCy + halfLength * Math.cos(angleRad);
        const x1bg = bgCx + halfLength * Math.sin(angleRad);
        const y1bg = bgCy - halfLength * Math.cos(angleRad);
        const grad = ctx.createLinearGradient(x0, y0, x1bg, y1bg);
        const stopRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+(\d+)%/g;
        let match;
        let hasStops = false;
        while ((match = stopRegex.exec(pageBg)) !== null) {
          grad.addColorStop(parseFloat(match[2]) / 100, match[1]);
          hasStops = true;
        }
        ctx.fillStyle = hasStops ? grad : '#ffffff';
      } catch (e) {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillRect(0, 0, pageW, pageH);
    } else {
      ctx.fillStyle = pageBg;
      ctx.fillRect(0, 0, pageW, pageH);
    }

    // Sort elements by zIndex to draw in order
    const sorted = [...pageElements].sort((a, b) => a.zIndex - b.zIndex);

    // Draw each element
    sorted.forEach(el => {
      ctx.save();
      
      // Calculate opacity
      ctx.globalAlpha = (el.opacity ?? 100) / 100;
      
      // Position, size, rotation — always use center pivot (matches DOM: no CSS scaleY on wrapper)
      const hasStretch = el.type === 'text' && (el.textStretchY ?? 1) !== 1;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation ?? 0) * Math.PI / 180);
      
      const x1 = -el.w / 2;
      const y1 = -el.h / 2;
      const w = el.w;
      const h = el.h;

      if (el.type === 'text') {
        renderElementWithIsolatedEraser(ctx, el, cx, cy, w, h, (tempCtx, x1, y1, w, h) => {
          const corners = getDeformCorners(el);
          if (el.deformEnabled && !isDefaultDeformCorners(corners, el.w, el.h)) {
            drawWarpedTextOnCanvas(tempCtx, el, corners, x1, y1);
          } else if (hasStretch || (el.textCurve ?? 0) !== 0) {
            const offscreen = document.createElement('canvas');
            offscreen.width  = Math.max(1, Math.round(el.w));
            offscreen.height = Math.max(1, Math.round(el.h));
            const octx = offscreen.getContext('2d');
            if (octx) {
              drawPlainTextToOffscreen(octx, el, offscreen.width, offscreen.height);
              tempCtx.drawImage(offscreen, x1, y1, el.w, el.h * (el.textStretchY ?? 1));
            }
          } else {
            const fontFamilyClean = (el.fontFamily || 'Inter').replace(/['"]/g, '').trim();
            const fontFamily = fontFamilyClean.includes(' ') ? `"${fontFamilyClean}"` : fontFamilyClean;
            tempCtx.font = `${el.fontStyle || 'normal'} ${el.fontWeight || '400'} ${el.fontSize || 16}px ${fontFamily}`;
            tempCtx.fillStyle = el.textColor || '#1a1a2e';
            tempCtx.textBaseline = 'top';
            tempCtx.textAlign = el.textAlign || 'center';

            const maxTextWidth = Math.max(1, el.w - 8);
            const lines = wrapTextToLines(el.text || '', tempCtx, maxTextWidth);

            const fontSize   = el.fontSize || 16;
            const lineHeight = fontSize * 1.4;
            const halfLead   = (lineHeight - fontSize) / 2;

            let startX: number;
            if (el.textAlign === 'center') startX = 0;
            else if (el.textAlign === 'right') startX = w / 2 - 4;
            else startX = x1 + 4;

            if (el.textShadowOffsetX || el.textShadowOffsetY) {
              tempCtx.shadowColor = el.textShadowColor || 'rgba(0,0,0,0.5)';
              tempCtx.shadowBlur = el.textShadowBlur ?? 4;
              tempCtx.shadowOffsetX = el.textShadowOffsetX ?? 0;
              tempCtx.shadowOffsetY = el.textShadowOffsetY ?? 0;
            }

            // Ajuste de posição Y do texto
            const TEXT_Y_OFFSET = 15; // Aumentado para compensar diferença canvas vs DOM
            
            lines.forEach((line, index) => {
              const startY = y1 + TEXT_Y_OFFSET + halfLead + index * lineHeight;
              const strokeWidthVal = el.textStrokeWidth && el.textStrokeWidth > 0 ? el.textStrokeWidth : (el.textHollowEnabled ? 1.5 : 0);
              if (strokeWidthVal > 0) {
                tempCtx.strokeStyle = el.textStrokeColor || '#000000';
                tempCtx.lineWidth = el.textHollowEnabled ? strokeWidthVal : strokeWidthVal * 2;
                tempCtx.strokeText(line, startX, startY);
              }
              if (!el.textHollowEnabled) {
                tempCtx.fillText(line, startX, startY);
              }
            });
            
            tempCtx.shadowColor = 'transparent';
            tempCtx.shadowBlur = 0;
            tempCtx.shadowOffsetX = 0;
            tempCtx.shadowOffsetY = 0;
          }
        });
        
        // TODO: Implementar borracha isolada no export para texto
      } else if (el.type === 'shape') {
        renderElementWithIsolatedEraser(ctx, el, cx, cy, w, h, (tempCtx, x1, y1, w, h) => {
          const kind = el.shapeKind || 'rect';
          tempCtx.beginPath();
          
          if (kind === 'rect') {
            tempCtx.rect(x1, y1, w, h);
          } else if (kind === 'circle') {
            tempCtx.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI);
          } else if (kind === 'triangle') {
            tempCtx.moveTo(0, y1);
            tempCtx.lineTo(x1 + w, y1 + h);
            tempCtx.lineTo(x1, y1 + h);
            tempCtx.closePath();
          } else if (kind === 'star') {
            const pts = [
              [50, 5], [61, 35], [95, 35], [68, 57], [79, 91],
              [50, 70], [21, 91], [32, 57], [5, 35], [39, 35]
            ];
            pts.forEach(([px, py], idx) => {
              const valX = x1 + (px / 100) * w;
              const valY = y1 + (py / 100) * h;
              if (idx === 0) tempCtx.moveTo(valX, valY);
              else tempCtx.lineTo(valX, valY);
            });
            tempCtx.closePath();
          } else if (kind === 'heart') {
            const startY = y1 + h * 0.88;
            tempCtx.moveTo(0, startY);
            tempCtx.bezierCurveTo(x1 + w*0.1, y1 + h*0.6, x1 + w*0.1, y1 + h*0.3, x1 + w*0.1, y1 + h*0.3);
            tempCtx.bezierCurveTo(x1 + w*0.1, y1 + h*0.17, x1 + w*0.2, y1 + h*0.08, x1 + w*0.35, y1 + h*0.08);
            tempCtx.bezierCurveTo(x1 + w*0.43, y1 + h*0.08, 0, y1 + h*0.14, 0, y1 + h*0.14);
            tempCtx.bezierCurveTo(0, y1 + h*0.14, x1 + w*0.57, y1 + h*0.08, x1 + w*0.65, y1 + h*0.08);
            tempCtx.bezierCurveTo(x1 + w*0.8, y1 + h*0.08, x1 + w*0.9, y1 + h*0.17, x1 + w*0.9, y1 + h*0.3);
            tempCtx.bezierCurveTo(x1 + w*0.9, y1 + h*0.6, 0, startY, 0, startY);
            tempCtx.closePath();
          } else if (kind === 'diamond') {
            tempCtx.moveTo(0, y1);
            tempCtx.lineTo(x1 + w, 0);
            tempCtx.lineTo(0, y1 + h);
            tempCtx.lineTo(x1, 0);
            tempCtx.closePath();
          } else if (kind === 'arrow') {
            const pts = [
              [5, 35], [65, 35], [65, 10], [95, 50], [65, 90], [65, 65], [5, 65]
            ];
            pts.forEach(([px, py], idx) => {
              const valX = x1 + (px / 100) * w;
              const valY = y1 + (py / 100) * h;
              if (idx === 0) tempCtx.moveTo(valX, valY);
              else tempCtx.lineTo(valX, valY);
            });
            tempCtx.closePath();
          } else if (kind === 'line') {
            tempCtx.moveTo(x1 + w * 0.04, 0);
            tempCtx.lineTo(x1 + w * 0.96, 0);
          } else if (kind === 'hexagon') {
            const pts = [
              [50, 4], [93, 27], [93, 73], [50, 96], [7, 73], [7, 27]
            ];
            pts.forEach(([px, py], idx) => {
              const valX = x1 + (px / 100) * w;
              const valY = y1 + (py / 100) * h;
              if (idx === 0) tempCtx.moveTo(valX, valY);
              else tempCtx.lineTo(valX, valY);
            });
            tempCtx.closePath();
          } else if (kind === 'cross') {
            const pts = [
              [35, 5], [65, 5], [65, 35], [95, 35], [95, 65], [65, 65], [65, 95], [35, 95], [35, 65], [5, 65], [5, 35], [35, 35]
            ];
            pts.forEach(([px, py], idx) => {
              const valX = x1 + (px / 100) * w;
              const valY = y1 + (py / 100) * h;
              if (idx === 0) tempCtx.moveTo(valX, valY);
              else tempCtx.lineTo(valX, valY);
            });
            tempCtx.closePath();
          }

          if (kind === 'line') {
            tempCtx.strokeStyle = el.fillColor || '#7c5cfc';
            tempCtx.lineWidth = Math.max(el.strokeWidth || 4, 4);
            tempCtx.stroke();
          } else {
            tempCtx.fillStyle = el.fillColor || '#7c5cfc';
            tempCtx.fill();
            if (el.strokeColor && el.strokeColor !== 'transparent' && el.strokeWidth && el.strokeWidth > 0) {
              tempCtx.strokeStyle = el.strokeColor;
              tempCtx.lineWidth = el.strokeWidth;
              tempCtx.stroke();
            }
          }
        });
        
        // TODO: Implementar borracha isolada no export
        // Por enquanto, borracha só funciona no editor (CSS mask)
      } else if (el.type === 'image') {
        const loadedImg = loadedImagesMap[el.id];
        if (!loadedImg) {
          ctx.restore();
          return;
        }
        
        renderElementWithIsolatedEraser(ctx, el, cx, cy, w, h, (tempCtx, x1, y1, w, h) => {
          const corners = getDeformCorners(el);
          if (el.deformEnabled && !isDefaultDeformCorners(corners, el.w, el.h)) {
            drawWarpedImageOnCanvas(tempCtx, el, loadedImg, corners, x1, y1);
            return;
          }

          const brightness = el.brightness ?? 100;
          const contrast = el.contrast ?? 100;
          const saturation = el.saturation ?? 100;
          const shadowOffsetX = el.shadowOffsetX ?? 0;
          const shadowOffsetY = el.shadowOffsetY ?? 0;
          const shadowBlur = el.shadowBlur ?? 15;
          const shadowColor = el.shadowColor || 'rgba(0,0,0,0.5)';
          const vignette = el.vignette ?? 0;
          tempCtx.filter = [
            el.duotoneEnabled ? `url(#duotone-${el.id})` : '',
            `brightness(${brightness}%)`,
            `contrast(${contrast}%)`,
            `saturate(${saturation}%)`,
            `blur(${el.blur ?? 0}px)`,
            `hue-rotate(${el.hueRotate ?? 0}deg)`,
            (shadowOffsetX !== 0 || shadowOffsetY !== 0) ? `drop-shadow(${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor})` : '',
          ].filter(Boolean).join(' ');

          const fit = el.imageObjectFit || 'cover';
          const flipX = el.flipX ? -1 : 1;
          const flipY = el.flipY ? -1 : 1;
          tempCtx.save();
          tempCtx.translate(x1 + w / 2, y1 + h / 2);
          tempCtx.scale(flipX, flipY);
          tempCtx.translate(-(x1 + w / 2), -(y1 + h / 2));
          
          if (el.cropImgW) {
            tempCtx.beginPath();
            tempCtx.rect(x1, y1, w, h);
            tempCtx.clip();
            tempCtx.drawImage(loadedImg, x1 + (el.cropOffsetX ?? 0), y1 + (el.cropOffsetY ?? 0), el.cropImgW, el.cropImgH ?? el.h);
          } else if (fit === 'fill') {
            tempCtx.drawImage(loadedImg, x1, y1, w, h);
          } else {
            const imgW = loadedImg.width;
            const imgH = loadedImg.height;
            const imgRatio = imgW / imgH;
            const boxRatio = w / h;
            
            let srcX = 0, srcY = 0, srcW = imgW, srcH = imgH;
            if (fit === 'cover') {
              if (imgRatio > boxRatio) {
                srcW = imgH * boxRatio;
                srcX = (imgW - srcW) / 2;
              } else {
                srcH = imgW / boxRatio;
                srcY = (imgH - srcH) / 2;
              }
            } else {
              if (imgRatio > boxRatio) {
                const drawH = w / imgRatio;
                tempCtx.drawImage(loadedImg, x1, -drawH / 2, w, drawH);
                tempCtx.filter = 'none';
                tempCtx.restore();
                return;
              } else {
                const drawW = h * imgRatio;
                tempCtx.drawImage(loadedImg, -drawW / 2, y1, drawW, h);
                tempCtx.filter = 'none';
                tempCtx.restore();
                return;
              }
            }
            tempCtx.drawImage(loadedImg, srcX, srcY, srcW, srcH, x1, y1, w, h);
          }

          tempCtx.filter = 'none';

          // Vignette overlay
          if (vignette > 0) {
            tempCtx.save();
            const grad = tempCtx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.8);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, `rgba(0,0,0,${vignette / 100})`);
            tempCtx.fillStyle = grad;
            tempCtx.fillRect(x1, y1, w, h);
            tempCtx.restore();
          }

          // Noise/grain effect
          const noiseIntensity = el.noiseIntensity ?? 0;
          if (noiseIntensity > 0) {
            // Get the full tempCtx canvas bounds, not just x1,y1,w,h
            const canvasWidth = tempCtx.canvas.width;
            const canvasHeight = tempCtx.canvas.height;
            const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
            const data = imageData.data;
            const amount = noiseIntensity * 0.6;
            
            for (let i = 0; i < data.length; i += 4) {
              const grain = (Math.random() - 0.5) * amount;
              data[i] = Math.max(0, Math.min(255, data[i] + grain));
              data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
              data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
            }
            
            tempCtx.putImageData(imageData, 0, 0);
          }
          tempCtx.restore(); // restore inner save (flip)
        });
        
        // TODO: Implementar borracha isolada no export para imagens
      } else if (el.type === 'drawing' && el.points && el.points.length >= 2) {
        // Drawing elements have x:0, y:0, w:canvasW, h:canvasH with absolute-coordinate points.
        // We must draw them without the element's center-translate, so restore first then re-save.
        ctx.restore();
        ctx.save();
        
        ctx.globalAlpha = (el.opacity ?? 100) / 100;
        
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.strokeStyle = el.strokeColor || '#7c5cfc';
        ctx.lineWidth = el.strokeWidth || 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
        return; // skip the final ctx.restore() below since we already restored
      }
      
      ctx.restore();
    });

    // Gerar URL com formato escolhido
    let mimeType = 'image/png';
    let fileExt = 'png';
    
    if (exportFormat === 'jpeg') {
      mimeType = 'image/jpeg';
      fileExt = 'jpg';
    } else if (exportFormat === 'webp') {
      mimeType = 'image/webp';
      fileExt = 'webp';
    }
    
    // Qualidade alta para JPEG/WebP (0.95 = 95%)
    const quality = exportFormat === 'png' ? undefined : 0.95;
    const url = canvas.toDataURL(mimeType, quality);
    
    if (preventDownload) {
      return url;
    }
    const a = document.createElement('a');
    a.href = url;
    const cleanTitle = designTitle.replace(/\s+/g, '_');
    const cleanPageName = page.name.replace(/\s+/g, '_');
    a.download = `${cleanTitle}_${cleanPageName}.${fileExt}`;
    a.click();
  };

  const exportCarousel = useCallback(async (page: CanvasPage) => {
    const match = page.name.match(/Carrossel (\d+)x/);
    if (!match) { await performExportPage(page, 0); return; }
    
    // Select folder for export
    if (window.electronAPI && window.electronAPI.selectFolder && window.electronAPI.saveBase64ToFile) {
      const folderRes = await window.electronAPI.selectFolder();
      if (!folderRes.success || !folderRes.path) {
        showToast('Exportação de carrossel cancelada.');
        return;
      }
      
      const folderPath = folderRes.path;
      const count = parseInt(match[1]);
      const slideW = Math.round(page.w / count);
      const slideH = page.h;
      showToast(`Exportando ${count} slides para a pasta...`);
      // Filter out guide/divider elements (locked ones)
      const userElements = page.elements.filter(el => !el.locked);
      for (let i = 0; i < count; i++) {
        const offsetX = slideW * i;
        const slicePage: CanvasPage = {
          ...page,
          id: `${page.id}-slice-${i}`,
          name: `Slide ${i + 1}`,
          w: slideW, h: slideH,
          elements: userElements
            .map(el => ({ ...el, x: (el.x ?? 0) - offsetX, y: el.y ?? 0 }))
            // Include element if it intersects with the 0 to slideW bounds
            .filter(el => (el.x + (el.w || 0)) > 0 && el.x < slideW),
        };
        const dataUrl = await performExportPage(slicePage, i, true);
        if (dataUrl) {
          const base64 = dataUrl.split(',')[1];
          const cleanTitle = designTitle.replace(/\s+/g, '_');
          const fileName = `${cleanTitle}_Slide_${i + 1}.png`;
          const filePath = `${folderPath}/${fileName}`;
          await window.electronAPI.saveBase64ToFile(filePath, base64);
        }
        await new Promise(r => setTimeout(r, 200));
      }
      showToast(`${count} slides exportados na pasta com sucesso!`);
    } else {
      showToast('Erro: API do Electron não disponível para exportar pastas.');
    }
  }, [showToast, designTitle]);

  const exportSinglePage = useCallback(async (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    if (page.pageKind === 'draft') {
      showToast('⚠️ Rascunhos não são exportados. Use o canvas principal.');
      return;
    }
    
    if (page.name.startsWith('Carrossel ')) {
      await exportCarousel(page);
      return;
    }
    
    await performExportPage(page, pages.indexOf(page));
    showToast(`⬇️ Canvas "${page.name}" exportado!`);
    onAddToTerminal?.(`📥 Exportado: ${designTitle}_${page.name}.png`);
    // onProjectAction?.(`Canvas exportado: ${page.name}`);
  }, [pages, designTitle, showToast, onAddToTerminal, exportCarousel, onProjectAction]);

  const exportAllPages = useCallback(async () => {
    const designPages = pages.filter(p => p.pageKind !== 'draft');
    for (let i = 0; i < designPages.length; i++) {
      await performExportPage(designPages[i], i);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    showToast(`⬇️ ${designPages.length} canvases exportados!`);
    onAddToTerminal?.(`📥 Exportados todos os ${designPages.length} canvases de: ${designTitle}`);
    // onProjectAction?.(`Todos os ${designPages.length} canvases exportados`);
  }, [pages, designTitle, showToast, onAddToTerminal, onProjectAction]);

  const handleExport = useCallback(async () => {
    // Sempre abre o modal para escolher formato, qualidade e resolução
    setShowExportModal(true);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // NEW CANVAS
  // ═══════════════════════════════════════════════════════════

  const addNewPage = useCallback(() => {
    if (pages.length >= 10) {
      showToast('⚠️ Limite de 10 canvases atingido!');
      return;
    }
    const newId = `page-${Date.now()}`;
    const newPage: CanvasPage = {
      id: newId,
      name: `Canvas ${pages.filter(p => p.pageKind !== 'draft').length + 1}`,
      w: newW,
      h: newH,
      bg: '#ffffff',
      elements: [],
      zCounter: 1,
      x: 0,
      y: 0,
      pageKind: 'design',
    };
    historyMapRef.current.set(newId, { stack: [{ elements: [], bg: '#ffffff' }], idx: 0 });
    setPages(prev => [...prev, newPage]);
    setActivePageId(newId);
    setSelectedId(null);
    setShowNewCanvas(false);
    showToast(`🎨 ${newPage.name} criado!`);
  }, [pages, newW, newH, showToast]);

  const createCarousel = useCallback(() => {
    const slideW = 1080;
    const slideH = carouselFormat === 'square' ? 1080 : carouselFormat === 'portrait' ? 1350 : 566;
    const totalW = slideW * carouselCount;
    const id = `carousel-${Date.now()}`;

    // Divider lines and slide number labels
    const elements: any[] = [];
    for (let i = 0; i < carouselCount; i++) {
    }

    historyMapRef.current.set(id, { stack: [{ elements, bg: '#ffffff' }], idx: 0 });
    const page: CanvasPage = {
      id, name: `Carrossel ${carouselCount}x`,
      w: totalW, h: slideH,
      bg: '#ffffff', elements, zCounter: 1001,
      x: 0, y: 0, pageKind: 'design',
    };
    setPages(prev => [...prev, page]);
    setActivePageId(id);
    setSelectedId(null);
    setShowCarouselModal(false);
    showToast(`Carrossel ${carouselCount} slides — ${totalW}x${slideH}px`);
  }, [carouselCount, carouselFormat, showToast]);



  const createDraft = useCallback(() => {
    const currentPage = pages.find(p => p.id === activePageId) ?? pages[0];
    const designPageId = getDesignPageId(pages, currentPage.id);
    const designPage = pages.find(p => p.id === designPageId) ?? currentPage;

    if (designPage.pageKind === 'draft') {
      showToast('⚠️ Selecione o canvas principal primeiro.');
      return;
    }

    const existingDraft = getDraftPageForDesign(pages, designPageId);
    if (existingDraft) {
      setActivePageId(existingDraft.id);
      setActivePanel('draw');
      setDrawMode('pen');
      setSelectedId(null);
      showToast('📝 Rascunho aberto — use a caneta para esboçar o layout.');
      onAddToTerminal?.(`📝 Rascunho reaberto para "${designPage.name}"`);
      return;
    }

    if (pages.length >= 10) {
      showToast('⚠️ Limite de 10 canvases atingido!');
      return;
    }

    const draftId = `draft-${Date.now()}`;
    const linkedIds = selectedId ? [selectedId] : [];
    const draftPage: CanvasPage = {
      id: draftId,
      name: `Rascunho — ${designPage.name}`,
      w: designPage.w,
      h: designPage.h,
      bg: '#f0f0f4',
      elements: [],
      zCounter: 1,
      x: (designPage.x || 0) + designPage.w + 80,
      y: designPage.y || 0,
      pageKind: 'draft',
      draftForPageId: designPageId,
      draftLinkedElementIds: linkedIds,
    };

    historyMapRef.current.set(draftId, { stack: [{ elements: [], bg: '#f0f0f4' }], idx: 0 });
    setPages(prev => [...prev, draftPage]);
    setActivePageId(draftId);
    setSelectedId(null);
    setActivePanel('draw');
    setDrawMode('pen');
    showToast('📝 Rascunho criado — esboce o layout com a caneta!');
    onAddToTerminal?.(
      linkedIds.length > 0
        ? `📝 Rascunho criado (${designPage.w}×${designPage.h}px). Elemento vinculado: ${linkedIds[0]}`
        : `📝 Rascunho criado (${designPage.w}×${designPage.h}px). Desenhe o roteiro e peça à IA para aplicar.`
    );
  }, [pages, activePageId, selectedId, showToast, onAddToTerminal]);

  // ═══════════════════════════════════════════════════════════
  // RENDER SORTED ELEMENTS
  // ═══════════════════════════════════════════════════════════

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  // ═══════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════

  const layersTimelineUI = elements.length > 0 ? (
    <div
      ref={timelinePanelRef}
      className={`canva-layers-timeline dock-${layersDockMode} position-${layersDockMode === 'floating' ? timelinePosition : (layersDockMode === 'bottom' || layersDockMode === 'top' ? 'horizontal' : 'vertical')} ${isTimelineMinimized ? 'minimized' : ''}`}
      style={layersDockMode === 'floating' ? { position: 'absolute', left: `${timelineX}px`, top: `${timelineY}px`, pointerEvents: 'all', zIndex: 9999, transform: `scale(${timelineScale})`, transformOrigin: 'top left' } : { pointerEvents: 'all', zIndex: 9999 }}
    >
      {layersDockMode === 'floating' && (
        <div
          className="clt-header"
          onMouseDown={(e) => {
            if (e.button !== 0 || layersDockMode !== 'floating') return;
            const target = e.target as HTMLElement;
            if (target.closest('button')) return;
            e.preventDefault(); e.stopPropagation();
            panelDragRef.current = { active: true, didMove: false, startX: e.clientX, startY: e.clientY, origX: timelineX, origY: timelineY, currentX: timelineX, currentY: timelineY };
          }}
          style={{ cursor: 'move' }}
        >
          <div className="clt-controls">
            <button className="clt-pos-btn" onClick={(e) => { e.stopPropagation(); setIsTimelineMinimized(prev => !prev); }} title={isTimelineMinimized ? 'Expandir' : 'Minimizar'}>
               {isTimelineMinimized ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
               : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            </button>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
            <button className="clt-pos-btn" onClick={(e) => { 
              e.stopPropagation(); 
              if (timelinePanelRef.current) {
                const isGoingVertical = timelinePosition === 'horizontal';
                timelinePanelRef.current.style.width = isGoingVertical ? '220px' : '600px';
                timelinePanelRef.current.style.height = isGoingVertical ? '400px' : '120px';
              }
              setTimelinePosition(p => p === 'horizontal' ? 'vertical' : 'horizontal'); 
            }} title="Mudar orientação (horizontal ↔ vertical)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6"/>
                <path d="M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {layersDockMode !== 'floating' && (
        <div 
          className="clt-dock-strip"
          onClick={() => setIsTimelineMinimized(prev => !prev)}
          title={isTimelineMinimized ? 'Expandir Camadas' : 'Minimizar Camadas'}
        >
          <div className="clt-dock-strip-line"></div>
          <button 
            className="clt-undock-center-btn" 
            onClick={(e) => { e.stopPropagation(); setLayersDockMode('floating'); setIsTimelineMinimized(false); }}
            title="Desancorar Aba"
          ></button>
          <div className="clt-dock-strip-line"></div>
        </div>
      )}

      {!isTimelineMinimized && (
        <div className="clt-blocks-container">
          {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((el, index) => {
            const isSelected = el.id === selectedId;
            const isDragging = draggedTimelineIdx === index;
            let iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>;
            let label = 'Forma', typeText = el.type;
            if (el.type === 'text') { 
                iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>; 
                label = el.text ? (el.text.substring(0, 15) + (el.text.length > 15 ? '...' : '')) : 'Texto'; 
            }
            else if (el.type === 'image') { 
                iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>; 
                label = el.imageSrc ? (el.imageSrc.startsWith('data:') ? 'Imagem Upload' : el.imageSrc.substring(el.imageSrc.lastIndexOf('/') + 1, el.imageSrc.lastIndexOf('/') + 15) || 'Imagem') : 'Imagem'; 
            }
            else if (el.type === 'drawing') { 
                iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>; 
                label = 'Desenho'; 
            }
            else if (el.type === 'shape') { 
                iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>; 
                label = el.shapeKind ? (el.shapeKind.charAt(0).toUpperCase() + el.shapeKind.slice(1)) : 'Forma'; 
            }
            else if (el.type === 'mockup') {
                iconSVG = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
                label = 'Mockup';
            }
            return (
              <div key={el.id} className={`clt-block ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
              >
                <div className="clt-icon-area">
                  {el.type === 'image' && el.imageSrc ? (
                    <img className="clt-thumb-img" src={el.imageSrc} alt="" />
                  ) : el.type === 'shape' && el.shapeKind ? (
                    <div className="clt-thumb-shape">{renderShapeSVG(el.shapeKind, el.fillColor || '#7c5cfc', 'transparent', 0)}</div>
                  ) : (<span className="clt-icon-svg">{iconSVG}</span>)}
                </div>
                <div className="clt-meta">
                  <span className="clt-label">{label}</span>
                  <span className="clt-type">{typeText}</span>
                </div>
                <div className="clt-actions">
                  <button className={`clt-btn lock ${el.locked ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); showToast(el.locked ? 'Elemento desbloqueado!' : 'Elemento bloqueado!'); }} title={el.locked ? 'Desbloquear' : 'Bloquear'}>
                      {el.locked 
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      }
                  </button>
                  <button className="clt-btn delete" onClick={(e) => { e.stopPropagation(); deleteElement(el.id); showToast('Camada excluída!'); }} title="Excluir">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Removed the inline undock button since it's now in the strip */}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
    <div className="canva-editor" onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <header className="canva-topbar">
        {/* Logo */}
        <div className="canva-logo">
          <img src="./logo oficial.png" alt="logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          <span style={{ position: 'relative' }}>
            Design
            <span style={{ position: 'absolute', top: '-4px', right: '-8px', fontSize: 'inherit' }}>+</span>
          </span>
        </div>

        <div className="canva-topbar-divider" />

        {/* Title */}
        <input
          className="canva-title-input"
          value={designTitle}
          onChange={e => setDesignTitle(e.target.value)}
          spellCheck={false}
        />

        <div className="canva-topbar-divider" />

        {/* Undo / Redo */}
        <div className="canva-topbar-center">
          <button className="ctb-icon" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">↩</button>
          <button className="ctb-icon" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)">↪</button>
          <div className="canva-topbar-divider" />


          <button className="ctb-btn ghost" onClick={fitToScreen} title="Ajustar à tela">⊞ Ajustar</button>
          <span className="canva-zoom-badge" onClick={() => setZoom(1)} title="Clique para 100%" style={{ minWidth: '60px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <div className="canva-topbar-divider" />
          <button className="ctb-btn ghost" onClick={() => setShowNewCanvas(true)}>+ Novo Canvas</button>
          <span style={{ fontSize: 11, color: '#aaaabc', whiteSpace: 'nowrap' }}>
            {canvasW} × {canvasH}px
          </span>

          {/* Carousel Slice Viewer - Tiny Version */}

        </div>

        {/* Right actions */}
        <div className="canva-topbar-right">
          <button className="ctb-btn" onClick={handleLoadProject}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Abrir
          </button>
          <button className="ctb-btn" onClick={handleSaveProject}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Salvar
          </button>
          <button className="ctb-btn-primary ctb-btn" onClick={handleExport}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      </header>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <div className="canva-main">

        {/* ── LEFT SIDEBAR ───────────────────────────────────── */}
        <div className={`canva-left-sidebar ${showLeftSidebar ? 'open' : 'closed'}`}>

          {/* Icon Rail */}
          <nav className="canva-icon-rail">
            {([
              { id: 'templates', icon: '⊟', label: 'Projetos' },
              { id: 'elements', icon: '◈', label: 'Elementos' },
              { id: 'text', icon: 'T', label: 'Texto' },
              { id: 'uploads', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              ), label: 'Upload' },
              { id: 'background', icon: '◉', label: 'Fundo' },
              { id: 'draw', icon: '✎', label: 'Desenhar' },
              { id: 'mockup', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              ), label: 'Mockup' },
              { id: 'ai', icon: '◆', label: 'IA' },
              { id: 'reference', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              ), label: 'Referência' },
            ] as { id: SidePanel; icon: React.ReactNode; label: string }[]).map(item => (
              <button
                key={item.id}
                className={`cir-btn ${activePanel === item.id ? 'active' : ''}`}
                onClick={() => { if (item.id === 'reference') { setShowRefSearch(true); } else { setActivePanel(item.id); } }}
                title={item.label}
              >
                <span style={{ 
                  fontSize: item.id === 'text' ? 22 : 20, 
                  fontWeight: item.id === 'text' ? 700 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 24
                }}>{item.icon}</span>
                <span className="cir-label">{item.label}</span>
              </button>
            ))}
            {/* Teoria das Cores button — opens palette modal */}
            <button
              className={`cir-btn ${showPaletteBox ? 'active' : ''}`}
              onClick={() => setShowPaletteBox(true)}
              title="Teoria das Cores"
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2C6.48 2 2 6.48 2 12"/></svg>
              </span>
              <span className="cir-label">Cores</span>
            </button>
          </nav>

          {/* Side Panel Content */}
          <div className="canva-side-panel">
            <div className="csp-header">
              <h3>
                {activePanel === 'templates' && 'Projetos'}
                {activePanel === 'elements' && 'Elementos'}
                {activePanel === 'text' && 'Texto'}
                {activePanel === 'uploads' && 'Imagens'}
                {activePanel === 'background' && 'Fundo'}
                {activePanel === 'draw' && 'Desenhar'}
                {activePanel === 'mockup' && 'Mockup'}
                {activePanel === 'ai' && 'IA'}
                {activePanel === 'draw' && 'Desenhar'}
                {activePanel === 'ai' && 'IA'}
              </h3>
              {activePanel === 'elements' && (
                <div className="csp-search">
                  <span className="csp-search-icon">⌕</span>
                  <input placeholder="Buscar formas..." />
                </div>
              )}
            </div>

            <div className="csp-body">

              {/* TEMPLATES */}
              {activePanel === 'templates' && (
                <>
                  {/* ── Carrossel ── */}
                  <div style={{ marginBottom: 16 }}>
                    <p className="csp-section-title" style={{ fontSize: 11, marginBottom: 8, opacity: 0.85 }}>Formatos Especiais</p>
                    <button
                      className="crp-action-btn"
                      style={{ marginBottom: 6, justifyContent: 'space-between' }}
                      onClick={() => setShowCarouselModal(true)}
                      title="Criar Carrossel"
                    >
                      <span>Carrossel</span>
                      <span style={{ fontSize: 11, color: '#aaaabc' }}>Múltiplos</span>
                    </button>
                  </div>
                  {/* Group templates by category */}
                  {Array.from(new Set(TEMPLATES.map(t => t.category))).map(cat => (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <p className="csp-section-title" style={{ fontSize: 11, marginBottom: 8, opacity: 0.85 }}>{cat}</p>
                      <div className="csp-template-grid">
                        {TEMPLATES.filter(t => t.category === cat).map(tpl => (
                          <div
                            key={tpl.id}
                            className="csp-template-card"
                            onClick={() => applyTemplate(tpl)}
                            title={`Aplicar: ${tpl.name}`}
                          >
                            {/* Rich visual thumbnail */}
                            <div className="tpl-preview" style={{ background: tpl.bg, width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                              {/* Render a scaled-down version of shapes/text */}
                              {tpl.elements.slice(0, 6).map((el, i) => {
                                const bH = tpl.baseH ?? 360;
                                const scaleX = 110 / 620;
                                const scaleY = 80 / bH;
                                const left = (el.x ?? 0) * scaleX;
                                const top = (el.y ?? 0) * scaleY;
                                const width = Math.max(4, (el.w ?? 100) * scaleX);
                                const height = Math.max(2, (el.h ?? 30) * scaleY);
                                if (el.type === 'shape') {
                                  const isCircle = el.shapeKind === 'circle';
                                  return (
                                    <div key={i} style={{
                                      position: 'absolute', left, top, width, height,
                                      backgroundColor: el.fillColor && el.fillColor !== 'transparent' ? el.fillColor : 'transparent',
                                      border: el.strokeColor ? `${(el.strokeWidth ?? 1) * 0.4}px solid ${el.strokeColor}` : 'none',
                                      borderRadius: isCircle ? '50%' : el.shapeKind === 'star' || el.shapeKind === 'hexagon' ? '30%' : 2,
                                      pointerEvents: 'none',
                                    }} />
                                  );
                                }
                                if (el.type === 'text') {
                                  return (
                                    <div key={i} style={{
                                      position: 'absolute', left, top, width, height,
                                      fontSize: Math.max(4, (el.fontSize ?? 14) * Math.min(scaleX, scaleY) * 1.4),
                                      fontWeight: el.fontWeight ?? '400',
                                      color: el.textColor ?? '#fff',
                                      textAlign: (el.textAlign as any) ?? 'center',
                                      overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.1,
                                      pointerEvents: 'none',
                                    }}>
                                      {el.text}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                              {/* Name label at bottom */}
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
                                padding: '2px 4px', fontSize: 8, color: '#fff',
                                textAlign: 'center', lineHeight: 1.4, fontFamily: 'Inter, sans-serif',
                              }}>
                                {tpl.name}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <p className="csp-section-title" style={{ marginTop: 16 }}>Tamanhos Populares</p>
                  {CANVAS_PRESETS.map(p => (
                    <button
                      key={p.name}
                      className="crp-action-btn"
                      style={{ marginBottom: 6, justifyContent: 'space-between' }}
                      onClick={() => { setNewW(p.w); setNewH(p.h); setSelectedPreset(p.name); setShowNewCanvas(true); }}
                    >
                      <span>{p.name}</span>
                      <span style={{ fontSize: 11, color: '#aaaabc' }}>{p.w}×{p.h}</span>
                    </button>
                  ))}
                  
                  <button
                    className="crp-action-btn"
                    style={{ 
                      marginTop: 10,
                      marginBottom: 6,
                      justifyContent: 'center',
                      background: 'rgba(124, 92, 252, 0.1)',
                      border: '1px dashed var(--accent)',
                      color: 'var(--accent)'
                    }}
                    onClick={() => { setNewW(1080); setNewH(1080); setSelectedPreset(''); setShowNewCanvas(true); }}
                  >
                    <span>➕ Tamanho Personalizado...</span>
                  </button>
                </>
              )}


              {/* ELEMENTS */}
              {activePanel === 'elements' && (
                <>
                  <p className="csp-section-title">Formas Básicas</p>
                  <div className="csp-shapes-grid">
                    {SHAPES.map(s => (
                      <button
                        key={s.kind}
                        className="csp-shape-btn"
                        onClick={() => addShape(s.kind)}
                        title={s.label}
                      >
                        <span className="shape-tooltip">{s.label}</span>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
                          {renderShapeSVG(s.kind, 'var(--accent, #7c5cfc)', 'transparent', 0)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="csp-section-title" style={{ marginTop: 16 }}>Linhas</p>
                  <div className="csp-shapes-grid">
                    {(['line', 'arrow'] as ShapeKind[]).map(k => (
                      <button
                        key={k}
                        className="csp-shape-btn"
                        onClick={() => addShape(k)}
                        style={{ gridColumn: 'span 2' }}
                      >
                        {k === 'line' ? '─── Linha ───' : '──────── Seta ➡'}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const categories = Array.from(new Set(OVERLAY_ELEMENTS.map(e => e.category)));
                    return categories.map(cat => (
                      <div key={cat}>
                        <p className="csp-section-title" style={{ marginTop: 14 }}>{cat}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {OVERLAY_ELEMENTS.filter(e => e.category === cat).map((item, idx) => {
                            const previewSrc = item.multicolor ? GLOW_MULTICOLOR_SVG : getOverlaySVG(item.type, item.defColor || '#7c5cfc');
                            return (
                              <div
                                key={`${cat}-${idx}`}
                                className="csp-template-card"
                                style={{ height: '58px', padding: '3px', cursor: 'pointer' }}
                                onClick={() => {
                                  const src = item.multicolor ? GLOW_MULTICOLOR_SVG : getOverlaySVG(item.type, item.defColor || '#7c5cfc');
                                  addElement({
                                    type: 'image',
                                    imageSrc: src,
                                    imageObjectFit: 'cover',
                                    x: canvasW / 2 - 150,
                                    y: canvasH / 2 - 150,
                                    w: 300,
                                    h: 300,
                                    overlayType: item.type as any,
                                    overlayColor1: item.defColor || undefined,
                                  });
                                  showToast(`✨ ${item.name} adicionado!`);
                                }}
                              >
                                <div style={{ width: '100%', height: '100%', borderRadius: '4px', overflow: 'hidden', background: '#181825', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                  <img src={previewSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                  <span style={{ position: 'absolute', bottom: '2px', left: '2px', right: '2px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.name}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </>
              )}

              {/* TEXT */}
              {activePanel === 'text' && (
                <>
                  <p className="csp-section-title">Adicionar Texto</p>
                  <div className="csp-text-presets">
                    <div className="csp-text-preset" onClick={() => addText('h1')}>
                      <div className="csp-text-preset-h1">Adicionar um título</div>
                    </div>
                    <div className="csp-text-preset" onClick={() => addText('h2')}>
                      <div className="csp-text-preset-h2">Adicionar um subtítulo</div>
                    </div>
                    <div className="csp-text-preset" onClick={() => addText('body')}>
                      <div className="csp-text-preset-body">Adicionar corpo de texto</div>
                    </div>
                  </div>

                  <p className="csp-section-title" style={{ marginTop: 16 }}>Fontes Populares</p>
                  {fontFamilies.slice(0, 8).map(f => (
                    <button
                      key={f}
                      className="csp-text-preset"
                      style={{ fontFamily: f, fontSize: 16, fontWeight: 500, color: '#1a1a2e', padding: '10px 14px', marginBottom: 6 }}
                      onClick={() => addElement({ type: 'text', text: f, fontFamily: f, fontSize: 24, fontWeight: '600', textColor: '#1a1a2e', w: 300, h: 60 })}
                    >
                      {f}
                    </button>
                  ))}
                </>
              )}

              {/* UPLOADS */}
              {activePanel === 'uploads' && (
                <>
                  <div
                    className="csp-upload-zone"
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); handleUpload(e.dataTransfer.files); }}
                    onClick={() => document.getElementById('canva-file-input')?.click()}
                    style={isDragOver ? { borderColor: '#7c5cfc', background: 'rgba(124,92,252,0.05)' } : {}}
                  >
                    <div className="csp-upload-zone-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.5}}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                    <p>Clique ou arraste imagens aqui</p>
                    <span>PNG, JPG, GIF, SVG</span>
                    <input
                      id="canva-file-input"
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => handleUpload(e.target.files)}
                    />
                  </div>
                  <p className="csp-section-title" style={{ marginTop: 16 }}>Dica</p>
                  <p style={{ fontSize: 12, color: '#888899', lineHeight: 1.6 }}>
                    Após carregar, sua imagem aparecerá no canvas. Arraste e redimensione como quiser.
                  </p>
                </>
              )}

              {/* BACKGROUND */}
              {activePanel === 'background' && (
                <>
                  <p className="csp-section-title">Cor Sólida</p>
                  <div className="csp-color-grid">
                    {BG_COLORS.map(c => (
                      <div
                        key={c}
                        className="csp-color-swatch"
                        style={{
                          background: c,
                          borderColor: canvasBg === c ? '#7c5cfc' : 'transparent',
                          borderWidth: 2,
                          boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e5e5ea' : 'none',
                        }}
                        onClick={() => {
                          setCanvasBg(c);
                          setElements(prev => { saveHistory(prev, c); return prev; });
                        }}
                        title={c}
                      />
                    ))}
                  </div>

                  <p className="csp-section-title">Cor Personalizada</p>
                  <div className="crp-color-row" style={{ marginBottom: 12 }}>
                    <div className="crp-color-btn" style={{ background: canvasBg.startsWith('#') ? canvasBg : '#fff' }}>
                      <input type="color" value={canvasBg.startsWith('#') ? canvasBg : '#ffffff'} onChange={e => { setCanvasBg(e.target.value); setElements(prev => { saveHistory(prev, e.target.value); return prev; }); }} />
                    </div>
                    <input
                      className="crp-color-hex"
                      value={canvasBg.startsWith('#') ? canvasBg.toUpperCase() : 'GRADIENTE'}
                      onChange={e => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) { setCanvasBg(v); setElements(prev => { saveHistory(prev, v); return prev; }); }
                      }}
                      placeholder="#FFFFFF"
                    />
                  </div>

                  <p className="csp-section-title">Gradientes</p>
                  <div className="csp-gradient-grid">
                    {BG_GRADIENTS.map(g => (
                      <div
                        key={g.name}
                        className="csp-gradient-swatch"
                        style={{
                          background: g.css,
                          borderColor: canvasBg === g.css ? '#7c5cfc' : 'transparent',
                        }}
                        onClick={() => {
                          setCanvasBg(g.css);
                          setElements(prev => { saveHistory(prev, g.css); return prev; });
                        }}
                        title={g.name}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* IA IMAGE GENERATION */}
              {activePanel === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p className="csp-section-title">Criação de Imagens por IA</p>
                  
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      placeholder="Descreva a imagem que deseja gerar..."
                      value={imageAIPrompt}
                      onChange={e => setImageAIPrompt(e.target.value)}
                      style={{ 
                        width: '100%', minHeight: '150px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', 
                        color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '13px', outline: 'none',
                        resize: 'none', transition: 'all 0.15s ease',
                        fontFamily: 'inherit', lineHeight: '1.5'
                      }}
                    />
                  </div>

                  <button 
                    disabled={isGeneratingImage || !imageAIPrompt.trim()}
                    style={{ 
                      width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--accent), #9d7dff)', border: 'none', 
                      borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isGeneratingImage || !imageAIPrompt.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s',
                      opacity: isGeneratingImage || !imageAIPrompt.trim() ? 0.55 : 1,
                      boxShadow: isGeneratingImage || !imageAIPrompt.trim() ? 'none' : '0 2px 8px rgba(124,92,252,0.35)'
                    }}
                    onClick={async () => {
                      try {
                        setIsGeneratingImage(true);
                        onAddToTerminal?.(`🎨 [IA] Solicitando imagem via Pollinations API...`);
                        const result = await (window as any).electronAPI.generateImage({ prompt: imageAIPrompt });
                        
                        if (result && result.success) {
                          const safePath = result.path.replace(/\\/g, '/');
                          addElement({
                            type: 'image',
                            imageSrc: `file://${safePath}`,
                            imageObjectFit: 'cover',
                            x: canvasW / 2 - 200,
                            y: canvasH / 2 - 150,
                            w: 400,
                            h: 300,
                          });
                          setImageAIPrompt("");
                          showToast(`✅ [IA] Imagem adicionada ao canvas!`);
                          onAddToTerminal?.(`✅ [IA] Imagem gerada e inserida com sucesso!`);
                        } else {
                          showToast(`❌ [IA] Falha na geração!`);
                          onAddToTerminal?.(`❌ [IA] Falha na geração: ${result?.error || 'Erro desconhecido'}`);
                        }
                      } catch (e: any) {
                        showToast(`⚠️ [IA] Erro crítico!`);
                        onAddToTerminal?.(`⚠️ [IA] Erro crítico: ${e.message}`);
                      } finally {
                        setIsGeneratingImage(false);
                      }
                    }}
                  >
                    {isGeneratingImage ? (
                      <>
                        <span style={{ fontSize: '14px', margin: 0 }}>⏳</span> Gerando imagem...
                      </>
                    ) : (
                      <>
                        <span></span> Gerar e Inserir no Canvas
                      </>
                    )}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Gerado por Pollinations.ai
                  </div>
                </div>
              )}

              {/* DRAW PANEL */}
              {activePanel === 'draw' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p className="csp-section-title">Modo de Desenho</p>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`crp-action-btn ${drawMode === 'pen' ? 'active' : ''}`}
                      onClick={() => setDrawMode('pen')}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        background: drawMode === 'pen' ? 'linear-gradient(135deg, #7c5cfc, #5f27cd)' : 'var(--bg-input)',
                        color: drawMode === 'pen' ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>✎</span>
                      Caneta
                    </button>
                    <button
                      className={`crp-action-btn ${drawMode === 'eraser' ? 'active' : ''}`}
                      onClick={() => setDrawMode('eraser')}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        background: drawMode === 'eraser' ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'var(--bg-input)',
                        color: drawMode === 'eraser' ? '#fff' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>◯</span>
                      Borracha
                    </button>
                  </div>

                  {drawMode === 'pen' && (
                    <>
                      <p className="csp-section-title" style={{ marginTop: '8px' }}>Cor da Caneta</p>
                      <div className="csp-color-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                        {['#ffffff', '#000000', '#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#a855f7'].map(c => (
                          <div
                            key={c}
                            className="csp-color-swatch"
                            style={{
                              background: c,
                              width: '100%',
                              height: '32px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              border: penColor === c ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                              boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #ddd' : 'none'
                            }}
                            onClick={() => setPenColor(c)}
                          />
                        ))}
                      </div>
                      <div className="crp-color-row" style={{ marginTop: '4px' }}>
                        <div className="crp-color-btn" style={{ background: penColor }}>
                          <input type="color" value={penColor} onChange={e => setPenColor(e.target.value)} />
                        </div>
                        <input
                          className="crp-color-hex"
                          value={penColor.toUpperCase()}
                          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setPenColor(e.target.value); }}
                          maxLength={7}
                        />
                      </div>

                      <p className="csp-section-title" style={{ marginTop: '8px' }}>Espessura do Traço ({penSize}px)</p>
                      <div className="crp-row">
                        <input
                          className="crp-slider"
                          type="range"
                          min={1}
                          max={600}
                          value={penSize}
                          onChange={e => setPenSize(Number(e.target.value))}
                        />
                      </div>
                      <p className="csp-section-title" style={{ marginTop: '8px' }}>Opacidade ({penOpacity}%)</p>
                      <div className="crp-row">
                        <input
                          className="crp-slider"
                          type="range"
                          min={1}
                          max={100}
                          value={penOpacity}
                          onChange={e => setPenOpacity(Number(e.target.value))}
                        />
                      </div>
                    </>
                  )}

                  {drawMode === 'eraser' && (
                    <>
                      <p className="csp-section-title" style={{ marginTop: '8px' }}>Tamanho da Borracha ({eraserSize}px)</p>
                      <div className="crp-row">
                        <input
                          className="crp-slider"
                          type="range"
                          min={5}
                          max={600}
                          value={eraserSize}
                          onChange={e => setEraserSize(Number(e.target.value))}
                        />
                      </div>
                      <p className="csp-section-title" style={{ marginTop: '8px' }}>Opacidade ({eraserOpacity}%)</p>
                      <div className="crp-row">
                        <input
                          className="crp-slider"
                          type="range"
                          min={1}
                          max={100}
                          value={eraserOpacity}
                          onChange={e => setEraserOpacity(Number(e.target.value))}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.5', margin: 0 }}>
                        Arraste ou clique com a borracha sobre qualquer linha desenhada para apagá-la.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* MOCKUP PANEL */}
              {activePanel === 'mockup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p className="csp-section-title">Ferramenta Mockup</p>
                  
                  <div style={{ padding: '12px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#c084fc', lineHeight: '1.6', margin: 0 }}>
                      <strong>Como usar:</strong><br/>
                      1. Clique nos pontos do canvas para criar a área do mockup<br/>
                      2. Feche o caminho clicando perto do primeiro ponto<br/>
                      3. Clique com botão direito em uma imagem → "Fazer Mockup"<br/>
                      4. A imagem aparece na área com clip-path editável
                    </p>
                  </div>

                  {!mockupMode && mockupPoints.length === 0 && (
                    <button
                      onClick={() => {
                        setMockupMode(true);
                        setMockupPoints([]);
                        setMockupClosed(false);
                        showToast('Clique no canvas para marcar os pontos do mockup');
                      }}
                      style={{
                        padding: '14px',
                        background: 'linear-gradient(135deg, #7c5cfc, #5f27cd)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                      Criar Área de Mockup
                    </button>
                  )}

                  {mockupMode && !mockupClosed && (
                    <>
                      <div style={{ padding: '10px', background: 'rgba(124,58,237,0.15)', borderRadius: '6px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: '#c084fc', margin: '0 0 8px 0', fontWeight: 600 }}>
                          Pontos: {mockupPoints.length}
                        </p>
                        <p style={{ fontSize: '10px', color: '#aaa', margin: 0 }}>
                          Clique perto do primeiro ponto para fechar
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setMockupMode(false);
                          setMockupPoints([]);
                          setMockupClosed(false);
                        }}
                        style={{
                          padding: '10px',
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          color: '#ef4444',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {mockupClosed && mockupPoints.length > 0 && (
                    <>
                      <div style={{ padding: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', textAlign: 'center' }}>
                        <p style={{ fontSize: '12px', color: '#10b981', margin: 0, fontWeight: 600 }}>
                          ✓ Área de mockup criada!
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          // Em vez de criar elemento mockup, pede pra selecionar a imagem base
                          setMockupClosed(false);
                          setMockupMode(false);
                          
                          // Procura imagens que estão na área marcada
                          const bounds = getMockupBounds(mockupPoints);
                          const imgsInArea = elements.filter(e => {
                            if (e.type !== 'image') return false;
                            const overlapsX = e.x < bounds.x + bounds.w && e.x + e.w > bounds.x;
                            const overlapsY = e.y < bounds.y + bounds.h && e.y + e.h > bounds.y;
                            return overlapsX && overlapsY;
                          });
                          
                          if (imgsInArea.length === 0) {
                            showToast('❌ Nenhuma imagem encontrada na área marcada');
                            setMockupPoints([]);
                            return;
                          }
                          
                          // Aplica o mockup path na primeira imagem encontrada (geralmente o fundo)
                          const targetImg = imgsInArea.sort((a, b) => a.zIndex - b.zIndex)[0];
                          
                          // Converte pontos para relativos à imagem
                          const relativePath = mockupPoints.map(p => ({
                            x: p.x - targetImg.x,
                            y: p.y - targetImg.y
                          }));
                          
                          updateElement(targetImg.id, { mockupPath: relativePath });
                          setMockupPoints([]);
                          setSelectedId(targetImg.id);
                          showToast('✓ Mockup aplicado na imagem!');
                        }}
                        style={{
                          padding: '14px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Confirmar e Aplicar
                      </button>
                      <button
                        onClick={() => {
                          setMockupMode(false);
                          setMockupPoints([]);
                          setMockupClosed(false);
                        }}
                        style={{
                          padding: '10px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Refazer
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── CANVAS AREA ────────────────────────────────────── */}
        <div
          ref={canvasAreaRef}
          className="canva-canvas-area"
          style={{ cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={e => {
            if (isSpacePressed) {
              e.preventDefault();
              e.stopPropagation();
              setIsPanning(true);
              panStartRef.current = { x: e.clientX - panX * zoom, y: e.clientY - panY * zoom };
            }
          }}
          onMouseMove={e => {
            if (isPanning) {
              e.preventDefault();
              e.stopPropagation();
              setPanX((e.clientX - panStartRef.current.x) / zoom);
              setPanY((e.clientY - panStartRef.current.y) / zoom);
            }
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          {/* Pages Tabs Strip */}
          <div className="canva-pages-strip">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className={`cps-tab ${page.id === activePageId ? 'active' : ''} ${page.pageKind === 'draft' ? 'draft-tab' : ''}`}
                onClick={e => { e.stopPropagation(); setActivePageId(page.id); setSelectedId(null); }}
                title={page.name}
              >
                <span className="cps-tab-num">{page.pageKind === 'draft' ? '✎' : idx + 1}</span>
                <span className="cps-tab-name">{page.pageKind === 'draft' ? 'Rascunho' : page.name}</span>
                {pages.length > 1 && (
                  <button
                    className="cps-tab-del"
                    title={page.pageKind === 'draft' ? 'Remover rascunho' : 'Remover canvas'}
                    onClick={e => {
                      e.stopPropagation();
                      const newPages = pages.filter(p => p.id !== page.id);
                      setPages(newPages);
                      historyMapRef.current.delete(page.id);
                      if (activePageId === page.id) {
                        const fallback = page.pageKind === 'draft' && page.draftForPageId
                          ? newPages.find(p => p.id === page.draftForPageId) ?? newPages[Math.max(0, idx - 1)]
                          : newPages[Math.max(0, idx - 1)];
                        setActivePageId(fallback.id);
                        setSelectedId(null);
                      }
                    }}
                  >×</button>
                )}
              </div>
            ))}
            {pages.length < 10 && (
              <button
                className="cps-add-btn"
                onClick={e => { e.stopPropagation(); setShowNewCanvas(true); }}
                title="Adicionar novo canvas"
              >+</button>
            )}
          </div>
          
          {/* Carousel Viewer row right below tabs */}
          {(() => {
             const activePg = pages.find(p => p.id === activePageId);
             const match = activePg?.name.match(/Carrossel (\d+)x/);
             if (match) {
                const count = parseInt(match[1]);
                return (
                   <div style={{ display: 'flex', gap: 4, padding: '4px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
                      <button onClick={(e) => { e.stopPropagation(); setCarouselViewSlice(null); }} className="ctb-btn ghost" style={{ background: carouselViewSlice === null ? '#7c5cfc' : 'rgba(255,255,255,0.05)', color: carouselViewSlice === null ? '#fff' : '#aaaabc', fontSize: 10, padding: '2px 8px', minWidth: 40, height: 20, borderRadius: 4 }}>Tudo</button>
                      {Array.from({length: count}).map((_, i) => (
                        <button key={i} onClick={(e) => {
                           e.stopPropagation();
                           setCarouselViewSlice(i);
                           const slideW = activePg!.w / count;
                           setPanX(activePg!.w / 2 - (slideW * i + slideW / 2));
                        }} className="ctb-btn ghost" style={{ background: carouselViewSlice === i ? '#7c5cfc' : 'rgba(255,255,255,0.05)', color: carouselViewSlice === i ? '#fff' : '#aaaabc', fontSize: 10, padding: '2px 8px', minWidth: 24, height: 20, borderRadius: 4 }}>{i + 1}</button>
                      ))}
                   </div>
                )
             }
             return null;
          })()}

          {/* Scroll/center area for the viewport */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Docked Top Panel */}
            {layersDockMode === 'top' && layersTimelineUI}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Docked Left Panel */}
              {layersDockMode === 'left' && layersTimelineUI}
              <div
                ref={viewportRef}
                style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target === viewportRef.current || target.classList.contains('canva-canvas-viewport') || target.classList.contains('canva-page-wrapper')) {
                    setSelectedId(null);
                    setEditingId(null);
                    setContextMenu(null);
                    setBackgroundContextMenu(null);
                    
                    if (e.button !== 0 || drawMode) return;
                    
                    const { x, y } = getCanvasPoint(e.clientX, e.clientY);
                    marqueeRef.current = { active: true, startX: x, startY: y, endX: x, endY: y };
                    setMarqueeRect({ x, y, w: 0, h: 0 });
                    setMultiSelectedIds([]);
                  }
                }}
                onContextMenu={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('.canva-design-canvas') ||
                    target.closest('.canva-element') ||
                    target.closest('.canva-context-menu') ||
                    target.closest('.canva-pages-strip') ||
                    target.closest('.canva-sidebar-toggle')
                  ) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setBackgroundContextMenu({ x: e.clientX, y: e.clientY });
                  setContextMenu(null);
                }}
              >
            {/* Toggle left sidebar button */}
            <button
              className="canva-sidebar-toggle left"
              onClick={() => setShowLeftSidebar(v => !v)}
              title={showLeftSidebar ? 'Esconder barra esquerda' : 'Mostrar barra esquerda'}
            >
              {showLeftSidebar ? '<' : '>'}
            </button>

            {/* Toggle right sidebar button */}
            <button
              className="canva-sidebar-toggle right"
              onClick={() => setShowRightSidebar(v => !v)}
              title={showRightSidebar ? 'Esconder barra direita' : 'Mostrar barra direita'}
            >
              {showRightSidebar ? '>' : '<'}
            </button>

            {/* Viewport / Zoom wrapper — all pages stacked vertically */}
            <div
              className="canva-canvas-viewport"
              style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)` }}
            >
              {/* === All Pages Stacked Vertically === */}
              {pages.map((page, pageIdx) => {
                const isActivePg = page.id === activePageId;
                const pgSorted = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);
                const posX = page.x || 0;
                const posY = page.y || 0;
                return (
                  <div
                    key={page.id}
                    className={`canva-page-wrapper ${isActivePg ? 'active-page' : ''} ${page.pageKind === 'draft' ? 'draft-page' : ''}`}
                    style={{
                      marginBottom: pageIdx < pages.length - 1 ? 64 : 0,
                      transform: `translate(${posX}px, ${posY}px)`,
                      position: 'relative',
                      cursor: isCtrlPressed ? 'move' : 'default',
                      ...((carouselViewSlice !== null && isActivePg && page.name.match(/Carrossel \d+x/)) ? {
                        clipPath: `inset(0px ${page.w - (page.w / parseInt(page.name.match(/Carrossel (\d+)x/)![1]) * (carouselViewSlice + 1))}px 0px ${(page.w / parseInt(page.name.match(/Carrossel (\d+)x/)![1]) * carouselViewSlice)}px)`
                      } : {})
                    }}
                    onMouseDownCapture={(e) => {
                      if (e.ctrlKey && e.button === 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        canvasDragRef.current = {
                          active: true,
                          pageId: page.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: page.x || 0,
                          origY: page.y || 0,
                        };
                      }
                    }}
                    onClick={() => { if (!isActivePg) { setActivePageId(page.id); setSelectedId(null); } }}
                  >
                    {/* Page label above canvas */}
                    <div className="canva-page-label" style={{ cursor: isCtrlPressed ? 'move' : 'default' }}>
                      <span className="cpl-dot" style={{ background: page.pageKind === 'draft' ? '#f59e0b' : (isActivePg ? '#7c5cfc' : '#555') }} />
                      <span className="cpl-name">{page.pageKind === 'draft' ? `Rascunho — ${pages.find(p => p.id === page.draftForPageId)?.name ?? 'Canvas'}` : page.name}</span>
                      <span className="cpl-size">{page.w} × {page.h}px</span>
                      {page.pageKind === 'draft' ? (
                        <button
                          className="canva-draft-back-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (page.draftForPageId) setActivePageId(page.draftForPageId);
                          }}
                        >
                          ← Voltar ao Canvas
                        </button>
                      ) : (
                      <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '12px', fontWeight: 500 }}>
                        (Ctrl + Arraste para mover)
                      </span>
                      )}
                    </div>

                  {isActivePg && page.pageKind === 'draft' && (() => {
                      const noteCount = Object.values(draftNotes).filter(n => n.trim()).length;
                      return (
                        <div className="draft-global-panel">
                          <div className="dgp-header">
                            <span className="dgp-icon"></span>
                            <span className="dgp-title">Instrução Geral do Rascunho</span>
                            {noteCount > 0 && (
                              <span className="dgp-notes-badge">{noteCount} nota{noteCount > 1 ? 's' : ''} nos elementos</span>
                            )}
                          </div>
                          <textarea
                            className="dgp-textarea"
                            placeholder="Descreva como a edição final deve ficar... Ex: estilo cinema noir, cores vibrantes, fundo removido nas fotos..."
                            value={draftGlobalNote}
                            onChange={e => setDraftGlobalNote(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          />
                          <div className="dgp-footer">
                            <span className="dgp-hint">Clique nos elementos para instruções. Depois peça no chat para a IA seguir o rascunho.</span>
                            <button
                              className="dgp-send-btn"
                              onClick={e => { e.stopPropagation(); setDraftGlobalNote(draftGlobalNote); showToast('✅ Instrução salva!'); }}
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Design Canvas */}
                    <div
                      className={`canva-design-canvas${crossCanvasTargetId === page.id ? ' cross-canvas-target' : ''}`}
                      ref={(el) => {
                        // Register in pageRefsMap for cross-canvas hit-testing
                        if (el) pageRefsMap.current.set(page.id, el);
                        else pageRefsMap.current.delete(page.id);
                        // Also assign canvasRef for the active page
                        if (isActivePg) (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                      }}
                      style={{
                        width: page.w,
                        height: page.h,
                        background: page.bg,
                        cursor: isActivePg && drawMode ? 'none' : 'default',
                        outline: crossCanvasTargetId === page.id
                          ? '3px solid #22c55e'
                          : isActivePg ? '2.5px solid #7c5cfc' : '2px solid rgba(255,255,255,0.07)',
                        pointerEvents: isActivePg ? 'auto' : 'none',
                        position: 'relative',
                      }}
                      onClick={e => {
                        // Limpa seleção se clicar no canvas (não nos elementos) OU no fundo preto
                        if (e.target === e.currentTarget) {
                          setSelectedId(null);
                          setEditingId(null);
                          setContextMenu(null);
                          setBackgroundContextMenu(null);
                          e.stopPropagation();
                        }
                        
                        // Close instruction box when clicking outside elements
                        if (page.pageKind === 'draft' && activeDraftNoteId) {
                          setActiveDraftNoteId(null);
                          setDraftNoteBoxPos(null);
                          setSelectedId(null);
                        }
                      }}
                      onContextMenu={e => {
                        if (!isActivePg) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedId) setContextMenu({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseDown={isActivePg ? handleCanvasMouseDown : undefined}
                      onMouseMove={isActivePg ? handleCanvasMouseMove : undefined}
                      onMouseUp={isActivePg ? handleCanvasMouseUp : undefined}
                    >
                      {/* Sub-container cortado exclusivamente para o conteúdo das fotos/elementos */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          overflow: 'hidden',
                          pointerEvents: 'none',
                        }}
                      >
                      {/* Centralization Guides — only on active page */}
                      {isActivePg && activeGuides.x && (
                        <div className="canvas-snap-guide-v" style={{ left: page.w / 2 }} />
                      )}
                      {isActivePg && activeGuides.y && (
                        <div className="canvas-snap-guide-h" style={{ top: page.h / 2 }} />
                      )}
                      {isActivePg && activeGuides.x && activeGuides.y && (
                        <div className="canvas-snap-guide-center" style={{ left: page.w / 2, top: page.h / 2 }} />
                      )}


                      {/* Multi-select bounding box outline */}
                      {isActivePg && multiSelectedIds.length > 1 && (() => {
                        const mels = elements.filter(el => multiSelectedIds.includes(el.id));
                        const minX = Math.min(...mels.map(el => el.x));
                        const minY = Math.min(...mels.map(el => el.y));
                        const maxX = Math.max(...mels.map(el => el.x + el.w));
                        const maxY = Math.max(...mels.map(el => el.y + el.h));
                        return (
                          <div style={{
                            position: 'absolute',
                            left: minX - 4,
                            top: minY - 4,
                            width: maxX - minX + 8,
                            height: maxY - minY + 8,
                            border: '2px dashed rgba(124,92,252,0.6)',
                            background: 'transparent',
                            pointerEvents: 'none',
                            zIndex: 9998,
                            borderRadius: 3,
                          }} />
                        );
                      })()}

                      {/* ── Carousel Grid Guides (UI only) ── */}
                      {page.name.startsWith('Carrossel ') && (() => {
                        const match = page.name.match(/Carrossel (\d+)x/);
                        if (!match) return null;
                        const count = parseInt(match[1]);
                        const slideW = page.w / count;
                        const lines = [];
                        for (let i = 1; i < count; i++) {
                          lines.push(
                            <div key={`c-guide-${i}`} style={{
                              position: 'absolute',
                              left: slideW * i,
                              top: 0,
                              bottom: 0,
                              width: 0,
                              borderLeft: '2px dashed #00ffff',
                              filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))',
                              opacity: 1,
                              zIndex: 999999,
                              pointerEvents: 'none'
                            }} />
                          );
                        }
                        return lines;
                      })()}

                       {/* ── Draft: Mirror elements from main canvas as interactive overlays ── */}
                      {isActivePg && page.pageKind === 'draft' && (() => {
                        const designPg = pages.find(p => p.id === page.draftForPageId);
                        if (!designPg || designPg.elements.length === 0) return null;
                        const designElsSorted = [...designPg.elements].sort((a, b) => a.zIndex - b.zIndex);
                        return designElsSorted.map((el, idx) => {
                          const hasNote = !!(draftNotes[el.id]?.trim());
                          const isNoteOpen = activeDraftNoteId === el.id;
                          const notePreview = hasNote ? draftNotes[el.id].substring(0, 40) + (draftNotes[el.id].length > 40 ? '…' : '') : '';
                          const elNum = idx + 1;
                          const typeIcon = el.type === 'image' ? '🖼️' : el.type === 'text' ? 'T' : '◈';
                          const typeLabel = el.type === 'image' ? `Imagem ${designPg.elements.filter(e=>e.type==='image').indexOf(el)+1}` : el.type === 'text' ? `"${(el.text ?? '').substring(0, 16)}${(el.text ?? '').length > 16 ? '…' : ''}"` : `Forma ${elNum}`;

                          return (
                            <div
                              key={`draft-overlay-${el.id}`}
                              className={`draft-element-overlay ${el.type} ${hasNote ? 'has-note' : ''} ${isNoteOpen ? 'is-active' : ''}`}
                              style={{
                                left: el.x,
                                top: el.y,
                                width: el.w,
                                height: el.h,
                                transform: `rotate(${el.rotation}deg)`,
                                zIndex: el.zIndex + 1000,
                              }}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => {
                                e.stopPropagation();
                                if (isNoteOpen) {
                                  setActiveDraftNoteId(null);
                                  setDraftNoteBoxPos(null);
                                  setSelectedId(null);
                                } else {
                                  setActiveDraftNoteId(el.id);
                                  setSelectedId(el.id);
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  // Use fixed position coordinates (viewport-relative) to avoid canvas clipping
                                  setDraftNoteBoxPos({ x: rect.left, y: rect.bottom + 8 });
                                }
                              }}
                            >
                              {/* Element thumbnail */}
                              {el.type === 'image' && el.imageSrc && (
                                <img
                                  src={el.imageSrc}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  draggable={false}
                                />
                              )}
                              {el.type === 'text' && (
                                <div style={{
                                  width: '100%', height: '100%', display: 'flex',
                                  alignItems: 'center', justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                  padding: '2px 4px', boxSizing: 'border-box',
                                  fontSize: Math.min(el.fontSize ?? 16, 64),
                                  fontFamily: el.fontFamily ?? 'Inter',
                                  fontWeight: el.fontWeight ?? '400',
                                  color: el.textColor ?? '#1a1a2e',
                                  overflow: 'hidden',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}>
                                  {el.text ?? ''}
                                </div>
                              )}
                              {el.type === 'shape' && (
                                <div style={{ width: '100%', height: '100%' }}>
                                  {renderShapeSVG(el.shapeKind ?? 'rect', el.fillColor ?? '#7c5cfc', el.strokeColor ?? 'transparent', el.strokeWidth ?? 0)}
                                </div>
                              )}

                              {/* Label chip */}
                              <div className="deo-label">
                                <span className="deo-icon">{typeIcon}</span>
                                <span>{typeLabel}</span>
                              </div>

                              {/* Note badge */}
                              {hasNote && !isNoteOpen && (
                                <div className="draft-note-badge" title={draftNotes[el.id]}>
                                  {notePreview}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}


                      {pgSorted.map(el => {
                        const isSelected = isActivePg && el.id === selectedId;
                        const isMultiSel = isActivePg && multiSelectedIds.includes(el.id);
                        const isEditing  = isActivePg && el.id === editingId;
                        const deformCorners = supportsDeform(el) ? getDeformCorners(el) : null;
                        const deformActive = !!(supportsDeform(el) && el.deformEnabled);
                        const deformMatrix = deformActive && deformCorners
                          ? computeCssMatrix3d(deformCorners, el.w, el.h)
                          : undefined;
                        const deformWrapStyle: React.CSSProperties | undefined = deformMatrix
                          ? { width: el.w, height: el.h, transform: deformMatrix, transformOrigin: '0 0' }
                          : undefined;
                          
                        return (
                          <div
                            key={el.id}
                            className={`canva-element ${
                              isSelected && el.type !== 'drawing' ? 'selected' : ''
                            } ${
                              isMultiSel && !isSelected ? 'multi-selected' : ''
                            } ${deformActive ? 'deform-active' : ''}`}
                            style={{
                              left: el.x, top: el.y, width: el.w,
                              height: isEditing ? 'auto' : el.h,
                              transform: `rotate(${el.rotation}deg)`,
                              opacity: el.opacity / 100,
                              zIndex: el.zIndex,
                              cursor: !isActivePg ? 'default' : el.locked ? 'not-allowed' : isEditing ? 'text' : 'move',
                              pointerEvents: !isActivePg ? 'none' : (drawMode || mockupMode) ? 'none' : el.type === 'drawing' ? 'none' : (selectedId && !isSelected && multiSelectedIds.length === 0) ? 'none' : 'auto',
                              overflow: 'visible',
                            }}
                            onMouseDown={isActivePg ? e => onElementMouseDown(e, el.id) : undefined}
                            onDoubleClick={isActivePg ? e => { e.stopPropagation(); if (el.type === 'text') setEditingId(el.id); } : undefined}
                            onClick={isActivePg ? e => {
                              if (!el.groupId) {
                                setSelectedId(el.id);
                                setMultiSelectedIds([]);
                              } else {
                                const groupIds = page.elements.filter(en => en.groupId === el.groupId).map(en => en.id);
                                setMultiSelectedIds(groupIds);
                                setSelectedId(el.id);
                              }
                              e.stopPropagation();
                            } : undefined}
                          >

                            {/* Deform quad outline */}
                            {isSelected && deformActive && deformCorners && (
                              <svg
                                className="deform-quad-outline"
                                style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 3 }}
                                width={el.w}
                                height={el.h}
                              >
                                <polygon
                                  points={`${deformCorners.tl.x},${deformCorners.tl.y} ${deformCorners.tr.x},${deformCorners.tr.y} ${deformCorners.br.x},${deformCorners.br.y} ${deformCorners.bl.x},${deformCorners.bl.y}`}
                                  fill="none"
                                  stroke="#7c5cfc"
                                  strokeWidth="1.5"
                                  strokeDasharray="5 3"
                                />
                              </svg>
                            )}


                            {/* Deform corner handles */}
                            {isSelected && !el.locked && deformActive && deformCorners && (
                              <>
                                {(['tl', 'tr', 'br', 'bl'] as DeformCornerKey[]).map(corner => (
                                  <div
                                    key={corner}
                                    className={`deform-handle ${corner}`}
                                    style={{
                                      left: deformCorners[corner].x - 6,
                                      top: deformCorners[corner].y - 6,
                                    }}
                                    onMouseDown={e => onElementMouseDown(e, el.id, `deform-${corner}`)}
                                    title={
                                      corner === 'tl' ? 'Canto superior esquerdo'
                                        : corner === 'tr' ? 'Canto superior direito'
                                        : corner === 'br' ? 'Canto inferior direito'
                                        : 'Canto inferior esquerdo'
                                    }
                                  />
                                ))}
                              </>
                            )}


                            <div className="canva-element-inner" style={{ 
                              overflow: (deformActive || (el.type === 'text' && (el.textStretchY ?? 1) !== 1)) ? 'visible' : 'hidden',
                              position: 'relative',
                              ...(eraserMasks.has(el.id) ? {
                                WebkitMaskImage: `url(${eraserMasks.get(el.id)})`,
                                maskImage: `url(${eraserMasks.get(el.id)})`,
                                WebkitMaskSize: '100% 100%',
                                maskSize: '100% 100%',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat'
                              } : {})
                            }}>
                              {el.type === 'text' && (
                                isEditing ? (
                                  <div style={deformWrapStyle}>
                                  <textarea
                            className="canva-text-element editing"
                            style={{
                              fontSize: el.fontSize ?? 16,
                              fontFamily: el.fontFamily ?? 'Inter',
                              fontWeight: el.fontWeight ?? '400',
                              fontStyle: el.fontStyle ?? 'normal',
                              textAlign: el.textAlign ?? 'center',
                              color: el.textColor ?? '#1a1a2e',
                              WebkitTextStrokeWidth: undefined,
                              WebkitTextStrokeColor: undefined,
                              textShadow: undefined,
                              cursor: 'text',
                              userSelect: 'text',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              resize: 'none',
                              padding: '2px 4px',
                              lineHeight: 1.4,
                              width: '100%',
                              height: el.h,
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'break-word',
                              boxSizing: 'border-box',
                              margin: 0,
                              overflow: 'hidden',
                              display: 'block',
                            }}
                            value={el.text ?? ''}
                            autoFocus
                            onChange={e => {
                              const ta = e.target;
                              // Manipula DOM diretamente para crescer sem esperar re-render do React
                              ta.style.height = '1px';
                              ta.style.height = `${ta.scrollHeight}px`;
                              const newH = Math.max(20, ta.scrollHeight + 2);
                              updateElement(el.id, { text: ta.value, h: newH });
                            }}
                            onBlur={() => setEditingId(null)}
                            onClick={e => e.stopPropagation()}
                          />
                                  </div>
                        ) : ((el.textStretchY ?? 1) !== 1 || (el.textCurve ?? 0) !== 0) ? (
                          // Stretch mode OR curved text: render via canvas so DOM and export use identical pipeline
                          <canvas
                            key={`stretch-${el.id}-${el.text}-${el.fontSize}-${el.fontFamily}-${el.fontWeight}-${el.fontStyle}-${el.textColor}-${el.textStretchY}-${el.textStrokeWidth}-${el.textStrokeColor}-${el.textHollowEnabled}-${el.textCurve}`}
                            ref={cvs => {
                              if (!cvs) return;
                              const cw = Math.max(1, Math.round(el.w));
                              const ch = Math.max(1, Math.round(el.h));
                              if (cvs.width !== cw || cvs.height !== ch) {
                                cvs.width = cw;
                                cvs.height = ch;
                              }
                              const octx = cvs.getContext('2d');
                              if (octx) {
                                octx.clearRect(0, 0, cw, ch);
                                drawPlainTextToOffscreen(octx, el, cw, ch);
                              }
                            }}
                            style={{
                              display: 'block',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: el.w,
                              // CSS-stretch the canvas height — exactly mirrors drawImage with dst height
                              height: el.h * (el.textStretchY ?? 1),
                              pointerEvents: 'none',
                              imageRendering: 'auto',
                            }}
                          />
                        ) : (
                          <div style={deformWrapStyle}>
                          <div
                            className="canva-text-element"
                            style={{
                              fontSize: el.fontSize ?? 16,
                              fontFamily: el.fontFamily ?? 'Inter',
                              fontWeight: el.fontWeight ?? '400',
                              fontStyle: el.fontStyle ?? 'normal',
                              textAlign: el.textAlign ?? 'center',
                              cursor: el.locked ? 'not-allowed' : 'move',
                              userSelect: 'none',
                              width: '100%',
                              height: '100%',
                              boxSizing: 'border-box',
                              position: 'relative',
                            }}
                          >
                            {/* Background outer stroke layer */}
                            {(((el.textStrokeWidth ?? 0) > 0) || !!el.textHollowEnabled) ? (
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                padding: '2px 4px',
                                color: 'transparent',
                                WebkitTextFillColor: 'transparent',
                                WebkitTextStrokeWidth: `${(el.textStrokeWidth && el.textStrokeWidth > 0 ? el.textStrokeWidth : (el.textHollowEnabled ? 1.5 : 0)) * (el.textHollowEnabled ? 1 : 2)}px`,
                                WebkitTextStrokeColor: el.textStrokeColor ?? '#000000',
                                pointerEvents: 'none',
                                userSelect: 'none',
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'break-word',
                                boxSizing: 'border-box',
                                zIndex: 1,
                                lineHeight: 1.4,
                              }}>
                                {el.text ?? ''}
                              </div>
                            ) : null}
                            {/* Foreground fill + shadow layer */}
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              padding: '2px 4px',
                              color: el.textHollowEnabled ? 'transparent' : (el.textColor ?? '#1a1a2e'),
                              WebkitTextFillColor: el.textHollowEnabled ? 'transparent' : undefined,
                              textShadow: (el.textShadowOffsetX || el.textShadowOffsetY)
                                ? `${el.textShadowOffsetX ?? 0}px ${el.textShadowOffsetY ?? 0}px ${el.textShadowBlur ?? 4}px ${el.textShadowColor ?? 'rgba(0,0,0,0.5)'}`
                                : undefined,
                              pointerEvents: 'none',
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'break-word',
                              boxSizing: 'border-box',
                              zIndex: 2,
                              lineHeight: 1.4,
                            }}>
                              {el.text ?? ''}
                            </div>
                          </div>
                          </div>
                        )
                      )}

                      {el.type === 'shape' && renderShapeSVG(
                        el.shapeKind ?? 'rect',
                        el.fillColor ?? '#7c5cfc',
                        el.strokeColor ?? 'transparent',
                        el.strokeWidth ?? 0
                      )}

                      {el.type === 'drawing' && el.points && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                          <svg style={{ width: '100%', height: '100%', display: 'block' }}>
                            <path
                              d={pointsToPath(el.points)}
                              fill="none"
                              stroke={el.strokeColor || '#7c5cfc'}
                              strokeWidth={el.strokeWidth || 5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}

                      {el.type === 'image' && el.imageSrc && (() => {
                        const imageInner = (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            overflow: deformActive ? 'visible' : 'hidden',
                            transform: `scaleX(${el.flipX ? -1 : 1}) scaleY(${el.flipY ? -1 : 1})`,
                          }}>
                          {el.duotoneEnabled && (() => {
                            const c1 = hexToNormalizedRGB(el.duotoneColor1 || '#000000');
                            const c2 = hexToNormalizedRGB(el.duotoneColor2 || '#ffffff');
                            return (
                              <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
                                <filter id={`duotone-${el.id}`}>
                                  <feColorMatrix
                                    type="matrix"
                                    values="0.2126 0.7152 0.0722 0 0
                                            0.2126 0.7152 0.0722 0 0
                                            0.2126 0.7152 0.0722 0 0
                                            0      0      0      1 0"
                                  />
                                  <feComponentTransfer>
                                    <feFuncR type="table" tableValues={`${c1.r} ${c2.r}`} />
                                    <feFuncG type="table" tableValues={`${c1.g} ${c2.g}`} />
                                    <feFuncB type="table" tableValues={`${c1.b} ${c2.b}`} />
                                  </feComponentTransfer>
                                </filter>
                              </svg>
                            );
                          })()}
                          <img
                            className="canva-image-element"
                            src={el.imageSrc}
                            alt=""
                            style={{ 
                              ...(el.cropImgW ? {
                                // Crop mode: fixed size, offset by px
                                position: 'absolute',
                                width: `${el.cropImgW}px`,
                                height: `${el.cropImgH ?? el.h}px`,
                                top: `${el.cropOffsetY ?? 0}px`,
                                left: `${el.cropOffsetX ?? 0}px`,
                                objectFit: 'fill',
                                maxWidth: 'none',
                                maxHeight: 'none',
                              } : {
                                // Normal mode: cover fills box
                                width: '100%',
                                height: '100%',
                                objectFit: el.imageObjectFit ?? 'cover',
                              }),
                              filter: `
                                ${el.duotoneEnabled ? `url(#duotone-${el.id})` : ''}
                                brightness(${el.brightness ?? 100}%)
                                contrast(${el.contrast ?? 100}%)
                                saturate(${el.saturation ?? 100}%)
                                blur(${el.blur ?? 0}px)
                                hue-rotate(${el.hueRotate ?? 0}deg)
                                ${(el.shadowOffsetX || el.shadowOffsetY) ? `drop-shadow(${el.shadowOffsetX ?? 0}px ${el.shadowOffsetY ?? 0}px ${el.shadowBlur ?? 15}px ${el.shadowColor || 'rgba(0,0,0,0.5)'})` : ''}
                              `
                            }}
                            draggable={false}
                          />
                          {el.vignette && el.vignette > 0 && (
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              pointerEvents: 'none',
                              background: `radial-gradient(circle, transparent ${100 - el.vignette}%, rgba(0,0,0,${el.vignette / 100}) 100%)`,
                              mixBlendMode: 'multiply'
                            }} />
                          )}
                          {(el.noiseIntensity ?? 0) > 0 && (
                            <div 
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                                opacity: (el.noiseIntensity ?? 0) / 100 * 0.85,
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='4' seed='15'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                                backgroundSize: '200px 200px',
                                mixBlendMode: 'soft-light',
                                filter: 'contrast(3)',
                                zIndex: 10
                              }}
                            />
                          )}
                          </div>
                        );
                        if (deformActive && deformWrapStyle) {
                          return <div style={deformWrapStyle}>{imageInner}</div>;
                        }
                        return (
                          <>
                            {imageInner}
                            {/* Contorno roxo do mockup quando a imagem tem mockupPath */}
                            {el.mockupPath && (
                              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                <path
                                  d={el.mockupPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'}
                                  fill="none"
                                  stroke="#7c3aed"
                                  strokeWidth={3}
                                  strokeDasharray="8,4"
                                />
                              </svg>
                            )}
                            {/* Renderiza imagem do mockup por cima */}
                            {el.mockupPath && el.mockupImageId && (() => {
                              const mockupImg = elements.find(e => e.id === el.mockupImageId);
                              if (!mockupImg || !mockupImg.imageSrc) return null;
                              const pathStr = el.mockupPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
                              return (
                                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                  <defs>
                                    <clipPath id={`mockup-clip-${el.id}`}>
                                      <path d={pathStr} />
                                    </clipPath>
                                  </defs>
                                  <image
                                    href={mockupImg.imageSrc}
                                    x={mockupImg.x - el.x}
                                    y={mockupImg.y - el.y}
                                    width={mockupImg.w}
                                    height={mockupImg.h}
                                    preserveAspectRatio="none"
                                    clipPath={`url(#mockup-clip-${el.id})`}
                                    opacity={(mockupImg.opacity ?? 100) / 100}
                                  />
                                </svg>
                              );
                            })()}
                          </>
                        );
                      })()}

                      {el.type === 'mockup' && el.mockupPath && (() => {
                        const pathStr = el.mockupPath.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
                        const childImg = el.mockupImageId ? elements.find(e => e.id === el.mockupImageId) : null;
                        
                        return (
                          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                            <svg style={{ width: '100%', height: '100%', display: 'block', position: 'absolute' }}>
                              <path
                                d={pathStr}
                                fill="none"
                                stroke="#7c3aed"
                                strokeWidth={3}
                                strokeDasharray="8,4"
                              />
                            </svg>
                            
                            {childImg && childImg.imageSrc && (
                              <svg style={{ width: '100%', height: '100%', display: 'block' }}>
                                <defs>
                                  <clipPath id={`mockup-clip-${el.id}`}>
                                    <path d={pathStr} />
                                  </clipPath>
                                </defs>
                                <image
                                  href={childImg.imageSrc}
                                  x={(childImg.x - el.x)}
                                  y={(childImg.y - el.y)}
                                  width={childImg.w}
                                  height={childImg.h}
                                  preserveAspectRatio="none"
                                  clipPath={`url(#mockup-clip-${el.id})`}
                                  opacity={(childImg.opacity ?? 100) / 100}
                                />
                              </svg>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              </div>

                    {/* Mockup mode: pontos e preview */}
                    {isActivePg && mockupMode && (
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 999998 }}>
                        <svg style={{ width: '100%', height: '100%', display: 'block' }}>
                          {/* Linhas entre pontos */}
                          {mockupPoints.map((p, i) => {
                            if (i === 0) return null;
                            const prev = mockupPoints[i - 1];
                            return (
                              <line
                                key={i}
                                x1={prev.x}
                                y1={prev.y}
                                x2={p.x}
                                y2={p.y}
                                stroke="#7c3aed"
                                strokeWidth={2}
                              />
                            );
                          })}
                          
                          {/* Linha do último ponto até o mouse */}
                          {mockupPoints.length > 0 && mockupMousePos && !mockupClosed && (
                            <line
                              x1={mockupPoints[mockupPoints.length - 1].x}
                              y1={mockupPoints[mockupPoints.length - 1].y}
                              x2={mockupMousePos.x}
                              y2={mockupMousePos.y}
                              stroke="#7c3aed"
                              strokeWidth={2}
                              strokeDasharray="4,4"
                              opacity={0.6}
                            />
                          )}
                          
                          {/* Linha de fechamento (do último até o primeiro) */}
                          {mockupClosed && mockupPoints.length > 2 && (
                            <line
                              x1={mockupPoints[mockupPoints.length - 1].x}
                              y1={mockupPoints[mockupPoints.length - 1].y}
                              x2={mockupPoints[0].x}
                              y2={mockupPoints[0].y}
                              stroke="#10b981"
                              strokeWidth={3}
                            />
                          )}
                          
                          {/* Círculos nos pontos */}
                          {mockupPoints.map((p, i) => (
                            <circle
                              key={`p-${i}`}
                              cx={p.x}
                              cy={p.y}
                              r={i === 0 ? 8 : 6}
                              fill={i === 0 ? '#10b981' : '#7c3aed'}
                              stroke="#fff"
                              strokeWidth={2}
                            />
                          ))}
                        </svg>
                      </div>
                    )}

                    {/* Marquee selection rectangle */}
                    {isActivePg && marqueeRect && (
                      <div style={{
                        position: 'absolute',
                        left: marqueeRect.x,
                        top: marqueeRect.y,
                        width: marqueeRect.w,
                        height: marqueeRect.h,
                        border: '2px dashed #7c5cfc',
                        background: 'rgba(124,92,252,0.25)',
                        pointerEvents: 'none',
                        zIndex: 9999999,
                        borderRadius: 2,
                      }} />
                    )}

                    {/* ── OVERLAY: Contornos e handles para elemento selecionado ── */}
                    {isActivePg && (selectedId || multiSelectedIds.length > 1) && (() => {
                      let selectedEl: any;
                      let isDeformActive = false;
                      
                      if (multiSelectedIds.length > 1) {
                        const mels = page.elements.filter(el => multiSelectedIds.includes(el.id));
                        if (mels.length === 0) return null;
                        const minX = Math.min(...mels.map(e => e.x));
                        const minY = Math.min(...mels.map(e => e.y));
                        const maxX = Math.max(...mels.map(e => e.x + e.w));
                        const maxY = Math.max(...mels.map(e => e.y + e.h));
                        selectedEl = { id: selectedId || mels[0].id, x: minX, y: minY, w: maxX - minX, h: maxY - minY, rotation: 0, type: 'group' };
                      } else {
                        selectedEl = page.elements.find(el => el.id === selectedId);
                        if (!selectedEl || selectedEl.locked) return null;
                        isDeformActive = !!(selectedEl.deformEnabled);
                      }
                      
                      return (
                        <>
                          {/* Selection ring wrapper */}
                          <div
                            style={{
                              position: 'absolute',
                              left: selectedEl.x,
                              top: selectedEl.y,
                              width: selectedEl.w,
                              height: selectedEl.h,
                              transform: `rotate(${selectedEl.rotation}deg)`,
                              pointerEvents: 'none',
                              zIndex: 999999,
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: '-6px',
                                border: '4px solid #7c5cfc',
                                borderRadius: '4px',
                                boxShadow: '0 0 0 2px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.4)',
                              }}
                            />
                          </div>
                          
                          {/* Resize handles — ocultos quando deform está ativo */}
                          {!isDeformActive && ['nw','n','ne','w','e','sw','s','se'].map(h => {
                            let handleX = selectedEl.x;
                            let handleY = selectedEl.y;
                            
                            if (h.includes('w')) handleX = selectedEl.x - 12;
                            else if (h.includes('e')) handleX = selectedEl.x + selectedEl.w - 12;
                            else handleX = selectedEl.x + selectedEl.w / 2 - 12;
                            
                            if (h.includes('n')) handleY = selectedEl.y - 12;
                            else if (h.includes('s')) handleY = selectedEl.y + selectedEl.h - 12;
                            else handleY = selectedEl.y + selectedEl.h / 2 - 12;
                            
                            const isCropHandle = selectedEl.type === 'image' && (selectedEl.imageObjectFit ?? 'cover') === 'cover' && h.length === 1;
                            
                            return (
                              <div
                                key={h}
                                style={{
                                  position: 'absolute',
                                  left: handleX,
                                  top: handleY,
                                  width: 24,
                                  height: 24,
                                  background: isCropHandle ? 'rgba(124,58,237,0.8)' : '#fff',
                                  border: isCropHandle ? '4px solid #c084fc' : '4px solid #7c5cfc',
                                  borderRadius: '4px',
                                  boxShadow: '0 3px 8px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,0,0,0.3)',
                                  pointerEvents: 'all',
                                  cursor: h === 'nw' ? 'nw-resize' : h === 'n' ? 'n-resize' : h === 'ne' ? 'ne-resize' : h === 'w' ? 'w-resize' : h === 'e' ? 'e-resize' : h === 'sw' ? 'sw-resize' : h === 's' ? 's-resize' : 'se-resize',
                                  transform: `rotate(${selectedEl.rotation}deg)`,
                                  transformOrigin: `${selectedEl.x + selectedEl.w / 2 - handleX + 12}px ${selectedEl.y + selectedEl.h / 2 - handleY + 12}px`,
                                  zIndex: 999999,
                                }}
                                onMouseDown={e => { e.stopPropagation(); onElementMouseDown(e, selectedEl.id, h); }}
                              />
                            );
                          })}
                          
                          {/* Quick toolbar — oculto quando deform está ativo ou itens em grupo */}
                          {!isDeformActive && multiSelectedIds.length <= 1 && <div
                            style={{
                              position: 'absolute',
                              left: selectedEl.x + selectedEl.w / 2 - 120,
                              top: selectedEl.y - 85,
                              display: 'flex',
                              gap: 24,
                              background: 'rgba(17, 17, 24, 0.95)',
                              backdropFilter: 'blur(10px)',
                              padding: '10px 16px',
                              borderRadius: 12,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                              border: '1px solid rgba(124, 92, 252, 0.3)',
                              pointerEvents: 'all',
                              transform: `rotate(${selectedEl.rotation}deg)`,
                              transformOrigin: `120px ${85 + selectedEl.h / 2}px`,
                              zIndex: 999999,
                            }}
                          >
                            <button
                              style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(124, 92, 252, 0.15)',
                                border: '2px solid rgba(124, 92, 252, 0.3)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                cursor: 'pointer',
                                color: '#7c5cfc',
                                transition: 'all 0.15s',
                              }}
                              onClick={(e) => { e.stopPropagation(); duplicateElement(selectedEl.id); }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.3)'; e.currentTarget.style.borderColor = '#7c5cfc'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                              title="Duplicar (Ctrl+D)"
                            >
                              ➕
                            </button>
                            <button
                              style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(124, 92, 252, 0.15)',
                                border: '2px solid rgba(124, 92, 252, 0.3)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                cursor: 'grab',
                                color: '#7c5cfc',
                                transition: 'all 0.15s',
                              }}
                              onMouseDown={e => { e.stopPropagation(); onElementMouseDown(e, selectedEl.id, 'rotate'); }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.3)'; e.currentTarget.style.borderColor = '#7c5cfc'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)'; e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                              title="Rotacionar"
                            >
                              ↻
                            </button>
                            <button
                              style={{
                                width: 64,
                                height: 64,
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '2px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                cursor: 'pointer',
                                color: '#ef4444',
                                transition: 'all 0.15s',
                              }}
                              onClick={(e) => { e.stopPropagation(); deleteElement(selectedEl.id); }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                              title="Excluir (Del)"
                            >
                              🗑️
                            </button>
                            </div>}
                        </>
                      );
                    })()}

                    {/* Drop hint when page is empty */}
                    {page.elements.length === 0 && (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 12, pointerEvents: 'none', color: '#c0c0cc'
                      }}>
                        <div style={{ fontSize: 56, opacity: 0.3 }}></div>
                        <p style={{ fontSize: 18, fontWeight: 600, margin: 0, opacity: 0.5, fontFamily: 'Outfit' }}>
                          {page.name} vazio
                        </p>
                        <p style={{ fontSize: 14, margin: 0, opacity: 0.4, textAlign: 'center', maxWidth: 280 }}>
                          {isActivePg ? 'Adicione elementos para começar' : 'Clique para ativar este canvas'}
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}

            {/* ── Reference Panel — inside transform ── */}
            {refPanel && (
              <div style={{ position: 'absolute', left: refPanel.x, top: refPanel.y, width: refPanel.w, height: refPanel.h + 70, background: '#09090e', border: `1px solid rgba(124,58,237,0.7)`, borderRadius: 14, boxShadow: `0 8px 40px rgba(0,0,0,0.8)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
                <div style={{ height: 70, background: '#111118', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 20px`, cursor: 'grab', flexShrink: 0, borderBottom: `1px solid rgba(124,58,237,0.15)` }}
                  onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) return; e.stopPropagation(); refDragRef2.current = { startX: e.clientX, startY: e.clientY, origX: refPanel.x, origY: refPanel.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={e => { if (!refDragRef2.current) return; e.stopPropagation(); try { setRefPanel(p => p ? { ...p, x: refDragRef2.current!.origX + (e.clientX - refDragRef2.current!.startX)/zoom, y: refDragRef2.current!.origY + (e.clientY - refDragRef2.current!.startY)/zoom } : null); } catch {} }}
                  onPointerUp={e => { e.stopPropagation(); refDragRef2.current = null; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7c3aed' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: Math.max(0.1, p.zoom - 0.25) } : null); }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa', width: 48, height: 48, borderRadius: 8, cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 15, color: '#666', minWidth: 52, textAlign: 'center', fontWeight: 600 }}>{Math.round(refPanel.zoom * 100)}%</span>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: Math.min(8, p.zoom + 0.25) } : null); }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa', width: 48, height: 48, borderRadius: 8, cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: 1 } : null); }} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#666', height: 48, padding: `0 18px`, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>fit</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={e => { e.stopPropagation(); setShowRefSearch(true); }} style={{ background: 'rgba(124,58,237,0.15)', border: `1px solid rgba(124,58,237,0.3)`, color: '#c084fc', cursor: 'pointer', width: 52, height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.15)'; }}>
                      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); refDragRef2.current = null; refResizeRef2.current = null; setRefPanel(null); }}
                      style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid rgba(239,68,68,0.3)`, color: '#ef4444', cursor: 'pointer', width: 52, height: 52, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}>×</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', background: '#060608' }}
                  ref={el => {
                    if (!el || (el as any).__refWheelPE) return;
                    (el as any).__refWheelPE = (e: WheelEvent) => {
                      e.preventDefault(); e.stopPropagation();
                      try {
                        const rect = el.getBoundingClientRect();
                        const mx = e.clientX - rect.left + el.scrollLeft;
                        const my = e.clientY - rect.top + el.scrollTop;
                        const delta = e.deltaY < 0 ? 0.12 : -0.12;
                        setRefPanel(p => {
                          if (!p || p.zoom <= 0) return p;
                          const newZ = Math.max(0.1, Math.min(8, p.zoom + delta));
                          const ratio = newZ / p.zoom;
                          if (isFinite(ratio)) requestAnimationFrame(() => { try { el.scrollLeft = mx * ratio - (e.clientX - rect.left); el.scrollTop = my * ratio - (e.clientY - rect.top); } catch {} });
                          return { ...p, zoom: newZ };
                        });
                      } catch {}
                    };
                    el.addEventListener('wheel', (el as any).__refWheelPE, { passive: false });
                  }}>
                  <img src={refPanel.src} draggable={false} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
                </div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, cursor: 'se-resize' }}
                  onPointerDown={e => { e.stopPropagation(); refResizeRef2.current = { startX: e.clientX, startY: e.clientY, origW: refPanel.w, origH: refPanel.h }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={e => { if (!refResizeRef2.current) return; e.stopPropagation(); const r = refResizeRef2.current; setRefPanel(p => p ? { ...p, w: Math.max(160, Math.min(4000, r.origW + (e.clientX - r.startX)/zoom)), h: Math.max(120, Math.min(4000, r.origH + (e.clientY - r.startY)/zoom)) } : null); }}
                  onPointerUp={e => { e.stopPropagation(); refResizeRef2.current = null; }}>
                  <svg width={14} height={14} viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 6, right: 6 }}><line x1="1" y1="7" x2="7" y2="1" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              </div>
            )}

            {/* ── Image Color Slots — canvas-world coordinates ── */}
            {imageColorSlots.map((slot, i) => {
              const firstPage = pages[0];
              const docX = firstPage ? (firstPage.x || 0) : 0;
              const docY = firstPage ? (firstPage.y || 0) : 0;
              const docW = firstPage ? (firstPage.w || canvasW) : canvasW;
              const slotW = slot.w > 0 ? slot.w : docW;
              const slotH = slot.h > 0 ? slot.h : 52;
              const stackOffset = (slotH + 10) * (i + 1) + (activePalette ? (52 + 10) : 0);
              const left = docX + slot.offsetX;
              const top = docY - stackOffset + slot.offsetY;
              const isWide = slotW > slotH * 2;
              return (
                <div key={slot.id} style={{ position: 'absolute', left, top, width: slotW, height: slotH, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: '#09090e', border: '2px solid rgba(124,58,237,0.5)', borderRadius: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'row',
                    flexWrap: isWide ? 'nowrap' as any : 'wrap' as any, alignItems: isWide ? 'center' : 'flex-start',
                    padding: '8px 12px', gap: 8, userSelect: 'none', cursor: slot.locked ? 'default' : 'grab',
                    overflow: 'hidden', pointerEvents: 'all' }}
                    onPointerDown={e => {
                      if (slot.locked || (e.target as HTMLElement).closest('button')) return;
                      e.stopPropagation();
                      slotDragRef.current = { id: slot.id, startX: e.clientX, startY: e.clientY, origOffsetX: slot.offsetX, origOffsetY: slot.offsetY };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                      if (!slotDragRef.current || slotDragRef.current.id !== slot.id) return;
                      e.stopPropagation();
                      setImageColorSlots(prev => prev.map(s => s.id === slot.id ? { ...s,
                        offsetX: slotDragRef.current!.origOffsetX + (e.clientX - slotDragRef.current!.startX)/zoom,
                        offsetY: slotDragRef.current!.origOffsetY + (e.clientY - slotDragRef.current!.startY)/zoom
                      } : s));
                    }}
                    onPointerUp={() => { slotDragRef.current = null; }}>
                    <button onClick={e => { e.stopPropagation(); setImageColorSlots(prev => prev.map(s => s.id === slot.id ? { ...s, locked: !s.locked } : s)); }}
                      title={slot.locked ? 'Desbloquear' : 'Fixar'} style={{ background: 'none', border: 'none', color: slot.locked ? '#c084fc' : '#555', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {slot.locked
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                    </button>
                    <span style={{ fontSize: 13, color: '#777', fontWeight: 700, flexShrink: 0 }}>{slot.label}</span>
                    <div style={{ width: 1, height: 24, background: 'rgba(124,58,237,0.3)', flexShrink: 0 }} />
                    {slot.colors.map((c, ci) => (
                      <div key={ci}
                        onClick={e => { e.stopPropagation(); applyPaletteColor(c); }}
                        style={{ flexGrow: isWide ? 1 : 0, flexShrink: 0, width: isWide ? undefined : 40, height: 40, minWidth: 40, borderRadius: 8, background: c, cursor: 'pointer',
                          border: paletteActiveColor === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)', boxShadow: paletteActiveColor === c ? `0 0 10px ${c}88` : 'none' }}
                        title={c}
                      />
                    ))}
                    <div style={{ width: 1, height: 24, background: 'rgba(124,58,237,0.3)', flexShrink: 0 }} />
                    <button onClick={e => { e.stopPropagation(); setImageColorSlots(prev => prev.filter(s => s.id !== slot.id)); }}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 26, display: 'flex', alignItems: 'center', padding: '0 8px', marginRight: 16, flexShrink: 0, position: 'relative', zIndex: 10 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; }}>×</button>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, cursor: 'se-resize' }}
                      onPointerDown={e => { e.stopPropagation(); slotResizeRef.current = { id: slot.id, startX: e.clientX, startY: e.clientY, origW: slotW, origH: slotH }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                      onPointerMove={e => {
                        if (!slotResizeRef.current || slotResizeRef.current.id !== slot.id) return;
                        e.stopPropagation();
                        const r = slotResizeRef.current;
                        setImageColorSlots(prev => prev.map(s => s.id === slot.id ? { ...s,
                          w: Math.max(100, Math.min(5000, r.origW + (e.clientX - r.startX)/zoom)),
                          h: Math.max(48, Math.min(800, r.origH + (e.clientY - r.startY)/zoom))
                        } : s));
                      }}
                      onPointerUp={() => { slotResizeRef.current = null; }}>
                      <svg width="12" height="12" viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 5, right: 5 }}><line x1="1" y1="7" x2="7" y2="1" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── Active Palette Bar ── */}
            {activePalette && (() => {
              const firstPage = pages[0];
              const docX = firstPage ? (firstPage.x || 0) : 0;
              const docY = firstPage ? (firstPage.y || 0) : 0;
              const docW = firstPage ? (firstPage.w || canvasW) : canvasW;
              const barH = 52;
              const gap = 10;
              return (
                <div style={{ position: 'absolute', left: docX, top: docY - (barH + gap) / zoom, width: docW, height: barH / zoom, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: docW * zoom, height: barH, transform: `scale(${1/zoom})`, transformOrigin: '0 0', background: '#09090e', border: '1px solid rgba(124,58,237,0.5)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, userSelect: 'none', overflow: 'hidden', pointerEvents: 'all', cursor: paletteLocked ? 'default' : 'grab' }}>
                    <button onClick={e => { e.stopPropagation(); setPaletteLocked(v => !v); }} title={paletteLocked ? 'Desbloquear' : 'Fixar'}
                      style={{ background: 'none', border: 'none', color: paletteLocked ? '#c084fc' : '#444', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {paletteLocked
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      }
                    </button>
                    {activePalette.map((c, i) => (
                      <div key={i}
                        onClick={e => {
                          e.stopPropagation();
                          applyPaletteColor(c);
                        }}
                        style={{ flex: 1, height: 32, borderRadius: 6, background: c, cursor: 'pointer', border: paletteActiveColor === c ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.15)', boxShadow: paletteActiveColor === c ? `0 0 10px ${c}88` : 'none', transition: 'transform 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        title={c}
                      />
                    ))}
                    <div style={{ width: 1, height: 28, background: 'rgba(124,58,237,0.3)', flexShrink: 0 }} />
                    <button onClick={e => { e.stopPropagation(); setActivePalette(null); }}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0, lineHeight: 1 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; }}>×</button>
                  </div>
                </div>
              );
            })()}

          </div>
          </div>

          {/* Layers Timeline (Floating) */}
          {layersDockMode === 'floating' && layersTimelineUI}

          {/* Docked Right Panel — inside the row, to the right of the canvas */}
          {layersDockMode === 'right' && layersTimelineUI}

          </div> {/* Closes the row wrapper */}

          {/* Docked Bottom Panel */}
          {layersDockMode === 'bottom' && layersTimelineUI}
          {/* Docked Top Panel */}
        </div> {/* Closes the column wrapper */}

          {/* Zoom controls floating */}
          <div className="canva-zoom-controls">
            <button className="czc-btn" onClick={() => setZoom(z => Math.max(0.05, z - 0.1))}>−</button>
            <span className="czc-val" onClick={fitToScreen} title="Ajustar à tela" style={{ minWidth: '60px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="czc-btn" onClick={() => setZoom(z => Math.min(5, z + 0.1))}>+</button>
          </div>

        </div>


        {/* ── RIGHT PROPERTIES PANEL ─────────────────────────── */}
        <aside className={`canva-right-panel ${showRightSidebar ? 'open' : 'closed'}`}>
          {!selectedEl ? (
            <div className="crp-empty">
              <div className="crp-empty-icon">↑</div>
              <p>Selecione um elemento no canvas para ver e editar suas propriedades.</p>
            </div>
          ) : (
            <>
              <div className="crp-header">
                <h4>
                  {selectedEl.type === 'text' && 'Texto'}
                  {selectedEl.type === 'shape' && 'Forma'}
                  {selectedEl.type === 'image' && 'Imagem'}
                </h4>
                <p>Propriedades do elemento</p>
              </div>
              <div className="crp-body">

                {/* ── POSITION & SIZE ── */}
                <div className="crp-section">
                  <p className="crp-section-title">Posição e Tamanho</p>
                  <div className="crp-row">
                    <span className="crp-label">Posição</span>
                    <div className="crp-input-pair">
                      <input
                        className="crp-input"
                        type="number"
                        value={Math.round(selectedEl.x)}
                        onChange={e => updateElement(selectedEl.id, { x: Number(e.target.value) })}
                        title="X"
                        placeholder="X"
                      />
                      <input
                        className="crp-input"
                        type="number"
                        value={Math.round(selectedEl.y)}
                        onChange={e => updateElement(selectedEl.id, { y: Number(e.target.value) })}
                        title="Y"
                        placeholder="Y"
                      />
                    </div>
                  </div>
                  <div className="crp-row">
                    <span className="crp-label">Tamanho</span>
                    <div className="crp-input-pair">
                      <input
                        className="crp-input"
                        type="number"
                        value={Math.round(selectedEl.w)}
                        onChange={e => updateElement(selectedEl.id, { w: Math.max(10, Number(e.target.value)) })}
                        title="Largura"
                        placeholder="W"
                        min={10}
                      />
                      <input
                        className="crp-input"
                        type="number"
                        value={Math.round(selectedEl.h)}
                        onChange={e => updateElement(selectedEl.id, { h: Math.max(10, Number(e.target.value)) })}
                        title="Altura"
                        placeholder="H"
                        min={10}
                      />
                    </div>
                  </div>
                  <div className="crp-row">
                    <span className="crp-label">Rotação</span>
                    <input
                      className="crp-slider"
                      type="range"
                      min={-180}
                      max={180}
                      value={Math.round(selectedEl.rotation)}
                      onChange={e => updateElement(selectedEl.id, { rotation: Number(e.target.value) }, true)}
                      onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                    />
                    <span className="crp-val">{Math.round(selectedEl.rotation)}°</span>
                  </div>
                  <div className="crp-row">
                    <span className="crp-label">Opacidade</span>
                    <input
                      className="crp-slider"
                      type="range"
                      min={0}
                      max={100}
                      value={selectedEl.opacity}
                      onChange={e => updateElement(selectedEl.id, { opacity: Number(e.target.value) }, true)}
                      onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                    />
                    <span className="crp-val">{selectedEl.opacity}%</span>
                  </div>
                </div>

                {/* ── TEXT PROPERTIES ── */}
                {selectedEl.type === 'text' && (
                  <div className="crp-section">
                    <p className="crp-section-title">Texto</p>
                    <div className="crp-row">
                      <span className="crp-label">Fonte</span>
                      <select
                        className="crp-select"
                        value={selectedEl.fontFamily ?? 'Inter'}
                        onChange={e => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                      >
                        {fontFamilies.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                      </select>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Tamanho</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={6}
                        max={200}
                        value={selectedEl.fontSize ?? 16}
                        onChange={e => updateElement(selectedEl.id, { fontSize: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.fontSize ?? 16}px</span>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Curvatura</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={-180}
                        max={180}
                        value={selectedEl.textCurve ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          console.log('[Slider] Mudando textCurve para:', val);
                          updateElement(selectedEl.id, { textCurve: val }, true);
                        }}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.textCurve ?? 0}°</span>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Cor</span>
                      <div className="crp-color-row">
                        <div className="crp-color-btn" style={{ background: selectedEl.textColor ?? '#1a1a2e' }}>
                          <input
                            type="color"
                            value={selectedEl.textColor ?? '#1a1a2e'}
                            onChange={e => updateElement(selectedEl.id, { textColor: e.target.value }, true)}
                            onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                          />
                        </div>
                        <input
                          className="crp-color-hex"
                          value={(selectedEl.textColor ?? '#1a1a2e').toUpperCase()}
                          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateElement(selectedEl.id, { textColor: e.target.value }); }}
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Estilo</span>
                      <div className="crp-btn-group">
                        <button
                          className={`crp-group-btn ${selectedEl.fontWeight === '700' || selectedEl.fontWeight === 'bold' ? 'active' : ''}`}
                          onClick={() => updateElement(selectedEl.id, { fontWeight: (selectedEl.fontWeight === '700' || selectedEl.fontWeight === 'bold') ? '400' : '700' })}
                          title="Negrito"
                          style={{ fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 14, letterSpacing: 0 }}
                        >B</button>
                        <button
                          className={`crp-group-btn ${selectedEl.fontStyle === 'italic' ? 'active' : ''}`}
                          onClick={() => updateElement(selectedEl.id, { fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })}
                          title="Itálico"
                          style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 14 }}
                        >I</button>
                      </div>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Alinhamento</span>
                      <div className="crp-btn-group">
                        {(['left', 'center', 'right'] as TextAlign[]).map(a => (
                          <button
                            key={a}
                            className={`crp-group-btn ${selectedEl.textAlign === a ? 'active' : ''}`}
                            onClick={() => updateElement(selectedEl.id, { textAlign: a })}
                            title={a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : 'Direita'}
                          >
                            {a === 'left' && (
                              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                                <rect x="0" y="0" width="14" height="2" rx="1"/>
                                <rect x="0" y="5" width="9" height="2" rx="1"/>
                                <rect x="0" y="10" width="11" height="2" rx="1"/>
                              </svg>
                            )}
                            {a === 'center' && (
                              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                                <rect x="0" y="0" width="14" height="2" rx="1"/>
                                <rect x="2.5" y="5" width="9" height="2" rx="1"/>
                                <rect x="1.5" y="10" width="11" height="2" rx="1"/>
                              </svg>
                            )}
                            {a === 'right' && (
                              <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
                                <rect x="0" y="0" width="14" height="2" rx="1"/>
                                <rect x="5" y="5" width="9" height="2" rx="1"/>
                                <rect x="3" y="10" width="11" height="2" rx="1"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="crp-section-title" style={{ marginTop: 12 }}>Deformar</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '52px', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            const enabled = !selectedEl.deformEnabled;
                            const updates: Partial<DesignElement> = { deformEnabled: enabled };
                            if (enabled && !selectedEl.deformCorners) {
                              updates.deformCorners = createDefaultDeformCorners(selectedEl.w, selectedEl.h);
                            }
                            updateElement(selectedEl.id, updates);
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: selectedEl.deformEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)',
                            border: `1px solid ${selectedEl.deformEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.deformEnabled ? 'rgba(124,58,237,0.4)' : 'rgba(40,40,48,1)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.deformEnabled ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)';
                          }}
                          onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.deformEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.deformEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 4h-5L2 9v6l7.5 5h5L22 15V9z"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          Deformar
                        </span>
                      </div>
                    </div>
                    {selectedEl.deformEnabled && (
                      <div className="crp-row" style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                        <span className="crp-label" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Arraste os 4 cantos no canvas para deformar o texto em perspectiva.
                        </span>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => {
                            updateElement(selectedEl.id, {
                              deformCorners: createDefaultDeformCorners(selectedEl.w, selectedEl.h),
                            });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                        >
                          Resetar Deformação
                        </button>
                      </div>
                    )}

                    {/* Esticar Vertical */}
                    <div className="crp-row">
                      <span className="crp-label">↕ Esticar Vertical</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={10}
                        max={500}
                        step={1}
                        value={Math.round((selectedEl.textStretchY ?? 1) * 100)}
                        onChange={e => {
                          const val = Number(e.target.value) / 100;
                          updateElement(selectedEl.id, { textStretchY: val }, true);
                        }}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{((selectedEl.textStretchY ?? 1)).toFixed(1)}×</span>
                    </div>
                    {(selectedEl.textStretchY ?? 1) !== 1 && (
                      <button
                        className="crp-image-action-btn"
                        style={{ padding: '3px 8px', fontSize: '11px', height: '24px' }}
                        onClick={() => {
                          updateElement(selectedEl.id, { textStretchY: 1 });
                          setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                        }}
                      >
                        Resetar Esticar
                      </button>
                    )}

                    {/* Outline / Contorno */}
                    <p className="crp-section-title" style={{ marginTop: 12 }}>Contorno da Letra</p>
                    <div className="crp-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="crp-label">Apenas Contorno (Vazado)</span>
                      <ToggleSwitch
                        checked={selectedEl.textHollowEnabled ?? false}
                        onChange={v => updateElement(selectedEl.id, { textHollowEnabled: v })}
                      />
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Espessura</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={15}
                        value={selectedEl.textStrokeWidth ?? 0}
                        onChange={e => updateElement(selectedEl.id, { textStrokeWidth: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.textStrokeWidth ?? 0}px</span>
                    </div>
                    {((selectedEl.textStrokeWidth ?? 0) > 0 || !!selectedEl.textHollowEnabled) && (
                      <div className="crp-row">
                        <span className="crp-label">Cor do Contorno</span>
                        <div className="crp-color-row">
                          <div className="crp-color-btn" style={{ background: selectedEl.textStrokeColor ?? '#000000' }}>
                            <input
                              type="color"
                              value={selectedEl.textStrokeColor ?? '#000000'}
                              onChange={e => updateElement(selectedEl.id, { textStrokeColor: e.target.value }, true)}
                              onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                            />
                          </div>
                          <input
                            className="crp-color-hex"
                            value={(selectedEl.textStrokeColor ?? '#000000').toUpperCase()}
                            onChange={e => {
                              const v = e.target.value;
                              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                updateElement(selectedEl.id, { textStrokeColor: v });
                              }
                            }}
                            maxLength={7}
                          />
                        </div>
                      </div>
                    )}

                    {/* Sombra da Letra */}
                    <p className="crp-section-title" style={{ marginTop: 12 }}>Sombra da Letra</p>
                    
                    <div className="crp-row" style={{ alignItems: 'flex-start' }}>
                      <span className="crp-label" style={{ marginTop: '8px' }}>Direção (X, Y)</span>
                      
                      {/* Interactive Joystick Pad */}
                      <div 
                        style={{
                          width: '80px',
                          height: '80px',
                          background: 'var(--bg-input, #181825)',
                          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                          borderRadius: '8px',
                          position: 'relative',
                          cursor: 'crosshair',
                          userSelect: 'none',
                          overflow: 'hidden'
                        }}
                        onMouseDown={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const updateOffset = (clientX: number, clientY: number) => {
                            const localX = clientX - rect.left;
                            const localY = clientY - rect.top;
                            const dx = Math.min(Math.max(localX - 40, -30), 30);
                            const dy = Math.min(Math.max(localY - 40, -30), 30);
                            
                            updateElement(selectedEl.id, {
                              textShadowOffsetX: Math.round(dx),
                              textShadowOffsetY: Math.round(dy),
                              textShadowBlur: selectedEl.textShadowBlur ?? 4,
                              textShadowColor: selectedEl.textShadowColor || 'rgba(0,0,0,0.5)',
                            }, true);
                          };
                          
                          updateOffset(e.clientX, e.clientY);
                          
                          const onMouseMove = (moveEvent: MouseEvent) => {
                            updateOffset(moveEvent.clientX, moveEvent.clientY);
                          };
                          
                          const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          };
                          
                          window.addEventListener('mousemove', onMouseMove);
                          window.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        {/* Center grid lines */}
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        
                        {/* Shadow Indicator Dot */}
                        <div 
                          style={{
                            position: 'absolute',
                            left: `${40 + (selectedEl.textShadowOffsetX ?? 0) - 5}px`,
                            top: `${40 + (selectedEl.textShadowOffsetY ?? 0) - 5}px`,
                            width: '10px',
                            height: '10px',
                            background: 'var(--accent, #7c5cfc)',
                            borderRadius: '50%',
                            boxShadow: '0 0 6px var(--accent, #7c5cfc)',
                            pointerEvents: 'none'
                          }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingLeft: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          X: {selectedEl.textShadowOffsetX ?? 0}px
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Y: {selectedEl.textShadowOffsetY ?? 0}px
                        </span>
                        <button 
                          className="crp-image-action-btn"
                          style={{ padding: '2px 6px', fontSize: '10px', height: '22px', marginTop: '6px' }}
                          onClick={() => {
                            updateElement(selectedEl.id, { textShadowOffsetX: 0, textShadowOffsetY: 0 });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                        >
                          Resetar
                        </button>
                      </div>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Desfoque (Blur)</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={30}
                        value={selectedEl.textShadowBlur ?? 4}
                        onChange={e => updateElement(selectedEl.id, { textShadowBlur: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.textShadowBlur ?? 4}px</span>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Cor da Sombra</span>
                      <div className="crp-color-row">
                        <div className="crp-color-btn" style={{ background: selectedEl.textShadowColor && !selectedEl.textShadowColor.startsWith('rgba') ? selectedEl.textShadowColor : '#000000' }}>
                          <input
                            type="color"
                            value={selectedEl.textShadowColor && !selectedEl.textShadowColor.startsWith('rgba') ? selectedEl.textShadowColor : '#000000'}
                            onChange={e => updateElement(selectedEl.id, { textShadowColor: e.target.value }, true)}
                            onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                          />
                        </div>
                        <input
                          className="crp-color-hex"
                          value={selectedEl.textShadowColor || ''}
                          onChange={e => updateElement(selectedEl.id, { textShadowColor: e.target.value })}
                          placeholder="ex: #000000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SHAPE PROPERTIES ── */}
                {selectedEl.type === 'shape' && (
                  <div className="crp-section">
                    <p className="crp-section-title">Forma</p>
                    <div className="crp-row">
                      <span className="crp-label">Preenchimento</span>
                      <div className="crp-color-row">
                        <div className="crp-color-btn" style={{ background: selectedEl.fillColor ?? '#7c5cfc' }}>
                          <input
                            type="color"
                            value={selectedEl.fillColor ?? '#7c5cfc'}
                            onChange={e => updateElement(selectedEl.id, { fillColor: e.target.value }, true)}
                            onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                          />
                        </div>
                        <input
                          className="crp-color-hex"
                          value={(selectedEl.fillColor ?? '#7c5cfc').toUpperCase()}
                          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateElement(selectedEl.id, { fillColor: e.target.value }); }}
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Contorno</span>
                      <div className="crp-color-row">
                        <div className="crp-color-btn" style={{ background: selectedEl.strokeColor ?? 'transparent', boxShadow: 'inset 0 0 0 1px #e5e5ea' }}>
                          <input
                            type="color"
                            value={selectedEl.strokeColor && selectedEl.strokeColor !== 'transparent' ? selectedEl.strokeColor : '#000000'}
                            onChange={e => updateElement(selectedEl.id, { strokeColor: e.target.value, strokeWidth: Math.max(1, selectedEl.strokeWidth ?? 1) }, true)}
                            onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                          />
                        </div>
                        <input
                          className="crp-input"
                          type="number"
                          min={0}
                          max={20}
                          value={selectedEl.strokeWidth ?? 0}
                          onChange={e => updateElement(selectedEl.id, { strokeWidth: Number(e.target.value) })}
                          style={{ flex: 1 }}
                          title="Espessura do contorno"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── IMAGE PROPERTIES ── */}
                {selectedEl.type === 'image' && (
                  <div className="crp-section">
                    <p className="crp-section-title">Imagem</p>
                    {selectedEl.overlayType && selectedEl.overlayType !== 'glow-multicolor' && (
                      <div className="crp-row">
                        <span className="crp-label">Cor do Efeito</span>
                        <div className="crp-color-row">
                          <div className="crp-color-btn" style={{ background: selectedEl.overlayColor1 ?? '#7c5cfc' }}>
                            <input
                              type="color"
                              value={selectedEl.overlayColor1 ?? '#7c5cfc'}
                              onChange={e => {
                                const newColor = e.target.value;
                                const newSrc = selectedEl.overlayType ? getOverlaySVG(selectedEl.overlayType, newColor) : selectedEl.imageSrc;
                                updateElement(selectedEl.id, { 
                                  overlayColor1: newColor,
                                  imageSrc: newSrc 
                                }, true);
                              }}
                              onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                            />
                          </div>
                          <input
                            className="crp-color-hex"
                            value={(selectedEl.overlayColor1 ?? '#7c5cfc').toUpperCase()}
                            onChange={e => {
                              const newColor = e.target.value;
                              if (/^#[0-9a-fA-F]{6}$/.test(newColor)) {
                                const newSrc = selectedEl.overlayType ? getOverlaySVG(selectedEl.overlayType, newColor) : selectedEl.imageSrc;
                                updateElement(selectedEl.id, { 
                                  overlayColor1: newColor,
                                  imageSrc: newSrc 
                                });
                              }
                            }}
                            maxLength={7}
                          />
                        </div>
                      </div>
                    )}
                    {selectedEl.overlayType === 'glow-multicolor' && (
                      <div className="crp-row">
                        <span className="crp-label" style={{ fontSize: '11px', color: '#888' }}>
                          Efeito Neon Multicolorido (Fundo transparente)
                        </span>
                      </div>
                    )}
                    <div className="crp-row" style={{ display: 'grid', gridTemplateColumns: '52px 52px 52px', gap: '8px', marginBottom: '16px', justifyContent: 'center', alignItems: 'start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => handleRemoveBackground(selectedEl)}
                          disabled={isRemovingBg}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: isRemovingBg ? 'rgba(124,58,237,0.2)' : 'rgba(30,30,35,0.95)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: isRemovingBg ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            opacity: isRemovingBg ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => { 
                            if (!isRemovingBg) { 
                              (e.currentTarget as HTMLElement).style.background = 'rgba(40,40,48,1)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                            }
                          }}
                          onMouseLeave={(e) => { 
                            if (!isRemovingBg) { 
                              (e.currentTarget as HTMLElement).style.background = 'rgba(30,30,35,0.95)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                            }
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          {isRemovingBg ? 'Removendo...' : 'Remover fundo'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => handleEnhanceImage(selectedEl)}
                          disabled={isEnhancingImage}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: isEnhancingImage ? 'rgba(124,58,237,0.2)' : 'rgba(30,30,35,0.95)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: isEnhancingImage ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            opacity: isEnhancingImage ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => { 
                            if (!isEnhancingImage) { 
                              (e.currentTarget as HTMLElement).style.background = 'rgba(40,40,48,1)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                            }
                          }}
                          onMouseLeave={(e) => { 
                            if (!isEnhancingImage) { 
                              (e.currentTarget as HTMLElement).style.background = 'rgba(30,30,35,0.95)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                            }
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          {isEnhancingImage ? 'Melhorando...' : 'Melhorar'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => { setImageEraserEl(selectedEl); setModalZoom(1); }}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: 'rgba(30,30,35,0.95)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = 'rgba(40,40,48,1)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                          }}
                          onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = 'rgba(30,30,35,0.95)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          Apagar
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => { setImagePenMaskEl(selectedEl); setMaskPoints([]); setIsClosed(false); setModalZoom(1); setModalPanX(0); setModalPanY(0); }}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: 'rgba(30,30,35,0.95)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = 'rgba(40,40,48,1)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                          }}
                          onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = 'rgba(30,30,35,0.95)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          Pen
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            const enabled = !selectedEl.duotoneEnabled;
                            updateElement(selectedEl.id, {
                              duotoneEnabled: enabled,
                              duotoneColor1: selectedEl.duotoneColor1 || '#000000',
                              duotoneColor2: selectedEl.duotoneColor2 || '#ffffff',
                            });
                          }}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)',
                            border: `1px solid ${selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.4)' : 'rgba(40,40,48,1)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)';
                          }}
                          onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.duotoneEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a10 10 0 0 1 0 20"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          Duotone
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            const enabled = !selectedEl.deformEnabled;
                            const updates: Partial<DesignElement> = { deformEnabled: enabled };
                            if (enabled && !selectedEl.deformCorners) {
                              updates.deformCorners = createDefaultDeformCorners(selectedEl.w, selectedEl.h);
                            }
                            updateElement(selectedEl.id, updates);
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                          style={{
                            width: '52px',
                            height: '52px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0',
                            borderRadius: '16px',
                            background: selectedEl.deformEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)',
                            border: `1px solid ${selectedEl.deformEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.deformEnabled ? 'rgba(124,58,237,0.4)' : 'rgba(40,40,48,1)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.deformEnabled ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)';
                          }}
                          onMouseLeave={(e) => { 
                            (e.currentTarget as HTMLElement).style.background = selectedEl.deformEnabled ? 'rgba(124,58,237,0.3)' : 'rgba(30,30,35,0.95)';
                            (e.currentTarget as HTMLElement).style.borderColor = selectedEl.deformEnabled ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)';
                          }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 4h-5L2 9v6l7.5 5h5L22 15V9z"/>
                          </svg>
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 400, textAlign: 'center', color: 'rgba(255,255,255,0.65)', lineHeight: 1.2 }}>
                          Deformar
                        </span>
                      </div>
                    </div>

                    {selectedEl.duotoneEnabled && (
                      <>
                        <div className="crp-row">
                          <span className="crp-label">Cor Escura</span>
                          <div className="crp-color-row">
                            <div className="crp-color-btn" style={{ background: selectedEl.duotoneColor1 || '#000000' }}>
                              <input
                                type="color"
                                value={selectedEl.duotoneColor1 || '#000000'}
                                onChange={e => updateElement(selectedEl.id, { duotoneColor1: e.target.value }, true)}
                                onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                              />
                            </div>
                            <input
                              className="crp-color-hex"
                              value={(selectedEl.duotoneColor1 || '#000000').toUpperCase()}
                              onChange={e => {
                                const v = e.target.value;
                                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                  updateElement(selectedEl.id, { duotoneColor1: v });
                                }
                              }}
                              maxLength={7}
                            />
                          </div>
                        </div>
                        <div className="crp-row">
                          <span className="crp-label">Cor Clara</span>
                          <div className="crp-color-row">
                            <div className="crp-color-btn" style={{ background: selectedEl.duotoneColor2 || '#ffffff' }}>
                              <input
                                type="color"
                                value={selectedEl.duotoneColor2 || '#ffffff'}
                                onChange={e => updateElement(selectedEl.id, { duotoneColor2: e.target.value }, true)}
                                onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                              />
                            </div>
                            <input
                              className="crp-color-hex"
                              value={(selectedEl.duotoneColor2 || '#ffffff').toUpperCase()}
                              onChange={e => {
                                const v = e.target.value;
                                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                  updateElement(selectedEl.id, { duotoneColor2: v });
                                }
                              }}
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedEl.deformEnabled && (
                      <div className="crp-row" style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                        <span className="crp-label" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Arraste os 4 cantos no canvas para deformar a imagem em perspectiva.
                        </span>
                        <button
                          className="crp-image-action-btn"
                          onClick={() => {
                            updateElement(selectedEl.id, {
                              deformCorners: createDefaultDeformCorners(selectedEl.w, selectedEl.h),
                            });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                        >
                          Resetar Deformação
                        </button>
                      </div>
                    )}

                    <div className="crp-row">
                      <span className="crp-label">Inverter</span>
                      <div className="crp-btn-group">
                        <button
                          className={`crp-group-btn ${selectedEl.flipX ? 'active' : ''}`}
                          onClick={() => {
                            updateElement(selectedEl.id, { flipX: !selectedEl.flipX });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                          title="Espelhar horizontalmente"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                            <rect x="6.25" y="1" width="1.5" height="12" rx="0.75" opacity="0.35" />
                            <path d="M1.5 4.5 4 7 1.5 9.5Z" />
                            <path d="M12.5 4.5 10 7 12.5 9.5Z" />
                          </svg>
                        </button>
                        <button
                          className={`crp-group-btn ${selectedEl.flipY ? 'active' : ''}`}
                          onClick={() => {
                            updateElement(selectedEl.id, { flipY: !selectedEl.flipY });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                          title="Espelhar verticalmente"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                            <rect x="1" y="6.25" width="12" height="1.5" rx="0.75" opacity="0.35" />
                            <path d="M4.5 1.5 7 4 9.5 1.5Z" />
                            <path d="M4.5 12.5 7 10 9.5 12.5Z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Brilho</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={200}
                        value={selectedEl.brightness ?? 100}
                        onChange={e => updateElement(selectedEl.id, { brightness: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.brightness ?? 100}%</span>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Contraste</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={200}
                        value={selectedEl.contrast ?? 100}
                        onChange={e => updateElement(selectedEl.id, { contrast: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.contrast ?? 100}%</span>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Saturação</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={200}
                        value={selectedEl.saturation ?? 100}
                        onChange={e => updateElement(selectedEl.id, { saturation: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.saturation ?? 100}%</span>
                    </div>
                    
                    <div className="crp-row">
                      <span className="crp-label">Vinheta</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={100}
                        value={selectedEl.vignette ?? 0}
                        onChange={e => updateElement(selectedEl.id, { vignette: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.vignette ?? 0}</span>
                    </div>
                    <div className="crp-row">
                      <span className="crp-label">Desfoque</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={20}
                        value={selectedEl.blur ?? 0}
                        onChange={e => updateElement(selectedEl.id, { blur: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.blur ?? 0}px</span>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Matriz (Cor)</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={360}
                        value={selectedEl.hueRotate ?? 0}
                        onChange={e => updateElement(selectedEl.id, { hueRotate: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.hueRotate ?? 0}°</span>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Ruído</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={100}
                        value={selectedEl.noiseIntensity ?? 0}
                        onChange={e => updateElement(selectedEl.id, { noiseIntensity: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.noiseIntensity ?? 0}</span>
                    </div>
                    
                    {/* Sombra da Imagem */}
                    <p className="crp-section-title" style={{ marginTop: 12 }}>Sombra da Imagem</p>
                    
                    <div className="crp-row" style={{ alignItems: 'flex-start' }}>
                      <span className="crp-label" style={{ marginTop: '8px' }}>Direção (X, Y)</span>
                      
                      {/* Interactive Joystick Pad */}
                      <div 
                        style={{
                          width: '80px',
                          height: '80px',
                          background: 'var(--bg-input, #181825)',
                          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                          borderRadius: '8px',
                          position: 'relative',
                          cursor: 'crosshair',
                          userSelect: 'none',
                          overflow: 'hidden'
                        }}
                        onMouseDown={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const updateOffset = (clientX: number, clientY: number) => {
                            const localX = clientX - rect.left;
                            const localY = clientY - rect.top;
                            const dx = Math.min(Math.max(localX - 40, -30), 30);
                            const dy = Math.min(Math.max(localY - 40, -30), 30);
                            
                            updateElement(selectedEl.id, {
                              shadowOffsetX: Math.round(dx),
                              shadowOffsetY: Math.round(dy),
                              shadowBlur: selectedEl.shadowBlur ?? 15,
                              shadowColor: selectedEl.shadowColor || 'rgba(0,0,0,0.5)',
                            }, true);
                          };
                          
                          updateOffset(e.clientX, e.clientY);
                          
                          const onMouseMove = (moveEvent: MouseEvent) => {
                            updateOffset(moveEvent.clientX, moveEvent.clientY);
                          };
                          
                          const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          };
                          
                          window.addEventListener('mousemove', onMouseMove);
                          window.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        {/* Center grid lines */}
                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                        
                        {/* Shadow Indicator Dot */}
                        <div 
                          style={{
                            position: 'absolute',
                            left: `${40 + (selectedEl.shadowOffsetX ?? 0) - 5}px`,
                            top: `${40 + (selectedEl.shadowOffsetY ?? 0) - 5}px`,
                            width: '10px',
                            height: '10px',
                            background: 'var(--accent, #7c5cfc)',
                            borderRadius: '50%',
                            boxShadow: '0 0 6px var(--accent, #7c5cfc)',
                            pointerEvents: 'none'
                          }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingLeft: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          X: {selectedEl.shadowOffsetX ?? 0}px
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Y: {selectedEl.shadowOffsetY ?? 0}px
                        </span>
                        <button 
                          className="crp-image-action-btn"
                          style={{ padding: '2px 6px', fontSize: '10px', height: '22px', marginTop: '6px' }}
                          onClick={() => {
                            updateElement(selectedEl.id, { shadowOffsetX: 0, shadowOffsetY: 0 });
                            setElements(prev => { saveHistory(prev, canvasBg); return prev; });
                          }}
                        >
                          Resetar
                        </button>
                      </div>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Desfoque (Blur)</span>
                      <input
                        className="crp-slider"
                        type="range"
                        min={0}
                        max={30}
                        value={selectedEl.shadowBlur ?? 15}
                        onChange={e => updateElement(selectedEl.id, { shadowBlur: Number(e.target.value) }, true)}
                        onMouseUp={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                      />
                      <span className="crp-val">{selectedEl.shadowBlur ?? 15}px</span>
                    </div>

                    <div className="crp-row">
                      <span className="crp-label">Cor da Sombra</span>
                      <div className="crp-color-row">
                        <div className="crp-color-btn" style={{ background: selectedEl.shadowColor && !selectedEl.shadowColor.startsWith('rgba') ? selectedEl.shadowColor : '#000000' }}>
                          <input
                            type="color"
                            value={selectedEl.shadowColor && !selectedEl.shadowColor.startsWith('rgba') ? selectedEl.shadowColor : '#000000'}
                            onChange={e => updateElement(selectedEl.id, { shadowColor: e.target.value }, true)}
                            onBlur={() => setElements(prev => { saveHistory(prev, canvasBg); return prev; })}
                          />
                        </div>
                        <input
                          className="crp-color-hex"
                          value={selectedEl.shadowColor || ''}
                          onChange={e => updateElement(selectedEl.id, { shadowColor: e.target.value })}
                          placeholder="ex: #000000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ARRANGE ── */}
                <div className="crp-section">
                  <p className="crp-section-title">Organizar</p>
                  <div className="crp-arrange-grid">
                    <button className="crp-action-btn" onClick={() => bringForward(selectedEl.id)}>↑ Para Frente</button>
                    <button className="crp-action-btn" onClick={() => sendBackward(selectedEl.id)}>↓ Para Trás</button>
                    <button className="crp-action-btn" onClick={() => updateElement(selectedEl.id, { x: 0, y: 0 })}>Canto Sup.</button>
                    <button className="crp-action-btn" onClick={() => updateElement(selectedEl.id, { x: canvasW/2 - selectedEl.w/2, y: canvasH/2 - selectedEl.h/2 })}>Centralizar</button>
                  </div>
                </div>

                {/* ── ACTIONS ── */}
                <div className="crp-section">
                  <p className="crp-section-title">Ações</p>
                  <button className="crp-action-btn" onClick={() => duplicateElement(selectedEl.id)}>Duplicar</button>
                  <button
                    className="crp-action-btn"
                    onClick={() => updateElement(selectedEl.id, { locked: !selectedEl.locked })}
                  >
                    {selectedEl.locked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                  <button className="crp-action-btn danger" onClick={() => deleteElement(selectedEl.id)}>Excluir</button>
                </div>

              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── NEW CANVAS MODAL ──────────────────────────────────── */}
      {showNewCanvas && (
        <div className="canva-modal-overlay" onClick={() => setShowNewCanvas(false)}>
          <div className="canva-modal" onClick={e => e.stopPropagation()}>
            <h3>Novo Canvas</h3>
            <p className="csp-section-title" style={{ marginBottom: 10 }}>Tamanhos Predefinidos</p>
            <div className="canva-modal-presets">
              {CANVAS_PRESETS.map(p => (
                <div
                  key={p.name}
                  className={`canva-modal-preset ${selectedPreset === p.name ? 'active' : ''}`}
                  onClick={() => { setNewW(p.w); setNewH(p.h); setSelectedPreset(p.name); }}
                >
                  <div className="preset-name">{p.name}</div>
                  <div className="preset-size">{p.w}×{p.h}</div>
                </div>
              ))}
            </div>
            <div className="canva-modal-row">
              <label>Largura (px)</label>
              <input type="number" value={newW} onChange={e => { setNewW(Number(e.target.value)); setSelectedPreset(''); }} min={100} max={8000} />
            </div>
            <div className="canva-modal-row">
              <label>Altura (px)</label>
              <input type="number" value={newH} onChange={e => { setNewH(Number(e.target.value)); setSelectedPreset(''); }} min={100} max={8000} />
            </div>
            <div className="canva-modal-actions">
              <button className="cm-btn cm-btn-cancel" onClick={() => setShowNewCanvas(false)}>Cancelar</button>
              <button
                className="cm-btn cm-btn-primary"
                onClick={addNewPage}
                disabled={pages.length >= 10}
              >
                {pages.length >= 10 ? '⚠️ Limite atingido' : `+ Adicionar Canvas ${pages.length + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CAROUSEL MODAL ── */}
      {showCarouselModal && (
        <div className="canva-modal-overlay" onClick={() => setShowCarouselModal(false)}>
          <div className="canva-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="5" height="12" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="17" y="6" width="5" height="12" rx="1"/></svg>
              Criar Carrossel
            </h3>

            <p className="csp-section-title" style={{ marginBottom: 10 }}>Número de Slides</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 20 }}>
              {[3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setCarouselCount(n)}
                  style={{ padding: '12px 0', borderRadius: 8, border: `2px solid ${carouselCount === n ? '#7c3aed' : '#1a1a2e'}`, background: carouselCount === n ? 'rgba(124,58,237,0.2)' : 'transparent', color: carouselCount === n ? '#c084fc' : '#666', fontSize: 18, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {n}
                </button>
              ))}
            </div>

            <p className="csp-section-title" style={{ marginBottom: 10 }}>Formato</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { id: 'square', label: 'Quadrado', size: '1080 × 1080px' },
                { id: 'portrait', label: 'Retrato', size: '1080 × 1350px' },
                { id: 'landscape', label: 'Paisagem', size: '1080 × 566px' },
              ].map(f => (
                <button key={f.id} onClick={() => setCarouselFormat(f.id as any)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: `2px solid ${carouselFormat === f.id ? '#7c3aed' : '#1a1a2e'}`, background: carouselFormat === f.id ? 'rgba(124,58,237,0.15)' : 'transparent', color: carouselFormat === f.id ? '#c084fc' : '#666', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' as any, transition: 'all 0.15s' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{f.size}</div>
                  </div>
                  {carouselFormat === f.id && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>

            <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11, color: '#888', lineHeight: 1.5 }}>
              Serão criados <strong style={{ color: '#c084fc' }}>{carouselCount} slides</strong> com marcações de posição (número do slide, borda guia). Remova as marcações antes de exportar ou exporte como está.
            </div>

            <div className="canva-modal-actions">
              <button className="cm-btn cm-btn-cancel" onClick={() => setShowCarouselModal(false)}>Cancelar</button>
              <button className="cm-btn cm-btn-primary" onClick={createCarousel}>
                Criar {carouselCount} Slides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE ERASER MODAL ────────────────────────────────── */}
      {imageEraserEl && (
        <div 
          className="canva-modal-overlay" 
          style={{ 
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(10, 10, 16, 0.85)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            className="canva-modal" 
            style={{ 
              width: '90%', 
              maxWidth: '900px', 
              height: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '24px',
              gap: '16px',
              background: '#13131e',
              border: '1px solid #232335'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <span></span> Borracha de Imagem
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888899' }}>
                  Pinte sobre as áreas da imagem que deseja apagar (tornar transparentes).
                </p>
              </div>
              <button 
                onClick={() => setImageEraserEl(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Editor workspace */}
            <div 
              style={{ 
                flex: 1, 
                background: '#09090f', 
                borderRadius: '12px', 
                border: '1px solid #1e1e2f',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                cursor: isSpacePressed ? (isModalPanning ? 'grabbing' : 'grab') : 'default'
              }}
              onWheel={e => {
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                setModalZoom(z => Math.max(0.2, Math.min(10, z * delta)));
              }}
              onMouseDown={e => {
                if (isSpacePressed) {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsModalPanning(true);
                  modalPanStartRef.current = { x: e.clientX - modalPanX, y: e.clientY - modalPanY };
                }
              }}
              onMouseMove={e => {
                if (isModalPanning) {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalPanX(e.clientX - modalPanStartRef.current.x);
                  setModalPanY(e.clientY - modalPanStartRef.current.y);
                }
              }}
              onMouseUp={() => setIsModalPanning(false)}
              onMouseLeave={() => setIsModalPanning(false)}
            >
              {/* Zoom Controls Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  gap: '6px',
                  background: 'rgba(25, 25, 40, 0.85)',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #2d2d44',
                  zIndex: 10
                }}
              >
                <button
                  onClick={() => setModalZoom(z => Math.max(0.2, z - 0.2))}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  title="Diminuir Zoom"
                >
                  −
                </button>
                <span style={{ color: '#fff', fontSize: '12px', alignSelf: 'center', minWidth: '48px', textAlign: 'center' }}>
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  onClick={() => setModalZoom(z => Math.min(5, z + 0.2))}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  title="Aumentar Zoom"
                >
                  +
                </button>
                <button
                  onClick={() => { setModalZoom(1); setModalPanX(0); setModalPanY(0); }}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                  title="Resetar Zoom"
                >
                  Reset
                </button>
              </div>

              {/* Checkerboard background wrapper */}
              <div 
                style={{
                  background: 'repeating-conic-gradient(#1c1c28 0% 25%, #13131f 0% 50%) 50% / 20px 20px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  position: 'relative',
                  transform: `translate(${modalPanX}px, ${modalPanY}px) scale(${modalZoom})`,
                  transition: 'none',
                  transformOrigin: 'center center'
                }}
              >
                <canvas
                  ref={modalCanvasRef}
                  onMouseDown={e => {
                    if (isSpacePressed) return; // Do not draw when panning
                    const canvas = e.currentTarget;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    
                    ctx.beginPath();
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = eraserSize;
                    
                    const startX = (e.clientX - rect.left) * scaleX;
                    const startY = (e.clientY - rect.top) * scaleY;
                    ctx.moveTo(startX, startY);
                    
                    (canvas as any).isDrawing = true;
                  }}
                  onMouseMove={e => {
                    setCursorCoords({ x: e.clientX, y: e.clientY });
                    if (isSpacePressed) return;
                    
                    const canvas = e.currentTarget;
                    if (!(canvas as any).isDrawing) return;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    
                    const currentX = (e.clientX - rect.left) * scaleX;
                    const currentY = (e.clientY - rect.top) * scaleY;
                    
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                  }}
                  onMouseUp={e => {
                    const canvas = e.currentTarget;
                    if ((canvas as any).isDrawing) {
                      (canvas as any).isDrawing = false;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        eraserHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                      }
                    }
                  }}
                  onMouseLeave={e => {
                    const canvas = e.currentTarget;
                    if ((canvas as any).isDrawing) {
                      (canvas as any).isDrawing = false;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        eraserHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                      }
                    }
                  }}
                  style={{
                    display: 'block',
                    cursor: isSpacePressed ? 'inherit' : 'none',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <span style={{ fontSize: '13px', color: '#888899', whiteSpace: 'nowrap' }}>
                  Tamanho do Pincel ({eraserSize}px)
                </span>
                <input
                  className="crp-slider"
                  type="range"
                  min={2}
                  max={600}
                  value={eraserSize}
                  onChange={e => setEraserSize(Number(e.target.value))}
                  style={{ maxWidth: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="cm-btn cm-btn-cancel" 
                  onClick={() => setImageEraserEl(null)}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #2d2d44',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className="cm-btn cm-btn-primary" 
                  onClick={() => {
                    const canvasEl = document.querySelector('.canva-modal canvas') as HTMLCanvasElement;
                    if (canvasEl) {
                      const transparentPngBase64 = canvasEl.toDataURL('image/png');
                      updateElement(imageEraserEl.id, { imageSrc: transparentPngBase64 });
                      showToast('✨ Imagem editada com sucesso!');
                      onAddToTerminal?.(`✅ [Borracha de Imagem] Transparência aplicada com sucesso!`);
                    }
                    setImageEraserEl(null);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(124,58,237,0.35)'
                  }}
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BACKGROUND CONTEXT MENU ──────────────────────────── */}
      {backgroundContextMenu && (
        <div
          className="canva-context-menu"
          style={{ top: backgroundContextMenu.y, left: backgroundContextMenu.x }}
          onMouseLeave={() => setBackgroundContextMenu(null)}
        >
          {(() => {
            const designPageId = getDesignPageId(pages, activePageId);
            const draft = getDraftPageForDesign(pages, designPageId);
            const onDesignPage = pages.find(p => p.id === activePageId)?.pageKind !== 'draft';
            return (
              <>
                <div
                  className="ccm-item"
                  onClick={async () => {
                    setBackgroundContextMenu(null);
                    const activePage = pages.find(p => p.id === activePageId);
                    if (!activePage || activePage.elements.length === 0) {
                      showToast('Nenhuma camada para acoplar!');
                      return;
                    }

                    try {
                      showToast('Acoplando...');
                      
                      // performExportPage já renderiza TUDO perfeitamente
                      const dataUrl = await performExportPage(activePage, 0, true);
                      
                      if (!dataUrl) {
                        showToast('❌ Erro');
                        return;
                      }

                      // Criar uma única imagem que substitui tudo
                      setPages(prev => prev.map(p => {
                        if (p.id !== activePageId) return p;
                        return {
                          ...p,
                          elements: [{
                            id: `merged-${Date.now()}`,
                            type: 'image' as const,
                            x: 0,
                            y: 0,
                            w: p.w,
                            h: p.h,
                            rotation: 0,
                            opacity: 100,
                            locked: false,
                            zIndex: 1,
                            imageSrc: dataUrl,
                            imageObjectFit: 'fill' as const,
                          }],
                          zCounter: 1
                        };
                      }));

                      setSelectedId(null);
                      showToast('✓ Acoplado!');
                      setTimeout(() => {
                        const pg = pages.find(p => p.id === activePageId);
                        if (pg) saveHistory(pg.elements, pg.bg);
                      }, 50);
                    } catch (err) {
                      console.error('Erro:', err);
                      showToast('❌ Erro');
                    }
                  }}
                >
                  🔗 Acoplar Tudo
                </div>
                <div className="ccm-divider" />
                {onDesignPage && !draft && (
                  <div
                    className="ccm-item"
                    onClick={() => {
                      createDraft();
                      setBackgroundContextMenu(null);
                    }}
                  >
                    ✎ Criar Rascunho
                  </div>
                )}
                <div
                  className="ccm-item"
                  onClick={() => {
                    setLayersDockMode('bottom');
                    setTimelinePosition('horizontal');
                    setTimelineX(30);
                    setTimelineY(420);
                    setIsTimelineMinimized(false);
                    setBackgroundContextMenu(null);
                    showToast('Aba de camadas redefinida!');
                  }}
                >
                  Resetar Camada
                </div>
                {draft && (
                  <div
                    className="ccm-item"
                    onClick={() => {
                      setActivePageId(draft.id);
                      setActivePanel('draw');
                      setDrawMode('pen');
                      setBackgroundContextMenu(null);
                    }}
                  >
                    📝 {activePageId === draft.id ? 'Rascunho Ativo' : 'Abrir Rascunho'}
                  </div>
                )}
                {draft?.draftForPageId && activePageId === draft.id && (
                  <>
                    <div className="ccm-divider" />
                    <div
                      className="ccm-item"
                      onClick={() => {
                        setActivePageId(draft.draftForPageId!);
                        setBackgroundContextMenu(null);
                      }}
                    >
                      ← Voltar ao Canvas Principal
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── CONTEXT MENU ─────────────────────────────────────── */}
      {contextMenu && selectedId && (
        <div
          className="canva-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div className="ccm-item" onClick={() => { 
            const el = elements.find(e => e.id === selectedId);
            if (el) {
              setRegisteringElementId(selectedId);
              setRegisterName(el.customName || '');
              setRegisterCategory(el.customCategory || 'outro');
              setShowRegisterModal(true);
            }
            setContextMenu(null); 
          }}>Registrar</div>
          <div className="ccm-divider" />
          <div className="ccm-item" onClick={() => { duplicateElement(selectedId); setContextMenu(null); }}>Duplicar</div>
          <div className="ccm-item" onClick={() => { bringForward(selectedId); setContextMenu(null); }}>⬆ Trazer para Frente</div>
          <div className="ccm-item" onClick={() => { sendBackward(selectedId); setContextMenu(null); }}>⬇ Enviar para Trás</div>
          {selectedId && (() => {
            const el = elements.find(e => e.id === selectedId);
            
            // Botão "Fazer Mockup" - aparece em imagens SEM mockup quando existe uma imagem COM mockup
            const imgWithMockup = elements.find(e => e.type === 'image' && e.mockupPath);
            if (el && el.type === 'image' && !el.mockupPath && imgWithMockup && !imgWithMockup.mockupImageId) {
              return (
                <>
                  <div className="ccm-divider" />
                  <div className="ccm-item" onClick={() => {
                    // Move a imagem para ficar acoplada ao mockup
                    updateElement(imgWithMockup.id, { mockupImageId: el.id });
                    showToast('✓ Imagem adicionada ao mockup!');
                    setContextMenu(null);
                  }}>
                    📐 Fazer Mockup
                  </div>
                </>
              );
            }
            
            // Botão "Finalizar Mockup" - aparece só na imagem base (quadro)
            if (el && el.type === 'image' && el.mockupPath && el.mockupImageId) {
              const baseImg = el;
              
              return (
                <>
                  <div className="ccm-divider" />
                  <div className="ccm-item" onClick={async () => {
                    setContextMenu(null);
                    
                    const baseImg = el;
                    
                    // Pega a imagem que foi marcada como mockupImageId
                    const mockupImg = baseImg.mockupImageId ? elements.find(e => e.id === baseImg.mockupImageId) : null;
                    
                    // Cria canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = baseImg.w;
                    canvas.height = baseImg.h;
                    const ctx = canvas.getContext('2d')!;
                    
                    // Desenha imagem base primeiro
                    const bgImg = new Image();
                    bgImg.crossOrigin = 'anonymous';
                    
                    bgImg.onload = async () => {
                      ctx.drawImage(bgImg, 0, 0, baseImg.w, baseImg.h);
                      
                      // Desenha imagem do mockup com clip
                      if (mockupImg && mockupImg.imageSrc) {
                        await new Promise<void>((resolve) => {
                          const img = new Image();
                          img.crossOrigin = 'anonymous';
                          img.onload = () => {
                            ctx.save();
                            ctx.beginPath();
                            baseImg.mockupPath!.forEach((p, i) => {
                              if (i === 0) ctx.moveTo(p.x, p.y);
                              else ctx.lineTo(p.x, p.y);
                            });
                            ctx.closePath();
                            ctx.clip();
                            
                            const x = mockupImg.x - baseImg.x;
                            const y = mockupImg.y - baseImg.y;
                            ctx.drawImage(img, x, y, mockupImg.w, mockupImg.h);
                            ctx.restore();
                            resolve();
                          };
                          img.onerror = () => resolve();
                          img.src = mockupImg.imageSrc;
                        });
                      }
                      
                      // Converte para dataURL
                      const dataUrl = canvas.toDataURL('image/png');
                      
                      // Cria imagem final
                      const newImg: DesignElement = {
                        id: genId(),
                        type: 'image',
                        x: baseImg.x,
                        y: baseImg.y,
                        w: baseImg.w,
                        h: baseImg.h,
                        rotation: 0,
                        opacity: 100,
                        locked: false,
                        zIndex: baseImg.zIndex,
                        imageSrc: dataUrl
                      };
                      
                      // Remove base e mockupImg
                      const idsToRemove = [baseImg.id];
                      if (mockupImg) idsToRemove.push(mockupImg.id);
                      
                      setElements(prev => {
                        saveHistory(prev, canvasBg);
                        return [...prev.filter(e => !idsToRemove.includes(e.id)), newImg];
                      });
                      
                      showToast('✓ Mockup finalizado!');
                      setSelectedId(newImg.id);
                    };
                    
                    bgImg.onerror = () => showToast('❌ Erro ao carregar imagem');
                    bgImg.src = baseImg.imageSrc!;
                  }}>
                    ✨ Finalizar Mockup
                  </div>
                  <div className="ccm-item" onClick={() => {
                    updateElement(el.id, { mockupPath: undefined });
                    showToast('✓ Mockup removido!');
                    setContextMenu(null);
                  }}>
                    🗑️ Remover Mockup
                  </div>
                </>
              );
            }
            
            return null;
          })()}
          <div className="ccm-divider" />
          {selectedId && (() => {
            const el = elements.find(e => e.id === selectedId);
            return el ? (
              <div className="ccm-item" onClick={() => { updateElement(selectedId, { locked: !el.locked }); setContextMenu(null); }}>
                {el.locked ? 'Desbloquear' : 'Bloquear'}
              </div>
            ) : null;
          })()}
          <div className="ccm-divider" />
          <div className="ccm-item danger" onClick={() => { deleteElement(selectedId); setContextMenu(null); }}>Excluir</div>
        </div>
      )}

      {/* ── MULTI-SELECT TOOLBAR ─────────────────────────────── */}
      {multiSelectedIds.length > 1 && (() => {
        const mels = elements.filter(el => multiSelectedIds.includes(el.id));
        if (mels.length === 0) return null;
        
        let boxStyle: React.CSSProperties = {};
        if (canvasRef.current) {
          const minX = Math.min(...mels.map(el => el.x));
          const minY = Math.min(...mels.map(el => el.y));
          const maxX = Math.max(...mels.map(el => el.x + el.w));
          const rect = canvasRef.current.getBoundingClientRect();
          const topPx = rect.top + (minY * zoom) - 60;
          const leftPx = rect.left + ((minX + (maxX - minX)/2) * zoom);
          boxStyle = { top: topPx, left: leftPx, bottom: 'auto' };
        }

        return (
          <div className="multi-select-toolbar" style={boxStyle}>
            <span className="mst-count">{multiSelectedIds.length} selecionados</span>
            <div className="mst-divider" />
            <button
              className="mst-btn"
              title="Duplicar todos"
              onClick={() => {
                let newIds: string[] = [];
                setElements(prev => {
                  let z = zCounter;
                  const copies = mels.map(el => {
                    const c = { ...el, id: genId(), x: el.x + 20, y: el.y + 20, zIndex: z++ };
                    newIds.push(c.id);
                    return c;
                  });
                  const next = [...prev, ...copies];
                  saveHistory(next, canvasBg);
                  return next;
                });
                setZCounter(p => p + mels.length);
                setMultiSelectedIds(newIds);
              }}
            >
              ⧉ Duplicar
            </button>
            <button
              className="mst-btn"
              title="Agrupar elementos"
              onClick={() => {
                const isGrouped = mels.every(el => el.groupId && el.groupId === mels[0].groupId);
                if (isGrouped) {
                  // Ungroup
                  setElements(prev => {
                    const next = prev.map(el => multiSelectedIds.includes(el.id) ? { ...el, groupId: undefined } : el);
                    saveHistory(next, canvasBg);
                    return next;
                  });
                  showToast('Elementos desagrupados!');
                } else {
                  // Group
                  const newGroupId = genId();
                  setElements(prev => {
                    const next = prev.map(el => multiSelectedIds.includes(el.id) ? { ...el, groupId: newGroupId } : el);
                    saveHistory(next, canvasBg);
                    return next;
                  });
                  showToast('Elementos agrupados!');
                }
              }}
            >
              {mels.every(el => el.groupId && el.groupId === mels[0].groupId) ? '⧉ Desagrupar' : '⧉ Agrupar'}
            </button>
            <div className="mst-divider" />
            <button
              className="mst-btn danger"
              title="Excluir todos"
              onClick={() => {
                const ids = new Set(multiSelectedIds);
                setElements(prev => {
                  const next = prev.filter(el => !ids.has(el.id));
                  saveHistory(next, canvasBg);
                  return next;
                });
                setMultiSelectedIds([]);
                setSelectedId(null);
              }}
            >
              🗑 Excluir
            </button>
            <div className="mst-divider" />
            <button
              className="mst-btn secondary"
              title="Limpar seleção"
              onClick={() => setMultiSelectedIds([])}
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* ── TOAST ────────────────────────────────────────────── */}
      {toast && (
        <div className="canva-toast">{toast}</div>
      )}

      {/* ── DRAFT INSTRUCTION FLOATING BOX (fixed, outside canvas, never clipped) ── */}
      {activeDraftNoteId && draftNoteBoxPos && (() => {
        const designPageId2 = getDesignPageId(pages, activePageId);
        const designPg2 = pages.find(p => p.id === designPageId2);
        const el = designPg2?.elements.find(e => e.id === activeDraftNoteId);
        if (!el) return null;
        const typeIcon = el.type === 'image' ? '🖼️' : el.type === 'text' ? 'T' : '◈';
        const imgIdx = el.type === 'image' ? (designPg2!.elements.filter(e=>e.type==='image').indexOf(el)+1) : 0;
        const typeLabel = el.type === 'image' ? `Imagem ${imgIdx}` : el.type === 'text' ? `"${(el.text ?? '').substring(0,16)}${(el.text??'').length>16?'…':''}"` : 'Forma';
        const boxW = 310;
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        let left = draftNoteBoxPos.x;
        let top = draftNoteBoxPos.y;
        if (left + boxW > vpW - 8) left = vpW - boxW - 8;
        if (left < 8) left = 8;
        if (top + 340 > vpH - 8) top = draftNoteBoxPos.y - 360;
        if (top < 8) top = 8;
        return (
          <div
            className="draft-instruction-box"
            style={{ position: 'fixed', left, top, zIndex: 9999999 }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="dib-header">
              <span className="dib-icon">{typeIcon}</span>
              <span className="dib-title">{typeLabel}</span>
              <button className="dib-close" onClick={() => { setActiveDraftNoteId(null); setDraftNoteBoxPos(null); }}>×</button>
            </div>
            <p className="dib-prompt">O que deve ser feito com este elemento?</p>
            {el.type === 'image' && (
              <div className="dib-suggestions">
                {['É o fundo', 'Remover fundo', 'Aumentar saturação', 'Aplicar P&B', 'Recortar', 'Adicionar sombra'].map(s => (
                  <button key={s} className="dib-suggestion-chip" onClick={() => {
                    if (s === 'Remover fundo') {
                      setActiveDraftNoteId(null); setDraftNoteBoxPos(null);
                      handleRemoveBackground(el);
                    } else if (s === 'É o fundo') {
                      setPages(prev => prev.map(pg => {
                        if (pg.id !== designPageId2) return pg;
                        const others = pg.elements.filter(e => e.id !== el.id);
                        const minZ = others.length > 0 ? Math.min(...others.map(e => e.zIndex)) : 2;
                        const withBg = pg.elements.map(e => e.id === el.id
                          ? { ...e, zIndex: minZ - 1, x: 0, y: 0, w: pg.w, h: pg.h, imageObjectFit: 'cover' as const }
                          : e
                        );
                        const sorted = [...withBg].sort((a, b) => a.zIndex - b.zIndex);
                        return { ...pg, elements: sorted.map((ee, i) => ({ ...ee, zIndex: i + 1 })) };
                      }));
                      setActiveDraftNoteId(null); setDraftNoteBoxPos(null);
                      showToast('🎨 Imagem definida como fundo!');
                      onAddToTerminal?.('🎨 Imagem definida como fundo do canvas (cobrindo tudo, zIndex mínimo).');
                    } else {
                      const cur = draftNotes[el.id] ?? '';
                      setDraftNotes(prev => ({ ...prev, [el.id]: cur ? cur + ', ' + s.toLowerCase() : s.toLowerCase() }));
                    }
                  }}>{s}</button>
                ))}
              </div>
            )}
            {el.type === 'text' && (
              <div className="dib-suggestions">
                {['Mudar cor para branco', 'Aumentar tamanho', 'Negrito', 'Sombra no texto', 'Mudar fonte'].map(s => (
                  <button key={s} className="dib-suggestion-chip" onClick={() => {
                    const cur = draftNotes[el.id] ?? '';
                    setDraftNotes(prev => ({ ...prev, [el.id]: cur ? cur + ', ' + s.toLowerCase() : s.toLowerCase() }));
                  }}>{s}</button>
                ))}
              </div>
            )}
            <textarea
              className="dib-textarea"
              placeholder={el.type === 'image' ? 'Ex: remover fundo, aumentar saturação para 150%...' : 'Ex: cor branca, fonte Playfair, tamanho 64px...'}
              value={draftNotes[el.id] ?? ''}
              onChange={e => setDraftNotes(prev => ({ ...prev, [el.id]: e.target.value }))}
              autoFocus
            />
            <div className="dib-footer">
              <button className="dib-clear-btn" onClick={() => setDraftNotes(prev => { const n = {...prev}; delete n[el.id]; return n; })}>🗑 Limpar</button>
              <button className="dib-save-btn" onClick={() => { setActiveDraftNoteId(null); setDraftNoteBoxPos(null); }}>Salvar</button>
            </div>
          </div>
        );
      })()}

      {/* ── IMAGE PEN MASK MODAL ──────────────────────────────── */}
      {imagePenMaskEl && (
        <div 
          className="canva-modal-overlay" 
          style={{ 
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(10, 10, 16, 0.85)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            className="canva-modal" 
            style={{ 
              width: '90%', 
              maxWidth: '900px', 
              height: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '24px',
              gap: '16px',
              background: '#13131e',
              border: '1px solid #232335'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                  <span></span> Recorte por Pontos (Caneta)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#888899' }}>
                  Clique na imagem para criar pontos. Clique no primeiro ponto verde para fechar o laço e recortar a imagem.
                </p>
              </div>
              <button 
                onClick={() => setImagePenMaskEl(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Editor workspace */}
            <div 
              style={{ 
                flex: 1, 
                background: '#09090f', 
                borderRadius: '12px', 
                border: '1px solid #1e1e2f',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                cursor: isSpacePressed ? (isModalPanning ? 'grabbing' : 'grab') : 'default'
              }}
              onWheel={e => {
                const delta = e.deltaY < 0 ? 1.1 : 0.9;
                setModalZoom(z => Math.max(0.2, Math.min(10, z * delta)));
              }}
              onMouseDown={e => {
                if (isSpacePressed) {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsModalPanning(true);
                  modalPanStartRef.current = { x: e.clientX - modalPanX, y: e.clientY - modalPanY };
                }
              }}
              onMouseMove={e => {
                if (isModalPanning) {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalPanX(e.clientX - modalPanStartRef.current.x);
                  setModalPanY(e.clientY - modalPanStartRef.current.y);
                }
              }}
              onMouseUp={() => setIsModalPanning(false)}
              onMouseLeave={() => setIsModalPanning(false)}
            >
              {/* Zoom Controls Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  gap: '6px',
                  background: 'rgba(25, 25, 40, 0.85)',
                  padding: '6px',
                  borderRadius: '8px',
                  border: '1px solid #2d2d44',
                  zIndex: 10
                }}
              >
                <button
                  onClick={() => setModalZoom(z => Math.max(0.2, z - 0.2))}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  −
                </button>
                <span style={{ color: '#fff', fontSize: '12px', alignSelf: 'center', minWidth: '48px', textAlign: 'center' }}>
                  {Math.round(modalZoom * 100)}%
                </span>
                <button
                  onClick={() => setModalZoom(z => Math.min(5, z + 0.2))}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => { setModalZoom(1); setModalPanX(0); setModalPanY(0); }}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #3d3d5c',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Checkerboard background wrapper and Image with SVG */}
              {penMaskDisplaySize.w > 0 && (
                <div 
                  style={{
                    position: 'relative',
                    width: penMaskDisplaySize.w,
                    height: penMaskDisplaySize.h,
                    transform: `translate(${modalPanX}px, ${modalPanY}px) scale(${modalZoom})`,
                    transition: 'none',
                    transformOrigin: 'center center',
                    background: 'repeating-conic-gradient(#1c1c28 0% 25%, #13131f 0% 50%) 50% / 20px 20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <img
                    src={imagePenMaskEl.imageSrc}
                    style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                    alt=""
                  />
                  <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      cursor: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cGF0aCBkPSJNMiAyIEw2IDE0IEw5IDExIEwxOSAyMSBMMjEgMTkgTDExIDkgTDE0IDYgWiIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxLjUiIGZpbGw9IiMyNTYzZWIiLz48L3N2Zz4=") 2 2, crosshair`
                    }}
                    viewBox={`0 0 ${penMaskDisplaySize.w} ${penMaskDisplaySize.h}`}
                    onClick={(e) => {
                      if (isSpacePressed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / modalZoom;
                      const y = (e.clientY - rect.top) / modalZoom;
                      
                      // Check if clicked near first point to close (15 screen pixels threshold)
                      if (maskPoints.length >= 3) {
                        const first = maskPoints[0];
                        const dist = Math.hypot(x - first.x, y - first.y) * modalZoom;
                        if (dist < 15) {
                          setIsClosed(true);
                          return;
                        }
                      }
                      
                      if (!isClosed) {
                        setMaskPoints(prev => [...prev, { x, y }]);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isClosed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / modalZoom;
                      const y = (e.clientY - rect.top) / modalZoom;
                      setMaskMousePos({ x, y });
                    }}
                    onMouseLeave={() => setMaskMousePos(null)}
                  >
                    {/* Dark overlay for cutout preview */}
                    {isClosed && maskPoints.length >= 3 && (
                      <path
                        d={`M 0 0 L ${penMaskDisplaySize.w} 0 L ${penMaskDisplaySize.w} ${penMaskDisplaySize.h} L 0 ${penMaskDisplaySize.h} Z M ${maskPoints.map(p => `${p.x} ${p.y}`).join(' L ')} Z`}
                        fill="rgba(0, 0, 0, 0.65)"
                        fillRule="evenodd"
                        style={{ pointerEvents: 'none' }}
                      />
                    )}

                    {/* Dotted preview line to mouse */}
                    {!isClosed && maskPoints.length > 0 && maskMousePos && (
                      <line
                        x1={maskPoints[maskPoints.length - 1].x}
                        y1={maskPoints[maskPoints.length - 1].y}
                        x2={maskMousePos.x}
                        y2={maskMousePos.y}
                        stroke="#3b82f6"
                        strokeWidth={2 / modalZoom}
                        strokeDasharray={`${4 / modalZoom}, ${4 / modalZoom}`}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}

                    {/* Lines connecting points */}
                    {maskPoints.length > 0 && (
                      <path
                        d={`M ${maskPoints.map(p => `${p.x} ${p.y}`).join(' L ')} ${isClosed ? 'Z' : ''}`}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2 / modalZoom}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}

                    {/* Anchor points */}
                    {maskPoints.map((p, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <g key={idx} style={{ pointerEvents: 'none' }}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={6 / modalZoom}
                            fill={isFirst ? '#10b981' : '#3b82f6'}
                            stroke="#ffffff"
                            strokeWidth={1.5 / modalZoom}
                          />
                          {isFirst && maskPoints.length >= 3 && !isClosed && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={12 / modalZoom}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth={1.5 / modalZoom}
                              strokeDasharray={`${2 / modalZoom}, ${2 / modalZoom}`}
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="cm-btn"
                  onClick={() => {
                    setMaskPoints(prev => prev.slice(0, -1));
                    setIsClosed(false);
                  }}
                  disabled={maskPoints.length === 0}
                  style={{ background: '#1d1d2f', border: '1px solid #2d2d44', color: '#fff', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ↩ Desfazer Ponto
                </button>
                <button
                  className="cm-btn"
                  onClick={() => {
                    setMaskPoints([]);
                    setIsClosed(false);
                  }}
                  disabled={maskPoints.length === 0}
                  style={{ background: '#1d1d2f', border: '1px solid #2d2d44', color: '#fff', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Limpar Tudo
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="cm-btn cm-btn-cancel" 
                  onClick={() => setImagePenMaskEl(null)}
                  style={{
                    background: '#1d1d2f',
                    border: '1px solid #2d2d44',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className="cm-btn cm-btn-primary" 
                  disabled={maskPoints.length < 3 || !isClosed}
                  onClick={applyPenMask}
                  style={{
                    background: maskPoints.length < 3 || !isClosed ? 'rgba(59, 130, 246, 0.4)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: maskPoints.length < 3 || !isClosed ? 'not-allowed' : 'pointer',
                    boxShadow: maskPoints.length < 3 || !isClosed ? 'none' : '0 2px 8px rgba(37,99,235,0.35)'
                  }}
                >
                  Aplicar Recorte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RASCUNHO EM MODO TEXTO ─────────────────────────── */}
      {showDraftTextMode && (
        <div className="canva-modal-overlay" onClick={() => setShowDraftTextMode(false)}>
          <div className="canva-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h3>Rascunho em Modo Texto</h3>
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 8 }}>Imagens encontradas no canvas:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {draftImagesList.map(img => (
                  <button
                    key={img.id}
                    className={`crp-btn ${selectedDraftImageIndex === img.index ? 'active' : ''}`}
                    onClick={() => setSelectedDraftImageIndex(img.index)}
                    style={{
                      background: selectedDraftImageIndex === img.index ? '#4f46e5' : '#f3f4f6',
                      color: selectedDraftImageIndex === img.index ? '#fff' : '#1a1a2e',
                      padding: '8px 16px'
                    }}
                  >
                    Imagem {img.index}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>Instrução para a imagem:</label>
              <textarea
                className="crp-textarea"
                rows={4}
                value={draftInstruction}
                onChange={e => setDraftInstruction(e.target.value)}
                placeholder="Ex: remover fundo, melhorar qualidade, inverter horizontal, preto e branco, brilho 130, contraste 150, blur 3, sombra, duotone, apagar partes, recortar..."
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #3d3d5c', background: '#1a1a2e', color: '#fff' }}
              />
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(124,92,252,0.1)', borderRadius: 6, border: '1px solid rgba(124,92,252,0.25)' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#9d88ff', lineHeight: 1.6 }}>
                  ⚡ <strong>Ações rápidas:</strong> "remover fundo" · "melhorar qualidade" · "inverter horizontal/vertical" · "preto e branco" · "brilho 130" · "contraste 150" · "saturação 200" · "blur 5" · "sombra" · "duotone" · "apagar partes" · "recortar"
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="cm-btn cm-btn-cancel"
                onClick={() => setShowDraftTextMode(false)}
              >
                Cancelar
              </button>
              <button
                className="cm-btn cm-btn-primary"
                onClick={async () => {
                  if (selectedDraftImageIndex === null || !draftInstruction.trim()) {
                    onAddToTerminal?.('❌ Selecione uma imagem e digite uma instrução.');
                    return;
                  }
                  const selectedImage = draftImagesList.find(img => img.index === selectedDraftImageIndex);
                  if (!selectedImage) return;

                  const instr = draftInstruction.toLowerCase();
                  const targetEl = elements.find(e => e.id === selectedImage.id);

                  onAddToTerminal?.(`✏️ Executando instrução na imagem ${selectedDraftImageIndex}: "${draftInstruction}"`);
                  setShowDraftTextMode(false);
                  setDraftInstruction('');
                  setSelectedDraftImageIndex(null);

                  if (!targetEl) {
                    onAddToTerminal?.('❌ Elemento não encontrado.');
                    return;
                  }

                  // ── Executar ação local baseado em keywords ──
                  let handled = false;

                  if (
                    instr.includes('remov') && (instr.includes('fundo') || instr.includes('background') || instr.includes('bg'))
                  ) {
                    handled = true;
                    handleRemoveBackground(targetEl);
                  } else if (instr.includes('melhor') || instr.includes('qualidade') || instr.includes('nitidez')) {
                    handled = true;
                    handleEnhanceImage(targetEl);
                  } else if (instr.includes('inverter') || instr.includes('flip') || instr.includes('espelhar')) {
                    handled = true;
                    const flipH = instr.includes('horizont') || instr.includes('flipx') || (!instr.includes('vertical') && !instr.includes('flipy'));
                    const flipV = instr.includes('vertical') || instr.includes('flipy');
                    updateElement(targetEl.id, {
                      flipX: flipH ? !targetEl.flipX : targetEl.flipX,
                      flipY: flipV ? !targetEl.flipY : targetEl.flipY,
                    });
                    onAddToTerminal?.('✅ Flip aplicado.');
                  } else if (instr.includes('duotone')) {
                    handled = true;
                    updateElement(targetEl.id, { duotoneEnabled: true });
                    onAddToTerminal?.('✅ Duotone ativado.');
                  } else if (instr.includes('preto e branco') || instr.includes('pb') || instr.includes('grayscale') || instr.includes('escala de cinza')) {
                    handled = true;
                    updateElement(targetEl.id, { saturation: 0 });
                    onAddToTerminal?.('✅ Imagem convertida para preto e branco.');
                  } else if (instr.includes('brilho') || instr.includes('brightness')) {
                    handled = true;
                    const m = instr.match(/(\d+)/);
                    const val = m ? Math.min(200, Math.max(0, Number(m[1]))) : 130;
                    updateElement(targetEl.id, { brightness: val });
                    onAddToTerminal?.(`✅ Brilho ajustado para ${val}%.`);
                  } else if (instr.includes('contraste') || instr.includes('contrast')) {
                    handled = true;
                    const m = instr.match(/(\d+)/);
                    const val = m ? Math.min(200, Math.max(0, Number(m[1]))) : 130;
                    updateElement(targetEl.id, { contrast: val });
                    onAddToTerminal?.(`✅ Contraste ajustado para ${val}%.`);
                  } else if (instr.includes('satura') || instr.includes('saturation')) {
                    handled = true;
                    const m = instr.match(/(\d+)/);
                    const val = m ? Math.min(200, Math.max(0, Number(m[1]))) : 150;
                    updateElement(targetEl.id, { saturation: val });
                    onAddToTerminal?.(`✅ Saturação ajustada para ${val}%.`);
                  } else if (instr.includes('blur') || instr.includes('desfoc')) {
                    handled = true;
                    const m = instr.match(/(\d+)/);
                    const val = m ? Math.min(20, Math.max(0, Number(m[1]))) : 3;
                    updateElement(targetEl.id, { blur: val });
                    onAddToTerminal?.(`✅ Blur ajustado para ${val}px.`);
                  } else if (instr.includes('sombra') || instr.includes('shadow')) {
                    handled = true;
                    updateElement(targetEl.id, { shadow: 60 });
                    onAddToTerminal?.('✅ Sombra aplicada.');
                  } else if (instr.includes('apagar') || instr.includes('borracha')) {
                    handled = true;
                    setImageEraserEl(targetEl);
                    setModalZoom(1);
                    onAddToTerminal?.('✅ Ferramenta borracha aberta. Pinte as áreas que deseja apagar.');
                  } else if (instr.includes('recortar') || instr.includes('recorte') || instr.includes('caneta') || instr.includes('pen')) {
                    handled = true;
                    setImagePenMaskEl(targetEl);
                    setMaskPoints([]);
                    setIsClosed(false);
                    setModalZoom(1);
                    setModalPanX(0);
                    setModalPanY(0);
                    onAddToTerminal?.('✅ Ferramenta de recorte por pontos aberta.');
                  }

                  if (!handled) {
                    // Fallback: enviar para IA
                    const actionPrompt = `Aplique a seguinte instrução na imagem com ID ${selectedImage.id} no editor de imagens: ${draftInstruction}`;
                    if (onSendToAI) {
                      onSendToAI(actionPrompt);
                      onAddToTerminal?.(`🤖 Instrução enviada para a IA: "${draftInstruction}"`);
                    } else {
                      onAddToTerminal?.('❌ Instrução não reconhecida e função de IA não disponível.');
                    }
                  }
                }}
                disabled={selectedDraftImageIndex === null || !draftInstruction.trim()}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ─────────────────────────── */}
      {showExportModal && (
        <div className="canva-modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="canva-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3>Exportar Canvas</h3>
            
            {/* Formato */}
            <div style={{ marginBottom: 20 }}>
              <p className="csp-section-title" style={{ marginBottom: 10 }}>Escolha o formato:</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['png', 'jpeg', 'webp'] as const).map(fmt => (
                  <button
                    key={fmt}
                    className={exportFormat === fmt ? 'cm-btn cm-btn-primary' : 'cm-btn'}
                    onClick={() => setExportFormat(fmt)}
                    style={{ flex: 1, padding: '12px' }}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de canvas (se tiver mais de 1) */}
            {pages.filter(p => p.pageKind !== 'draft').length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <p className="csp-section-title" style={{ marginBottom: 10 }}>Canvas:</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    className="cm-btn cm-btn-primary"
                    onClick={() => {
                      setShowExportModal(false);
                      exportSinglePage(activePageId);
                    }}
                    style={{ flex: 1 }}
                  >
                    Apenas Atual
                  </button>
                  <button
                    className="cm-btn cm-btn-primary"
                    onClick={() => {
                      setShowExportModal(false);
                      exportAllPages();
                    }}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    Todos ({pages.filter(p => p.pageKind !== 'draft').length})
                  </button>
                </div>
                <select 
                  className="crp-select"
                  onChange={(e) => {
                    if (e.target.value) {
                      setShowExportModal(false);
                      exportSinglePage(e.target.value);
                    }
                  }}
                  defaultValue=""
                  style={{ width: '100%' }}
                >
                  <option value="" disabled>Ou selecione um específico...</option>
                  {pages.filter(p => p.pageKind !== 'draft').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Botão de confirmar/cancelar */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button 
                className="cm-btn cm-btn-cancel" 
                onClick={() => setShowExportModal(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                className="cm-btn cm-btn-primary"
                onClick={() => {
                  setShowExportModal(false);
                  exportSinglePage(activePageId);
                }}
                style={{ flex: 2 }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM FLOATING BRUSH CURSOR ───────────────────────── */}
      {drawMode && (
        <div
          style={{
            position: 'fixed',
            left: cursorCoords.x,
            top: cursorCoords.y,
            width: drawMode === 'pen' ? penSize * zoom : eraserSize * zoom,
            height: drawMode === 'pen' ? penSize * zoom : eraserSize * zoom,
            borderRadius: '50%',
            border: drawMode === 'pen' ? '1.5px solid #7c5cfc' : '1.5px solid #f43f5e',
            background: drawMode === 'pen' ? 'rgba(124, 92, 252, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 999999
          }}
        />
      )}

      {imageEraserEl && !isSpacePressed && (
        <div
          style={{
            position: 'fixed',
            left: cursorCoords.x,
            top: cursorCoords.y,
            width: eraserSize * modalZoom,
            height: eraserSize * modalZoom,
            borderRadius: '50%',
            border: '1.5px solid #f43f5e',
            background: 'rgba(244, 63, 94, 0.15)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 9999999
          }}
        />
      )}

    </div>

      {/* ── Reference Search — Google Imagens ── */}
      {showRefSearch && (
        <div style={{ position: 'fixed', left: refSearchPos.x, top: refSearchPos.y, width: refSearchSize.w, height: refSearchSize.h, zIndex: 99999, background: '#09090e', border: '1px solid rgba(124,58,237,0.6)', borderRadius: 14, boxShadow: '0 20px 80px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
          <div
            style={{ height: 44, background: '#111118', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'grab', flexShrink: 0, borderBottom: '1px solid rgba(124,58,237,0.2)' }}
            onPointerDown={e => { if ((e.target as HTMLElement).closest('input,button')) return; refSearchDragRef.current = { startX: e.clientX, startY: e.clientY, origX: refSearchPos.x, origY: refSearchPos.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={e => { if (!refSearchDragRef.current) return; setRefSearchPos({ x: refSearchDragRef.current.origX + e.clientX - refSearchDragRef.current.startX, y: refSearchDragRef.current.origY + e.clientY - refSearchDragRef.current.startY }); }}
            onPointerUp={() => { refSearchDragRef.current = null; }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input autoFocus value={refQuery} onChange={e => setRefQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doRefSearch(); e.stopPropagation(); }}
              placeholder="Buscar referência... ex: pôr do sol, retrato"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,58,237,0.25)', color: '#ddd', padding: '7px 12px', fontSize: 12, borderRadius: 8, outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = 'rgba(124,58,237,0.25)'}
            />
            <button onClick={doRefSearch} style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Buscar</button>
            <button onClick={() => setShowRefSearch(false)}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}>×</button>
          </div>
          <webview ref={refWebviewRef} src={refWebviewUrl} style={{ flex: 1, width: '100%' } as any} partition="persist:bill-browser" />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, cursor: 'se-resize' }}
            onPointerDown={e => { e.stopPropagation(); refSearchResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: refSearchSize.w, origH: refSearchSize.h }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={e => { if (!refSearchResizeRef.current) return; setRefSearchSize({ w: Math.max(400, refSearchResizeRef.current.origW + e.clientX - refSearchResizeRef.current.startX), h: Math.max(300, refSearchResizeRef.current.origH + e.clientY - refSearchResizeRef.current.startY) }); }}
            onPointerUp={() => { refSearchResizeRef.current = null; }}>
            <svg width="8" height="8" viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 4, right: 4 }}><line x1="1" y1="7" x2="7" y2="1" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
      )}

      {/* ── Palette Box ── */}
      {showPaletteBox && (
        <div style={{ position: 'fixed', left: 200, top: 60, width: 440, maxHeight: '70vh', zIndex: 9999, background: '#09090e', border: '1px solid rgba(124,58,237,0.6)', borderRadius: 14, boxShadow: '0 16px 60px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
          <div style={{ height: 44, background: '#111118', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', flexShrink: 0, borderBottom: '1px solid rgba(124,58,237,0.2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: '0.08em' }}>TEORIA DAS CORES</span>
            <button onClick={() => setShowPaletteBox(false)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}>×</button>
          </div>
          <div style={{ overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {COLOR_PALETTES.map(palette => (
              <div key={palette.name} onClick={() => { setActivePalette(palette.colors); setShowPaletteBox(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', transition: 'all 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(124,58,237,0.1)'; el.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.02)'; el.style.borderColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  {palette.colors.map((c, i) => (
                    <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: '#aaa' }}>{palette.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Image choice menu ── */}
      {refChoiceMenu && (
        <div id="ref-choice-menu" style={{ position: 'fixed', left: refChoiceMenu.x, top: refChoiceMenu.y, zIndex: 99999, background: '#0d0d14', border: '1px solid rgba(124,58,237,0.5)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden', userSelect: 'none', minWidth: 200 }}>
          <div style={{ padding: '8px 12px', fontSize: 10, color: '#555', borderBottom: '1px solid #1a1a2e', fontWeight: 700, letterSpacing: '0.08em' }}>O QUE FAZER COM ESTA IMAGEM?</div>
          <div
            style={{ padding: '12px 14px', cursor: 'pointer', color: '#ddd', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const dataUrl = refChoiceMenu.dataUrl;
              setRefChoiceMenu(null);
              
              // Carrega imagem para obter dimensões naturais
              const img = new Image();
              img.onload = () => {
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const maxW = canvasW * 0.90;
                const maxH = canvasH * 0.90;
                const scaleX = maxW / naturalW;
                const scaleY = maxH / naturalH;
                const scale = Math.min(scaleX, scaleY, 1);
                const fitW = Math.round(naturalW * scale);
                const fitH = Math.round(naturalH * scale);
                
                addElement({ 
                  type: 'image', 
                  imageSrc: dataUrl, 
                  imageObjectFit: 'cover', 
                  x: Math.round(canvasW / 2 - fitW / 2), 
                  y: Math.round(canvasH / 2 - fitH / 2), 
                  w: fitW, 
                  h: fitH 
                });
                showToast('✅ Imagem adicionada ao canvas!');
              };
              img.src = dataUrl;
              
              addImageColorSlot(dataUrl, 'Ref');
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Enviar ao canvas
          </div>
          <div
            style={{ padding: '12px 14px', cursor: 'pointer', color: '#ddd', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, borderTop: '1px solid #1a1a2e' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const dataUrl = refChoiceMenu.dataUrl;
              setRefChoiceMenu(null);
              const firstPage = pages[0];
              const px = firstPage ? (firstPage.x || 0) + (firstPage.w || canvasW) + 60 : canvasW + 60;
              const py = firstPage ? (firstPage.y || 0) : 0;
              const panelW = firstPage ? firstPage.w : canvasW;
              const panelH = firstPage ? firstPage.h : canvasH;
              setRefPanel({ src: dataUrl, x: px, y: py, w: panelW, h: panelH, zoom: 1 });
              addImageColorSlot(dataUrl, 'Ref');
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Usar como referência
          </div>
        </div>
      )}

      {/* ── REGISTER ELEMENT MODAL ─────────────────────────────── */}
      {showRegisterModal && registeringElementId && createPortal(
        <div style={{
          position: 'fixed', top: registerModalPos.y, left: registerModalPos.x, zIndex: 100000
        }}>
          <div style={{
            background: '#1e1e2e', borderRadius: '12px', padding: '24px',
            width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)', border: '1px solid #333'
          }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '20px',
                cursor: 'move',
                userSelect: 'none'
              }}
              onMouseDown={(e) => {
                registerModalDragging.current = true;
                registerModalDragOffset.current = {
                  x: e.clientX - registerModalPos.x,
                  y: e.clientY - registerModalPos.y
                };
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>
                Registrar Elemento
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '0',
                  lineHeight: '1'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
                Nome do Elemento
              </label>
              <input
                type="text"
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                placeholder="Ex: Montanha Verde, Logo Principal, Cachorro..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px',
                  outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#7c5cfc'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 500 }}>
                Categoria
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(['pessoa', 'objeto', 'animal', 'cenario', 'efeito', 'texto', 'outro'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRegisterCategory(cat)}
                    style={{
                      padding: '10px', background: registerCategory === cat ? 'rgba(124,92,252,0.15)' : 'var(--bg-input)',
                      border: `1px solid ${registerCategory === cat ? '#7c5cfc' : 'var(--border-color)'}`,
                      borderRadius: '6px', color: registerCategory === cat ? '#7c5cfc' : 'var(--text-secondary)',
                      fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s', fontWeight: registerCategory === cat ? 600 : 400,
                      textTransform: 'capitalize'
                    }}
                    onMouseEnter={e => { if (registerCategory !== cat) e.currentTarget.style.borderColor = '#7c5cfc44'; }}
                    onMouseLeave={e => { if (registerCategory !== cat) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{
                  padding: '10px 20px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                  fontWeight: 500, transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = '#ff6b6b'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (registeringElementId) {
                    updateElement(registeringElementId, {
                      customName: registerName.trim() || undefined,
                      customCategory: registerCategory
                    });
                    showToast(`Elemento registrado como "${registerName || 'sem nome'}" (${registerCategory})`);
                  }
                  setShowRegisterModal(false);
                  setRegisteringElementId(null);
                  setRegisterName('');
                  setRegisterCategory('outro');
                }}
                style={{
                  padding: '10px 24px', background: 'linear-gradient(135deg, #7c5cfc 0%, #9d7dff 100%)',
                  border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer',
                  fontWeight: 600, boxShadow: '0 2px 8px rgba(124,92,252,0.3)', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,92,252,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,92,252,0.3)'; }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Floating Reference Panel ── */}
    </>
  );
});

export default PhotoEditor;