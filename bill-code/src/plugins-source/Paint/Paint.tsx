import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

type Tool = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse' | 'select';
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

interface Layer {
  id: string; name: string; canvas: HTMLCanvasElement;
  visible: boolean; opacity: number; blendMode: BlendMode; locked: boolean;
}

interface ImageObject {
  id: string; src: string;
  x: number; y: number; w: number; h: number;
  opacity: number; rotation: number;
  brightness: number; contrast: number; saturation: number;
}

// ── Multi-document ──────────────────────────────────────────
interface PaintDoc {
  id: string;
  name: string;
  layers: Layer[];
  activeLayerId: string;
  canvasSize: { w: number; h: number };
  imageObjects: ImageObject[];
  x: number;
  y: number;
  history: ImageData[];
  historyIdx: number;
}

export interface PaintRef {
  getCanvasSnapshot: () => Promise<string | null>;
  applyPaintAction: (action: string, payload: any) => string;
  loadProjectById: (projectId: string) => Promise<void>;
}

const COLORS_PALETTE = [
  '#ffffff','#c0c0c0','#808080','#404040','#000000',
  '#7c3aed','#c084fc','#a855f7','#6d28d9','#4c1d95',
  '#3b82f6','#06b6d4','#10b981','#84cc16','#eab308',
  '#f97316','#ef4444','#ec4899','#f43f5e','#8b5cf6',
];

interface PaintProps {
  activeProject?: { id: string; name: string; description: string; blockType: string; workFolder?: string; saveId?: string } | null;
  onProjectAction?: (action: string) => void;
  onUpdatePreview?: (previewDataUrl: string) => void;
}

