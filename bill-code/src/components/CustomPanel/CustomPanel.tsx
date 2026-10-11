import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, X, Plus, Edit, Trash2, Upload, FileText } from 'lucide-react';
import type { SavedResearch } from '../MyResearch/MyResearch';

interface CustomBlock {
  id: string;
  color: string;
  text: string;
  links: string[];
  images: string[];
  videos: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number; // Tamanho da fonte
  textX?: number; // Posição X do texto dentro do bloco
  textY?: number; // Posição Y do texto dentro do bloco
  isHidden?: boolean; // Se está oculto (bolinha)
  childrenIds: string[]; // IDs dos filhos diretos
}

interface CustomPanelProps {
  onClose: () => void;
  initialPanel?: SavedPanel; // Painel para carregar (opcional)
  onOpenUrl?: (url: string) => void; // Callback para abrir URL no navegador
  chatCollapsed?: boolean; // Se o chat está recolhido
}

interface SavedPanel {
  id: string;
  name: string;
  blocks: CustomBlock[];
  researches?: string[]; // IDs das pesquisas anexadas
  timestamp: number;
}

export default function CustomPanel({ onClose, initialPanel, onOpenUrl, chatCollapsed = true }: CustomPanelProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<CustomBlock[]>(initialPanel?.blocks || []);
  const [panelName, setPanelName] = useState(initialPanel?.name || 'Criativo sem título');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingBlock, setDraggingBlock] = useState<string | null>(null);
  const [blockDragOffset, setBlockDragOffset] = useState({ x: 0, y: 0 });
  const [resizingBlock, setResizingBlock] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [editingText, setEditingText] = useState<string | null>(null); // Bloco com texto sendo editado
  const [resizingFont, setResizingFont] = useState<string | null>(null); // Bloco com fonte sendo redimensionada
  const [isDraggingHandle, setIsDraggingHandle] = useState(false); // Se está arrastando o handle
  const [isDraggingText, setIsDraggingText] = useState(false); // Se está arrastando o texto
  const [textDragStart, setTextDragStart] = useState({ x: 0, y: 0 });
  const [fontResizeStart, setFontResizeStart] = useState({ x: 0, y: 0, fontSize: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId?: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState<{ blockId: string | null; parentId?: string; position?: { x: number; y: number } } | null>(null);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  
  // Estados para pesquisas
  const [attachedResearches, setAttachedResearches] = useState<string[]>(initialPanel?.researches || []);
  const [showResearchPicker, setShowResearchPicker] = useState(false);
  const [selectedResearchPreview, setSelectedResearchPreview] = useState<string | null>(null);
  
  // Menu de contexto para seleção de texto
  const [textContextMenu, setTextContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTranslator, setShowTranslator] = useState(false);
  const [translateText, setTranslateText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translateFrom, setTranslateFrom] = useState('en');
  const [translateTo, setTranslateTo] = useState('pt-br');
  const [isTranslating, setIsTranslating] = useState(false);

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    if (!textContextMenu) return;
    
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('custom-panel-context-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setTextContextMenu(null);
    };
    
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('click', handler, true);
    
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('click', handler, true);
    };
  }, [textContextMenu]);

  // Handler para capturar seleção de texto
  const handleTextSelection = (e: React.MouseEvent) => {
    if (e.button !== 2) return; // Só captura botão direito
    
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText) {
      e.preventDefault();
      setTextContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: selectedText
      });
    }
  };

  // Fix preventDefault warning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Posição do mouse no mundo antes do zoom
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
      
      // Ajusta o pan para manter o ponto do mouse fixo
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !contextMenu) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !draggingBlock && !resizingBlock && !resizingFont) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingBlock && !resizingFont) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const newX = (e.clientX - rect.left - pan.x) / zoom - blockDragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - blockDragOffset.y;
      
      setBlocks(prev => prev.map(block => 
        block.id === draggingBlock 
          ? { ...block, x: newX, y: newY }
          : block
      ));
    } else if (resizingBlock) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      
      const deltaX = currentX - resizeStart.x;
      const deltaY = currentY - resizeStart.y;
      
      setBlocks(prev => prev.map(block => 
        block.id === resizingBlock 
          ? { 
              ...block, 
              width: Math.max(200, resizeStart.width + deltaX),
              height: Math.max(150, resizeStart.height + deltaY)
            }
          : block
      ));
    } else if (resizingFont && isDraggingHandle) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      const deltaX = currentX - fontResizeStart.x;
      const deltaY = currentY - fontResizeStart.y;
      
      // Usa distância diagonal para resize mais intuitivo
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const direction = deltaX + deltaY > 0 ? 1 : -1;
      
      // 10px de movimento = 1px de fonte (mais sensível)
      const fontSizeChange = Math.round((distance * direction) / 10);
      const newFontSize = Math.max(10, Math.min(72, fontResizeStart.fontSize + fontSizeChange));
      
      setBlocks(prev => prev.map(block => 
        block.id === resizingFont 
          ? { ...block, fontSize: newFontSize }
          : block
      ));
    } else if (resizingFont && isDraggingText) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      
      const deltaX = currentX - textDragStart.x;
      const deltaY = currentY - textDragStart.y;
      
      setBlocks(prev => prev.map(block => 
        block.id === resizingFont 
          ? { 
              ...block, 
              textX: (block.textX || 0) + deltaX,
              textY: (block.textY || 0) + deltaY
            }
          : block
      ));
      
      setTextDragStart({ x: currentX, y: currentY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingBlock(null);
    setResizingBlock(null);
    setIsDraggingHandle(false);
    setIsDraggingText(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Clique no canvas desativa resize de fonte
    if (resizingFont && e.target === canvasRef.current) {
      setResizingFont(null);
    }
  };

  // Detectar tecla ESC ou Enter para sair do modo resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (resizingFont && (e.key === 'Escape' || e.key === 'Enter')) {
        setResizingFont(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resizingFont]);

  const handleCanvasRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleBlockRightClick = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, blockId });
  };

  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (e.button === 0 && !editingText && !resizingFont) {
      e.stopPropagation();
      setDraggingBlock(blockId);
      
      const block = blocks.find(b => b.id === blockId);
      if (block) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const clickX = (e.clientX - rect.left - pan.x) / zoom;
        const clickY = (e.clientY - rect.top - pan.y) / zoom;
        
        setBlockDragOffset({
          x: clickX - block.x,
          y: clickY - block.y
        });
      }
    }
  };

  const startTextEditing = (blockId: string) => {
    setEditingText(blockId);
    setContextMenu(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    setResizingBlock(blockId);
    
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;
      
      setResizeStart({
        x: currentX,
        y: currentY,
        width: block.width,
        height: block.height
      });
    }
  };

  const createNewBlock = (parentId?: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    let x = 500;
    let y = 200;
    
    if (parentId) {
      const parent = blocks.find(b => b.id === parentId);
      if (parent) {
        // Posiciona o novo filho à direita, espaçado verticalmente pelos filhos existentes
        const childCount = parent.childrenIds.length;
        x = parent.x + parent.width + 200;
        y = parent.y + (childCount * 150);
      }
    } else if (contextMenu) {
      x = (contextMenu.x - rect.left - pan.x) / zoom;
      y = (contextMenu.y - rect.top - pan.y) / zoom;
    }
    
    setShowEditModal({ blockId: null, parentId, position: { x, y } });
    setContextMenu(null);
  };

  const editBlock = (blockId: string) => {
    setShowEditModal({ blockId });
    setContextMenu(null);
  };

  const deleteBlock = (blockId: string) => {
    // Remove o bloco e todos os seus filhos recursivamente
    const removeBlockAndChildren = (id: string) => {
      const block = blocks.find(b => b.id === id);
      if (!block) return [id];
      
      const toRemove = [id];
      block.childrenIds.forEach(childId => {
        toRemove.push(...removeBlockAndChildren(childId));
      });
      return toRemove;
    };
    
    const idsToRemove = removeBlockAndChildren(blockId);
    
    setBlocks(prev => {
      // Remove os blocos
      const filtered = prev.filter(b => !idsToRemove.includes(b.id));
      
      // Remove referências dos pais
      return filtered.map(block => ({
        ...block,
        childrenIds: block.childrenIds.filter(id => !idsToRemove.includes(id))
      }));
    });
    
    setContextMenu(null);
  };

  const saveBlock = (blockData: Partial<CustomBlock>) => {
    if (showEditModal?.blockId) {
      // Editando bloco existente
      const blockToUpdate = blocks.find(b => b.id === showEditModal.blockId);
      
      setBlocks(prev => prev.map(block => 
        block.id === showEditModal.blockId 
          ? { ...block, ...blockData }
          : block
      ));
      
      // Se adicionou imagem nova em bloco existente, ajusta tamanho
      if (blockData.images && blockData.images.length > 0 && blockToUpdate) {
        const newImages = blockData.images.filter(img => !blockToUpdate.images.includes(img));
        if (newImages.length > 0) {
          const img = new Image();
          img.onload = () => {
            setBlocks(prev => prev.map(block => 
              block.id === showEditModal.blockId
                ? { ...block, width: img.width, height: img.height }
                : block
            ));
          };
          img.src = newImages[0];
        }
      }
    } else {
      // Criando novo bloco
      const newBlock: CustomBlock = {
        id: `block-${Date.now()}`,
        color: blockData.color || '#f59e0b',
        text: blockData.text || '',
        links: blockData.links || [],
        images: blockData.images || [],
        videos: blockData.videos || [],
        x: showEditModal?.position?.x || 500,
        y: showEditModal?.position?.y || 200,
        width: 300,
        height: 200,
        fontSize: blockData.fontSize || 14,
        childrenIds: []
      };
      
      // Se tem imagem, ajusta o tamanho do bloco ao tamanho da imagem
      if (blockData.images && blockData.images.length > 0) {
        const img = new Image();
        img.onload = () => {
          console.log('[CustomPanel] Imagem carregada:', img.width, 'x', img.height);
          setBlocks(prev => prev.map(block => 
            block.id === newBlock.id
              ? { ...block, width: img.width, height: img.height }
              : block
          ));
        };
        img.onerror = () => {
          console.error('[CustomPanel] Erro ao carregar imagem');
        };
        img.src = blockData.images[0];
        console.log('[CustomPanel] Iniciando carregamento da imagem...');
      }
      
      setBlocks(prev => {
        const updated = [...prev, newBlock];
        
        // Se tem pai, adiciona este bloco aos filhos do pai
        if (showEditModal?.parentId) {
          return updated.map(block => 
            block.id === showEditModal.parentId
              ? { ...block, childrenIds: [...block.childrenIds, newBlock.id] }
              : block
          );
        }
        
        return updated;
      });
    }
    
    setShowEditModal(null);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const savePanel = () => {
    try {
      // Carrega painéis existentes
      const saved = localStorage.getItem('billcode_custom_panels');
      const panels: SavedPanel[] = saved ? JSON.parse(saved) : [];
      
      // Cria novo painel
      const newPanel: SavedPanel = {
        id: `panel-${Date.now()}`,
        name: panelName,
        blocks,
        researches: attachedResearches, // Salva pesquisas anexadas
        timestamp: Date.now()
      };
      
      // Calcula tamanho aproximado
      const jsonString = JSON.stringify([...panels, newPanel]);
      const sizeInMB = (jsonString.length / (1024 * 1024)).toFixed(2);
      
      console.log('[CustomPanel] Tentando salvar...');
      console.log('[CustomPanel] Tamanho total:', sizeInMB, 'MB');
      console.log('[CustomPanel] Blocos:', blocks.length);
      console.log('[CustomPanel] Vídeos no painel:', blocks.reduce((acc, b) => acc + b.videos.length, 0));
      
      // Tenta salvar no localStorage primeiro
      try {
        panels.push(newPanel);
        localStorage.setItem('billcode_custom_panels', JSON.stringify(panels));
        
        // Mostra notificação
        setShowSaveNotification(true);
        setTimeout(() => setShowSaveNotification(false), 3000);
        
        console.log('[CustomPanel] ✓ Criativo salvo com sucesso no localStorage!');
        console.log('[CustomPanel] Nome:', panelName);
        console.log('[CustomPanel] Total de criativos salvos:', panels.length);
      } catch (quotaError: any) {
        // Se localStorage cheio, tenta IndexedDB
        if (quotaError.name === 'QuotaExceededError' || quotaError.code === 22) {
          console.warn('[CustomPanel] localStorage cheio, tentando IndexedDB...');
          
          // Remove último item adicionado do array
          panels.pop();
          
          // Salva via IndexedDB
          const request = indexedDB.open('billcode_db', 1);
          
          request.onerror = () => {
            console.error('[CustomPanel] Erro ao abrir IndexedDB');
            alert('❌ Erro ao salvar: Armazenamento indisponível');
          };
          
          request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('panels')) {
              db.createObjectStore('panels', { keyPath: 'id' });
            }
          };
          
          request.onsuccess = (event: any) => {
            const db = event.target.result;
            const transaction = db.transaction(['panels'], 'readwrite');
            const store = transaction.objectStore('panels');
            
            store.put(newPanel);
            
            transaction.oncomplete = () => {
              console.log('[CustomPanel] ✓ Criativo salvo com sucesso no IndexedDB!');
              
              // Marca no localStorage que tem dados no IndexedDB
              localStorage.setItem('billcode_uses_indexeddb', 'true');
              
              setShowSaveNotification(true);
              setTimeout(() => setShowSaveNotification(false), 3000);
            };
            
            transaction.onerror = () => {
              console.error('[CustomPanel] Erro ao salvar no IndexedDB');
            };
          };
        } else {
          throw quotaError;
        }
      }
    } catch (e: any) {
      console.error('[CustomPanel] ✗ Erro ao salvar:', e);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0, // Sempre cola na esquerda (sem espaço para sidebar)
      right: chatCollapsed ? 0 : '392px', // 380px chat + 12px handle
      bottom: 0,
      background: '#0a0a0f',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Toolbar */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '2px solid var(--border-light)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            placeholder="Nome do criativo"
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '300px',
              padding: '4px 8px',
              borderRadius: '4px'
            }}
            onFocus={(e) => e.target.style.background = 'var(--bg-primary)'}
            onBlur={(e) => e.target.style.background = 'transparent'}
          />
          <p style={{ margin: '4px 0 0 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Clique direito para criar blocos • Arraste blocos para mover
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={savePanel}
            style={{ 
              padding: '8px 16px', 
              background: '#10b981', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px'
            }} 
            title="Salvar Criativo"
          >
            Salvar
          </button>
          
          <button 
            onClick={() => setShowResearchPicker(true)}
            style={{ 
              padding: '8px 16px', 
              background: 'var(--accent)', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px'
            }} 
            title="Adicionar Pesquisa"
          >
            <FileText size={16} />
            Adicionar Pesquisa
          </button>
          
          <button onClick={() => setZoom(prev => Math.min(3, prev * 1.2))} style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Zoom In">
            <ZoomIn size={18} color="var(--text-secondary)" />
          </button>
          
          <button onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))} style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Zoom Out">
            <ZoomOut size={18} color="var(--text-secondary)" />
          </button>
          
          <button onClick={resetView} style={{ padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Reset View">
            <Maximize2 size={18} color="var(--text-secondary)" />
          </button>
          
          <div style={{ padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', minWidth: '80px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </div>
          
          <button onClick={onClose} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Fechar">
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      {/* Pesquisas Anexadas */}
      {attachedResearches.length > 0 && (
        <div style={{
          padding: '12px 20px',
          background: 'var(--bg-secondary)',
          borderBottom: '2px solid var(--border-light)',
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          {attachedResearches.map(researchId => {
            const saved = localStorage.getItem('billcode_my_researches');
            const researches: SavedResearch[] = saved ? JSON.parse(saved) : [];
            const research = researches.find(r => r.id === researchId);
            
            if (!research) return null;
            
            return (
              <div
                key={researchId}
                onClick={() => setSelectedResearchPreview(researchId)}
                style={{
                  minWidth: '200px',
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  border: selectedResearchPreview === researchId ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  if (selectedResearchPreview !== researchId) {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={e => {
                  if (selectedResearchPreview !== researchId) {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachedResearches(prev => prev.filter(id => id !== researchId));
                    if (selectedResearchPreview === researchId) {
                      setSelectedResearchPreview(null);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    padding: '4px',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#fff'
                  }}
                  title="Remover"
                >
                  <X size={12} />
                </button>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', paddingRight: '24px' }}>
                  {research.title}
                </h4>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {research.links.length} links • {research.images.length} imagens
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasRightClick}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : draggingBlock ? 'move' : 'grab',
          background: 'radial-gradient(circle at 50% 50%, #0f0f1a 0%, #0a0a0f 100%)'
        }}
      >
        {/* Container com transform */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}>
          {/* SVG para linhas e grid */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '5000px', height: '5000px', pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                <path d={`M 50 0 L 0 0 0 50`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={5000} height={5000} fill="url(#grid)" />
            
            {/* Linhas de conexão - TODAS as relações pai-filho */}
            {blocks.map(parentBlock => 
              parentBlock.childrenIds.map(childId => {
                const childBlock = blocks.find(b => b.id === childId);
                if (!childBlock) return null;
                
                // Calcula posições baseado se está oculto ou não
                const parentWidth = parentBlock.isHidden ? 40 : parentBlock.width;
                const parentHeight = parentBlock.isHidden ? 40 : parentBlock.height;
                const childWidth = childBlock.isHidden ? 40 : childBlock.width;
                const childHeight = childBlock.isHidden ? 40 : childBlock.height;
                
                // Conecta borda direita do pai com borda esquerda do filho
                const x1 = parentBlock.x + parentWidth;
                const y1 = parentBlock.y + parentHeight / 2;
                const x2 = childBlock.x;
                const y2 = childBlock.y + childHeight / 2;
                
                // Curva bezier suave
                const dx = x2 - x1;
                const controlOffset = Math.abs(dx) * 0.5;
                
                return (
                  <path
                    key={`conn-${parentBlock.id}-${childId}`}
                    d={`M ${x1},${y1} C ${x1 + controlOffset},${y1} ${x2 - controlOffset},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={childBlock.color}
                    strokeWidth={2.5}
                    opacity={0.6}
                    strokeLinecap="round"
                  />
                );
              })
            )}
          </svg>

          {/* Blocos */}
          {blocks.map(block => {
            const isEditingThisText = editingText === block.id;
            
            // Se o bloco está oculto, mostra só a bolinha
            if (block.isHidden) {
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBlocks(prev => prev.map(b => 
                      b.id === block.id ? { ...b, isHidden: false } : b
                    ));
                  }}
                  onContextMenu={(e) => handleBlockRightClick(e, block.id)}
                  style={{
                    position: 'absolute',
                    left: block.x,
                    top: block.y,
                    width: '40px',
                    height: '40px',
                    background: `linear-gradient(135deg, ${block.color}ee, ${block.color}cc)`,
                    border: '3px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: '900',
                    transition: 'all 0.2s',
                    zIndex: 1000
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5)';
                  }}
                >
                  •
                </div>
              );
            }
            
            // Bloco normal
            return (
              <div
                key={block.id}
                onMouseDown={(e) => !isEditingThisText && handleBlockMouseDown(e, block.id)}
                onClick={(e) => {
                  // Clicar no bloco (fora do texto) desativa modo resize
                  if (resizingFont === block.id && e.target === e.currentTarget) {
                    e.stopPropagation();
                    setResizingFont(null);
                  }
                }}
                onContextMenu={(e) => handleBlockRightClick(e, block.id)}
                style={{
                  position: 'absolute',
                  left: block.x,
                  top: block.y,
                  width: `${block.width}px`,
                  minHeight: `${block.height}px`,
                  padding: '20px',
                  background: `linear-gradient(135deg, ${block.color}ee, ${block.color}cc)`,
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  cursor: isEditingThisText ? 'text' : 'move',
                  userSelect: isEditingThisText ? 'text' : 'none',
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* Texto editável inline */}
                {isEditingThisText ? (
                  <textarea
                    autoFocus
                    value={block.text}
                    onChange={(e) => {
                      setBlocks(prev => prev.map(b => 
                        b.id === block.id ? { ...b, text: e.target.value } : b
                      ));
                    }}
                    onBlur={() => setEditingText(null)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Digite o texto aqui..."
                    style={{
                      width: '100%',
                      flex: 1,
                      minHeight: '100px',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.15)',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: `${block.fontSize}px`,
                      lineHeight: '1.6',
                      resize: 'none',
                      fontFamily: 'inherit',
                      outline: 'none'
                    }}
                  />
                ) : block.text ? (
                  <div 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startTextEditing(block.id);
                    }}
                    style={{ 
                      position: 'relative',
                      width: 'fit-content',
                      maxWidth: '100%',
                      left: `${block.textX || 0}px`,
                      top: `${block.textY || 0}px`
                    }}
                  >
                    <div 
                      onMouseDown={(e) => {
                        if (resizingFont === block.id) {
                          e.stopPropagation();
                          const rect = canvasRef.current?.getBoundingClientRect();
                          if (!rect) return;
                          
                          const currentX = (e.clientX - rect.left - pan.x) / zoom;
                          const currentY = (e.clientY - rect.top - pan.y) / zoom;
                          
                          setIsDraggingText(true);
                          setTextDragStart({ x: currentX, y: currentY });
                        }
                      }}
                      style={{
                        fontSize: `${block.fontSize}px`, 
                        fontWeight: '700',
                        color: 'rgba(255,255,255,0.95)', 
                        lineHeight: '1.6', 
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        padding: resizingFont === block.id ? '12px' : '8px',
                        background: resizingFont === block.id ? 'rgba(96, 213, 255, 0.1)' : 'transparent',
                        border: resizingFont === block.id ? '3px solid #60d5ff' : 'none',
                        borderRadius: '8px',
                        transition: 'all 0.15s',
                        position: 'relative',
                        width: 'fit-content',
                        minWidth: '40px',
                        cursor: resizingFont === block.id ? 'move' : 'text'
                      }}>
                      {block.text}
                    </div>
                    {resizingFont === block.id && (
                      <>
                        <div style={{
                          position: 'absolute',
                          top: '-40px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#60d5ff',
                          color: '#000',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                          pointerEvents: 'none',
                          zIndex: 1000
                        }}>
                          {block.fontSize}px • ESC para sair
                        </div>
                        {/* Handle de resize no canto inferior direito do contorno */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            
                            const currentX = (e.clientX - rect.left - pan.x) / zoom;
                            const currentY = (e.clientY - rect.top - pan.y) / zoom;
                            
                            setFontResizeStart({
                              x: currentX,
                              y: currentY,
                              fontSize: block.fontSize
                            });
                            
                            // Ativa o modo de arraste do handle
                            setIsDraggingHandle(true);
                            setDraggingBlock(null);
                          }}
                          style={{
                            position: 'absolute',
                            bottom: '-6px',
                            right: '-6px',
                            width: '24px',
                            height: '24px',
                            background: '#60d5ff',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            boxShadow: '0 3px 12px rgba(96, 213, 255, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000',
                            fontSize: '12px',
                            fontWeight: '900',
                            border: '2px solid #000',
                            zIndex: 100
                          }}
                        >
                          ⋰
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startTextEditing(block.id);
                    }}
                    style={{ 
                      fontSize: '13px', 
                      color: 'rgba(255,255,255,0.3)', 
                      fontStyle: 'italic',
                      textAlign: 'center',
                      padding: '20px',
                      cursor: 'text'
                    }}>
                    Duplo clique para adicionar texto
                  </div>
                )}
                
                {/* Imagens */}
                {block.images.length > 0 && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: block.images.length === 1 ? '1fr' : 'repeat(2, 1fr)', 
                    gap: '8px',
                    marginTop: '8px'
                  }}>
                    {block.images.map((img, idx) => (
                      <img 
                        key={idx} 
                        src={img} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Vídeos */}
                {block.videos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {block.videos.map((video, idx) => (
                      <video 
                        key={idx} 
                        src={video} 
                        controls 
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Links */}
                {block.links.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {block.links.map((link, idx) => (
                      <a 
                        key={idx} 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          display: 'block', 
                          color: '#60d5ff', 
                          textDecoration: 'none',
                          fontSize: '11px',
                          padding: '6px 8px',
                          background: 'rgba(96, 213, 255, 0.1)',
                          borderRadius: '4px',
                          border: '1px solid rgba(96, 213, 255, 0.3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        🔗 {link}
                      </a>
                    ))}
                  </div>
                )}
                
                {/* Resize Handle */}
                {!isEditingThisText && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, block.id)}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      cursor: 'nwse-resize',
                      background: 'rgba(255,255,255,0.2)',
                      borderTopLeftRadius: '4px',
                      borderBottomRightRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)'
                    }}
                  >
                    ⋰
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Menu de contexto */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 10000,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              padding: '4px 0',
              minWidth: '200px'
            }}
          >
            {!contextMenu.blockId ? (
              <div
                style={{ padding: '10px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => createNewBlock()}
              >
                <Plus size={16} />
                Criar Bloco
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => {
                  const block = blocks.find(b => b.id === contextMenu.blockId);
                  if (block && block.text) {
                    setResizingFont(contextMenu.blockId!);
                    setContextMenu(null);
                  }
                }}>
                  <ZoomIn size={16} />
                  Aumentar Texto
                </div>
                <div style={{ padding: '10px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => editBlock(contextMenu.blockId!)}>
                  <Edit size={16} />
                  Editar Bloco
                </div>
                <div style={{ padding: '10px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => createNewBlock(contextMenu.blockId)}>
                  <Plus size={16} />
                  Adicionar Bloco Conectado
                </div>
                <div style={{ padding: '10px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => {
                  setBlocks(prev => prev.map(b => 
                    b.id === contextMenu.blockId ? { ...b, isHidden: true } : b
                  ));
                  setContextMenu(null);
                }}>
                  <Maximize2 size={16} />
                  Ocultar
                </div>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
                <div style={{ padding: '10px 14px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => deleteBlock(contextMenu.blockId!)}>
                  <Trash2 size={16} />
                  Excluir Bloco
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} onClick={() => setContextMenu(null)} />
        </>
      )}

      {/* Modal de Edição */}
      {showEditModal && <EditBlockModal blockId={showEditModal.blockId} blocks={blocks} onSave={saveBlock} onClose={() => setShowEditModal(null)} />}

      {/* Notificação de Salvamento */}
      {showSaveNotification && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 10003,
          background: '#10b981',
          color: '#fff',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: '600',
          animation: 'slideIn 0.3s ease-out'
        }}>
          ✓ Criativo salvo com sucesso!
        </div>
      )}

      {/* Modal: Seletor de Pesquisas */}
      {showResearchPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10004,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowResearchPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '2px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Adicionar Pesquisa
              </h3>
              <button
                onClick={() => setShowResearchPicker(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de pesquisas */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {(() => {
                const saved = localStorage.getItem('billcode_my_researches');
                const researches: SavedResearch[] = saved ? JSON.parse(saved) : [];
                
                if (researches.length === 0) {
                  return (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '40px' }}>
                      Nenhuma pesquisa salva ainda.
                    </p>
                  );
                }
                
                return researches.map(research => {
                  const isAttached = attachedResearches.includes(research.id);
                  
                  return (
                    <div
                      key={research.id}
                      onClick={() => {
                        if (!isAttached) {
                          setAttachedResearches(prev => [...prev, research.id]);
                          setShowResearchPicker(false);
                        }
                      }}
                      style={{
                        padding: '16px',
                        background: isAttached ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                        border: isAttached ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        cursor: isAttached ? 'default' : 'pointer',
                        opacity: isAttached ? 0.6 : 1,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => {
                        if (!isAttached) {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isAttached) {
                          e.currentTarget.style.borderColor = 'var(--border-light)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {research.title}
                        {isAttached && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--accent)' }}>✓ Anexada</span>}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {research.links.length} links • {research.images.length} imagens
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preview de Pesquisa */}
      {selectedResearchPreview && (() => {
        const saved = localStorage.getItem('billcode_my_researches');
        const researches: SavedResearch[] = saved ? JSON.parse(saved) : [];
        const research = researches.find(r => r.id === selectedResearchPreview);
        
        if (!research) return null;
        
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: chatCollapsed ? 0 : '392px', // Se chat aberto, deixa espaço (380px + 12px handle)
              bottom: 0,
              width: '500px',
              background: 'var(--bg-secondary)',
              borderLeft: '2px solid var(--border-light)',
              zIndex: 10005,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
              transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '2px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', flex: 1 }}>
                {research.title}
              </h3>
              <button
                onClick={() => setSelectedResearchPreview(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Conteúdo */}
              {research.content && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Conteúdo
                  </h4>
                  <p 
                    onContextMenu={handleTextSelection}
                    style={{ 
                      margin: 0, 
                      fontSize: '13px', 
                      color: 'var(--text-primary)', 
                      lineHeight: '1.8', 
                      whiteSpace: 'pre-wrap',
                      userSelect: 'text',
                      cursor: 'text'
                    }}
                  >
                    {research.content}
                  </p>
                </div>
              )}

              {/* Links */}
              {research.links.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Links ({research.links.length})
                  </h4>
                  {research.links.map((link, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (onOpenUrl) {
                          onOpenUrl(link);
                          onClose(); // Fecha o painel de criativos
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        fontSize: '12px',
                        color: 'var(--accent)',
                        wordBreak: 'break-all',
                        lineHeight: '1.4',
                        cursor: onOpenUrl ? 'pointer' : 'default',
                        transition: 'background 0.15s, border-color 0.15s'
                      }}
                      onMouseEnter={e => {
                        if (onOpenUrl) {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (onOpenUrl) {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.borderColor = 'var(--border-light)';
                        }
                      }}
                    >
                      {link}
                    </div>
                  ))}
                </div>
              )}

              {/* Imagens */}
              {research.images.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Imagens ({research.images.length})
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {research.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt=""
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '2px solid var(--border-light)'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      
      {/* Menu de contexto para texto selecionado */}
      {textContextMenu && (
        <div
          id="custom-panel-context-menu"
          style={{
            position: 'fixed',
            left: textContextMenu.x,
            top: textContextMenu.y,
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-light)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10006,
            minWidth: '150px',
            overflow: 'hidden'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(textContextMenu.text);
              setTextContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Copiar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTranslateText(textContextMenu.text);
              setTranslatedText('');
              setShowTranslator(true);
              setTextContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid var(--border-light)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Traduzir
          </button>
        </div>
      )}
      
      {/* Modal: Tradutor */}
      {showTranslator && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10007,
            padding: '20px'
          }}
          onClick={() => setShowTranslator(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              border: '2px solid var(--border-light)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px', borderBottom: '2px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Tradutor
              </h3>
              <button
                onClick={() => setShowTranslator(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  value={translateFrom}
                  onChange={(e) => setTranslateFrom(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                  <option value="de">Alemão</option>
                  <option value="it">Italiano</option>
                  <option value="pt-br">Português</option>
                </select>
                <button
                  onClick={() => {
                    const temp = translateFrom;
                    setTranslateFrom(translateTo);
                    setTranslateTo(temp);
                  }}
                  style={{
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                  title="Inverter idiomas"
                >
                  ⇄
                </button>
                <select
                  value={translateTo}
                  onChange={(e) => setTranslateTo(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="pt-br">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                  <option value="de">Alemão</option>
                  <option value="it">Italiano</option>
                </select>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Texto original
                </label>
                <textarea
                  value={translateText}
                  onChange={(e) => setTranslateText(e.target.value)}
                  placeholder="Digite ou cole o texto aqui..."
                  style={{
                    flex: 1,
                    minHeight: '150px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                onClick={async () => {
                  if (!translateText.trim()) return;
                  setIsTranslating(true);
                  try {
                    const result = await (window as any).electronAPI.translateText(translateText, translateFrom, translateTo);
                    if (result.success) {
                      setTranslatedText(result.translatedText);
                    } else {
                      setTranslatedText('Erro ao traduzir. Tente novamente.');
                    }
                  } catch (error) {
                    setTranslatedText('Erro de conexão. Verifique sua internet.');
                  } finally {
                    setIsTranslating(false);
                  }
                }}
                disabled={isTranslating || !translateText.trim()}
                style={{
                  padding: '14px',
                  background: isTranslating ? 'var(--bg-tertiary)' : '#06b6d4',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isTranslating || !translateText.trim() ? 'not-allowed' : 'pointer',
                  opacity: isTranslating || !translateText.trim() ? 0.5 : 1
                }}
              >
                {isTranslating ? 'Traduzindo...' : 'Traduzir'}
              </button>

              {translatedText && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Tradução
                    </label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(translatedText);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <div style={{
                    flex: 1,
                    minHeight: '150px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    border: '2px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {translatedText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal de Edição de Bloco - Só para mídia, cor e tamanho de fonte
function EditBlockModal({ blockId, blocks, onSave, onClose }: { blockId: string | null; blocks: CustomBlock[]; onSave: (data: Partial<CustomBlock>) => void; onClose: () => void }) {
  const existingBlock = blockId ? blocks.find(b => b.id === blockId) : null;
  
  const [text, setText] = useState(existingBlock?.text || '');
  const [color, setColor] = useState(existingBlock?.color || '#f59e0b');
  const [fontSize, setFontSize] = useState(existingBlock?.fontSize || 14);
  const [links, setLinks] = useState<string[]>(existingBlock?.links || []);
  const [linkInput, setLinkInput] = useState('');
  const [images, setImages] = useState<string[]>(existingBlock?.images || []);
  const [videos, setVideos] = useState<string[]>(existingBlock?.videos || []);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      // Só loga se o vídeo for muito grande (> 5MB)
      const sizeInMB = file.size / (1024 * 1024);
      if (sizeInMB > 5) {
        console.warn('[CustomPanel] Vídeo grande:', file.name, '-', sizeInMB.toFixed(2), 'MB - pode demorar para salvar');
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setVideos(prev => [...prev, event.target!.result as string]);
          console.log('[CustomPanel] Vídeo adicionado:', file.name, '-', sizeInMB.toFixed(2), 'MB');
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSave = () => {
    onSave({ text, color, fontSize, links, images, videos });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '28px', maxWidth: '550px', width: '90%', maxHeight: '85vh', overflowY: 'auto', border: '2px solid var(--border-light)' }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {blockId ? 'Editar Bloco' : 'Criar Bloco'}
        </h2>
        
        <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          💡 <strong>Dica:</strong> Dê duplo clique no texto do bloco para redimensionar a fonte arrastando
        </p>
        
        {/* Cor */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cor do Bloco
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: '60px', height: '44px', border: '2px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#f59e0b"
              style={{ flex: 1, padding: '12px', background: 'var(--bg-primary)', border: '2px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'monospace' }}
            />
          </div>
        </div>
        
        {/* Links */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Links
          </label>
          {links.map((link, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" value={link} readOnly style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px' }} />
              <button onClick={() => setLinks(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '10px 14px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkInput.trim()) {
                  setLinks(prev => [...prev, linkInput.trim()]);
                  setLinkInput('');
                }
              }}
              placeholder="https://exemplo.com (Enter para adicionar)"
              style={{ flex: 1, padding: '10px', background: 'var(--bg-primary)', border: '2px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px' }}
            />
            <button onClick={() => { if (linkInput.trim()) { setLinks(prev => [...prev, linkInput.trim()]); setLinkInput(''); }}} style={{ padding: '10px 14px', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        {/* Imagens */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Imagens
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', paddingTop: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-light)' }}>
                <img src={img} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '4px', right: '4px', padding: '6px', background: '#ef4444', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--bg-primary)',
              border: '2px dashed var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            <Upload size={18} />
            Fazer Upload de Imagens
          </button>
        </div>
        
        {/* Vídeos */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Vídeos
          </label>
          {videos.map((video, idx) => (
            <div key={idx} style={{ marginBottom: '10px', position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-light)' }}>
              <video src={video} style={{ width: '100%', maxHeight: '180px', display: 'block' }} controls />
              <button onClick={() => setVideos(prev => prev.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '8px', right: '8px', padding: '8px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => videoInputRef.current?.click()}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--bg-primary)',
              border: '2px dashed var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            <Upload size={18} />
            Fazer Upload de Vídeos
          </button>
        </div>
        
        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '12px 24px', background: 'transparent', border: '2px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
            Cancelar
          </button>
          <button onClick={handleSave} style={{ padding: '12px 24px', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {blockId ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}
