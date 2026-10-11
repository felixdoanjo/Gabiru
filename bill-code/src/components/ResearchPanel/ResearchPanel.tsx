import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

interface ResearchNode {
  id: string;
  title: string;
  content: string;
  x: number;
  y: number;
  parentId: string | null;
  expanded: boolean;
  children?: ResearchNode[];
}

interface ResearchPanelProps {
  research: {
    id: string;
    query: string;
    content: string;
    timestamp: number;
    model: string;
    provider: string;
  };
  onClose: () => void;
}

export default function ResearchPanel({ research, onClose }: ResearchPanelProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<ResearchNode[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Processa o conteúdo da pesquisa e cria a estrutura de nós
  useEffect(() => {
    const processResearch = () => {
      console.log('[ResearchPanel] ========== PROCESSANDO ==========');
      console.log('[ResearchPanel] Query:', research.query);
      
      const rootNode: ResearchNode = {
        id: 'root',
        title: research.query,
        content: `Modelo: ${research.model}\nProvider: ${research.provider}\nData: ${new Date(research.timestamp).toLocaleString('pt-BR')}`,
        x: 500,
        y: 150,
        parentId: null,
        expanded: true,
        children: []
      };

      // Extrai todas as iterações
      const iterationSections = research.content.split(/### Iteração \d+:/);
      console.log('[ResearchPanel] Seções encontradas:', iterationSections.length);
      
      // Remove header (primeiro item)
      const iterations = iterationSections.slice(1);
      
      // Concatena todo o conteúdo das iterações
      let allText = '';
      const allLinks: string[] = [];
      
      iterations.forEach((section, idx) => {
        // Extrai links
        const urlRegex = /(https?:\/\/[^\s\)]+)/g;
        const linksInSection = section.match(urlRegex) || [];
        allLinks.push(...linksInSection);
        
        // Pega texto sem links e sem metadados chatos
        let cleanText = section
          .replace(urlRegex, '') // Remove URLs
          .replace(/\*\*Busca:\*\*/gi, '') // Remove "Busca:"
          .replace(/---\s*Fonte:/gi, '') // Remove "Fonte:"
          .replace(/---/g, '') // Remove separadores
          .replace(/carreira do messi/gi, '') // Remove queries repetidas
          .replace(/pesquise sobre/gi, '') // Remove queries
          .trim();
        
        allText += cleanText + '\n\n';
      });
      
      console.log('[ResearchPanel] Texto total:', allText.length, 'caracteres');
      console.log('[ResearchPanel] Links totais:', allLinks.length);
      
      // Remove duplicatas de links
      const uniqueLinks = Array.from(new Set(allLinks));
      console.log('[ResearchPanel] Links únicos:', uniqueLinks.length);
      
      // Divide o texto em frases completas (terminadas com . ! ou ?)
      const sentences = allText
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .filter(s => s.trim().length > 30)
        .map(s => s.trim());
      
      console.log('[ResearchPanel] ===== SENTENÇAS =====');
      console.log('[ResearchPanel] Total de sentenças:', sentences.length);
      sentences.forEach((s, i) => {
        console.log(`[${i}]:`, s.substring(0, 80) + '...');
      });
      
      const totalSentences = sentences.length;
      
      if (totalSentences === 0) {
        console.error('[ResearchPanel] ERRO: Nenhuma sentença encontrada!');
        setNodes([rootNode]);
        return;
      }
      
      // Divide em 3 blocos garantindo que não se repetem
      const sentencesPerTopic = Math.ceil(totalSentences / 3);
      
      console.log('[ResearchPanel] ===== DIVISÃO =====');
      console.log('[ResearchPanel] Sentenças por tópico:', sentencesPerTopic);
      
      const topicNodes: ResearchNode[] = [];
      const linkNodes: ResearchNode[] = [];
      
      // Divide as sentenças em 3 grupos distintos
      const topic1Sentences = sentences.slice(0, sentencesPerTopic);
      const topic2Sentences = sentences.slice(sentencesPerTopic, sentencesPerTopic * 2);
      const topic3Sentences = sentences.slice(sentencesPerTopic * 2);
      
      const topicGroups = [topic1Sentences, topic2Sentences, topic3Sentences];
      
      topicGroups.forEach((topicSentences, i) => {
        if (!topicSentences || topicSentences.length === 0) {
          console.warn(`[ResearchPanel] Grupo ${i + 1} vazio, pulando`);
          return;
        }
        
        console.log(`[ResearchPanel] --- TÓPICO ${i + 1} ---`);
        console.log(`[ResearchPanel] Sentenças:`, topicSentences.length);
        console.log(`[ResearchPanel] Primeira:`, topicSentences[0]?.substring(0, 80));
        console.log(`[ResearchPanel] Última:`, topicSentences[topicSentences.length - 1]?.substring(0, 80));
        
        // Junta APENAS as sentenças DESTE grupo
        const topicText = topicSentences.join(' ').trim();
        
        if (!topicText || topicText.length < 50) {
          console.warn(`[ResearchPanel] Tópico ${i + 1} muito curto, pulando`);
          return;
        }
        
        console.log(`[ResearchPanel] Tópico ${i + 1} comprimento:`, topicText.length, 'chars');
        
        // Extrai um título da primeira sentença
        const firstSentence = topicSentences[0] || `Tópico ${i + 1}`;
        const topicTitle = firstSentence.length > 70 
          ? firstSentence.substring(0, 70) + '...'
          : firstSentence;
        
        // Cria nó do tópico
        const topicNode: ResearchNode = {
          id: `topic-${i}`,
          title: topicTitle,
          content: topicText, // Conteúdo ÚNICO deste grupo
          x: 200 + i * 400,
          y: 350,
          parentId: 'root',
          expanded: false
        };
        
        topicNodes.push(topicNode);
        
        // Divide links igualmente entre os tópicos
        const linksPerTopic = Math.ceil(uniqueLinks.length / 3);
        const topicLinks = uniqueLinks.slice(i * linksPerTopic, (i + 1) * linksPerTopic);
        
        console.log(`[ResearchPanel] Links do tópico ${i + 1}:`, topicLinks.length);
        
        if (topicLinks.length > 0) {
          const linkNode: ResearchNode = {
            id: `links-${i}`,
            title: `Fontes (${topicLinks.length})`,
            content: topicLinks.join('\n'),
            x: 200 + i * 400,
            y: 550,
            parentId: `topic-${i}`,
            expanded: false
          };
          
          linkNodes.push(linkNode);
        }
      });
      
      console.log('[ResearchPanel] ===== RESULTADO =====');
      console.log('[ResearchPanel] Tópicos criados:', topicNodes.length);
      console.log('[ResearchPanel] Links criados:', linkNodes.length);
      console.log('[ResearchPanel] ========== FIM ==========');
      
      setNodes([rootNode, ...topicNodes, ...linkNodes]);
    };

    processResearch();
  }, [research]);

  // Fix preventDefault warning - usar wheel nativo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
    
    // Expande/colapsa o nó
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, expanded: !node.expanded } : node
    ));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0a0a0f',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
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
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Painel de Pesquisa
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {research.query}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            style={{
              padding: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom In"
          >
            <ZoomIn size={18} color="var(--text-secondary)" />
          </button>
          
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            style={{
              padding: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom Out"
          >
            <ZoomOut size={18} color="var(--text-secondary)" />
          </button>
          
          <button
            onClick={resetView}
            style={{
              padding: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Reset View"
          >
            <Maximize2 size={18} color="var(--text-secondary)" />
          </button>
          
          <div style={{
            padding: '8px 12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-light)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            minWidth: '80px',
            textAlign: 'center'
          }}>
            {Math.round(zoom * 100)}%
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Fechar"
          >
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: 'radial-gradient(circle at 50% 50%, #0f0f1a 0%, #0a0a0f 100%)'
        }}
      >
        {/* Container unificado com transform - tudo se move junto */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}>
          {/* SVG para linhas - dentro do mesmo container */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '5000px',
              height: '5000px',
              pointerEvents: 'none',
              overflow: 'visible'
            }}
          >
            <defs>
              <pattern
                id="grid"
                width={50}
                height={50}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M 50 0 L 0 0 0 50`}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            
            {/* Grid de fundo */}
            <rect 
              x={0} 
              y={0} 
              width={5000} 
              height={5000} 
              fill="url(#grid)" 
            />
            
            {/* Conexões entre nós */}
            {nodes.map(node => {
              if (!node.parentId) return null;
              const parent = nodes.find(n => n.id === node.parentId);
              if (!parent) return null;
              
              // Coordenadas simples - ajustadas para conexão mais natural
              const x1 = parent.x;
              const y1 = parent.y + 70; // saída mais abaixo do bloco pai
              const x2 = node.x;
              const y2 = node.y - 30; // entrada mais acima do bloco filho
              
              // Calcula curva mais suave
              const controlOffset = Math.abs(y2 - y1) * 0.6; // 60% da distância vertical
              const cy1 = y1 + controlOffset;
              const cy2 = y2 - controlOffset;
              
              return (
                <path
                  key={`conn-${node.id}`}
                  d={`M ${x1},${y1} C ${x1},${cy1} ${x2},${cy2} ${x2},${y2}`}
                  fill="none"
                  stroke={node.id.startsWith('links-') ? '#10b981' : '#f59e0b'}
                  strokeWidth={node.id.startsWith('links-') ? 2.5 : 3}
                  opacity={0.8}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Blocos - dentro do mesmo container */}
          {nodes.map(node => {
            const isRoot = node.id === 'root';
            const isSelected = selectedNode === node.id;
            
            return (
              <div
                key={node.id}
                onClick={(e) => {
                  // Não expande/colapsa quando clica em link
                  if ((e.target as HTMLElement).tagName !== 'A') {
                    handleNodeClick(node.id, e);
                  }
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  transform: 'translate(-50%, -50%)',
                  minWidth: isRoot ? '320px' : node.id.startsWith('links-') ? '240px' : '280px',
                  maxWidth: isRoot ? '420px' : node.id.startsWith('links-') ? '300px' : '350px',
                  padding: node.id.startsWith('links-') ? '16px' : '24px',
                  background: isRoot 
                    ? 'linear-gradient(135deg, #7c5cfc 0%, #9b7cfc 100%)'
                    : node.id.startsWith('links-')
                    ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                  border: isSelected ? '3px solid #fff' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  boxShadow: isSelected 
                    ? '0 0 40px rgba(124, 92, 252, 0.8), 0 8px 32px rgba(0,0,0,0.6)' 
                    : '0 8px 24px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  zIndex: isSelected ? 1000 : 1,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  if (!isDragging) {
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 0 50px rgba(124, 92, 252, 0.9), 0 12px 40px rgba(0,0,0,0.7)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                  e.currentTarget.style.boxShadow = isSelected 
                    ? '0 0 40px rgba(124, 92, 252, 0.8), 0 8px 32px rgba(0,0,0,0.6)' 
                    : '0 8px 24px rgba(0,0,0,0.5)';
                }}
              >
                <div style={{
                  fontSize: isRoot ? '20px' : node.id.startsWith('links-') ? '14px' : '16px',
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: '12px',
                  lineHeight: '1.3'
                }}>
                  {node.title}
                </div>
                
                {node.expanded && (
                  <div style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.95)',
                    lineHeight: '1.8',
                    maxHeight: '350px',
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}>
                    {/* Renderização especial para nós de links */}
                    {node.id.startsWith('links-') ? (
                      <>
                        {node.content.split('\n').map((url, idx) => {
                          const cleanUrl = url.trim();
                          if (!cleanUrl) return null;
                          
                          return (
                            <div key={idx} style={{ marginBottom: '10px' }}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('[ResearchPanel] Abrindo URL:', cleanUrl);
                                  // Abre no navegador do app - criar nova aba
                                  (window as any).electronAPI?.invoke?.('open-url-in-browser', cleanUrl);
                                }}
                                style={{
                                  color: '#60d5ff',
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  wordBreak: 'break-all',
                                  fontSize: '11px'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#90e5ff';
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#60d5ff';
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>🔗</span>
                                <span>{cleanUrl.length > 45 ? cleanUrl.substring(0, 45) + '...' : cleanUrl}</span>
                              </a>
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      /* Renderização para nós de texto (sem links) */
                      <>
                        {node.content.split('\n\n').map((para, idx) => {
                          const cleanPara = para.trim();
                          if (!cleanPara || cleanPara.length < 20) return null;
                          
                          return (
                            <p key={idx} style={{ 
                              margin: '0 0 14px 0',
                              textAlign: 'justify',
                              fontSize: '13px',
                              lineHeight: '1.7'
                            }}>
                              {cleanPara}
                            </p>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
                
                {!node.expanded && (
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.75)',
                    fontStyle: 'italic'
                  }}>
                    {node.id.startsWith('links-') 
                      ? 'Clique para ver os links'
                      : 'Clique para expandir e ler'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dica de uso */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(10px)'
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Navegação:</strong> Arraste para mover • Scroll para zoom • Clique nos nós para expandir
      </div>
    </div>
  );
}
