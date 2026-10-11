import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, MousePointer, RefreshCw, GripVertical, Maximize2, Type, Palette, AlignCenter, Bold, Sparkles, Box, Move, Circle, Eye, Trash2, MessageSquare, Send, Image as ImageIcon, Smartphone, Monitor } from 'lucide-react';
import { injectPreviewBridge, postToPreviewFrame } from '../../preview/previewBridge';

interface ElementInfo {
  tag: string; id: string; classes: string[]; text: string;
  styles: Record<string, string>; path: string;
}

interface Comment {
  id: string;
  elementPath: string;
  text: string;
  author: string;
  timestamp: number;
  position: { x: number; y: number; viewportX?: number; viewportY?: number };
  color?: string;
}

interface HtmlPreviewProps {
  content: string;
  filePath: string | null;
  onEditRequest: (instruction: string) => void;
  onApplyDirectHtml?: (selector: string, tag: string, src: string, idx: number) => void;
  onClose: () => void;
}

function rgbToHex(rgb: string): string {
  if (!rgb) return '#ffffff';
  const trimmed = rgb.trim().toLowerCase();
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed === 'transparent' || trimmed.includes('rgba(0, 0, 0, 0)') || trimmed.includes('rgba(0,0,0,0)')) return '#ffffff';
  
  const namedColors: Record<string, string> = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#00ff00', blue: '#0000ff',
    yellow: '#ffff00', gray: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
    lime: '#00ff00', aqua: '#00ffff', teal: '#008080', navy: '#000080', fuchsia: '#ff00ff',
    purple: '#800080'
  };
  if (namedColors[trimmed]) return namedColors[trimmed];

  const m = trimmed.match(/\d+/g);
  if (!m || m.length < 3) return '#ffffff';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const PREVIEW_PORT = 7432;

