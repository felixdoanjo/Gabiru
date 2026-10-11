import { useState, useRef, useEffect } from 'react';
import { Trash2, Code, Film, Image, Palette, Globe, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface PlanBlock {
  id: string;
  type: 'start' | 'end' | 'code' | 'video' | 'photo' | 'paint' | 'web';
  label: string;
  description: string;
  x: number;
  y: number;
  nextId: string | null;
  status?: 'pending' | 'in-progress' | 'completed' | 'delayed';
  startDate?: string;
  startTime?: string;
  deadline?: string;
  deadlineTime?: string;
  notes?: Array<{ timestamp: number; text: string }>;
  preview?: string;
  projectStarted?: boolean;
  workFolder?: string;
  saveId?: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  blocks: PlanBlock[];
  createdAt: number;
}

interface PlanCanvasProps {
  plan: Plan;
  onClose: () => void;
  onUpdatePlan: (plan: Plan) => void;
  onSelectBlock?: (block: PlanBlock | null) => void;
}

const blockIcons: Record<string, any> = {
  code: Code,
  video: Film,
  photo: Image,
  paint: Palette,
  web: Globe,
};

const blockColors: Record<string, string> = {
  start: '#c084fc',
  end: '#c084fc',
  code: '#60a5fa',
  video: '#f472b6',
  photo: '#34d399',
  paint: '#fbbf24',
  web: '#fb923c',
};

export default function PlanCanvas({ plan, onClose, onUpdatePlan, onSelectBlock }: PlanCanvasProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; afterBlockId: string } | null>(null);
  const [editingBlock, setEditingBlock] = useState<{ 
    blockId: string; 
    label: string;
    description: string;
    startDate?: string;
    startTime?: string;
    deadline?: string;
    deadlineTime?: string;
    workFolder?: string;
  } | null>(null);
  const [draggingBlock, setDraggingBlock] = useState<{ blockId: string; startX: number; startY: number; blockStartX: number; blockStartY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  console.log('[PlanCanvas] ========================================');
  console.log('[PlanCanvas] Plan recebido:', plan.name);
  console.log('[PlanCanvas] Total de blocos:', plan.blocks.length);
  console.log('[PlanCanvas] ContextMenu state:', contextMenu);
  plan.blocks.forEach((b, i) => {
    console.log(`[PlanCanvas] Bloco ${i}:`, { id: b.id, type: b.type, label: b.label, x: b.x, y: b.y });
  });
  console.log('[PlanCanvas] ========================================');

  // useEffect para gerenciar event listeners de drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingBlock) return;

      const deltaX = (e.clientX - draggingBlock.startX) / zoom;
      const deltaY = (e.clientY - draggingBlock.startY) / zoom;

      // Se moveu mais de 5px, considera que está arrastando
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        setIsDragging(true);
      }

      const updatedBlocks = plan.blocks.map(b =>
        b.id === draggingBlock.blockId
          ? {
              ...b,
              x: draggingBlock.blockStartX + deltaX,
              y: draggingBlock.blockStartY + deltaY,
            }
          : b
      );

      onUpdatePlan({ ...plan, blocks: updatedBlocks });
    };

    const handleMouseUp = () => {
      setDraggingBlock(null);
      // Pequeno delay para não interferir com o onClick
      setTimeout(() => setIsDragging(false), 50);
    };

    if (draggingBlock) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingBlock, plan, onUpdatePlan, zoom]);

  // useEffect para gerenciar zoom com scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(Math.max(0.3, prev + delta), 2));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.3));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleAddBlock = (type: 'code' | 'video' | 'photo' | 'paint' | 'web', afterBlockId: string) => {
    const afterBlock = plan.blocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;

    const typeLabels = {
      code: 'Code',
      video: 'Video',
      photo: 'Design',
      paint: 'Paint',
      web: 'Web',
    };

    const newBlock: PlanBlock = {
      id: Date.now().toString(),
      type,
      label: `${typeLabels[type]} Início`,
      description: '',
      x: afterBlock.x + 250,
      y: afterBlock.y,
      nextId: afterBlock.nextId,
      status: 'pending',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 dias
      notes: [],
    };

    const updatedBlocks = plan.blocks.map(b =>
      b.id === afterBlockId ? { ...b, nextId: newBlock.id } : b
    );

    updatedBlocks.push(newBlock);
    onUpdatePlan({ ...plan, blocks: updatedBlocks });
    setContextMenu(null);
  };

  const handleUpdateBlock = (blockId: string, description: string, additionalData?: any) => {
    const updatedBlocks = plan.blocks.map(b =>
      b.id === blockId ? { ...b, description, ...additionalData } : b
    );

    onUpdatePlan({ ...plan, blocks: updatedBlocks });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (blockId === 'start' || blockId === 'end') return;

    const blockToDelete = plan.blocks.find(b => b.id === blockId);
    if (!blockToDelete) return;

    const previousBlock = plan.blocks.find(b => b.nextId === blockId);

    if (previousBlock) {
      const updatedBlocks = plan.blocks
        .filter(b => b.id !== blockId)
        .map(b => b.id === previousBlock.id ? { ...b, nextId: blockToDelete.nextId } : b);

      onUpdatePlan({ ...plan, blocks: updatedBlocks });
      // Dispara evento para atualizar modal de projetos
      window.dispatchEvent(new CustomEvent('plans-updated'));
    }
  };

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (e.button !== 0) return; // Só botão esquerdo
    e.preventDefault();
    e.stopPropagation();
    
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;

    setDraggingBlock({
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      blockStartX: block.x,
      blockStartY: block.y,
    });
  };

  return (
    <>
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        overflow: 'hidden',
      }}>
        {/* Controles de Zoom */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
          <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
            Zoom: {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomOut}
            style={{
              background: 'rgba(124, 92, 252, 0.2)',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            style={{
              background: 'rgba(124, 92, 252, 0.2)',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#c084fc',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            100%
          </button>
          <button
            onClick={handleZoomIn}
            style={{
              background: 'rgba(124, 92, 252, 0.2)',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            background: 'linear-gradient(145deg, #0a0a12 0%, #050508 50%, #0a0a12 100%)',
            borderRadius: '12px',
            cursor: draggingBlock ? 'grabbing' : 'default',
          }}
          onClick={() => setContextMenu(null)}
          onContextMenu={e => {
            console.log('[PlanCanvas] onContextMenu no CANVAS (fundo)!');
            e.preventDefault();
            e.stopPropagation();
            
            // Encontra o último bloco antes do 'end'
            const endBlock = plan.blocks.find(b => b.type === 'end');
            const lastBeforeEnd = plan.blocks.find(b => b.nextId === endBlock?.id);
            const targetBlock = lastBeforeEnd || plan.blocks.find(b => b.type === 'start');
            
            if (targetBlock) {
              console.log('[PlanCanvas] Abrindo menu para adicionar após:', targetBlock.id);
              setContextMenu({ x: e.clientX, y: e.clientY, afterBlockId: targetBlock.id });
            }
          }}
        >
          {/* Container interno para os blocos com zoom */}
          <div 
            style={{
              position: 'relative',
              width: `${1500 * zoom}px`,
              height: `${600 * zoom}px`,
              minWidth: '100%',
              minHeight: '100%',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Desenha setas entre blocos */}
        {plan.blocks.map(block => {
          if (!block.nextId) return null;
          const nextBlock = plan.blocks.find(b => b.id === block.nextId);
          if (!nextBlock) return null;

          const x1 = block.x + 120;
          const y1 = block.y + 40;
          const x2 = nextBlock.x;
          const y2 = nextBlock.y + 40;

          return (
            <g key={`arrow-${block.id}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={blockColors[block.type]}
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.4"
              />
              <polygon
                points={`${x2-10},${y2-6} ${x2},${y2} ${x2-10},${y2+6}`}
                fill={blockColors[block.type]}
                opacity="0.6"
              />
            </g>
          );
        })}
      </svg>

      {/* Renderiza blocos */}
      {plan.blocks.map((block, index) => {
        const Icon = blockIcons[block.type];
        const blockColor = blockColors[block.type] || '#c084fc';
        console.log(`[PlanCanvas] >>> RENDERIZANDO BLOCO ${index}:`, {
          id: block.id,
          type: block.type,
          label: block.label,
          x: block.x,
          y: block.y,
          color: blockColor
        });
        
        return (
          <div
            key={`block-${block.id}-${index}`}
            onMouseDown={(e) => {
              console.log('[PlanCanvas] onMouseDown no bloco:', block.id);
              handleMouseDown(e, block.id);
            }}
            onMouseEnter={() => console.log('[PlanCanvas] Mouse entrou no bloco:', block.id)}
            onContextMenu={e => {
              console.log('[PlanCanvas] onContextMenu no bloco:', block.id);
              e.preventDefault();
              e.stopPropagation();
              
              // Abre menu para adicionar após este bloco (exceto se for 'end')
              if (block.type !== 'end') {
                console.log('[PlanCanvas] Menu permitido após bloco:', block.id);
                setContextMenu({ x: e.clientX, y: e.clientY, afterBlockId: block.id });
              }
            }}
            onClick={e => {
              console.log('[PlanCanvas] onClick no bloco:', block.id, 'isDragging:', isDragging);
              e.stopPropagation();
              
              // Se não estava arrastando
              if (!isDragging) {
                // Se for bloco editável (não start/end), abre modal
                if (block.type !== 'start' && block.type !== 'end') {
                  // Notifica o pai que o bloco foi selecionado
                  if (onSelectBlock) {
                    onSelectBlock(block);
                  }
                  // Ainda abre o modal de edição de descrição
                  setEditingBlock({ 
                    blockId: block.id, 
                    label: block.label,
                    description: block.description,
                    startDate: block.startDate || new Date().toISOString().split('T')[0],
                    startTime: block.startTime || new Date().toTimeString().slice(0, 5),
                    deadline: block.deadline,
                    deadlineTime: block.deadlineTime || '23:59',
                    workFolder: block.workFolder,
                  });
                }
              }
            }}
            style={{
              position: 'absolute',
              left: `${block.x}px`,
              top: `${block.y}px`,
              width: '120px',
              minHeight: '80px',
              background: `linear-gradient(135deg, ${blockColor}40, ${blockColor}20)`,
              border: `2px solid ${blockColor}`,
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              cursor: draggingBlock?.blockId === block.id ? 'grabbing' : 'grab',
              transition: draggingBlock ? 'none' : 'all 0.2s',
              boxShadow: `0 4px 20px ${blockColor}30`,
              userSelect: 'none',
              zIndex: draggingBlock?.blockId === block.id ? 100 : 20,
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {Icon && <Icon size={14} color={blockColors[block.type]} />}
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: blockColors[block.type],
                  textTransform: 'uppercase',
                }}>
                  {block.label}
                </span>
              </div>
              {block.type !== 'start' && block.type !== 'end' && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteBlock(block.id);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={10} color="#ef4444" />
                </button>
              )}
            </div>
            {block.description && (
              <p style={{
                margin: 0,
                fontSize: '11px',
                color: '#aaa',
                lineHeight: '1.4',
              }}>
                {block.description}
              </p>
            )}
          </div>
        );
      })}
          </div>
          {/* Fim do container interno */}
        </div>
        {/* Fim do canvas */}
      </div>
      {/* Fim do wrapper principal */}

      {/* Context Menu - fora do canvas para não ser afetado pelo zoom */}
      {contextMenu ? (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'linear-gradient(135deg, #1a1a24, #12121c)',
            border: '1px solid rgba(124, 92, 252, 0.3)',
            borderRadius: '8px',
            padding: '8px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '150px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '6px 8px', fontSize: '11px', color: '#888', fontWeight: 600 }}>
            ADICIONAR BLOCO
          </div>
          {(['code', 'video', 'photo', 'paint', 'web'] as const).map(type => {
            const Icon = blockIcons[type];
            const labels = { code: 'Code', video: 'Video', photo: 'Design', paint: 'Paint', web: 'Web' };
            return (
              <button
                key={type}
                onClick={() => handleAddBlock(type, contextMenu.afterBlockId)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: blockColors[type],
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${blockColors[type]}20`}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon size={14} />
                {labels[type]}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Modal de Edição de Bloco */}
      {editingBlock && (
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
            zIndex: 3000,
          }}
          onClick={() => setEditingBlock(null)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a24, #12121c)',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              width: '500px',
              maxWidth: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#c084fc' }}>
              Editar Bloco
            </h3>
            
            {/* Nome do Bloco */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                NOME DO PROJETO
              </label>
              <input
                type="text"
                value={editingBlock.label || ''}
                onChange={e => setEditingBlock({ ...editingBlock, label: e.target.value })}
                placeholder="Ex: Desenvolver API"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                }}
              />
            </div>
            
            {/* Descrição */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                DESCRIÇÃO DA TAREFA
              </label>
              <textarea
                value={editingBlock.description}
                onChange={e => setEditingBlock({ ...editingBlock, description: e.target.value })}
                placeholder="Descreva o que será feito neste passo..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Datas e Horários */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {/* Data/Hora Atual */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  DATA ATUAL
                </label>
                <input
                  type="date"
                  value={editingBlock.startDate || new Date().toISOString().split('T')[0]}
                  onChange={e => setEditingBlock({ ...editingBlock, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  HORÁRIO INÍCIO
                </label>
                <input
                  type="time"
                  value={editingBlock.startTime || new Date().toTimeString().slice(0, 5)}
                  onChange={e => setEditingBlock({ ...editingBlock, startTime: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              {/* Data/Hora Entrega */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  PRAZO ENTREGA
                </label>
                <input
                  type="date"
                  value={editingBlock.deadline || ''}
                  onChange={e => setEditingBlock({ ...editingBlock, deadline: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  HORÁRIO ENTREGA
                </label>
                <input
                  type="time"
                  value={editingBlock.deadlineTime || '23:59'}
                  onChange={e => setEditingBlock({ ...editingBlock, deadlineTime: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  const block = plan.blocks.find(b => b.id === editingBlock.blockId);
                  if (block) {
                    handleUpdateBlock(editingBlock.blockId, editingBlock.description, {
                      label: editingBlock.label,
                      startDate: editingBlock.startDate,
                      startTime: editingBlock.startTime,
                      deadline: editingBlock.deadline,
                      deadlineTime: editingBlock.deadlineTime,
                      workFolder: editingBlock.workFolder,
                    });
                  }
                  setEditingBlock(null);
                }}
                style={{
                  flex: 1,
                  background: 'rgba(124, 92, 252, 0.2)',
                  border: '1px solid rgba(124, 92, 252, 0.3)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#c084fc',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingBlock(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