const Paint = forwardRef<PaintRef, PaintProps>(function Paint({ activeProject, onProjectAction, onUpdatePreview }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Source of truth: all docs live here, never serialized to React state ──
  const activeDocIdRef = useRef<string>('');
  const [activeDocId, setActiveDocId] = useState<string>('');
  const docsRef = useRef<PaintDoc[]>([]);
  const [docs, setDocs] = useState<PaintDoc[]>([]);          // React state only for re-render triggers
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Per-doc canvas refs (keyed by docId → HTMLCanvasElement for the composite display)
  const docCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const registerDocCanvas = (docId: string, el: HTMLCanvasElement | null) => {
    if (el) docCanvasRefs.current.set(docId, el);
    else docCanvasRefs.current.delete(docId);
  };

  // Active doc derived helpers — always read from docsRef for sync accuracy
  const getActiveDoc = () => docsRef.current.find(d => d.id === activeDocIdRef.current);

  // Expose active doc's fields as React state for rendering panels
  const [layers, setLayers] = useState<Layer[]>([]);
  const layersRef = useRef<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('');
  const activeLayerIdRef = useRef<string>('');
  const [canvasSize, setCanvasSize] = useState({ w: 1920, h: 1080 });
  const canvasSizeRef = useRef({ w: 1920, h: 1080 });

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#c084fc');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [opacity, setOpacity] = useState(100);
  const [hardness, setHardness] = useState(80);
  const [fillTolerance, setFillTolerance] = useState(15);
  const [fillSampleAll, setFillSampleAll] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const isPanning = useRef(false);
  // Per-doc history stored inside PaintDoc (historyRef/historyIdx aliases current doc)
  const historyRef = useRef<ImageData[]>([]);
  const historyIdx = useRef(-1);
  const cursorElRef = useRef<HTMLDivElement>(null);
  const isSpacePressed = useRef(false);
  const isCtrlPressed = useRef(false);

  // Sync refs with state
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ── Image Objects (per active doc) ────────────────────────
  const [imageObjects, setImageObjects] = useState<ImageObject[]>([]);
  const imageObjectsRef = useRef<ImageObject[]>([]);
  const imgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const selectedObjIdRef = useRef<string | null>(null);

  const objDragRef = useRef<{
    startClientX: number; startClientY: number;
    startObjX: number; startObjY: number;
    type: 'move' | 'resize'; handle?: string;
    startW?: number; startH?: number;
  } | null>(null);

  const updateObj = (id: string, patch: Partial<ImageObject>) => {
    setImageObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  };
  const selectedObj = imageObjects.find(o => o.id === selectedObjId) ?? null;

  useEffect(() => {
    imageObjectsRef.current = imageObjects;
    imageObjects.forEach(obj => {
      if (!imgCacheRef.current.has(obj.id)) {
        const img = new window.Image();
        img.onload = () => compositeDoc(activeDocIdRef.current);
        img.src = obj.src;
        imgCacheRef.current.set(obj.id, img);
      }
    });
    const ids = new Set(imageObjects.map(o => o.id));
    imgCacheRef.current.forEach((_, id) => { if (!ids.has(id)) imgCacheRef.current.delete(id); });
  }, [imageObjects]);
  useEffect(() => { selectedObjIdRef.current = selectedObjId; }, [selectedObjId]);

  // ── Doc management ────────────────────────────────────────
  const makeBlankDoc = (name: string, w: number, h: number, x = 0, y = 0): PaintDoc => {
    const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const layer: Layer = { id: 'layer1', name: 'Camada 1', canvas: cvs, visible: true, opacity: 100, blendMode: 'normal', locked: false };
    const data = ctx.getImageData(0, 0, w, h);
    return { id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2), name, layers: [layer], activeLayerId: 'layer1', canvasSize: { w, h }, imageObjects: [], x, y, history: [data], historyIdx: 0 };
  };

  // Flush active editor state INTO the current doc in docsRef (synchronous, no closures)
  const flushActiveDocState = () => {
    const id = activeDocIdRef.current; if (!id) return;
    const idx = docsRef.current.findIndex(d => d.id === id); if (idx < 0) return;
    docsRef.current[idx] = {
      ...docsRef.current[idx],
      layers: layersRef.current,
      activeLayerId: activeLayerIdRef.current,
      canvasSize: canvasSizeRef.current,
      imageObjects: imageObjectsRef.current,
      history: historyRef.current,
      historyIdx: historyIdx.current,
    };
  };

  // Activate a doc: flush current, then load target into editor state
  const activateDoc = (docId: string) => {
    if (docId === activeDocIdRef.current) return;
    flushActiveDocState();
    const target = docsRef.current.find(d => d.id === docId); if (!target) return;
    activeDocIdRef.current = docId;
    layersRef.current = target.layers;
    activeLayerIdRef.current = target.activeLayerId;
    canvasSizeRef.current = target.canvasSize;
    historyRef.current = target.history;
    historyIdx.current = target.historyIdx;
    // Update React state for re-render (pan/zoom stay as-is)
    setActiveDocId(docId);
    setLayers(target.layers);
    setActiveLayerId(target.activeLayerId);
    setCanvasSize(target.canvasSize);
    setImageObjects(target.imageObjects);
    setSelectedObjId(null);
    requestAnimationFrame(() => compositeDoc(docId));
  };

  const addDoc = () => {
    flushActiveDocState();
    // Position new doc below all existing ones (with 80px gap)
    const lastDoc = docsRef.current[docsRef.current.length - 1];
    const newY = lastDoc ? lastDoc.y + lastDoc.canvasSize.h + 80 : 0;
    const doc = makeBlankDoc(`Canvas ${docsRef.current.length + 1}`, 1920, 1080, 0, newY);
    docsRef.current = [...docsRef.current, doc];
    setDocs([...docsRef.current]);
    activateDoc(doc.id);
    // Zoom/pan unchanged — user stays where they are
  };

  const closeDoc = (docId: string) => {
    if (docsRef.current.length <= 1) return;
    const idx = docsRef.current.findIndex(d => d.id === docId);
    const remaining = docsRef.current.filter(d => d.id !== docId);
    docsRef.current = remaining;
    setDocs([...remaining]);
    if (docId === activeDocIdRef.current) {
      const nextDoc = remaining[Math.max(0, idx - 1)];
      activeDocIdRef.current = ''; // force re-activate
      activateDoc(nextDoc.id);
    }
  };

  // Init first doc
  useEffect(() => {
    const doc = makeBlankDoc('Canvas 1', 1920, 1080);
    docsRef.current = [doc];
    activeDocIdRef.current = doc.id;
    setDocs([doc]);
    setActiveDocId(doc.id);
    layersRef.current = doc.layers;
    activeLayerIdRef.current = doc.activeLayerId;
    canvasSizeRef.current = doc.canvasSize;
    historyRef.current = doc.history;
    historyIdx.current = doc.historyIdx;
    setLayers(doc.layers);
    setActiveLayerId(doc.activeLayerId);
    setCanvasSize(doc.canvasSize);
  }, []);

  const getActiveLayer = () => layersRef.current.find(l => l.id === activeLayerIdRef.current);

  const saveHistory = useCallback((lrs: Layer[]) => {
    const al = lrs.find(l => l.id === activeLayerIdRef.current); if (!al) return;
    const data = al.canvas.getContext('2d')!.getImageData(0, 0, al.canvas.width, al.canvas.height);
    historyRef.current = historyRef.current.slice(0, historyIdx.current + 1);
    historyRef.current.push(data);
    historyIdx.current = historyRef.current.length - 1;
    // Keep docsRef in sync
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) {
      docsRef.current[docIdx].history = historyRef.current;
      docsRef.current[docIdx].historyIdx = historyIdx.current;
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    const al = getActiveLayer(); if (!al) return;
    al.canvas.getContext('2d')!.putImageData(historyRef.current[historyIdx.current], 0, 0);
    composite();
  }, [layers, activeLayerId]);

  const redo = useCallback(() => {
    if (historyIdx.current >= historyRef.current.length - 1) return;
    historyIdx.current++;
    const al = getActiveLayer(); if (!al) return;
    al.canvas.getContext('2d')!.putImageData(historyRef.current[historyIdx.current], 0, 0);
    composite();
  }, [layers, activeLayerId]);

  // ── Composite: draw to a specific doc's canvas ───────────
  const compositeDoc = useCallback((docId: string) => {
    const dc = docCanvasRefs.current.get(docId); if (!dc) return;
    const doc = docsRef.current.find(d => d.id === docId); if (!doc) return;
    const layers = docId === activeDocIdRef.current ? layersRef.current : doc.layers;
    const imgObjs = docId === activeDocIdRef.current ? imageObjectsRef.current : doc.imageObjects;
    const ctx = dc.getContext('2d')!;
    ctx.clearRect(0, 0, dc.width, dc.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dc.width, dc.height);
    layers.forEach(l => {
      if (!l.visible) return;
      ctx.globalAlpha = l.opacity / 100;
      ctx.globalCompositeOperation = l.blendMode === 'normal' ? 'source-over' : l.blendMode as GlobalCompositeOperation;
      ctx.drawImage(l.canvas, 0, 0);
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    imgObjs.forEach(obj => {
      const img = imgCacheRef.current.get(obj.id);
      if (!img || !img.complete || img.naturalWidth === 0) return;
      ctx.save();
      ctx.globalAlpha = obj.opacity / 100;
      ctx.filter = `brightness(${obj.brightness}%) contrast(${obj.contrast}%) saturate(${obj.saturation}%)`;
      const cx = obj.x + obj.w / 2; const cy = obj.y + obj.h / 2;
      ctx.translate(cx, cy); ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.drawImage(img, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Alias for active doc composite
  const composite = useCallback(() => { compositeDoc(activeDocIdRef.current); }, [compositeDoc]);

  useEffect(() => { composite(); }, [layers, imageObjects, composite]);

  // Auto-save canvas state to localStorage when activeProject has a saveId
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[Paint] Sem saveId, não salvando');
      return;
    }
    
    const saveKey = `bill-paint-${activeProject.saveId}`;
    console.log('[Paint] Auto-salvando canvas com chave:', saveKey);
    
    // Debounce para não salvar a cada pixel
    const timer = setTimeout(() => {
      try {
        // Serializa o estado atual do canvas
        const saveData = {
          layers: layersRef.current.map(l => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode,
            locked: l.locked,
            imageData: l.canvas.toDataURL('image/png')
          })),
          activeLayerId: activeLayerIdRef.current,
          canvasSize: canvasSizeRef.current,
          imageObjects: imageObjectsRef.current,
        };
        
        localStorage.setItem(saveKey, JSON.stringify(saveData));
        console.log('[Paint] Canvas salvo com sucesso');
        
        // Atualiza preview do projeto
        if (onUpdatePreview) {
          const doc = docsRef.current.find(d => d.id === activeDocIdRef.current);
          if (doc) {
            const dc = docCanvasRefs.current.get(doc.id);
            if (dc) {
              const previewUrl = dc.toDataURL('image/png');
              onUpdatePreview(previewUrl);
            }
          }
        }
      } catch (err) {
        console.error('[Paint] Erro ao salvar:', err);
      }
    }, 2000); // Salva 2s após última mudança
    
    return () => clearTimeout(timer);
  }, [layers, imageObjects, activeProject, onUpdatePreview]);

  // Auto-load canvas state when activeProject changes
  useEffect(() => {
    if (!activeProject?.saveId) {
      console.log('[Paint] Sem saveId no projeto, iniciando canvas limpo');
      return;
    }
    
    const saveKey = `bill-paint-${activeProject.saveId}`;
    console.log('[Paint] Tentando carregar save com chave:', saveKey);
    
    try {
      const savedData = localStorage.getItem(saveKey);
      if (!savedData) {
        console.log('[Paint] Nenhum save encontrado, usando canvas limpo');
        return;
      }
      
      const data = JSON.parse(savedData);
      console.log('[Paint] Save encontrado, restaurando canvas do projeto:', activeProject.name);
      
      // Reconstrói as layers
      const { w, h } = data.canvasSize || { w: 1920, h: 1080 };
      
      Promise.all(
        data.layers.map((lData: any) => {
          return new Promise<Layer>((resolve) => {
            const cvs = document.createElement('canvas');
            cvs.width = w;
            cvs.height = h;
            const ctx = cvs.getContext('2d')!;
            
            const img = new window.Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              resolve({
                id: lData.id,
                name: lData.name,
                canvas: cvs,
                visible: lData.visible,
                opacity: lData.opacity,
                blendMode: lData.blendMode,
                locked: lData.locked
              } as Layer);
            };
            img.onerror = () => {
              // Se falhar, cria layer branca
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
              resolve({
                id: lData.id,
                name: lData.name,
                canvas: cvs,
                visible: lData.visible,
                opacity: lData.opacity,
                blendMode: lData.blendMode,
                locked: lData.locked
              } as Layer);
            };
            img.src = lData.imageData;
          });
        })
      ).then(rebuilt => {
        const newActiveLayerId = data.activeLayerId || rebuilt[0]?.id || '';
        layersRef.current = rebuilt;
        activeLayerIdRef.current = newActiveLayerId;
        canvasSizeRef.current = { w, h };
        
        setLayers(rebuilt);
        setActiveLayerId(newActiveLayerId);
        setCanvasSize({ w, h });
        setImageObjects(data.imageObjects || []);
        
        // Sync to docsRef
        const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
        if (docIdx >= 0) {
          docsRef.current[docIdx] = {
            ...docsRef.current[docIdx],
            layers: rebuilt,
            activeLayerId: newActiveLayerId,
            canvasSize: { w, h },
            imageObjects: data.imageObjects || [],
          };
          setDocs([...docsRef.current]);
        }
        
        requestAnimationFrame(() => compositeDoc(activeDocIdRef.current));
        console.log('[Paint] Canvas restaurado com sucesso');
      });
    } catch (err) {
      console.error('[Paint] Erro ao carregar save:', err);
    }
  }, [activeProject?.saveId]); // Só recarrega quando o saveId mudar

  // Limpa canvas quando activeProject fica null (usuário fechou o projeto)
  useEffect(() => {
    if (!activeProject) {
      console.log('[Paint] Projeto fechado - limpando canvas');
      // Reseta pro estado inicial criando layer em branco
      const cvs = document.createElement('canvas');
      cvs.width = 1920;
      cvs.height = 1080;
      const ctx = cvs.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1920, 1080);
      
      const initialLayer: Layer = {
        id: Date.now().toString(),
        name: 'Camada 1',
        canvas: cvs,
        visible: true,
        opacity: 100,
        blendMode: 'source-over',
        locked: false,
      };
      
      setLayers([initialLayer]);
      setActiveLayerId(initialLayer.id);
      setImageObjects([]);
      activeLayerIdRef.current = initialLayer.id;
      
      // Limpa docs também
      const doc = docsRef.current.find(d => d.id === activeDocIdRef.current);
      if (doc) {
        doc.layers = [initialLayer];
        doc.activeLayerId = initialLayer.id;
        doc.imageObjects = [];
        setDocs([...docsRef.current]);
      }
      
      requestAnimationFrame(() => compositeDoc(activeDocIdRef.current));
    }
  }, [activeProject]);

  const screenToCanvas = (sx: number, sy: number) => {
    const docId = activeDocIdRef.current;
    const dc = docCanvasRefs.current.get(docId); if (!dc) return { x: 0, y: 0 };
    const rect = dc.getBoundingClientRect();
    // rect already accounts for pan + doc.x/y offset + zoom — just divide by zoom for canvas coords
    return { x: (sx - rect.left) / zoomRef.current, y: (sy - rect.top) / zoomRef.current };
  };

  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16)
  });

  const drawBrushStroke = (ctx: CanvasRenderingContext2D, x: number, y: number, isErase = false) => {
    const hard = hardness / 100; const rad = brushSize / 2;
    if (hard > 0.95) {
      ctx.globalAlpha = opacity / 100;
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
      if (!isErase) ctx.fillStyle = color; ctx.fill();
    } else {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const { r, g, b } = hexToRgb(color);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity / 100})`);
      gradient.addColorStop(hard, `rgba(${r},${g},${b},${opacity / 100 * 0.5})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = isErase ? `rgba(0,0,0,${opacity / 100})` : gradient; ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };

  const floodFill = (canvas: HTMLCanvasElement, sx: number, sy: number, fillColor: string, tolerance: number, sampleAll: boolean) => {
    // Build composite pixel data if sampleAll (sample merged canvas, but paint on active layer)
    let sampleCtx: CanvasRenderingContext2D;
    if (sampleAll) {
      const tmpCvs = document.createElement('canvas');
      tmpCvs.width = canvas.width; tmpCvs.height = canvas.height;
      sampleCtx = tmpCvs.getContext('2d')!;
      sampleCtx.fillStyle = '#fff'; sampleCtx.fillRect(0, 0, tmpCvs.width, tmpCvs.height);
      layersRef.current.forEach(l => { if (l.visible) sampleCtx.drawImage(l.canvas, 0, 0); });
    } else {
      sampleCtx = canvas.getContext('2d')!;
    }

    const W = canvas.width; const H = canvas.height;
    const px = Math.floor(sx); const py = Math.floor(sy);
    if (px < 0 || px >= W || py < 0 || py >= H) return;

    // Parse fill color to RGBA
    const { r: fr, g: fg, b: fb } = hexToRgb(fillColor);
    const fa = Math.round((opacity / 100) * 255);

    // Get sample data (read-only for tolerance test)
    const sampleData = sampleCtx.getImageData(0, 0, W, H).data;
    const targetIdx = (px + py * W) * 4;
    const [tr, tg, tb, ta] = [sampleData[targetIdx], sampleData[targetIdx+1], sampleData[targetIdx+2], sampleData[targetIdx+3]];

    // If target pixel already matches fill color within tolerance, nothing to do
    const colorMatch = (i: number) => {
      const dr = sampleData[i] - tr; const dg = sampleData[i+1] - tg;
      const db = sampleData[i+2] - tb; const da = sampleData[i+3] - ta;
      return Math.sqrt(dr*dr + dg*dg + db*db + da*da) <= tolerance * 4;
    };

    // Fetch the actual layer's pixel data (where we paint)
    const layerCtx = canvas.getContext('2d')!;
    const imgData = layerCtx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const visited = new Uint8Array(W * H);

    // Scanline flood fill — much faster than recursive stack
    const stack: number[] = [px + py * W];
    visited[px + py * W] = 1;

    while (stack.length > 0) {
      const pos = stack.pop()!;
      const cx = pos % W; const cy = Math.floor(pos / W);

      // Scan left
      let x1 = cx;
      while (x1 > 0 && !visited[x1-1 + cy*W] && colorMatch((x1-1 + cy*W)*4)) {
        x1--; visited[x1 + cy*W] = 1;
      }
      // Scan right
      let x2 = cx;
      while (x2 < W-1 && !visited[x2+1 + cy*W] && colorMatch((x2+1 + cy*W)*4)) {
        x2++; visited[x2 + cy*W] = 1;
      }

      // Fill the span with anti-alias at edges
      for (let x = x1; x <= x2; x++) {
        const i = (x + cy * W) * 4;
        // Anti-alias: at the boundary pixels, blend based on how close they are to tolerance
        let alpha = fa;
        if (x === x1 || x === x2) {
          const dr = sampleData[i]-tr; const dg = sampleData[i+1]-tg;
          const db = sampleData[i+2]-tb; const da2 = sampleData[i+3]-ta;
          const dist = Math.sqrt(dr*dr + dg*dg + db*db + da2*da2);
          const edgeFactor = tolerance > 0 ? Math.max(0, 1 - (dist / (tolerance*4))) : 1;
          alpha = Math.round(fa * edgeFactor);
        }
        // Composite fill color over existing pixel (respect opacity)
        const existA = d[i+3] / 255;
        const fillA = alpha / 255;
        const outA = fillA + existA * (1 - fillA);
        if (outA > 0) {
          d[i]   = Math.round((fr * fillA + d[i]   * existA * (1-fillA)) / outA);
          d[i+1] = Math.round((fg * fillA + d[i+1] * existA * (1-fillA)) / outA);
          d[i+2] = Math.round((fb * fillA + d[i+2] * existA * (1-fillA)) / outA);
          d[i+3] = Math.round(outA * 255);
        }
      }

      // Check row above and below for unfilled connected pixels
      for (let x = x1; x <= x2; x++) {
        if (cy > 0) {
          const above = x + (cy-1)*W;
          if (!visited[above] && colorMatch(above*4)) { visited[above] = 1; stack.push(above); }
        }
        if (cy < H-1) {
          const below = x + (cy+1)*W;
          if (!visited[below] && colorMatch(below*4)) { visited[below] = 1; stack.push(below); }
        }
      }
    }

    layerCtx.putImageData(imgData, 0, 0);
  };

  // Hit test for image objects (simple bounding box, no rotation)
  const hitTestObj = (pos: { x: number; y: number }) => {
    // Test in reverse so top-most object is selected first
    const objs = [...imageObjectsRef.current].reverse();
    return objs.find(obj => pos.x >= obj.x && pos.x <= obj.x + obj.w && pos.y >= obj.y && pos.y <= obj.y + obj.h) ?? null;
  };

  const createLayerFromImage = (id: string) => {
    const obj = imageObjectsRef.current.find(o => o.id === id); if (!obj) return;
    const img = imgCacheRef.current.get(id); if (!img || !img.complete) return;
    const sz = canvasSizeRef.current;
    const cvs = document.createElement('canvas'); cvs.width = sz.w; cvs.height = sz.h;
    const ctx = cvs.getContext('2d')!;
    ctx.save(); ctx.globalAlpha = obj.opacity / 100;
    ctx.filter = `brightness(${obj.brightness}%) contrast(${obj.contrast}%) saturate(${obj.saturation}%)`;
    const cx = obj.x + obj.w / 2; const cy = obj.y + obj.h / 2;
    ctx.translate(cx, cy); ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.drawImage(img, -obj.w / 2, -obj.h / 2, obj.w, obj.h); ctx.restore();
    const layerId = 'img_' + Date.now();
    const imgLayer: Layer = { id: layerId, name: `Imagem`, canvas: cvs, visible: true, opacity: 100, blendMode: 'normal', locked: false };
    const newLayers = [...layersRef.current, imgLayer];
    layersRef.current = newLayers; activeLayerIdRef.current = layerId;
    setLayers(newLayers); setActiveLayerId(layerId);
    setImageObjects(prev => prev.filter(o => o.id !== id)); setSelectedObjId(null);
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) { docsRef.current[docIdx].layers = newLayers; docsRef.current[docIdx].activeLayerId = layerId; }
  };

  // ── Per-doc drag (Ctrl+drag to reposition a canvas) ──────
  const docDragRef = useRef<{ docId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ── Layer drag-to-reorder ─────────────────────────────────
  const layerDragRef = useRef<{ id: string; startIdx: number } | null>(null);

  // ── Pointer handlers ──────────────────────────────────────
  const updateCanvasCursor = () => {
    const dc = docCanvasRefs.current.get(activeDocIdRef.current); if (!dc) return;
    if (isPanning.current) { dc.style.cursor = 'grabbing'; return; }
    if (isSpacePressed.current || isCtrlPressed.current) { dc.style.cursor = 'grab'; return; }
    if (selectedObjIdRef.current) { dc.style.cursor = 'move'; return; }
    if (tool === 'brush' || tool === 'eraser') { dc.style.cursor = 'none'; return; }
    if (tool === 'fill') { dc.style.cursor = 'copy'; return; }
    dc.style.cursor = 'crosshair';
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isSpacePressed.current || isCtrlPressed.current || e.button === 1) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y };
      e.preventDefault(); return;
    }
    const pos = screenToCanvas(e.clientX, e.clientY);

    // Check if clicking on a floating image object
    const hit = hitTestObj(pos);
    if (hit) {
      setSelectedObjId(hit.id);
      objDragRef.current = {
        startClientX: e.clientX, startClientY: e.clientY,
        startObjX: hit.x, startObjY: hit.y,
        type: 'move',
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Click on empty canvas → deselect image
    setSelectedObjId(null);

    // Normal drawing
    const al = getActiveLayer(); if (!al || al.locked) return;
    isDrawing.current = true; lastPos.current = pos; startPos.current = pos;

    if (tool === 'eyedropper') {
      const px = al.canvas.getContext('2d')!.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
      setColor(`#${px[0].toString(16).padStart(2, '0')}${px[1].toString(16).padStart(2, '0')}${px[2].toString(16).padStart(2, '0')}`);
      isDrawing.current = false; return;
    }
    if (tool === 'fill') {
      floodFill(al.canvas, pos.x, pos.y, color, fillTolerance, fillSampleAll); composite(); saveHistory(layers);
      isDrawing.current = false; return;
    }
    if (tool === 'brush' || tool === 'eraser') {
      drawBrushStroke(al.canvas.getContext('2d')!, pos.x, pos.y, tool === 'eraser'); composite();
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Brush circle cursor
    if (cursorElRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      const sz = brushSize * zoomRef.current;
      cursorElRef.current.style.left = `${x}px`; cursorElRef.current.style.top = `${y}px`;
      cursorElRef.current.style.width = `${sz}px`; cursorElRef.current.style.height = `${sz}px`;
      const showCursor = (tool === 'brush' || tool === 'eraser') && !isPanning.current && !selectedObjIdRef.current;
      cursorElRef.current.style.display = showCursor ? 'block' : 'none';
    }
    updateCanvasCursor();

    // Drag image object
    if (objDragRef.current) {
      const drag = objDragRef.current;
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;
      if (drag.type === 'move' && selectedObjIdRef.current) {
        updateObj(selectedObjIdRef.current, { x: drag.startObjX + dx, y: drag.startObjY + dy });
      }
      return;
    }

    if (isPanning.current) {
      setPan({ x: panStart.current.px + (e.clientX - panStart.current.x), y: panStart.current.py + (e.clientY - panStart.current.y) }); return;
    }
    if (!isDrawing.current) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    const al = getActiveLayer(); if (!al || al.locked) return;
    const ctx = al.canvas.getContext('2d')!;
    if (tool === 'brush' || tool === 'eraser') {
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color; ctx.lineWidth = brushSize;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = opacity / 100;
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      drawBrushStroke(ctx, pos.x, pos.y, tool === 'eraser'); composite();
    }
    lastPos.current = pos;
  };

  const onPointerUp = () => {
    if (objDragRef.current) { objDragRef.current = null; return; }
    if (isPanning.current) {
      isPanning.current = false;
      if (cursorElRef.current) cursorElRef.current.style.display = 'none';
      updateCanvasCursor(); return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false; saveHistory(layers);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current; if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left; const cy = e.clientY - rect.top;
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const z = zoomRef.current; const p = panRef.current;
    const newZoom = Math.max(0.05, Math.min(10, z * scaleFactor));
    const newPanX = cx - (cx - p.x) * (newZoom / z);
    const newPanY = cy - (cy - p.y) * (newZoom / z);
    zoomRef.current = newZoom; panRef.current = { x: newPanX, y: newPanY };
    setZoom(newZoom); setPan({ x: newPanX, y: newPanY });
  };

  const addLayer = () => {
    const sz = canvasSizeRef.current;
    const cvs = document.createElement('canvas'); cvs.width = sz.w; cvs.height = sz.h;
    const id = 'layer' + Date.now();
    const newLayers = [...layersRef.current, { id, name: `Camada ${layersRef.current.length + 1}`, canvas: cvs, visible: true, opacity: 100, blendMode: 'normal' as BlendMode, locked: false }];
    layersRef.current = newLayers;
    activeLayerIdRef.current = id;
    setLayers(newLayers); setActiveLayerId(id);
    // Sync to docsRef
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) { docsRef.current[docIdx].layers = newLayers; docsRef.current[docIdx].activeLayerId = id; }
    onProjectAction?.(`Nova camada adicionada: ${newLayers[newLayers.length - 1].name}`);
  };

  const deleteLayer = (id: string) => {
    if (layersRef.current.length <= 1) return; // keep at least one
    const newLayers = layersRef.current.filter(l => l.id !== id);
    const newActiveId = id === activeLayerIdRef.current
      ? (newLayers[newLayers.length - 1]?.id ?? '')
      : activeLayerIdRef.current;
    layersRef.current = newLayers;
    activeLayerIdRef.current = newActiveId;
    setLayers(newLayers); setActiveLayerId(newActiveId);
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) { docsRef.current[docIdx].layers = newLayers; docsRef.current[docIdx].activeLayerId = newActiveId; }
    compositeDoc(activeDocIdRef.current);
  };

  const moveLayer = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...layersRef.current];
    const fromIdx = arr.findIndex(l => l.id === fromId);
    const toIdx = arr.findIndex(l => l.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    layersRef.current = arr;
    setLayers(arr);
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) docsRef.current[docIdx].layers = arr;
    compositeDoc(activeDocIdRef.current);
  };

  const exportPNG = () => {
    const sz = canvasSizeRef.current;
    const cvs = document.createElement('canvas'); cvs.width = sz.w; cvs.height = sz.h;
    const ctx = cvs.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sz.w, sz.h);
    layersRef.current.forEach(l => { if (l.visible) ctx.drawImage(l.canvas, 0, 0); });
    const a = document.createElement('a'); a.href = cvs.toDataURL('image/png'); a.download = 'paint.png'; a.click();
    onProjectAction?.('Imagem exportada como PNG');
  };

  // ── File ops ──────────────────────────────────────────────
  const uploadImage = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          const maxW = Math.min(img.width, canvasSize.w * 0.6);
          const scale = maxW / img.width;
          const w = Math.round(img.width * scale); const h = Math.round(img.height * scale);
          const p = panRef.current; const z = zoomRef.current;
          const container = containerRef.current;
          const viewCX = container ? (container.clientWidth / 2 - p.x) / z : canvasSize.w / 2;
          const viewCY = container ? (container.clientHeight / 2 - p.y) / z : canvasSize.h / 2;
          const newObj: ImageObject = {
            id: 'img_' + Date.now(), src,
            x: Math.round(viewCX - w / 2), y: Math.round(viewCY - h / 2),
            w, h, opacity: 100, rotation: 0, brightness: 100, contrast: 100, saturation: 100
          };
          setImageObjects(prev => [...prev, newObj]);
          setSelectedObjId(newObj.id);
          onProjectAction?.(`Imagem importada: ${file.name}`);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const openFile = async () => {
    const result = await (window as any).electronAPI.loadBillProject();
    if (!result.success || !result.clips) return;
    const data = result.clips as any;
    if (data.type !== 'paint') { 
      console.error('[Paint] Este arquivo não é um projeto Paint (.gab)!'); 
      return; 
    }
    const { w, h } = data.canvasSize || { w: 1920, h: 1080 };
    const rebuilt: Layer[] = await Promise.all(
      (data.layers as any[]).map(async (lData: any) => {
        const cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d')!;
        await new Promise<void>(res => {
          const img = new window.Image(); img.onload = () => { ctx.drawImage(img, 0, 0); res(); }; img.src = lData.imageData;
        });
        return { id: lData.id, name: lData.name, canvas: cvs, visible: lData.visible, opacity: lData.opacity, blendMode: lData.blendMode, locked: lData.locked } as Layer;
      })
    );
    const newActiveLayerId = data.activeLayerId || rebuilt[0]?.id || '';
    layersRef.current = rebuilt; activeLayerIdRef.current = newActiveLayerId; canvasSizeRef.current = { w, h };
    setLayers(rebuilt); setActiveLayerId(newActiveLayerId); setCanvasSize({ w, h });
    setPan({ x: 0, y: 0 }); setZoom(1); zoomRef.current = 1; panRef.current = { x: 0, y: 0 };
    historyRef.current = []; historyIdx.current = -1;
    imgCacheRef.current.clear(); setImageObjects([]); setSelectedObjId(null);
    // Sync to docsRef
    const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
    if (docIdx >= 0) {
      docsRef.current[docIdx] = { ...docsRef.current[docIdx], layers: rebuilt, activeLayerId: newActiveLayerId, canvasSize: { w, h }, imageObjects: [], history: [], historyIdx: -1 };
      setDocs([...docsRef.current]);
    }
    requestAnimationFrame(() => compositeDoc(activeDocIdRef.current));
  };

  const saveFile = async () => {
    const layersData = layersRef.current.map(l => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blendMode: l.blendMode, locked: l.locked,
      imageData: l.canvas.toDataURL('image/png'),
    }));
    
    const projectData = { 
      type: 'paint', 
      canvasSize: canvasSizeRef.current, 
      activeLayerId: activeLayerIdRef.current, 
      layers: layersData 
    };
    
    // Gera thumbnail do canvas composto
    let thumbnailBase64: string | undefined;
    try {
      const composite = document.createElement('canvas');
      composite.width = canvasSizeRef.current.w;
      composite.height = canvasSizeRef.current.h;
      const ctx = composite.getContext('2d');
      
      if (ctx) {
        // Desenha todas as layers visíveis
        layersRef.current.forEach(layer => {
          if (layer.visible) {
            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
            ctx.drawImage(layer.canvas, 0, 0);
          }
        });
        
        // Cria thumbnail redimensionado
        const fullDataUrl = composite.toDataURL('image/png');
        const img = new Image();
        img.src = fullDataUrl;
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        
        const thumbCanvas = document.createElement('canvas');
        const thumbSize = 300;
        const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
        thumbCanvas.width = img.width * scale;
        thumbCanvas.height = img.height * scale;
        
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
          thumbnailBase64 = thumbCanvas.toDataURL('image/png');
          console.log('[Paint Save] Thumbnail gerado:', thumbnailBase64.substring(0, 50));
        }
      }
    } catch (e) {
      console.error('[Paint Save] Erro ao gerar thumbnail:', e);
    }
    
    const result = await (window as any).electronAPI.saveProject('paint', projectData, thumbnailBase64);
    if (result.success) {
      console.log('[Paint] ✅ Projeto salvo!');
      showToast('✅ Projeto salvo com sucesso!');
      onProjectAction?.('Projeto salvo como arquivo .gab');
      // Atualiza preview do planejamento
      if (thumbnailBase64) {
        onUpdatePreview?.(thumbnailBase64);
      }
    } else {
      console.error('[Paint] ❌ Erro ao salvar:', result.error || 'desconhecido');
      showToast('❌ Erro ao salvar projeto');
    }
  };

  const createNew = () => {
    flushActiveDocState();
    const cvs = document.createElement('canvas'); cvs.width = newW; cvs.height = newH;
    const ctx = cvs.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, newW, newH);
    const layer: Layer = { id: 'layer1', name: 'Camada 1', canvas: cvs, visible: true, opacity: 100, blendMode: 'normal', locked: false };
    const histData = ctx.getImageData(0, 0, newW, newH);
    // Update this doc in docsRef and React state
    const docName = docs.find(d => d.id === activeDocId)?.name ?? `Canvas ${docs.length}`;
    const curDoc = docsRef.current.find(d => d.id === activeDocId);
    const updatedDoc: PaintDoc = { id: activeDocId, name: docName, layers: [layer], activeLayerId: 'layer1', canvasSize: { w: newW, h: newH }, imageObjects: [], x: curDoc?.x ?? 0, y: curDoc?.y ?? 0, history: [histData], historyIdx: 0 };
    const idx = docsRef.current.findIndex(d => d.id === activeDocId);
    if (idx >= 0) docsRef.current[idx] = updatedDoc;
    setDocs([...docsRef.current]);
    // Load into editor
    layersRef.current = [layer]; activeLayerIdRef.current = 'layer1'; canvasSizeRef.current = { w: newW, h: newH };
    setLayers([layer]); setActiveLayerId('layer1'); setCanvasSize({ w: newW, h: newH });
    historyRef.current = [histData]; historyIdx.current = 0;
    setPan({ x: 0, y: 0 }); setZoom(1); zoomRef.current = 1; panRef.current = { x: 0, y: 0 };
    setImageObjects([]); setSelectedObjId(null); setShowNewModal(false);
    requestAnimationFrame(() => compositeDoc(activeDocId));
  };

  // ── Keyboard ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); isSpacePressed.current = true; }
      if (e.key === 'Control') isCtrlPressed.current = true;
      if (e.key === 'b') setTool('brush');
      if (e.key === 'e') setTool('eraser');
      if (e.key === 'g') setTool('fill');
      if (e.key === 'k') setTool('eyedropper');
      if (e.key === 'Escape') setSelectedObjId(null);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
      if (e.key === 'Delete' && selectedObjIdRef.current) {
        const id = selectedObjIdRef.current;
        setImageObjects(prev => prev.filter(o => o.id !== id)); setSelectedObjId(null);
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { isSpacePressed.current = false; if (!isCtrlPressed.current) isPanning.current = false; }
      if (e.key === 'Control') { isCtrlPressed.current = false; if (!isSpacePressed.current) isPanning.current = false; }
    };
    window.addEventListener('keydown', handler); window.addEventListener('keyup', upHandler);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', upHandler); };
  }, [undo, redo]);

  const [leftTab, setLeftTab] = useState<'assets' | 'ai'>('assets');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newW, setNewW] = useState(1920); const [newH, setNewH] = useState(1080);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // ── Color theory palettes ─────────────────────────────────
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
  const [showPaletteBox, setShowPaletteBox] = useState(false);
  const [activePalette, setActivePalette] = useState<string[] | null>(null);
  const [paletteLocked, setPaletteLocked] = useState(false);
  const paletteDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ── Image color extraction ────────────────────────────────
  // Each slot: { label, colors[], locked, customY }
  const [imageColorSlots, setImageColorSlots] = useState<{ id: string; label: string; colors: string[]; locked: boolean; offsetX: number; offsetY: number; w: number; h: number }[]>([]);
  const slotDragRef = useRef<{ id: string; startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const slotResizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);

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
        // Sample pixels and cluster
        const pixels: [number,number,number][] = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] < 128) continue; // skip transparent
          pixels.push([data[i], data[i+1], data[i+2]]);
        }
        // Simple median cut: sort by most dominant channel and split
        const toHex = (r: number, g: number, b: number) =>
          '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
        // Sample evenly spaced pixels for speed
        const step = Math.max(1, Math.floor(pixels.length / (count * 8)));
        const sampled = pixels.filter((_, i) => i % step === 0);
        if (sampled.length === 0) { resolve([]); return; }
        // K-means with k=count, 10 iterations
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

  // ── Reference panel — webview Google Imagens ─────────────
  const [showRefSearch, setShowRefSearch] = useState(false);
  const [refQuery, setRefQuery] = useState('');
  const [refSearchPos, setRefSearchPos] = useState({ x: 120, y: 60 });
  const [refSearchSize, setRefSearchSize] = useState({ w: 700, h: 520 });
  const refSearchDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refSearchResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const refWebviewRef = useRef<any>(null);
  const [refPanel, setRefPanel] = useState<{ src: string; x: number; y: number; w: number; h: number; zoom: number; locked: boolean } | null>(null);
  const refDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [refChoiceMenu, setRefChoiceMenu] = useState<{ dataUrl: string; x: number; y: number } | null>(null);
  const [refResults] = useState<string[]>([]);
  const [refLoading] = useState(false);
  const refCtxMenu = null;

  const openRefPanel = (src: string) => {
    const firstDoc = docsRef.current[0];
    const cx = firstDoc ? firstDoc.x + firstDoc.canvasSize.w + 60 : 2000;
    const cy = firstDoc ? firstDoc.y : 0;
    setRefPanel({ src, x: cx, y: cy, w: 500, h: 450, zoom: 1, locked: false });
  };

  // Close choice menu on outside click
  useEffect(() => {
    if (!refChoiceMenu) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('paint-ref-choice-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setRefChoiceMenu(null);
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [refChoiceMenu]);

  const injectRefClickListener = () => {
    const wv = refWebviewRef.current; if (!wv) return;
    const script = `(function() {
      if (window.__refInjected) return;
      window.__refInjected = true;
      document.addEventListener('click', function(e) {
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
    const wv = refWebviewRef.current; if (!wv) return;
    const onLoad = () => setTimeout(injectRefClickListener, 500);
    const onTitleUpdate = (e: any) => {
      const title: string = e.title || '';
      if (title.startsWith('__REF_IMG__')) {
        const imgUrl = title.replace('__REF_IMG__', '');
        if (imgUrl) {
          (window as any).electronAPI.fetchImageAsDataUrl(imgUrl)
            .then((res: any) => {
              if (res.success && res.dataUrl) {
                // Show choice menu centered on screen
                const wvRect = refWebviewRef.current?.getBoundingClientRect();
                const mx = wvRect ? wvRect.left + wvRect.width / 2 : window.innerWidth / 2;
                const my = wvRect ? wvRect.top + wvRect.height / 2 : window.innerHeight / 2;
                setRefChoiceMenu({ dataUrl: res.dataUrl, x: mx - 100, y: my - 50 });
              }
            });
        }
      }
    };
    wv.addEventListener('did-finish-load', onLoad);
    wv.addEventListener('page-title-updated', onTitleUpdate);
    return () => {
      wv.removeEventListener('did-finish-load', onLoad);
      wv.removeEventListener('page-title-updated', onTitleUpdate);
    };
  }, [showRefSearch]);

  const doRefSearch = () => {
    const wv = refWebviewRef.current; if (!wv) return;
    const q = refQuery.trim() || 'drawing reference art';
    wv.src = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}&hl=pt-BR`;
  };
  const generateAI = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await (window as any).electronAPI.generateImage({ prompt: aiPrompt });
      if (result.success && result.path) {
        const src = 'file://' + result.path;
        const img = new window.Image(); img.src = src;
        img.onload = () => {
          const maxW = Math.min(img.width, canvasSize.w * 0.6);
          const scale = maxW / img.width;
          const w = Math.round(img.width * scale); const h = Math.round(img.height * scale);
          const newObj: ImageObject = {
            id: 'img_' + Date.now(), src,
            x: Math.round((canvasSize.w - w) / 2), y: Math.round((canvasSize.h - h) / 2),
            w, h, opacity: 100, rotation: 0, brightness: 100, contrast: 100, saturation: 100
          };
          setImageObjects(prev => [...prev, newObj]); setSelectedObjId(newObj.id);
        };
      }
    } catch { }
    setAiLoading(false);
  };

  const tools: { id: Tool; icon: React.ReactNode; title: string }[] = [
    { id: 'brush', title: 'Pincel (B)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-4 4 4"/><path d="M7 13V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v10a4 4 0 0 1-8 0"/></svg> },
    { id: 'eraser', title: 'Borracha (E)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg> },
    { id: 'fill', title: 'Balde (G)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z"/><path d="m20 12 2 2"/><path d="M22 14c0 2.2-1.8 4-4 4"/></svg> },
    { id: 'eyedropper', title: 'Conta-gotas (K)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/></svg> },
    { id: 'line', title: 'Linha', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg> },
    { id: 'rect', title: 'Retângulo', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: 'ellipse', title: 'Elipse', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg> },
  ];

  const toolOptions: Record<Tool, React.ReactNode> = {
    brush: <><SliderRow label="Tamanho" value={brushSize} min={1} max={200} set={setBrushSize} /><SliderRow label="Opacidade" value={opacity} min={1} max={100} set={setOpacity} unit="%" /><SliderRow label="Dureza" value={hardness} min={0} max={100} set={setHardness} unit="%" /></>,
    eraser: <><SliderRow label="Tamanho" value={brushSize} min={1} max={200} set={setBrushSize} /><SliderRow label="Opacidade" value={opacity} min={1} max={100} set={setOpacity} unit="%" /></>,
    fill: <><SliderRow label="Tolerância" value={fillTolerance} min={0} max={100} set={setFillTolerance} /><div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}><input type="checkbox" id="fillSampleAll" checked={fillSampleAll} onChange={e => setFillSampleAll(e.target.checked)} style={{ accentColor:'#7c3aed', width:14, height:14 }} /><label htmlFor="fillSampleAll" style={{ fontSize:11, color:'#b4b4d0', cursor:'pointer', userSelect:'none' }}>Amostrar todas camadas</label></div></>, eyedropper: <></>,
    line: <><SliderRow label="Espessura" value={brushSize} min={1} max={50} set={setBrushSize} /><SliderRow label="Opacidade" value={opacity} min={1} max={100} set={setOpacity} unit="%" /></>,
    rect: <><SliderRow label="Espessura" value={brushSize} min={1} max={50} set={setBrushSize} /></>,
    ellipse: <><SliderRow label="Espessura" value={brushSize} min={1} max={50} set={setBrushSize} /></>,
    select: <></>,
  };

  // Handle size for resize handles (in canvas coords)
  const HS = Math.max(8, 10 / zoom);
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePos = (obj: ImageObject, h: string) => {
    const mx = obj.x + obj.w / 2; const my = obj.y + obj.h / 2;
    const map: Record<string, { x: number; y: number }> = {
      nw: { x: obj.x, y: obj.y }, n: { x: mx, y: obj.y }, ne: { x: obj.x + obj.w, y: obj.y },
      e: { x: obj.x + obj.w, y: my }, se: { x: obj.x + obj.w, y: obj.y + obj.h },
      s: { x: mx, y: obj.y + obj.h }, sw: { x: obj.x, y: obj.y + obj.h }, w: { x: obj.x, y: my },
    };
    return map[h];
  };
  const handleCursor: Record<string, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
    se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
  };

  const onHandlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    const obj = imageObjectsRef.current.find(o => o.id === selectedObjIdRef.current); if (!obj) return;
    objDragRef.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startObjX: obj.x, startObjY: obj.y,
      startW: obj.w, startH: obj.h,
      type: 'resize', handle,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const drag = objDragRef.current; if (!drag || drag.type !== 'resize' || !selectedObjIdRef.current) return;
    const id = selectedObjIdRef.current;
    const obj = imageObjectsRef.current.find(o => o.id === id); if (!obj) return;
    const dx = (e.clientX - drag.startClientX) / zoomRef.current;
    const dy = (e.clientY - drag.startClientY) / zoomRef.current;
    const h = drag.handle!;
    let { x, y, w, h: oh } = { x: drag.startObjX, y: drag.startObjY, w: drag.startW!, h: drag.startH! };
    if (h.includes('e')) w = Math.max(20, w + dx);
    if (h.includes('s')) oh = Math.max(20, oh + dy);
    if (h.includes('w')) { w = Math.max(20, w - dx); x = drag.startObjX + dx; }
    if (h.includes('n')) { oh = Math.max(20, oh - dy); y = drag.startObjY + dy; }
    updateObj(id, { x, y, w, h: oh });
  };

  const loadProjectById = async (projectId: string): Promise<void> => {
    try {
      const result = await (window as any).electronAPI.loadProject('paint', projectId);
      if (!result.success || !result.data) {
        console.error('[Paint Load] Erro ao carregar projeto:', result.error);
        return;
      }
      
      const data = result.data as any;
      if (data.type !== 'paint') {
        console.error('[Paint Load] Tipo de projeto inválido:', data.type);
        return;
      }
      
      const { w, h } = data.canvasSize || { w: 1920, h: 1080 };
      const rebuilt: Layer[] = await Promise.all(
        (data.layers as any[]).map(async (lData: any) => {
          const cvs = document.createElement('canvas'); 
          cvs.width = w; 
          cvs.height = h;
          const ctx = cvs.getContext('2d')!;
          await new Promise<void>(res => {
            const img = new window.Image(); 
            img.onload = () => { 
              ctx.drawImage(img, 0, 0); 
              res(); 
            }; 
            img.src = lData.imageData;
          });
          return { 
            id: lData.id, 
            name: lData.name, 
            canvas: cvs, 
            visible: lData.visible, 
            opacity: lData.opacity, 
            blendMode: lData.blendMode, 
            locked: lData.locked 
          } as Layer;
        })
      );
      
      const newActiveLayerId = data.activeLayerId || rebuilt[0]?.id || '';
      layersRef.current = rebuilt; 
      activeLayerIdRef.current = newActiveLayerId; 
      canvasSizeRef.current = { w, h };
      setLayers(rebuilt); 
      setActiveLayerId(newActiveLayerId); 
      setCanvasSize({ w, h });
      setPan({ x: 0, y: 0 }); 
      setZoom(1); 
      zoomRef.current = 1; 
      panRef.current = { x: 0, y: 0 };
      historyRef.current = []; 
      historyIdx.current = -1;
      imgCacheRef.current.clear(); 
      setImageObjects([]); 
      setSelectedObjId(null);
      
      // Sync to docsRef
      const docIdx = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
      if (docIdx >= 0) {
        docsRef.current[docIdx] = { 
          ...docsRef.current[docIdx], 
          layers: rebuilt, 
          activeLayerId: newActiveLayerId, 
          canvasSize: { w, h }, 
          imageObjects: [], 
          history: [], 
          historyIdx: -1 
        };
        setDocs([...docsRef.current]);
      }
      requestAnimationFrame(() => compositeDoc(activeDocIdRef.current));
      
      console.log('[Paint Load] Projeto carregado com sucesso:', projectId);
    } catch (error) {
      console.error('[Paint Load] Erro ao carregar projeto:', error);
    }
  };

  // ── AI ref ────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getCanvasSnapshot: async (): Promise<string | null> => {
      try {
        const doc = docsRef.current.find(d => d.id === activeDocIdRef.current);
        if (!doc) return null;
        const sz = doc.canvasSize;
        const maxSize = 768;
        const scale = Math.min(1, maxSize / Math.max(sz.w, sz.h));
        const tw = Math.round(sz.w * scale); const th = Math.round(sz.h * scale);
        const cvs = document.createElement('canvas'); cvs.width = tw; cvs.height = th;
        const ctx = cvs.getContext('2d')!;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tw, th);
        layersRef.current.forEach(l => {
          if (!l.visible) return;
          ctx.globalAlpha = l.opacity / 100;
          ctx.drawImage(l.canvas, 0, 0, tw, th);
        });
        ctx.globalAlpha = 1;
        imageObjectsRef.current.forEach(obj => {
          const img = imgCacheRef.current.get(obj.id);
          if (!img || !img.complete) return;
          ctx.save(); ctx.globalAlpha = obj.opacity / 100;
          const cx = (obj.x + obj.w / 2) * scale; const cy = (obj.y + obj.h / 2) * scale;
          ctx.translate(cx, cy); ctx.rotate((obj.rotation * Math.PI) / 180);
          ctx.drawImage(img, -obj.w * scale / 2, -obj.h * scale / 2, obj.w * scale, obj.h * scale);
          ctx.restore();
        });
        return cvs.toDataURL('image/png');
      } catch { return null; }
    },

    applyPaintAction: (action: string, payload: any): string => {
      const sz = canvasSizeRef.current;
      switch (action) {

        case 'add-reference': {
          const src = payload.src || payload.imageSrc || '';
          if (!src) return '❌ Nenhuma imagem fornecida.';
          const img = new window.Image();
          img.onload = () => {
            const maxW = Math.min(img.width, sz.w * 0.7);
            const s = maxW / img.width;
            const w = Math.round(img.width * s); const h = Math.round(img.height * s);
            const newObj: ImageObject = {
              id: 'img_' + Date.now(), src,
              x: Math.round((sz.w - w) / 2), y: Math.round((sz.h - h) / 2),
              w, h, opacity: payload.opacity ?? 50,
              rotation: 0, brightness: 100, contrast: 100, saturation: 100,
            };
            setImageObjects(prev => [...prev, newObj]);
            setSelectedObjId(newObj.id);
          };
          img.src = src;
          return '✅ Referência adicionada com 50% de opacidade.';
        }

        case 'add-layer-from-image': {
          const src = payload.src || payload.imageSrc || '';
          if (!src) return '❌ Nenhuma imagem fornecida.';
          const img = new window.Image();
          img.onload = () => {
            const cvs = document.createElement('canvas'); cvs.width = sz.w; cvs.height = sz.h;
            const ctx = cvs.getContext('2d')!;
            const s = Math.min(sz.w / img.width, sz.h / img.height) * 0.9;
            const dw = Math.round(img.width * s); const dh = Math.round(img.height * s);
            ctx.globalAlpha = (payload.opacity ?? 100) / 100;
            ctx.drawImage(img, Math.round((sz.w - dw) / 2), Math.round((sz.h - dh) / 2), dw, dh);
            const layerId = 'ai_' + Date.now();
            const newLayer: Layer = { id: layerId, name: payload.name || 'IA', canvas: cvs, visible: true, opacity: payload.opacity ?? 100, blendMode: 'normal', locked: false };
            const newLayers = [...layersRef.current, newLayer];
            layersRef.current = newLayers; activeLayerIdRef.current = layerId;
            setLayers(newLayers); setActiveLayerId(layerId);
            const di = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
            if (di >= 0) { docsRef.current[di].layers = newLayers; docsRef.current[di].activeLayerId = layerId; }
            compositeDoc(activeDocIdRef.current);
          };
          img.src = src;
          return '✅ Imagem adicionada como nova camada.';
        }

        case 'edge-detect': {
          const al = layersRef.current.find(l => l.id === activeLayerIdRef.current);
          if (!al) return '❌ Nenhuma camada ativa.';
          const W = al.canvas.width; const H = al.canvas.height;
          const d = al.canvas.getContext('2d')!.getImageData(0, 0, W, H).data;
          const outCvs = document.createElement('canvas'); outCvs.width = W; outCvs.height = H;
          const outCtx = outCvs.getContext('2d')!;
          const outData = outCtx.createImageData(W, H); const out = outData.data;
          const gray = (i: number) => { const p = i * 4; return 0.299 * d[p] + 0.587 * d[p+1] + 0.114 * d[p+2]; };
          for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
              const tl = gray((y-1)*W+(x-1)); const tc = gray((y-1)*W+x); const tr = gray((y-1)*W+(x+1));
              const ml = gray(y*W+(x-1));                                   const mr = gray(y*W+(x+1));
              const bl = gray((y+1)*W+(x-1)); const bc = gray((y+1)*W+x); const br2 = gray((y+1)*W+(x+1));
              const gx = -tl - 2*ml - bl + tr + 2*mr + br2;
              const gy = -tl - 2*tc - tr + bl + 2*bc + br2;
              const v = Math.round(255 - Math.min(255, Math.sqrt(gx*gx + gy*gy)));
              const idx = (y*W+x)*4;
              out[idx] = v; out[idx+1] = v; out[idx+2] = v; out[idx+3] = 255;
            }
          }
          outCtx.putImageData(outData, 0, 0);
          const layerId = 'edge_' + Date.now();
          const edgeLayer: Layer = { id: layerId, name: 'Traçado (IA)', canvas: outCvs, visible: true, opacity: 100, blendMode: 'multiply', locked: false };
          const newLayers = [...layersRef.current, edgeLayer];
          layersRef.current = newLayers; activeLayerIdRef.current = layerId;
          setLayers(newLayers); setActiveLayerId(layerId);
          const di2 = docsRef.current.findIndex(d => d.id === activeDocIdRef.current);
          if (di2 >= 0) { docsRef.current[di2].layers = newLayers; docsRef.current[di2].activeLayerId = layerId; }
          compositeDoc(activeDocIdRef.current);
          return '✅ Traçado criado como nova camada (modo Multiply).';
        }

        case 'set-brush-color': {
          setColor(payload.color || '#000000');
          return `✅ Cor: ${payload.color}`;
        }

        case 'set-brush-size': {
          setBrushSize(Math.max(1, Math.min(200, Number(payload.size) || 8)));
          return `✅ Tamanho: ${payload.size}px`;
        }

        case 'add-layer': {
          addLayer();
          return '✅ Nova camada adicionada.';
        }

        case 'clear-layer': {
          const al = layersRef.current.find(l => l.id === activeLayerIdRef.current);
          if (!al) return '❌ Nenhuma camada ativa.';
          const ctx = al.canvas.getContext('2d')!;
          ctx.clearRect(0, 0, al.canvas.width, al.canvas.height);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, al.canvas.width, al.canvas.height);
          compositeDoc(activeDocIdRef.current);
          saveHistory(layersRef.current);
          return '✅ Camada limpa.';
        }

        default:
          return `❌ Ação desconhecida: ${action}`;
      }
    },
    
    loadProjectById: async (projectId: string): Promise<void> => {
      await loadProjectById(projectId);
    },
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#09090e', userSelect: 'none' }}>
      <style>{`@keyframes paintSpin{to{transform:rotate(360deg)}}`}</style>

      {/* Top toolbar */}
      <div style={{ height: 42, background: '#0d0d14', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, flexShrink: 0 }}>
        {tools.map(t => (
          <button key={t.id} title={t.title} onClick={() => setTool(t.id)}
            style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: tool === t.id ? 'rgba(124,58,237,0.3)' : 'transparent', color: tool === t.id ? '#c084fc' : '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => { if (tool !== t.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (tool !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >{t.icon}</button>
        ))}
        <div style={{ flex: 1 }} />
        {selectedObj && <span style={{ fontSize: 9, color: '#7c5cfc', marginRight: 8 }}>📷 Imagem — arraste para mover • clique no canvas para desenhar</span>}
        <span style={{ fontSize: 9, color: '#333' }}>{Math.round(zoom * 100)}%</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{ width: showLeftPanel ? 195 : 0, minWidth: 0, background: '#0d0d14', borderRight: showLeftPanel ? '1px solid #1a1a2e' : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { label: 'Novo', action: () => setShowNewModal(true), icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
              { label: 'Abrir', action: openFile, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
              { label: 'Salvar', action: saveFile, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> },
              { label: 'Exportar PNG', action: exportPNG, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} style={{ width: '100%', padding: '7px 10px', background: 'transparent', border: '1px solid #1a1a2e', color: '#666', borderRadius: 6, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', textAlign: 'left' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.color = '#c084fc'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#1a1a2e'; }}
              >{btn.icon}{btn.label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e' }}>
            {([['assets', 'Assets'], ['ai', 'IA']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setLeftTab(id)} style={{ flex: 1, padding: '7px 0', background: 'transparent', border: 'none', borderBottom: `2px solid ${leftTab === id ? '#7c3aed' : 'transparent'}`, color: leftTab === id ? '#c084fc' : '#444', fontSize: 10, fontWeight: 700, cursor: 'pointer', marginBottom: -1 }}>{label}</button>
            ))}
          </div>

          <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {leftTab === 'assets' && (
              <>
                <button onClick={uploadImage} style={{ width: '100%', padding: '10px 0', background: 'rgba(124,58,237,0.07)', border: '1px dashed rgba(124,58,237,0.3)', color: '#c084fc', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.07)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Importar Imagem
                </button>
                <button onClick={() => setShowRefSearch(true)} style={{ width: '100%', padding: '10px 0', background: 'rgba(124,58,237,0.07)', border: '1px dashed rgba(124,58,237,0.3)', color: '#c084fc', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.07)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Buscar Referência
                </button>
                <button onClick={() => setShowPaletteBox(true)} style={{ width: '100%', padding: '10px 0', background: 'rgba(124,58,237,0.07)', border: '1px dashed rgba(124,58,237,0.3)', color: '#c084fc', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(124,58,237,0.07)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2C6.48 2 2 6.48 2 12"/></svg>
                  Teoria das Cores
                </button>
                {imageObjects.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Objetos ({imageObjects.length})</span>
                    {imageObjects.map(obj => (
                      <div key={obj.id} onClick={() => setSelectedObjId(obj.id === selectedObjId ? null : obj.id)}
                        style={{ padding: '5px 8px', borderRadius: 5, background: obj.id === selectedObjId ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)', border: `1px solid ${obj.id === selectedObjId ? 'rgba(124,58,237,0.5)' : '#1a1a2e'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src={obj.src} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }} />
                        <span style={{ fontSize: 9, color: obj.id === selectedObjId ? '#c084fc' : '#555', flex: 1 }}>Imagem</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {leftTab === 'ai' && (
              <>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gerar com IA</span>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Descreva a imagem..." rows={4}
                  style={{ width: '100%', background: '#111', border: '1px solid #1a1a2e', color: '#bbb', padding: '8px', borderRadius: 6, fontSize: 11, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = '#1a1a2e'}
                />
                <button onClick={generateAI} disabled={aiLoading} style={{ padding: '9px 0', background: aiLoading ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {aiLoading ? <><span style={{ width: 10, height: 10, border: '2px solid #c084fc', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'paintSpin 0.7s linear infinite' }} />Gerando...</> : <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Gerar Imagem</>}
                </button>
                <p style={{ fontSize: 9, color: '#2a2a3e', textAlign: 'center', margin: 0 }}>Powered by Pollinations</p>
              </>
            )}
          </div>
        </div>

        {/* Canvas area — flex column so tab bar sits at bottom */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Scrollable canvas viewport */}
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', touchAction: 'none' }} onWheel={onWheel}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-conic-gradient(#1a1a24 0% 25%, #0d0d14 0% 50%)', backgroundSize: '20px 20px', zIndex: 0 }} />

          {/* Toggle left panel button */}
          <button onClick={() => setShowLeftPanel(v => !v)} title={showLeftPanel ? 'Esconder painel esquerdo' : 'Mostrar painel esquerdo'}
            style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 18, height: 36, background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: 6, color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.2)'; e.currentTarget.style.color = '#c084fc'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0d0d14'; e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1a1a2e'; }}
          >
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {showLeftPanel ? <polyline points="6,2 2,6 6,10"/> : <polyline points="2,2 6,6 2,10"/>}
            </svg>
          </button>

          {/* Toggle right panel button */}
          <button onClick={() => setShowRightPanel(v => !v)} title={showRightPanel ? 'Esconder painel direito' : 'Mostrar painel direito'}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', zIndex: 20, width: 18, height: 36, background: '#0d0d14', border: '1px solid #1a1a2e', borderRadius: 6, color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', padding: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.2)'; e.currentTarget.style.color = '#c084fc'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0d0d14'; e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = '#1a1a2e'; }}
          >
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {showRightPanel ? <polyline points="2,2 6,6 2,10"/> : <polyline points="6,2 2,6 6,10"/>}
            </svg>
          </button>

          {/* ── All docs positioned with doc.x/doc.y, same zoom/pan transform ── */}
          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, zIndex: 1 }}>
            {docs.map((doc) => {
              const isActive = doc.id === activeDocId;
              const docSize = isActive ? canvasSize : doc.canvasSize;
              return (
                <div key={doc.id} style={{ position: 'absolute', left: doc.x, top: doc.y, cursor: isCtrlPressed.current ? 'move' : 'default' }}
                  onPointerDownCapture={e => {
                    if (e.ctrlKey && e.button === 0) {
                      e.preventDefault(); e.stopPropagation();
                      docDragRef.current = { docId: doc.id, startX: e.clientX, startY: e.clientY, origX: doc.x, origY: doc.y };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }
                  }}
                  onPointerMoveCapture={e => {
                    if (docDragRef.current?.docId === doc.id) {
                      const dx = (e.clientX - docDragRef.current.startX) / zoomRef.current;
                      const dy = (e.clientY - docDragRef.current.startY) / zoomRef.current;
                      const idx = docsRef.current.findIndex(d => d.id === doc.id);
                      if (idx >= 0) { docsRef.current[idx].x = docDragRef.current.origX + dx; docsRef.current[idx].y = docDragRef.current.origY + dy; }
                      setDocs([...docsRef.current]);
                    }
                  }}
                  onPointerUpCapture={() => { docDragRef.current = null; }}
                >
                  {/* Label above canvas */}
                  <div style={{ position: 'absolute', top: -22, left: 0, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#7c3aed' : '#2a2a3e', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: isActive ? '#c084fc' : '#333', fontWeight: isActive ? 700 : 400 }}>{doc.name}</span>
                    <span style={{ fontSize: 9, color: '#2a2a3e' }}>{docSize.w} × {docSize.h}</span>
                    {docs.length > 1 && <span style={{ fontSize: 9, color: '#2a2a3e' }}>• Ctrl+arrastar p/ mover</span>}
                  </div>

                  {/* The composite canvas for this doc */}
                  <canvas
                    ref={el => registerDocCanvas(doc.id, el)}
                    width={docSize.w}
                    height={docSize.h}
                    style={{
                      display: 'block',
                      cursor: isActive ? (tool === 'fill' ? 'copy' : tool === 'eyedropper' ? 'crosshair' : 'crosshair') : 'pointer',
                      boxShadow: isActive ? '0 0 0 2px #7c3aed, 0 8px 40px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.4)',
                      touchAction: 'none',
                    }}
                    onClick={e => { if (!isActive && !docDragRef.current) activateDoc(doc.id); }}
                    onPointerDown={isActive ? onPointerDown : undefined}
                    onPointerMove={isActive ? onPointerMove : undefined}
                    onPointerUp={isActive ? onPointerUp : undefined}
                    onPointerCancel={isActive ? onPointerUp : undefined}
                    onPointerLeave={isActive ? (() => {
                      if (isDrawing.current) onPointerUp();
                      if (cursorElRef.current) cursorElRef.current.style.display = 'none';
                    }) : undefined}
                  />

                  {/* Selection handles — only for active doc */}
                  {isActive && selectedObj && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: docSize.w, height: docSize.h, pointerEvents: 'none', zIndex: 3 }}>
                      <div style={{ position: 'absolute', left: selectedObj.x, top: selectedObj.y, width: selectedObj.w, height: selectedObj.h, transform: `rotate(${selectedObj.rotation}deg)`, transformOrigin: 'center', outline: '2px solid #7c5cfc', boxSizing: 'border-box', pointerEvents: 'none' }}>
                        {handles.map(h => {
                          const pos = handlePos(selectedObj, h);
                          return (
                            <div key={h} style={{ position: 'absolute', left: pos.x - selectedObj.x - HS / 2, top: pos.y - selectedObj.y - HS / 2, width: HS, height: HS, background: '#fff', border: '1.5px solid #7c5cfc', borderRadius: 2, cursor: handleCursor[h], pointerEvents: 'all', boxShadow: '0 0 4px rgba(124,92,252,0.6)' }}
                              onPointerDown={e => onHandlePointerDown(e, h)}
                              onPointerMove={e => { e.stopPropagation(); onHandlePointerMove(e); }}
                              onPointerUp={e => { e.stopPropagation(); objDragRef.current = null; }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Image color slots — inside transform, same world as canvas ── */}
            {imageColorSlots.map((slot, i) => {
              const firstDoc = docsRef.current[0];
              const docX = firstDoc?.x ?? 0;
              const docY = firstDoc?.y ?? 0;
              const docW = firstDoc?.canvasSize.w ?? 1920;
              const slotW = slot.w > 0 ? slot.w : docW;
              const slotH = slot.h > 0 ? slot.h : 52;
              const stackOffset = (slotH + 10) / zoom * (i + 1) + (activePalette ? (52 + 10) / zoom : 0);
              const left = docX + slot.offsetX / Math.max(0.1, zoom);
              const top = docY - stackOffset + slot.offsetY / Math.max(0.1, zoom);
              const isWide = slotW > slotH * 2;
              return (
                // Outer: canvas-world size placeholder
                <div key={slot.id} style={{ position: 'absolute', left, top, width: slotW, height: slotH / zoom, pointerEvents: 'none' }}>
                  {/* Inner: fixed visual size, inversely scaled */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: Math.min(slotW * zoom, 10000), height: slotH,
                    transform: `scale(${1/zoom})`, transformOrigin: '0 0',
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
                        offsetX: slotDragRef.current!.origOffsetX + (e.clientX - slotDragRef.current!.startX),
                        offsetY: slotDragRef.current!.origOffsetY + (e.clientY - slotDragRef.current!.startY)
                      } : s));
                    }}
                    onPointerUp={() => { slotDragRef.current = null; }}>
                    <button onClick={e => { e.stopPropagation(); setImageColorSlots(prev => prev.map(s => s.id === slot.id ? { ...s, locked: !s.locked } : s)); }}
                      title={slot.locked ? 'Desbloquear' : 'Fixar'} style={{ background: 'none', border: 'none', color: slot.locked ? '#c084fc' : '#555', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {slot.locked
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                    </button>
                    <span style={{ fontSize: 10, color: '#777', fontWeight: 700, flexShrink: 0 }}>{slot.label}</span>
                    <div style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.3)', flexShrink: 0 }} />
                    {slot.colors.map((c, ci) => (
                      <div key={ci} onClick={e => { e.stopPropagation(); setColor(c); }}
                        style={{ flexGrow: isWide ? 1 : 0, flexShrink: 0, width: isWide ? undefined : 32, height: 32, minWidth: 32, borderRadius: 6, background: c, cursor: 'pointer',
                          border: color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)', boxShadow: color === c ? `0 0 10px ${c}88` : 'none' }}
                        title={c}
                      />
                    ))}
                    <div style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.3)', flexShrink: 0 }} />
                    <button onClick={e => { e.stopPropagation(); setImageColorSlots(prev => prev.filter(s => s.id !== slot.id)); }}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; }}>×</button>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, cursor: 'se-resize' }}
                      onPointerDown={e => { e.stopPropagation(); slotResizeRef.current = { id: slot.id, startX: e.clientX, startY: e.clientY, origW: slotW, origH: slotH }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                      onPointerMove={e => {
                        if (!slotResizeRef.current || slotResizeRef.current.id !== slot.id) return;
                        e.stopPropagation();
                        const r = slotResizeRef.current; const z = zoomRef.current;
                        setImageColorSlots(prev => prev.map(s => s.id === slot.id ? { ...s,
                          w: Math.max(100, Math.min(5000, r.origW + (e.clientX - r.startX) / z)),
                          h: Math.max(48, Math.min(800, r.origH + (e.clientY - r.startY) / z))
                        } : s));
                      }}
                      onPointerUp={() => { slotResizeRef.current = null; }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 3, right: 3 }}><line x1="1" y1="7" x2="7" y2="1" stroke="#444" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── Active Palette Bar ── */}
            {activePalette && (() => {
              const firstDoc = docsRef.current[0];
              const docX = firstDoc?.x ?? 0;
              const docY = firstDoc?.y ?? 0;
              const docW = firstDoc?.canvasSize.w ?? 1920;
              const barH = 52; // fixed px
              const gap = 10; // fixed px
              return (
                // Outer: canvas-world position, scaled size
                <div style={{ position: 'absolute', left: docX, top: docY - (barH + gap) / zoom, width: docW, height: barH / zoom, pointerEvents: 'none' }}>
                  {/* Inner: fixed size, scaled up by zoom */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: docW * zoom, height: barH, transform: `scale(${1/zoom})`, transformOrigin: '0 0', background: '#09090e', border: '1px solid rgba(124,58,237,0.5)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, userSelect: 'none', overflow: 'hidden', pointerEvents: 'all', cursor: paletteLocked ? 'default' : 'grab' }}
                    onPointerDown={e => {
                      if (paletteLocked || (e.target as HTMLElement).closest('button')) return;
                      // palette drag could be added here if needed
                    }}>
                    {/* Lock button */}
                    <button onClick={e => { e.stopPropagation(); setPaletteLocked(v => !v); }} title={paletteLocked ? 'Desbloquear' : 'Fixar'}
                      style={{ background: 'none', border: 'none', color: paletteLocked ? '#c084fc' : '#444', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {paletteLocked
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      }
                    </button>
                    {activePalette.map((c, i) => (
                      <div key={i} onClick={e => { e.stopPropagation(); setColor(c); }}
                        style={{ flex: 1, height: 32, borderRadius: 6, background: c, cursor: 'pointer', border: color === c ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.15)', boxShadow: color === c ? `0 0 10px ${c}88` : 'none', transition: 'transform 0.1s' }}
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

            {/* ── Reference Panel — inside transform ── */}
            {refPanel && (
              <div style={{ position: 'absolute', left: refPanel.x, top: refPanel.y, width: refPanel.w, height: refPanel.h + 40/zoom, background: '#09090e', border: `${1/zoom}px solid rgba(124,58,237,0.7)`, borderRadius: 14/zoom, boxShadow: `0 ${8/zoom}px ${40/zoom}px rgba(0,0,0,0.8)`, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
                <div style={{ height: 40/zoom, background: '#111118', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${12/zoom}px`, cursor: refPanel.locked ? 'default' : 'grab', flexShrink: 0, borderBottom: `${1/zoom}px solid rgba(124,58,237,0.15)` }}
                  onPointerDown={e => { if (refPanel.locked || (e.target as HTMLElement).closest('button')) return; e.stopPropagation(); refDragRef.current = { startX: e.clientX, startY: e.clientY, origX: refPanel.x, origY: refPanel.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={e => { if (!refDragRef.current) return; e.stopPropagation(); setRefPanel(p => p ? { ...p, x: refDragRef.current!.origX + (e.clientX - refDragRef.current!.startX)/zoomRef.current, y: refDragRef.current!.origY + (e.clientY - refDragRef.current!.startY)/zoomRef.current } : null); }}
                  onPointerUp={e => { e.stopPropagation(); refDragRef.current = null; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6/zoom }}>
                    {/* Lock button */}
                    <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, locked: !p.locked } : null); }} title={refPanel.locked ? 'Desbloquear' : 'Fixar posição'}
                      style={{ background: 'none', border: 'none', color: refPanel.locked ? '#c084fc' : '#444', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', width: 16/zoom, height: 16/zoom }}>
                      {refPanel.locked
                        ? <svg width={13/zoom} height={13/zoom} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        : <svg width={13/zoom} height={13/zoom} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                      }
                    </button>
                    <div style={{ width: 7/zoom, height: 7/zoom, borderRadius: '50%', background: '#7c3aed' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3/zoom }}>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: Math.max(0.1, p.zoom - 0.25) } : null); }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa', width: 24/zoom, height: 24/zoom, borderRadius: 5/zoom, cursor: 'pointer', fontSize: 16/zoom, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 10/zoom, color: '#666', minWidth: 36/zoom, textAlign: 'center' }}>{Math.round(refPanel.zoom * 100)}%</span>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: Math.min(8, p.zoom + 0.25) } : null); }} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa', width: 24/zoom, height: 24/zoom, borderRadius: 5/zoom, cursor: 'pointer', fontSize: 16/zoom, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      <button onClick={e => { e.stopPropagation(); setRefPanel(p => p ? { ...p, zoom: 1 } : null); }} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#666', height: 24/zoom, padding: `0 ${8/zoom}px`, borderRadius: 5/zoom, cursor: 'pointer', fontSize: 10/zoom }}>fit</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5/zoom }}>
                    <button onClick={e => { e.stopPropagation(); setShowRefSearch(true); }} style={{ background: 'rgba(124,58,237,0.15)', border: `${1/zoom}px solid rgba(124,58,237,0.3)`, color: '#c084fc', cursor: 'pointer', width: 28/zoom, height: 28/zoom, borderRadius: 7/zoom, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.15)'; }}>
                      <svg width={13/zoom} height={13/zoom} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); refDragRef.current = null; refResizeRef.current = null; setRefPanel(null); }}
                      style={{ background: 'rgba(239,68,68,0.15)', border: `${1/zoom}px solid rgba(239,68,68,0.3)`, color: '#ef4444', cursor: 'pointer', width: 28/zoom, height: 28/zoom, borderRadius: 7/zoom, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18/zoom }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}>×</button>
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto', background: '#060608' }}
                  ref={el => {
                    if (!el || (el as any).__refWheelH) return;
                    (el as any).__refWheelH = (e: WheelEvent) => {
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
                    el.addEventListener('wheel', (el as any).__refWheelH, { passive: false });
                  }}>
                  <img src={refPanel.src} draggable={false} style={{ width: refPanel.zoom === 1 ? '100%' : `${refPanel.w * refPanel.zoom}px`, height: refPanel.zoom === 1 ? '100%' : 'auto', display: 'block', objectFit: 'contain' }} />
                </div>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20/zoom, height: 20/zoom, cursor: 'se-resize' }}
                  onPointerDown={e => { e.stopPropagation(); refResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: refPanel.w, origH: refPanel.h }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={e => { if (!refResizeRef.current) return; e.stopPropagation(); const r = refResizeRef.current; setRefPanel(p => p ? { ...p, w: Math.max(160, Math.min(4000, r.origW + (e.clientX - r.startX)/zoomRef.current)), h: Math.max(120, Math.min(4000, r.origH + (e.clientY - r.startY)/zoomRef.current)) } : null); }}
                  onPointerUp={e => { e.stopPropagation(); refResizeRef.current = null; }}>
                  <svg width={8/zoom} height={8/zoom} viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 4/zoom, right: 4/zoom }}><line x1="1" y1="7" x2="7" y2="1" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              </div>
            )}
          </div>

          {/* Brush cursor circle */}
          <div ref={cursorElRef} style={{ display: 'none', position: 'absolute', borderRadius: '50%', border: `1.5px solid ${tool === 'eraser' ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.9)'}`, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.6)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 10 }} />

          </div>{/* end canvas viewport */}

          {/* ── Document tab bar ── */}
          <div style={{ height: 34, background: '#08080f', borderTop: '1px solid #1a1a2e', display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
            {docs.map(doc => (
              <div key={doc.id}
                onClick={() => activateDoc(doc.id)}
                onDoubleClick={() => { setRenamingDocId(doc.id); setRenameValue(doc.name); }}
                title={`${doc.name}\nDuplo clique para renomear`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px 0 12px', cursor: 'pointer', flexShrink: 0, maxWidth: 160, minWidth: 60, borderRight: '1px solid #1a1a2e', background: doc.id === activeDocId ? '#0d0d14' : 'transparent', borderTop: `2px solid ${doc.id === activeDocId ? '#7c3aed' : 'transparent'}`, transition: 'background 0.15s' }}
                onMouseEnter={e => { if (doc.id !== activeDocId) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (doc.id !== activeDocId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {renamingDocId === doc.id ? (
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => { const n = renameValue.trim(); if (n) { const i = docsRef.current.findIndex(d => d.id === doc.id); if (i >= 0) docsRef.current[i].name = n; setDocs([...docsRef.current]); } setRenamingDocId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { const n = renameValue.trim(); if (n) { const i = docsRef.current.findIndex(d => d.id === doc.id); if (i >= 0) docsRef.current[i].name = n; setDocs([...docsRef.current]); } setRenamingDocId(null); } e.stopPropagation(); }}
                    onClick={e => e.stopPropagation()}
                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #7c3aed', color: '#c084fc', fontSize: 11, outline: 'none', width: 90, padding: '1px 2px' }}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: doc.id === activeDocId ? '#c084fc' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{doc.name}</span>
                )}
                {docs.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); closeDoc(doc.id); }}
                    style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '1px 2px', display: 'flex', alignItems: 'center', borderRadius: 3, flexShrink: 0, marginLeft: 2 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#333'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                    title="Fechar canvas">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addDoc} title="Novo canvas"
              style={{ padding: '0 12px', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#444'; }}
            >+</button>
          </div>

        </div>{/* end canvas area column */}

        {/* Right panel */}
        <div style={{ width: showRightPanel ? 220 : 0, minWidth: 0, background: '#0d0d14', borderLeft: showRightPanel ? '1px solid #1a1a2e' : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: showRightPanel ? 'auto' : 'hidden', overflow: 'hidden', transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
          {selectedObj ? (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7c5cfc', letterSpacing: '0.1em', textTransform: 'uppercase' }}>📷 Imagem</div>
              <SliderRow label="Opacidade" value={selectedObj.opacity} min={0} max={100} set={v => updateObj(selectedObj.id, { opacity: v })} unit="%" />
              <SliderRow label="Brilho" value={selectedObj.brightness} min={0} max={200} set={v => updateObj(selectedObj.id, { brightness: v })} unit="%" />
              <SliderRow label="Contraste" value={selectedObj.contrast} min={0} max={200} set={v => updateObj(selectedObj.id, { contrast: v })} unit="%" />
              <SliderRow label="Saturação" value={selectedObj.saturation} min={0} max={200} set={v => updateObj(selectedObj.id, { saturation: v })} unit="%" />
              <SliderRow label="Rotação" value={selectedObj.rotation} min={-180} max={180} set={v => updateObj(selectedObj.id, { rotation: v })} unit="°" />
              <div style={{ fontSize: 9, color: '#444', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Posição</span><span style={{ color: '#666' }}>X:{Math.round(selectedObj.x)} Y:{Math.round(selectedObj.y)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tamanho</span><span style={{ color: '#666' }}>{Math.round(selectedObj.w)}×{Math.round(selectedObj.h)}</span></div>
              </div>
              <button onClick={() => createLayerFromImage(selectedObj.id)}
                style={{ padding: '8px 0', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', color: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                ⬇ Criar Camada com Imagem
              </button>
              <button onClick={() => { setImageObjects(prev => prev.filter(o => o.id !== selectedObj.id)); setSelectedObjId(null); }}
                style={{ padding: '7px 0', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                🗑 Remover
              </button>
              <button onClick={() => setSelectedObjId(null)}
                style={{ padding: '6px 0', background: 'transparent', border: '1px solid #1a1a2e', color: '#555', borderRadius: 7, cursor: 'pointer', fontSize: 9 }}>
                Fechar (Esc) — retorna ao desenho
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a2e' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{tools.find(t => t.id === tool)?.title.split(' ')[0]}</div>
                {toolOptions[tool]}
              </div>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#555' }}>Zoom</span>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <button onClick={() => setZoom(z => Math.max(0.1, z / 1.25))} style={{ width: 20, height: 20, background: '#1a1a2e', border: 'none', color: '#888', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>−</button>
                  <span style={{ fontSize: 9, color: '#666', minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(10, z * 1.25))} style={{ width: 20, height: 20, background: '#1a1a2e', border: 'none', color: '#888', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>+</button>
                  <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ padding: '0 5px', height: 20, background: '#1a1a2e', border: 'none', color: '#555', borderRadius: 4, cursor: 'pointer', fontSize: 8 }}>1:1</button>
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a2e' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Cor</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 32, height: 32, cursor: 'pointer' }} onClick={() => { const t = color; setColor(secondaryColor); setSecondaryColor(t); }}>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: secondaryColor, border: '2px solid #333', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: color, border: '2px solid #555', borderRadius: 3 }} />
                  </div>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ flex: 1, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'transparent' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3 }}>
                  {COLORS_PALETTE.map(c => <div key={c} onClick={() => setColor(c)} style={{ aspectRatio: '1', borderRadius: 3, background: c, cursor: 'pointer', border: color === c ? '2px solid #c084fc' : '1px solid #222', transition: 'transform 0.1s' }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />)}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Camadas</span>
                  <button onClick={addLayer} style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.35)', color: '#c084fc', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>+ Nova</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...layers].reverse().map(l => (
                    <div key={l.id}
                      draggable
                      onDragStart={() => { layerDragRef.current = { id: l.id, startIdx: layers.indexOf(l) }; }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { if (layerDragRef.current && layerDragRef.current.id !== l.id) moveLayer(layerDragRef.current.id, l.id); layerDragRef.current = null; }}
                      onClick={() => { setActiveLayerId(l.id); activeLayerIdRef.current = l.id; }}
                      style={{ padding: '6px 8px', borderRadius: 6, background: l.id === activeLayerId ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.02)', border: `1px solid ${l.id === activeLayerId ? 'rgba(124,58,237,0.45)' : '#1a1a2e'}`, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Drag handle */}
                      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" style={{ color: '#333', flexShrink: 0, cursor: 'grab' }}>
                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                        <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                        <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
                      </svg>
                      {/* Visibility toggle */}
                      <button onClick={e => { e.stopPropagation(); const nl = layers.map(x => x.id === l.id ? { ...x, visible: !x.visible } : x); setLayers(nl); layersRef.current = nl; const di = docsRef.current.findIndex(d => d.id === activeDocIdRef.current); if (di >= 0) docsRef.current[di].layers = nl; compositeDoc(activeDocIdRef.current); }}
                        style={{ background: 'none', border: 'none', color: l.visible ? '#c084fc' : '#2a2a3e', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      {/* Name */}
                      <span style={{ fontSize: 10, color: l.id === activeLayerId ? '#c084fc' : '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                      {/* Delete */}
                      {layers.length > 1 && (
                        <button onClick={e => { e.stopPropagation(); deleteLayer(l.id); }}
                          style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', padding: '1px 3px', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#333'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                          title="Excluir camada">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Novo */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowNewModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d14', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 12, padding: 24, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>Novo Documento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[['1920x1080', 'Full HD 16:9'], ['1080x1920', 'Vertical 9:16'], ['1080x1080', 'Quadrado 1:1'], ['2560x1440', '2K 16:9'], ['3840x2160', '4K 16:9']].map(([res, label]) => (
                <button key={res} onClick={() => { const [w, h] = res.split('x').map(Number); setNewW(w); setNewH(h); }} style={{ padding: '8px 12px', background: `${newW}x${newH}` === res ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.03)', border: `1px solid ${`${newW}x${newH}` === res ? 'rgba(124,58,237,0.5)' : '#1a1a2e'}`, color: `${newW}x${newH}` === res ? '#c084fc' : '#666', borderRadius: 7, cursor: 'pointer', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{label}</span><span style={{ fontSize: 10 }}>{res}</span>
                </button>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[['Largura', newW, setNewW], ['Altura', newH, setNewH]].map(([lbl, val, setter]: any) => (
                  <div key={lbl} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>{lbl}</div>
                    <input type="number" value={val} onChange={e => setter(Number(e.target.value))} style={{ width: '100%', background: '#111', border: '1px solid #1a1a2e', color: '#ccc', padding: '6px 8px', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = '#1a1a2e'} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNewModal(false)} style={{ flex: 1, padding: '9px 0', background: 'transparent', border: '1px solid #1a1a2e', color: '#555', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
              <button onClick={createNew} style={{ flex: 2, padding: '9px 0', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Criar {newW}×{newH}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reference Search — Google Imagens via webview ── */}
      {showRefSearch && (
        <div style={{ position: 'fixed', left: refSearchPos.x, top: refSearchPos.y, width: refSearchSize.w, height: refSearchSize.h, zIndex: 9999, background: '#09090e', border: '1px solid rgba(124,58,237,0.6)', borderRadius: 14, boxShadow: '0 20px 80px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}>
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
              placeholder="Buscar referência... ex: Goku, mão anime"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(124,58,237,0.25)', color: '#ddd', padding: '7px 12px', fontSize: 12, borderRadius: 8, outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = 'rgba(124,58,237,0.25)'}
            />
            <button onClick={doRefSearch}
              style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Buscar
            </button>
            <button onClick={() => setShowRefSearch(false)}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; }}>×</button>
          </div>
          <webview ref={refWebviewRef} src="about:blank" style={{ flex: 1, width: '100%' } as any} partition="persist:bill-browser" />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, cursor: 'se-resize' }}
            onPointerDown={e => { e.stopPropagation(); refSearchResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: refSearchSize.w, origH: refSearchSize.h }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={e => { if (!refSearchResizeRef.current) return; setRefSearchSize({ w: Math.max(400, refSearchResizeRef.current.origW + e.clientX - refSearchResizeRef.current.startX), h: Math.max(300, refSearchResizeRef.current.origH + e.clientY - refSearchResizeRef.current.startY) }); }}
            onPointerUp={() => { refSearchResizeRef.current = null; }}>
            <svg width="8" height="8" viewBox="0 0 8 8" style={{ position: 'absolute', bottom: 4, right: 4 }}><line x1="1" y1="7" x2="7" y2="1" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="7" x2="7" y2="4" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
      )}
      {refCtxMenu && null}

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

      {/* ── Active Palette Bar — inside canvas transform ── */}

      {/* ── Image choice menu ── */}
      {refChoiceMenu && (
        <div id="paint-ref-choice-menu" style={{ position: 'fixed', left: refChoiceMenu.x, top: refChoiceMenu.y, zIndex: 99999, background: '#0d0d14', border: '1px solid rgba(124,58,237,0.5)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden', userSelect: 'none', minWidth: 200 }}>
          <div style={{ padding: '8px 12px', fontSize: 10, color: '#555', borderBottom: '1px solid #1a1a2e', fontWeight: 700, letterSpacing: '0.08em' }}>O QUE FAZER COM ESTA IMAGEM?</div>
          <div
            style={{ padding: '12px 14px', cursor: 'pointer', color: '#ddd', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const src = refChoiceMenu.dataUrl;
              setRefChoiceMenu(null);
              const sz = canvasSizeRef.current;
              const img = new window.Image();
              img.onload = () => {
                const maxW = Math.min(img.width, sz.w * 0.6);
                const scale = maxW / img.width;
                const w = Math.round(img.width * scale); const h = Math.round(img.height * scale);
                const newObj: ImageObject = {
                  id: 'img_' + Date.now(), src,
                  x: Math.round((sz.w - w) / 2), y: Math.round((sz.h - h) / 2),
                  w, h, opacity: 100, rotation: 0, brightness: 100, contrast: 100, saturation: 100,
                };
                setImageObjects(prev => [...prev, newObj]); setSelectedObjId(newObj.id);
                addImageColorSlot(src, 'Canvas');
              };
              img.src = src;
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Enviar ao canvas
          </div>
          <div
            style={{ padding: '12px 14px', cursor: 'pointer', color: '#ddd', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, borderTop: '1px solid #1a1a2e' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const src = refChoiceMenu.dataUrl;
              setRefChoiceMenu(null);
              openRefPanel(src);
              addImageColorSlot(src, 'Referência');
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Usar como referência
          </div>
        </div>
      )}
      
      {/* Toast de notificação */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.95), rgba(102, 126, 234, 0.95))',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 10000,
          fontSize: '14px',
          fontWeight: 500,
          animation: 'slideIn 0.3s ease',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
});

export default Paint;

function SliderRow({ label, value, min, max, set, unit = '' }: { label: string; value: number; min: number; max: number; set: (v: number) => void; unit?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#555', marginBottom: 3 }}>
        <span>{label}</span><span style={{ color: '#777' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
    </div>
  );
}