export default function HtmlPreview({ content, filePath, onEditRequest, onApplyDirectHtml, onClose }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const domElRef = useRef<HTMLElement | null>(null);
  const [selectedEl, setSelectedEl] = useState<ElementInfo | null>(null);
  const [elSize, setElSize] = useState<{ w: number; h: number } | null>(null);
  const [inspectMode, setInspectMode] = useState(true);
  const [previewSrc, setPreviewSrc] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editText, setEditText] = useState('');
  const [localText, setLocalText] = useState('');
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [localColor, setLocalColor] = useState('#000000');
  const [localWidth, setLocalWidth] = useState('');
  const [localHeight, setLocalHeight] = useState('');
  const [tweakFontSize, setTweakFontSize] = useState(16);
  const [tweakPadding, setTweakPadding] = useState(0);
  const [tweakMargin, setTweakMargin] = useState(0);
  const [tweakBorderRadius, setTweakBorderRadius] = useState(0);
  const [tweakOpacity, setTweakOpacity] = useState(100);
  const [localBgColor, setLocalBgColor] = useState('#ffffff');
  const [localImgSrc, setLocalImgSrc] = useState('');
  const [localGradient, setLocalGradient] = useState('');
  const [gradColor1, setGradColor1] = useState('#667eea');
  const [gradColor2, setGradColor2] = useState('#764ba2');
  const [gradAngle, setGradAngle] = useState(135);
  const [pendingPatches, setPendingPatches] = useState<string[]>([]);
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 340, y: 20 });
  const panelDragging = useRef(false);
  const panelDragOffset = useRef({ x: 0, y: 0 });
  const [commentMode, setCommentMode] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentColor, setNewCommentColor] = useState('#22c55e');
  const [newCommentEl, setNewCommentEl] = useState<{ path: string; pos: { x: number; y: number; viewportX?: number; viewportY?: number } } | null>(null);
  const [viewingComment, setViewingComment] = useState<string | null>(null);
  const prevFilePathRef = useRef<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const bridgeReadyRef = useRef(false);
  const getHtmlResolverRef = useRef<((html: string) => void) | null>(null);
  
  // Detecção e integração com o container da barra lateral (Design Sidebar)
  const [hasSidebarContainer, setHasSidebarContainer] = useState(false);
  useEffect(() => {
    const container = document.getElementById('design-sidebar-container');
    setHasSidebarContainer(!!container);
    const observer = new MutationObserver(() => {
      const containerNow = document.getElementById('design-sidebar-container');
      setHasSidebarContainer(!!containerNow);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  
  // Cleanup: garante que estilos globais sejam resetados quando o componente desmontar
  useEffect(() => {
    return () => {
      // Reset de estilos que podem vazar
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('height');
      document.documentElement.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('height');
    };
  }, []);

  // Exibe/oculta o placeholder de design conforme a seleção do elemento
  useEffect(() => {
    const placeholder = document.getElementById('design-sidebar-placeholder');
    if (placeholder) {
      placeholder.style.display = (selectedEl && !commentMode && hasSidebarContainer) ? 'none' : 'flex';
    }
  }, [selectedEl, commentMode, hasSidebarContainer]);
  
  // Estados para árvore de elementos HTML
  const [htmlElements, setHtmlElements] = useState<any[]>([]);
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // Parse HTML quando content muda
  useEffect(() => {
    parseHtmlContent(content);
  }, [content]);

  const parseHtmlContent = (html: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tree = buildElementTree(doc.body, 'body');
      setHtmlElements(tree);
      const firstLevel = new Set(tree.map(t => t.path));
      setExpandedElements(firstLevel);
    } catch (err) {
      console.error('[HtmlPreview] Erro ao parsear HTML:', err);
      setHtmlElements([]);
    }
  };

  const buildElementTree = (node: Element, path: string): any[] => {
    const result: any[] = [];
    Array.from(node.children).forEach((child, idx) => {
      const tag = child.tagName.toLowerCase();
      const id = child.id ? `#${child.id}` : '';
      const classes = Array.from(child.classList);
      const classStr = classes.length > 0 ? `.${classes.join('.')}` : '';
      const childPath = `${path}/${tag}[${idx}]`;
      
      // Pega o computed style para mostrar as classes CSS aplicadas
      const styles: string[] = [];
      if (child.getAttribute('class')) {
        styles.push(child.getAttribute('class')!);
      }
      if (child.getAttribute('style')) {
        styles.push(child.getAttribute('style')!);
      }
      
      const item = {
        tag,
        id: child.id,
        classes,
        styles,
        label: `${tag}${id}${classStr}`,
        path: childPath,
        children: buildElementTree(child, childPath)
      };
      result.push(item);
    });
    return result;
  };

  const toggleElementExpand = (path: string) => {
    const newExpanded = new Set(expandedElements);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedElements(newExpanded);
  };

  const renderElementTree = (items: any[], level = 0): JSX.Element[] => {
    return items.map((item) => {
      const isExpanded = expandedElements.has(item.path);
      const hasChildren = item.children.length > 0;
      const isSelected = selectedElement === item.path;
      
      return (
        <div key={item.path}>
          <div
            onClick={() => {
              if (hasChildren) toggleElementExpand(item.path);
              setSelectedElement(item.path);
            }}
            style={{
              padding: '8px',
              paddingLeft: `${8 + level * 16}px`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '11px',
              fontFamily: 'Consolas, Monaco, monospace',
              color: isSelected ? '#fff' : '#bbb',
              background: isSelected ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.05)',
              transition: 'all 0.15s',
              marginBottom: '2px',
              borderRadius: '4px',
              borderLeft: isSelected ? '3px solid #8b5cf6' : '3px solid transparent'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'rgba(139,92,246,0.12)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'rgba(139,92,246,0.05)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hasChildren ? 1 : 0.2 }}>
                {hasChildren && (isExpanded ? '▼' : '▶')}
              </span>
              <span style={{ color: '#8b5cf6', fontWeight: 600, fontSize: '11px' }}>
                {item.tag}
              </span>
              {item.id && (
                <span style={{ color: '#10b981', fontSize: '10px' }}>#{item.id}</span>
              )}
            </div>
            {item.classes.length > 0 && (
              <div style={{ paddingLeft: '20px', fontSize: '9px', color: '#f59e0b', fontFamily: 'monospace', opacity: 0.9, lineHeight: '1.4' }}>
                .{item.classes.join(' .')}
              </div>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>{renderElementTree(item.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const commitAll = useCallback(() => {
    // Captura o HTML atual do iframe COM todas as mudanças aplicadas
    const iframe = iframeRef.current;
    if (!iframe) {
      console.warn('[commitAll] Iframe não encontrado');
      return;
    }
    
    const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
    if (!doc) {
      console.warn('[commitAll] Documento do iframe não encontrado');
      return;
    }
    
    // Remove classes de highlight antes de salvar
    doc.querySelectorAll('.__bh, .__bs, .__bc').forEach((el: Element) => {
      el.classList.remove('__bh', '__bs', '__bc');
      (el as HTMLElement).style.outline = '';
    });
    
    // Remove atributos temporários
    doc.querySelectorAll('[data-temp-id]').forEach((el: Element) => {
      el.removeAttribute('data-temp-id');
    });
    
    // Captura o HTML completo com TODAS as mudanças inline já aplicadas
    const serializer = new XMLSerializer();
    let htmlContent = serializer.serializeToString(doc.documentElement);
    
    // Adiciona DOCTYPE se não tiver
    if (!htmlContent.startsWith('<!DOCTYPE')) {
      htmlContent = '<!DOCTYPE html>\n' + htmlContent;
    }
    
    console.log('[commitAll] HTML capturado, tamanho:', htmlContent.length);
    
    // Envia para salvar diretamente
    onEditRequest(`__SAVE_HTML__${htmlContent}`);
    
    setPendingPatches([]); 
    setSelectedEl(null); 
    domElRef.current = null;
  }, [onEditRequest, iframeRef]);

  // Carrega comentários salvos quando o arquivo muda
  useEffect(() => {
    if (!filePath) return;
    
    // Se mudou o arquivo, carrega os comentários SEM disparar o save
    if (prevFilePathRef.current !== filePath) {
      prevFilePathRef.current = filePath;
      const key = `comments_${filePath}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setComments(JSON.parse(saved));
        } catch (e) {
          console.error('Erro ao carregar comentários', e);
          setComments([]);
        }
      } else {
        setComments([]);
      }
      return; // NÃO continua para o save
    }
    
    // Se não mudou o arquivo, salva as mudanças
    const key = `comments_${filePath}`;
    if (comments.length > 0) {
      localStorage.setItem(key, JSON.stringify(comments));
    } else {
      localStorage.removeItem(key);
    }
  }, [filePath, comments]);

  const getFileDir = (fp: string | null): string => {
    if (!fp) return '';
    const sep = Math.max(fp.lastIndexOf('\\'), fp.lastIndexOf('/'));
    return sep >= 0 ? fp.substring(0, sep + 1) : '';
  };

  /**
   * Prepara o HTML para ser exibido no iframe via blob URL (same-origin).
   * Isso é essencial para que o iframe.contentDocument funcione
   * (cross-origin bloquearia os event listeners de clique/edição).
   * 
   * Para resolver imagens locais (que não carregariam em blob://),
   * adicionamos uma tag <base> apontando para o diretório do arquivo.
   */
  const prepareHtmlForBlob = useCallback((html: string, fp: string | null): string => {
    // Adiciona <base> tag para resolver caminhos relativos de imagens/recursos
    const dir = getFileDir(fp);
    if (dir) {
      // Converte caminho Windows (C:\Users\...) para URL file:/// (file:///C:/Users/...)
      const fileUrl = 'file:///' + dir.replace(/\\/g, '/').replace(/^\/([A-Za-z]):/, '$1:');
      const baseTag = `<base href="${fileUrl}">`;
      
      // Verifica se já existe uma tag <base> e substitui, senão adiciona
      if (/<base\s/i.test(html)) {
        html = html.replace(/<base[^>]*>/i, baseTag);
      } else if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<html')) {
        html = html.replace('<html', `<html><head>${baseTag}</head>`);
      } else if (html.toLowerCase().includes('<!doctype')) {
        html = html.replace(/(<\!doctype[^>]*>)/i, `$1<head>${baseTag}</head>`);
      } else {
        html = `<head>${baseTag}</head>${html}`;
      }
    }
    return html;
  }, []);

  // Carrega HTML sempre como blob URL (same-origin) para que os eventos funcionem
  useEffect(() => {
    const preparedHtml = prepareHtmlForBlob(content, filePath);
    
    // Limpa blob anterior
    if ((window as any).__billPreviewBlobUrl) {
      URL.revokeObjectURL((window as any).__billPreviewBlobUrl);
    }
    
    const blob = new Blob([preparedHtml], { type: 'text/html; charset=utf-8' });
    const src = URL.createObjectURL(blob);
    (window as any).__billPreviewBlobUrl = src;
    
    setPreviewSrc(src);
    setPreviewError('');
    setRefreshKey(k => k + 1);
    
    return () => {
      URL.revokeObjectURL(src);
      (window as any).__billPreviewBlobUrl = null;
    };
  }, [content, filePath, prepareHtmlForBlob]);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // http://127.0.0.1 � mesma origem � contentDocument funciona
    const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
    if (!doc) return;

    // Marca iframe como pronto para forçar re-render dos marcadores
    setIframeReady(prev => !prev);

    // Remove listener antigo se existir
    const old = (iframe as any).__billCleanup;
    if (old) old();

    const s = doc.createElement('style');
    s.textContent = '.__bh{outline:2px solid #7c5cfc!important;outline-offset:1px!important;cursor:crosshair!important}.__bs{outline:2px solid #ff6b6b!important;outline-offset:1px!important}.__bc{cursor:help!important}';
    doc.head?.appendChild(s);

    const onOver = (e: MouseEvent) => {
      if (!inspectMode && !commentMode) return;
      // Remove outlines anteriores
      doc.querySelectorAll('.__bh, .__bc').forEach((el: Element) => {
        el.classList.remove('__bh', '__bc');
        (el as HTMLElement).style.outline = '';
      });
      const t = e.target as HTMLElement;
      if (t && t.tagName !== 'HTML' && t.tagName !== 'BODY') {
        if (commentMode) {
          t.classList.add('__bc');
          t.style.outline = '2px dashed #22c55e';
          t.style.outlineOffset = '1px';
        } else {
          t.classList.add('__bh');
        }
      }
    };

    let isDraggingEl = false;
    let dragEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const selectElement = (el: HTMLElement) => {
      doc.querySelectorAll('.__bs').forEach((e: Element) => e.classList.remove('__bs'));
      el.classList.add('__bs');
      domElRef.current = el;

      const rect = el.getBoundingClientRect();
      const computed = (iframe.contentWindow as any)?.getComputedStyle(el);
      const styles: Record<string, string> = {};
      if (computed) ['color','background-color','background-image','font-size','font-weight','padding','margin'].forEach(p => { styles[p] = computed.getPropertyValue(p); });

      const getPath = (element: HTMLElement): string => {
        const parts: string[] = [];
        let cur: HTMLElement | null = element;
        while (cur && cur.tagName !== 'BODY') {
          let part = cur.tagName.toLowerCase();
          if (cur.id) { part += `#${cur.id}`; parts.unshift(part); break; }
          const cls = Array.from(cur.classList).filter(c => c !== '__bh' && c !== '__bs' && c !== '__bc');
          if (cls.length) part += `.${cls.join('.')}`;
          parts.unshift(part); cur = cur.parentElement;
        }
        return parts.join(' > ');
      };

      setSelectedEl({ tag: el.tagName.toLowerCase(), id: el.id||'', classes: Array.from(el.classList).filter(c=>c!=='__bh'&&c!=='__bs'), text: (el.innerText||'').slice(0,200), styles, path: getPath(el) });
      setElSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      setLocalText((el.innerText||'').slice(0,200));
      setLocalColor(rgbToHex(styles['color']||'#000000'));
      setLocalWidth(Math.round(rect.width) + 'px');
      setLocalHeight(Math.round(rect.height) + 'px');
      
      const fontSize = parseInt(styles['font-size']) || 16;
      const padding = parseInt(styles['padding']) || 0;
      const margin = parseInt(styles['margin']) || 0;
      const borderRadius = parseInt(styles['border-radius']) || 0;
      const opacity = Math.round((parseFloat(computed?.opacity || '1') || 1) * 100);
      
      setTweakFontSize(fontSize);
      setTweakPadding(padding);
      setTweakMargin(margin);
      setTweakBorderRadius(borderRadius);
      setTweakOpacity(opacity);

      // Detecta background-color, imagem e gradiente
      const bgImage = styles['background-image'] || computed?.getPropertyValue('background-image') || '';
      let bgColor = styles['background-color'] || computed?.getPropertyValue('background-color') || '';
      const isGradient = bgImage.includes('gradient');
      const isImage = bgImage.includes('url(');

      // Se a cor de fundo for transparente, busca nos elementos pais/ancestrais a cor visível real
      if (!bgColor || bgColor === 'transparent' || bgColor.includes('rgba(0, 0, 0, 0)') || bgColor.includes('rgba(0,0,0,0)')) {
        let parent = el.parentElement;
        while (parent) {
          const parentComputed = (iframe.contentWindow as any)?.getComputedStyle(parent);
          const pBg = parentComputed?.getPropertyValue('background-color') || '';
          if (pBg && pBg !== 'transparent' && !pBg.includes('rgba(0, 0, 0, 0)') && !pBg.includes('rgba(0,0,0,0)')) {
            bgColor = pBg;
            break;
          }
          parent = parent.parentElement;
        }
      }

      const parsedBgColor = rgbToHex(bgColor || '#ffffff');
      setLocalBgColor(parsedBgColor);
      setLocalGradient(isGradient ? bgImage : '');

      // Tenta parsear as cores do gradiente para preencher os pickers
      if (isGradient) {
        // Extrai ângulo ex: "135deg"
        const angleMatch = bgImage.match(/(\d+)deg/);
        if (angleMatch) setGradAngle(parseInt(angleMatch[1]));
        // Extrai todas as cores hex/rgb do gradiente
        const colorMatches = bgImage.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
        if (colorMatches) {
          if (colorMatches[0]) setGradColor1(colorMatches[0].startsWith('#') ? colorMatches[0] : rgbToHex(colorMatches[0]));
          if (colorMatches[1]) setGradColor2(colorMatches[1].startsWith('#') ? colorMatches[1] : rgbToHex(colorMatches[1]));
        }
      } else {
        // Se não for gradiente, inicia os pickers com a cor de fundo atual identificada
        setGradColor1(parsedBgColor);
        setGradColor2(parsedBgColor);
      }

      // Para imagens: src direto (se <img>) ou background-image
      if (el.tagName === 'IMG') {
        setLocalImgSrc((el as HTMLImageElement).src || '');
      } else if (isImage) {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        setLocalImgSrc(match ? match[1] : '');
      } else {
        setLocalImgSrc('');
      }
    };

    let hasMoved = false;
    let originalPosition = '';

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains('__comment_marker') || t.closest('.__comment_marker')) return;
      
      // Se modo edição estiver OFF, permite interação normal com o site
      if (!inspectMode && !commentMode) {
        return; // Deixa o evento seguir normalmente
      }
      
      // Modo edição ON: previne comportamento padrão para editar
      if (!t || t.tagName === 'HTML') return;
      
      e.preventDefault();
      e.stopPropagation();
      selectElement(t);

      if (t.tagName === 'BODY') {
        isDraggingEl = false;
        dragEl = null;
      } else {
        isDraggingEl = true;
        dragEl = t;
      }
      startX = e.clientX;
      startY = e.clientY;
      hasMoved = false;
      originalPosition = t.style.position;

      const computed = (iframe.contentWindow as any)?.getComputedStyle(t);
      const posType = computed?.position;
      if (t.tagName !== 'BODY' && (!posType || posType === 'static')) {
        t.style.position = 'relative';
      }

      initialLeft = parseFloat(t.style.left) || 0;
      initialTop = parseFloat(t.style.top) || 0;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingEl || !dragEl) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Só ativa o arrasto se mover mais de 3 pixels (evita micro-movimentos acidentais ao clicar)
      if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasMoved = true;
      }

      if (hasMoved) {
        dragEl.style.left = `${initialLeft + deltaX}px`;
        dragEl.style.top = `${initialTop + deltaY}px`;
        
        setLocalWidth(dragEl.style.width || (Math.round(dragEl.getBoundingClientRect().width) + 'px'));
        setLocalHeight(dragEl.style.height || (Math.round(dragEl.getBoundingClientRect().height) + 'px'));
      }
    };

    const onMouseUp = () => {
      if (isDraggingEl && dragEl) {
        isDraggingEl = false;
        
        if (hasMoved) {
          const leftVal = dragEl.style.left;
          const topVal = dragEl.style.top;
          const posVal = dragEl.style.position;
          
          applyDom('position', posVal, `position → ${posVal}`);
          applyDom('left', leftVal, `left → ${leftVal}`);
          applyDom('top', topVal, `top → ${topVal}`);
        } else {
          // Se não moveu, restaura a posição original para não acumular alterações inline
          dragEl.style.position = originalPosition;
        }
        
        dragEl = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.classList.contains('__comment_marker') || t.closest('.__comment_marker')) {
        return;
      }
      
      // Se o modo de edição estiver OFF, permite navegação normal (links, botões)
      if (!inspectMode && !commentMode) {
        return; // Deixa o evento seguir seu curso normal
      }
      
      // Previne navegação apenas quando estiver em modo edição ou comentário
      e.preventDefault();
      e.stopPropagation();
      
      // O modo comentário adiciona um comentário
      if (commentMode && t && t.tagName !== 'HTML' && t.tagName !== 'BODY') {
        const rect = t.getBoundingClientRect();
        const iframeDoc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
        const scrollX = iframeDoc?.documentElement.scrollLeft || 0;
        const scrollY = iframeDoc?.documentElement.scrollTop || 0;
        
        const getPath = (el: HTMLElement): string => {
          const parts: string[] = [];
          let cur: HTMLElement | null = el;
          while (cur && cur.tagName !== 'BODY') {
            let part = cur.tagName.toLowerCase();
            if (cur.id) { part += `#${cur.id}`; parts.unshift(part); break; }
            const cls = Array.from(cur.classList).filter(c => c !== '__bh' && c !== '__bs' && c !== '__bc');
            if (cls.length) part += `.${cls.join('.')}`;
            parts.unshift(part); cur = cur.parentElement;
          }
          return parts.join(' > ');
        };
        
        const iframeRect = iframe.getBoundingClientRect();
        
        setNewCommentEl({ 
          path: getPath(t), 
          pos: { 
            x: rect.left + rect.width / 2 + scrollX, 
            y: rect.top + rect.height / 2 + scrollY,
            viewportX: iframeRect.left + rect.left + rect.width / 2,
            viewportY: iframeRect.top + rect.top + rect.height / 2
          } 
        });
      }
    };

    doc.addEventListener('mouseover', onOver);
    doc.addEventListener('mousedown', onMouseDown, true); // capture phase para pegar antes
    doc.addEventListener('mousemove', onMouseMove);
    doc.addEventListener('mouseup', onMouseUp);
    doc.addEventListener('click', onClick, true); // capture phase para pegar antes
    
    (iframe as any).__billCleanup = () => {
      doc.removeEventListener('mouseover', onOver);
      doc.removeEventListener('mousedown', onMouseDown, true);
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('mouseup', onMouseUp);
      doc.removeEventListener('click', onClick, true);
    };
  };

  const getDoc = () => {
    const iframe = iframeRef.current;
    return iframe?.contentDocument || (iframe?.contentWindow as any)?.document || null;
  };

  const applyTweak = (property: string, value: string | number, desc: string) => {
    const el = domElRef.current;
    if (!el) return;
    
    const valueStr = typeof value === 'number' ? `${value}${property.includes('opacity') ? '' : 'px'}` : value;
    el.style.setProperty(property, valueStr);
    
    if (selectedEl) {
      // Adiciona um atributo único temporário ao elemento para identificá-lo facilmente
      const uniqueId = `temp-edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      el.setAttribute('data-temp-id', uniqueId);
      
      setPendingPatches(prev => {
        const filtered = prev.filter(p => !p.includes(`"prop":"${property}"`));
        return [...filtered, `__STYLE__${JSON.stringify({ tempId: uniqueId, prop: property, value: valueStr, desc })}`];
      });
    }
  };

  const applyDom = (prop: string, value: string, desc: string) => {
    const el = domElRef.current;
    if (!el) return;
    el.style.setProperty(prop, value);
    const uniqueId = `temp-edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    el.setAttribute('data-temp-id', uniqueId);
    setPendingPatches(prev => [...prev, `__STYLE__${JSON.stringify({ tempId: uniqueId, prop, value, desc })}`]);
  };

  const applyText = (text: string) => {
    const el = domElRef.current;
    if (!el) return;
    el.innerText = text;
    if (selectedEl) {
      const uniqueId = `temp-edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      el.setAttribute('data-temp-id', uniqueId);
      setPendingPatches(prev => [...prev, `__TEXT__${JSON.stringify({ tempId: uniqueId, text })}`]);
    }
  };

  const applyImage = (src: string, name: string) => {
    const el = domElRef.current;
    if (!el) return;
    if (el.tagName === 'IMG') { (el as HTMLImageElement).src = src; }
    else {
      el.style.backgroundImage = `url(${src})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
      if (el.offsetHeight < 30) el.style.minHeight = '150px';
      el.querySelectorAll('img').forEach((img: Element) => {
        const im = img as HTMLImageElement;
        const s = im.getAttribute('src') || '';
        if (!s || s === '#' || (!s.startsWith('http') && !s.startsWith('data:'))) im.style.display = 'none';
      });
    }
    if (!selectedEl) return;
    if (src.startsWith('data:')) {
      const doc = getDoc();
      let idx = 0;
      if (doc) { const all = doc.querySelectorAll(selectedEl.path); for (let i=0;i<all.length;i++) if (all[i]===el){idx=i;break;} }
      setPendingPatches(prev => [...prev, `__IMG__${selectedEl.path}__${el.tagName}__${idx}__${src}`]);
    } else {
      setPendingPatches(prev => [...prev, `${selectedEl.path}: imagem ? ${name}`]);
    }
  };

  const clearContent = () => {
    const el = domElRef.current;
    if (!el) return;
    if (el.innerText?.trim()) el.innerText = '';
    if (el.style.backgroundImage) { el.style.backgroundImage=''; el.style.backgroundSize=''; el.style.backgroundPosition=''; }
    if (el.tagName === 'IMG') (el as HTMLImageElement).src = '';
    el.querySelectorAll('img[style*="display:none"]').forEach(img => { (img as HTMLElement).style.display = ''; });
    if (selectedEl) setPendingPatches(prev => [...prev, `__CLEAR_BG__${selectedEl.path}__${el.tagName}`]);
  };

  const sendToAI = (instr: string) => {
    if (!selectedEl) return;
    const el = domElRef.current;
    // Limpa classes de highlight antes de capturar o HTML
    const cleanOuterHtml = (() => {
      if (!el) return '';
      const clone = el.cloneNode(true) as HTMLElement;
      clone.classList.remove('__bh', '__bs');
      clone.querySelectorAll('.__bh, .__bs').forEach(c => { c.classList.remove('__bh', '__bs'); });
      return clone.outerHTML.slice(0, 800);
    })();
    const fileName = filePath?.split('\\').pop() || filePath?.split('/').pop() || 'arquivo.html';
    onEditRequest(
      `__AI_EDIT__${JSON.stringify({
        fileName,
        selector: selectedEl.path,
        tag: selectedEl.tag,
        elHtml: cleanOuterHtml,
        instruction: instr,
      })}`
    );
    setSelectedEl(null); domElRef.current = null; setEditText('');
  };

  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true; dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.preventDefault();
  };
  useEffect(() => {
    const mv = (e: MouseEvent) => { if (dragging.current) setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }); };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => applyImage(ev.target?.result as string, file.name);
    reader.readAsDataURL(file);
  };

  const addComment = () => {
    if (!newCommentText.trim() || !newCommentEl) return;
    const comment: Comment = {
      id: Date.now().toString(),
      elementPath: newCommentEl.path,
      text: newCommentText.trim(),
      author: 'Você',
      timestamp: Date.now(),
      position: newCommentEl.pos,
      color: newCommentColor
    };
    setComments(prev => [...prev, comment]);
    setNewCommentText('');
    setNewCommentEl(null);
  };

  const navigateToComment = (comment: Comment) => {
    setViewingComment(comment.id);
    // Rola o iframe para mostrar o marcador de forma manual para evitar bug do scrollIntoView no parent
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument || (iframe?.contentWindow as any)?.document;
    const marker = iframeDoc?.querySelector(`[data-comment-id="${comment.id}"]`) as HTMLElement | null;
    if (marker && iframe && iframe.contentWindow) {
      const rect = marker.getBoundingClientRect();
      iframe.contentWindow.scrollTo({
        top: iframe.contentWindow.scrollY + rect.top - iframe.clientHeight / 2,
        behavior: 'smooth'
      });
    }
  };

  const deleteComment = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
    if (!doc || !doc.body) return;

    // Remove marcadores antigos
    doc.querySelectorAll('.__comment_marker').forEach((el: Element) => el.remove());

    // Aplica cursor help quando está no modo comentário
    if (commentMode) {
      doc.body.style.cursor = 'help';
    } else {
      doc.body.style.cursor = '';
    }
    
    // Handler para cliques em marcadores
    const handleMarkerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('__comment_marker')) {
        e.stopPropagation();
        e.preventDefault();
        const id = target.getAttribute('data-comment-id');
        if (id) {
          setViewingComment(id);
        }
      }
    };
    
    // Adiciona listener no body do iframe
    doc.body.addEventListener('click', handleMarkerClick, true);
    
    // Adiciona marcadores de comentários dentro do iframe (SEMPRE visíveis)
    comments.forEach((comment, idx) => {
      const marker = doc.createElement('div');
      marker.className = '__comment_marker';
      marker.textContent = (idx + 1).toString();
      marker.setAttribute('data-comment-id', comment.id);
      const markerColor = comment.color || '#22c55e';
      
      marker.style.cssText = `
        position: absolute;
        left: ${comment.position.x}px;
        top: ${comment.position.y}px;
        transform: translate(-50%, -50%);
        width: 28px;
        height: 28px;
        background: ${markerColor};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 8px ${markerColor}66;
        border: 2px solid #fff;
        z-index: 9999;
        transition: all 0.2s;
        font-family: system-ui, -apple-system, sans-serif;
        pointer-events: auto;
      `;
      
      marker.addEventListener('mouseenter', () => {
        marker.style.transform = 'translate(-50%, -50%) scale(1.15)';
      });
      
      marker.addEventListener('mouseleave', () => {
        marker.style.transform = 'translate(-50%, -50%) scale(1)';
      });
      
      doc.body.appendChild(marker);
    });
    
    // Cleanup
    return () => {
      doc.body.removeEventListener('click', handleMarkerClick, true);
    };
  }, [comments, iframeReady]);
  
  useEffect(() => {
    // Re-registra os event listeners de inspeção quando os modos mudam
    handleIframeLoad();
  }, [commentMode, inspectMode]);

  // Handlers de drag do painel
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (panelDragging.current) {
        setPanelPos({
          x: e.clientX - panelDragOffset.current.x,
          y: e.clientY - panelDragOffset.current.y
        });
      }
    };
    const onMouseUp = () => {
      panelDragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const startPanelDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    panelDragging.current = true;
    panelDragOffset.current = {
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y
    };
    document.body.style.userSelect = 'none';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Preview iframe */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <MousePointer size={13} color={inspectMode ? '#7c5cfc' : 'var(--text-secondary)'} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1 }}>
            {pendingPatches.length > 0 ? `${pendingPatches.length} mudanças pendentes` : inspectMode ? 'Clique em um elemento' : 'Visualização'}
          </span>
          {pendingPatches.length > 0 && (
            <>
              <button onClick={commitAll} style={{ background: '#22c55e', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px', padding: '4px 12px', fontWeight: 600 }}>
                Aplicar no Código ({pendingPatches.length})
              </button>
              <button onClick={() => { setPendingPatches([]); setRefreshKey(k => k+1); }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px', padding: '3px 8px' }}>
                Descartar
              </button>
            </>
          )}
          <button onClick={() => { setInspectMode(m => !m); setSelectedEl(null); }}
            style={{ background: inspectMode ? 'rgba(124,92,252,0.15)' : 'var(--bg-input)', border: `1px solid ${inspectMode ? '#7c5cfc' : 'var(--border-color)'}`, borderRadius: '4px', color: inspectMode ? '#7c5cfc' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px', padding: '3px 8px' }}>
            {inspectMode ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => { setCommentMode(m => !m); setInspectMode(false); setSelectedEl(null); }}
            style={{ background: commentMode ? 'rgba(34,197,94,0.15)' : 'var(--bg-input)', border: `1px solid ${commentMode ? '#22c55e' : 'var(--border-color)'}`, borderRadius: '4px', color: commentMode ? '#22c55e' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MessageSquare size={12} /> {commentMode ? '💬 Comentando' : 'Comentários'} {comments.length > 0 && `(${comments.length})`}
          </button>
          <button onClick={() => setRefreshKey(k => k+1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }} title="Atualizar">
            <RefreshCw size={12} />
          </button>
          
          <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 4px' }} />
          
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <button onClick={() => setDeviceView('desktop')} style={{ background: deviceView === 'desktop' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: deviceView === 'desktop' ? '#fff' : 'var(--text-secondary)', display: 'flex', transition: 'all 0.2s' }} title="Computador">
              <Monitor size={12} />
            </button>
            <button onClick={() => setDeviceView('mobile')} style={{ background: deviceView === 'mobile' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: deviceView === 'mobile' ? '#fff' : 'var(--text-secondary)', display: 'flex', transition: 'all 0.2s' }} title="Celular">
              <Smartphone size={12} />
            </button>
          </div>

          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: deviceView === 'mobile' ? '#1a1a24' : 'transparent', display: 'flex', justifyContent: 'center', alignItems: deviceView === 'mobile' ? 'center' : 'stretch' }}>
          {previewSrc ? (
            <div style={{ 
              width: deviceView === 'mobile' ? '375px' : '100%', 
              height: deviceView === 'mobile' ? '812px' : '100%',
              maxHeight: '100%',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: deviceView === 'mobile' ? '0 0 0 10px #09090b, 0 20px 40px rgba(0,0,0,0.5)' : 'none',
              borderRadius: deviceView === 'mobile' ? '32px' : '0',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <iframe key={refreshKey} ref={iframeRef} src={previewSrc} onLoad={handleIframeLoad}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff', cursor: commentMode ? 'help' : 'default' }}
                title="HTML Preview" />
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: '12px' }}>
              Carregando preview...
            </div>
          )}
          {previewError && (
            <div style={{ position: 'absolute', left: '10px', right: '10px', bottom: '10px', background: 'rgba(20,20,40,0.92)', border: '1px solid rgba(124,92,252,0.35)', borderRadius: '6px', color: '#c4b5fd', fontSize: '11px', padding: '8px 10px', zIndex: 5 }}>
              {previewError}
            </div>
          )}
          


        </div>
      </div>

      {/* Comments list panel - shown in sidebar when no element is selected */}
      {hasSidebarContainer && !selectedEl && !commentMode && comments.length > 0 && createPortal(
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'transparent' }}>
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={12} /> Comentários ({comments.length})
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {comments.map((c, idx) => (
              <div
                key={c.id}
                onClick={() => navigateToComment(c)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  background: viewingComment === c.id ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${viewingComment === c.id ? 'rgba(124,92,252,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = viewingComment === c.id ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.03)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.color || '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{idx + 1}</div>
                  <span style={{ fontSize: '10px', color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.elementPath || 'Elemento'}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#e0e0e0', lineHeight: 1.4, marginLeft: '28px', wordBreak: 'break-word' }}>{c.text}</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '5px', marginLeft: '28px' }}>
                  {new Date(c.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.getElementById('design-sidebar-container') || document.body
      )}

      {/* Tweaks Panel - flutuante e movível, ou fixado na barra lateral via portal */}
      {(() => {
        if (!selectedEl || commentMode) return null;

        const panelElement = (
          <div style={hasSidebarContainer ? {
            width: '100%',
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden'
          } : { 
            width: '320px', 
            background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            display: 'flex', 
            flexDirection: 'column',
            height: 'auto',
            maxHeight: '90vh',
            position: 'fixed',
            left: `${panelPos.x}px`,
            top: `${panelPos.y}px`,
            zIndex: 1000,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {/* Header draggable */}
            <div 
              onMouseDown={hasSidebarContainer ? undefined : startPanelDrag}
              style={{ 
                padding: '14px 18px', 
                background: 'linear-gradient(135deg, #0a0a0a 0%, #000000 100%)', 
                borderBottom: '1px solid rgba(255,255,255,0.1)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)', 
                cursor: hasSidebarContainer ? 'default' : 'move' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!hasSidebarContainer && <GripVertical size={14} color="#666" />}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                  &lt;{selectedEl.tag}{selectedEl.id ? ` #${selectedEl.id}` : ''}&gt;
                </span>
              </div>
              <button onClick={() => { setSelectedEl(null); domElRef.current = null; }} 
                style={{ background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#888', padding: '4px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color='#ff4444'; }}
                onMouseLeave={e => { e.currentTarget.style.color='#888'; }}
                onMouseDown={e => e.stopPropagation()}>
                <X size={16} />
              </button>
            </div>

            {/* Scroll area com estilo melhorado */}
            <div style={{ 
              flex: '1 1 auto',
              overflowY: 'auto', 
              overflowX: 'hidden',
              maxHeight: hasSidebarContainer ? 'calc(100vh - 120px)' : 'calc(90vh - 60px)',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: '20px'
            }}>
              {/* Tamanho */}
              {elSize && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(124,92,252,0.05)' }}>
                  <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Maximize2 size={12} /> Dimensões
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 500 }}>LARGURA</label>
                      <input type="text" value={localWidth} 
                        onChange={e => { 
                          setLocalWidth(e.target.value); 
                          if (e.target.value) applyDom('width', e.target.value, `largura → ${e.target.value}`); 
                        }}
                        style={{ width: '100%', background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '8px 10px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }} 
                        onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 500 }}>ALTURA</label>
                      <input type="text" value={localHeight} 
                        onChange={e => { 
                          setLocalHeight(e.target.value); 
                          if (e.target.value) applyDom('height', e.target.value, `altura → ${e.target.value}`); 
                        }}
                        style={{ width: '100%', background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '8px 10px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }} 
                        onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Texto */}
              {selectedEl.text && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Type size={12} /> Texto
                  </div>
                  <textarea value={localText} 
                    onChange={e => { 
                      setLocalText(e.target.value); 
                      applyText(e.target.value); 
                    }} 
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '12px', padding: '10px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, transition: 'all 0.2s' }}
                    onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }} 
                    onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
                </div>
              )}

              {/* Cor do texto */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={12} /> Cor
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="color" value={localColor} onChange={e => { setLocalColor(e.target.value); applyTweak('color', e.target.value, `cor → ${e.target.value}`); }}
                    style={{ width: '56px', height: '40px', border: '2px solid #3d3d5c', borderRadius: '8px', cursor: 'pointer', background: '#252540', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#7c5cfc'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#3d3d5c'} />
                  <input type="text" value={localColor} 
                    onChange={e => { 
                      setLocalColor(e.target.value); 
                      applyTweak('color', e.target.value, `cor → ${e.target.value}`); 
                    }} 
                    placeholder="#000000"
                    style={{ flex: 1, background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '10px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                    onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }} 
                    onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
                </div>
              </div>

              {/* Cor de Fundo */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={12} /> Cor de Fundo
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="color" value={localBgColor} onChange={e => {
                    setLocalBgColor(e.target.value);
                    // Só aplica como background-color se não houver gradiente ativo
                    if (!localGradient) {
                      applyDom('background-color', e.target.value, `bg-color → ${e.target.value}`);
                    } else {
                      // Se tiver gradiente, remove o gradiente e aplica a cor sólida
                      setLocalGradient('');
                      applyDom('background-image', 'none', `gradient removido`);
                      applyDom('background-color', e.target.value, `bg-color → ${e.target.value}`);
                    }
                  }}
                    style={{ width: '56px', height: '40px', border: '2px solid #3d3d5c', borderRadius: '8px', cursor: 'pointer', background: '#252540', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#7c5cfc'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#3d3d5c'} />
                  <input type="text" value={localBgColor}
                    onChange={e => {
                      setLocalBgColor(e.target.value);
                      if (!localGradient) applyDom('background-color', e.target.value, `bg-color → ${e.target.value}`);
                    }}
                    placeholder="#ffffff"
                    style={{ flex: 1, background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '10px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                    onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
                </div>
              </div>

              {/* Gradiente */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palette size={12} /> Gradiente
                </div>

                {/* Preview live do gradiente */}
                <div style={{
                  width: '100%', height: '40px', borderRadius: '8px', marginBottom: '12px',
                  background: `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${gradColor2} 100%)`,
                  border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.3s'
                }} />

                {/* Dois color pickers empilhados verticalmente (um em cima e outro embaixo) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '9px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 500 }}>COR INICIAL</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="color" value={gradColor1} onChange={e => {
                        setGradColor1(e.target.value);
                        const grad = `linear-gradient(${gradAngle}deg, ${e.target.value} 0%, ${gradColor2} 100%)`;
                        setLocalGradient(grad);
                        applyDom('background-image', grad, `gradiente cor1 → ${e.target.value}`);
                      }}
                        style={{ width: '44px', height: '36px', border: '2px solid #3d3d5c', borderRadius: '8px', cursor: 'pointer', background: '#252540', transition: 'border-color 0.2s', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='#7c5cfc'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='#3d3d5c'} />
                      <input type="text" value={gradColor1}
                        onChange={e => {
                          setGradColor1(e.target.value);
                          const grad = `linear-gradient(${gradAngle}deg, ${e.target.value} 0%, ${gradColor2} 100%)`;
                          setLocalGradient(grad);
                          applyDom('background-image', grad, `gradiente cor1 → ${e.target.value}`);
                        }}
                        style={{ flex: 1, minWidth: 0, background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '10px', padding: '7px 8px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor='#7c5cfc'; }}
                        onBlur={e => { e.target.style.borderColor='#3d3d5c'; }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 500 }}>COR FINAL</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="color" value={gradColor2} onChange={e => {
                        setGradColor2(e.target.value);
                        const grad = `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${e.target.value} 100%)`;
                        setLocalGradient(grad);
                        applyDom('background-image', grad, `gradiente cor2 → ${e.target.value}`);
                      }}
                        style={{ width: '44px', height: '36px', border: '2px solid #3d3d5c', borderRadius: '8px', cursor: 'pointer', background: '#252540', transition: 'border-color 0.2s', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.borderColor='#7c5cfc'}
                        onMouseLeave={e => e.currentTarget.style.borderColor='#3d3d5c'} />
                      <input type="text" value={gradColor2}
                        onChange={e => {
                          setGradColor2(e.target.value);
                          const grad = `linear-gradient(${gradAngle}deg, ${gradColor1} 0%, ${e.target.value} 100%)`;
                          setLocalGradient(grad);
                          applyDom('background-image', grad, `gradiente cor2 → ${e.target.value}`);
                        }}
                        style={{ flex: 1, minWidth: 0, background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '10px', padding: '7px 8px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                        onFocus={e => { e.target.style.borderColor='#7c5cfc'; }}
                        onBlur={e => { e.target.style.borderColor='#3d3d5c'; }} />
                    </div>
                  </div>
                </div>

                {/* Ângulo */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '9px', color: '#888', fontWeight: 500 }}>ÂNGULO</label>
                    <span style={{ fontSize: '11px', color: '#fff', fontFamily: 'monospace', background: 'rgba(124,92,252,0.2)', padding: '2px 8px', borderRadius: '4px' }}>{gradAngle}°</span>
                  </div>
                  <input type="range" min="0" max="360" value={gradAngle}
                    onChange={e => {
                      const a = parseInt(e.target.value);
                      setGradAngle(a);
                      const grad = `linear-gradient(${a}deg, ${gradColor1} 0%, ${gradColor2} 100%)`;
                      setLocalGradient(grad);
                      applyDom('background-image', grad, `gradiente ângulo → ${a}°`);
                    }}
                    style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
                </div>

                {/* Presets de gradiente */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    ['#667eea','#764ba2'], ['#f093fb','#f5576c'], ['#4facfe','#00f2fe'],
                    ['#43e97b','#38f9d7'], ['#fa709a','#fee140'], ['#a18cd1','#fbc2eb'],
                    ['#0f0c29','#24243e'], ['#ff6b6b','#ee5a24'],
                  ].map(([c1, c2], i) => {
                    const g = `linear-gradient(${gradAngle}deg, ${c1} 0%, ${c2} 100%)`;
                    return (
                      <div key={i} onClick={() => {
                        setGradColor1(c1); setGradColor2(c2);
                        setLocalGradient(g);
                        applyDom('background-image', g, `gradiente preset`);
                      }}
                        title={`${c1} → ${c2}`}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`, cursor: 'pointer', border: (gradColor1 === c1 && gradColor2 === c2) ? '2px solid #7c5cfc' : '2px solid transparent', transition: 'all 0.2s', flexShrink: 0 }} />
                    );
                  })}
                </div>

                {localGradient && (
                  <button onClick={() => {
                    setLocalGradient('');
                    applyDom('background-image', 'none', `gradiente removido`);
                  }}
                    style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ff6b6b', fontSize: '10px', padding: '7px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}>
                    Remover Gradiente
                  </button>
                )}
              </div>

              {/* Imagem - sempre visível para qualquer elemento */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ImageIcon size={12} /> Imagem
                </div>

                {/* Preview miniatura */}
                {localImgSrc && (
                  <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                    <img src={localImgSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
                  </div>
                )}
                {!localImgSrc && (
                  <div style={{ marginBottom: '10px', borderRadius: '8px', border: '1px dashed rgba(124,92,252,0.3)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,92,252,0.04)', color: '#555', fontSize: '11px' }}>
                    <ImageIcon size={16} style={{ marginRight: 6, opacity: 0.4 }} /> Nenhuma imagem
                  </div>
                )}

                <label style={{ fontSize: '9px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 500 }}>URL DA IMAGEM</label>
                <input type="text" value={localImgSrc}
                  onChange={e => {
                    setLocalImgSrc(e.target.value);
                    const el = domElRef.current;
                    if (!el) return;
                    if (el.tagName === 'IMG') {
                      (el as HTMLImageElement).src = e.target.value;
                      const uid = `temp-edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                      el.setAttribute('data-temp-id', uid);
                      el.setAttribute('src', e.target.value);
                      setPendingPatches(prev => [...prev, `__ATTR__${JSON.stringify({ tempId: uid, attr: 'src', value: e.target.value, desc: `src → ${e.target.value}` })}`]);
                    } else {
                      const val = e.target.value ? `url("${e.target.value}")` : 'none';
                      applyDom('background-image', val, `bg-image → ${e.target.value}`);
                    }
                  }}
                  placeholder="https://... ou /caminho/imagem.jpg"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '10px', fontFamily: 'monospace', transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />

                {/* Upload de arquivo local */}
                <div style={{ marginTop: '10px' }}>
                  <button onClick={() => document.getElementById('sidebar-image-upload-input')?.click()}
                    style={{ width: '100%', background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '11px', padding: '8px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>
                    Upload de Arquivo Local
                  </button>
                  <input id="sidebar-image-upload-input" type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </div>

                {/* Botões de fit - para qualquer elemento (bg-image) exceto <img> */}
                {selectedEl?.tag !== 'img' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                    {[['cover','Cover'],['contain','Contain'],['100% 100%','Stretch'],['repeat','Repeat']].map(([val, label]) => (
                      <button key={val} onClick={() => applyDom('background-size', val === 'repeat' ? 'auto' : val, `bg-size → ${val}`)}
                        style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: '6px', color: '#a78bfa', fontSize: '10px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(124,92,252,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(124,92,252,0.1)'}>{label}</button>
                    ))}
                  </div>
                )}
                {localImgSrc && (
                  <button onClick={() => {
                    setLocalImgSrc('');
                    const el = domElRef.current;
                    if (!el) return;
                    if (el.tagName === 'IMG') {
                      (el as HTMLImageElement).src = '';
                      const uid = `temp-edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                      el.setAttribute('data-temp-id', uid);
                      el.setAttribute('src', '');
                      setPendingPatches(prev => [...prev, `__ATTR__${JSON.stringify({ tempId: uid, attr: 'src', value: '', desc: 'src removido' })}`]);
                    } else {
                      applyDom('background-image', 'none', `imagem removida`);
                    }
                  }}
                    style={{ marginTop: '10px', width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ff6b6b', fontSize: '10px', padding: '7px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; }}>
                    Remover Imagem
                  </button>
                )}
              </div>


              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Type size={12} /> Tamanho
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(124,92,252,0.2)', padding: '4px 10px', borderRadius: '6px' }}>{tweakFontSize}px</span>
                </div>
                <input type="range" min="8" max="72" value={tweakFontSize} 
                  onChange={e => { const v = parseInt(e.target.value); setTweakFontSize(v); applyTweak('font-size', v, `font-size → ${v}px`); }}
                  style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
              </div>

              {/* Padding */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Box size={12} /> Padding
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(124,92,252,0.2)', padding: '4px 10px', borderRadius: '6px' }}>{tweakPadding}px</span>
                </div>
                <input type="range" min="0" max="80" value={tweakPadding}
                  onChange={e => { const v = parseInt(e.target.value); setTweakPadding(v); applyTweak('padding', v, `padding → ${v}px`); }}
                  style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
              </div>

              {/* Margin */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Move size={12} /> Margin
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(124,92,252,0.2)', padding: '4px 10px', borderRadius: '6px' }}>{tweakMargin}px</span>
                </div>
                <input type="range" min="0" max="80" value={tweakMargin}
                  onChange={e => { const v = parseInt(e.target.value); setTweakMargin(v); applyTweak('margin', v, `margin → ${v}px`); }}
                  style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
              </div>

              {/* Border Radius */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Circle size={12} /> Bordas
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(124,92,252,0.2)', padding: '4px 10px', borderRadius: '6px' }}>{tweakBorderRadius}px</span>
                </div>
                <input type="range" min="0" max="50" value={tweakBorderRadius}
                  onChange={e => { const v = parseInt(e.target.value); setTweakBorderRadius(v); applyTweak('border-radius', v, `border-radius → ${v}px`); }}
                  style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
              </div>

              {/* Opacity */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Eye size={12} /> Opacidade
                  </span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'monospace', fontWeight: 700, background: 'rgba(124,92,252,0.2)', padding: '4px 10px', borderRadius: '6px' }}>{tweakOpacity}%</span>
                </div>
                <input type="range" min="0" max="100" value={tweakOpacity}
                  onChange={e => { const v = parseInt(e.target.value); setTweakOpacity(v); applyTweak('opacity', v / 100, `opacity → ${v}%`); }}
                  style={{ width: '100%', height: '6px', accentColor: '#7c5cfc', borderRadius: '3px' }} />
              </div>

              {/* Pedir à IA */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(124,92,252,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} /> Pedir à IA
                </div>
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                  onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey&&editText.trim()){e.preventDefault();sendToAI(editText.trim());} }}
                  placeholder="Ex: adicione sombra suave, anime ao scroll..."
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(37,37,64,0.8)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#e0e0e0', fontSize: '11px', padding: '10px', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, transition: 'all 0.2s' }}
                  onFocus={e => { e.target.style.borderColor='#7c5cfc'; e.target.style.boxShadow='0 0 0 3px rgba(124,92,252,0.1)'; }} 
                  onBlur={e => { e.target.style.borderColor='#3d3d5c'; e.target.style.boxShadow='none'; }} />
              </div>

              {/* Botões de ação rápida */}
              <div style={{ padding: '14px 18px 18px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button onClick={() => sendToAI('centralize este elemento')}
                  style={{ flex: '1 1 calc(50% - 4px)', background: 'linear-gradient(135deg, #252540 0%, #1e1e38 100%)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#c0c0e0', cursor: 'pointer', fontSize: '10px', padding: '8px', transition: 'all 0.2s', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#7c5cfc'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(124,92,252,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#3d3d5c'; e.currentTarget.style.color='#c0c0e0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
                  <AlignCenter size={12} /> Centralizar
                </button>
                <button onClick={() => sendToAI('deixe o texto em negrito')}
                  style={{ flex: '1 1 calc(50% - 4px)', background: 'linear-gradient(135deg, #252540 0%, #1e1e38 100%)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#c0c0e0', cursor: 'pointer', fontSize: '10px', padding: '8px', transition: 'all 0.2s', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#7c5cfc'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(124,92,252,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#3d3d5c'; e.currentTarget.style.color='#c0c0e0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
                  <Bold size={12} /> Negrito
                </button>
                <button onClick={() => sendToAI('adicione animação fade in')}
                  style={{ flex: '1 1 calc(50% - 4px)', background: 'linear-gradient(135deg, #252540 0%, #1e1e38 100%)', border: '1px solid #3d3d5c', borderRadius: '6px', color: '#c0c0e0', cursor: 'pointer', fontSize: '10px', padding: '8px', transition: 'all 0.2s', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#7c5cfc'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(124,92,252,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#3d3d5c'; e.currentTarget.style.color='#c0c0e0'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
                  <Sparkles size={12} /> Fade in
                </button>
                <button onClick={clearContent}
                  style={{ flex: '1 1 calc(50% - 4px)', background: 'linear-gradient(135deg, rgba(229,62,62,0.15) 0%, rgba(229,62,62,0.08) 100%)', border: '1px solid rgba(229,62,62,0.4)', borderRadius: '6px', color: '#ff6b6b', cursor: 'pointer', fontSize: '10px', padding: '8px', transition: 'all 0.2s', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={e => { e.currentTarget.style.background='linear-gradient(135deg, rgba(229,62,62,0.25) 0%, rgba(229,62,62,0.15) 100%)'; e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(229,62,62,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg, rgba(229,62,62,0.15) 0%, rgba(229,62,62,0.08) 100%)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
                  <Trash2 size={12} /> Limpar
                </button>
              </div>
            </div>
          </div>
        );

        if (hasSidebarContainer) {
          const target = document.getElementById('design-sidebar-container');
          return target ? createPortal(panelElement, target) : null;
        }
        return panelElement;
      })()}

      {/* Popups de comentário renderizados via portal (fora de qualquer overflow:hidden) */}
      {newCommentEl && createPortal(
        <div
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            position: 'fixed',
            left: `${newCommentEl.pos.viewportX}px`,
            top: `${newCommentEl.pos.viewportY}px`,
            transform: 'translate(-50%, calc(-100% - 10px))',
            background: 'linear-gradient(135deg, #1e1e3f 0%, #16162a 100%)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,92,252,0.3)',
            padding: '14px',
            width: '280px',
            zIndex: 999999,
          }}
        >
          <div style={{ fontSize: '11px', color: '#a78bfa', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Adicionar Comentário</div>
          <textarea
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder="Digite seu comentário..."
            autoFocus
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(37,37,64,0.8)',
              border: '1px solid #3d3d5c',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '12px',
              resize: 'none',
              fontFamily: 'inherit',
              marginBottom: '10px',
              color: '#e0e0e0',
              lineHeight: 1.5
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment(); }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: '#888', flexShrink: 0 }}>Cor da bolinha:</span>
            {['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'].map(col => (
              <div
                key={col}
                onClick={() => setNewCommentColor(col)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: col, cursor: 'pointer', flexShrink: 0,
                  border: newCommentColor === col ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: newCommentColor === col ? `0 0 0 2px ${col}` : 'none',
                  transition: 'all 0.15s',
                }}
              />
            ))}
            <input
              type="color"
              value={newCommentColor}
              onChange={e => setNewCommentColor(e.target.value)}
              title="Cor personalizada"
              style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #3d3d5c', cursor: 'pointer', padding: 0, background: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={(e) => { e.stopPropagation(); setNewCommentEl(null); }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #3d3d5c', borderRadius: '6px', padding: '7px 14px', fontSize: '11px', cursor: 'pointer', color: '#888', fontWeight: 500, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#ff6b6b'; e.currentTarget.style.color='#ff6b6b'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#3d3d5c'; e.currentTarget.style.color='#888'; }}>
              Cancelar
            </button>
            <button onClick={(e) => { e.stopPropagation(); addComment(); }}
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '11px', cursor: 'pointer', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(34,197,94,0.3)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(34,197,94,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(34,197,94,0.3)'; }}>
              <Send size={12} /> Adicionar
            </button>
          </div>
        </div>,
        document.body
      )}

      {viewingComment && (() => {
        const comment = comments.find(c => c.id === viewingComment);
        if (!comment) return null;
        const iframe = iframeRef.current;
        const iframeRect = iframe?.getBoundingClientRect();
        // Pega a posição real do marcador no iframe (que já é `position:absolute` correto)
        const iframeDoc = iframe?.contentDocument || (iframe?.contentWindow as any)?.document;
        const marker = iframeDoc?.querySelector(`[data-comment-id="${comment.id}"]`) as HTMLElement | null;
        let popupX: number, popupY: number;
        if (marker && iframeRect) {
          const markerRect = marker.getBoundingClientRect();
          // getBoundingClientRect dentro do iframe é relativo ao viewport do iframe,
          // então somamos o offset do iframe na página
          popupX = iframeRect.left + markerRect.left + markerRect.width / 2;
          popupY = iframeRect.top + markerRect.top + markerRect.height / 2;
        } else if (iframeRect) {
          // Fallback: posição salva com scroll do documento subtraído
          const scrollX = iframeDoc?.documentElement.scrollLeft || 0;
          const scrollY = iframeDoc?.documentElement.scrollTop || 0;
          popupX = iframeRect.left + comment.position.x - scrollX;
          popupY = iframeRect.top + comment.position.y - scrollY;
        } else {
          popupX = comment.position.viewportX || comment.position.x;
          popupY = comment.position.viewportY || comment.position.y;
        }
        const popupHeight = 160; // altura estimada do popup
        const spaceAbove = popupY - 50; // 50px de margem da barra
        const showBelow = spaceAbove < popupHeight;
        return createPortal(
          <div
            onClick={(e) => { e.stopPropagation(); }}
            style={{
              position: 'fixed',
              left: `${Math.min(Math.max(popupX, 150), window.innerWidth - 150)}px`,
              top: showBelow ? `${popupY + 20}px` : `${popupY}px`,
              transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, calc(-100% - 14px))',
              background: 'linear-gradient(135deg, #1e1e3f 0%, #16162a 100%)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,197,94,0.4)',
              padding: '14px',
              width: '280px',
              zIndex: 999999,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {comment.author}
              </div>
              <button onClick={() => setViewingComment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '0', display: 'flex', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color='#ff6b6b'}
                onMouseLeave={e => e.currentTarget.style.color='#888'}>
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: '13px', color: '#e0e0e0', lineHeight: 1.6, marginBottom: '12px' }}>
              {comment.text}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {new Date(comment.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                <input
                  type="color"
                  value={comment.color || '#22c55e'}
                  onChange={e => {
                    const newColor = e.target.value;
                    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, color: newColor } : c));
                  }}
                  title="Mudar cor do marcador"
                  style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid #3d3d5c', cursor: 'pointer', padding: 0, background: 'none' }}
                />
              </div>
              <button onClick={() => { deleteComment(comment.id); setViewingComment(null); }}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', cursor: 'pointer', color: '#ff6b6b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor='#ff6b6b'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor='rgba(239,68,68,0.3)'; }}>
                <Trash2 size={11} /> Deletar
              </button>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}