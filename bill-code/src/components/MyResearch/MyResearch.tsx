import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Link as LinkIcon, Image as ImageIcon, Save } from 'lucide-react';

export interface SavedResearch {
  id: string;
  title: string;
  content: string; // Texto do artigo em markdown
  links: string[];
  images: string[]; // Base64 ou URLs
  timestamp: number;
}

interface MyResearchProps {
  onClose: () => void;
  onOpenUrl?: (url: string) => void; // Callback para abrir URL no navegador
}

export default function MyResearch({ onClose, onOpenUrl }: MyResearchProps) {
  const [researches, setResearches] = useState<SavedResearch[]>(() => {
    try {
      const saved = localStorage.getItem('billcode_my_researches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedResearch, setSelectedResearch] = useState<SavedResearch | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Menu de contexto para seleção de texto
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTranslator, setShowTranslator] = useState(false);
  const [translateText, setTranslateText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translateFrom, setTranslateFrom] = useState('en');
  const [translateTo, setTranslateTo] = useState('pt-br');
  const [isTranslating, setIsTranslating] = useState(false);

  // Fecha menu de contexto ao clicar fora
  useEffect(() => {
    if (!contextMenu) return;
    
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('research-context-menu');
      if (menu && menu.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('click', handler, true);
    
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('click', handler, true);
    };
  }, [contextMenu]);

  // Handler para capturar seleção de texto
  const handleTextSelection = (e: React.MouseEvent) => {
    if (e.button !== 2) return; // Só captura botão direito
    
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText) {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        text: selectedText
      });
    }
  };

  // Salva no localStorage
  const saveResearches = (updated: SavedResearch[]) => {
    setResearches(updated);
    localStorage.setItem('billcode_my_researches', JSON.stringify(updated));
  };

  const createNewResearch = () => {
    const newResearch: SavedResearch = {
      id: Date.now().toString(),
      title: 'Nova Pesquisa',
      content: '',
      links: [],
      images: [],
      timestamp: Date.now()
    };
    setSelectedResearch(newResearch);
    setEditTitle(newResearch.title);
    setEditContent(newResearch.content);
    setEditLinks([]);
    setEditImages([]);
    setIsEditing(true);
  };

  const saveCurrentResearch = () => {
    if (!selectedResearch) return;

    const updated = {
      ...selectedResearch,
      title: editTitle,
      content: editContent,
      links: editLinks,
      images: editImages,
      timestamp: Date.now()
    };

    const existingIndex = researches.findIndex(r => r.id === selectedResearch.id);
    let newList;
    if (existingIndex >= 0) {
      newList = [...researches];
      newList[existingIndex] = updated;
    } else {
      newList = [...researches, updated];
    }

    saveResearches(newList);
    setSelectedResearch(updated);
    setIsEditing(false);
  };

  const deleteResearch = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta pesquisa?')) {
      const updated = researches.filter(r => r.id !== id);
      saveResearches(updated);
      if (selectedResearch?.id === id) {
        setSelectedResearch(null);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setEditImages(prev => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        {/* Sidebar - Lista de pesquisas */}
        <div style={{
          width: '300px',
          background: 'var(--bg-primary)',
          borderRight: '2px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '2px solid var(--border-light)'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Minhas Pesquisas
            </h2>
            <button
              onClick={createNewResearch}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} />
              Nova Pesquisa
            </button>
          </div>

          {/* Lista */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px'
          }}>
            {researches.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '13px'
              }}>
                Nenhuma pesquisa salva ainda
              </div>
            ) : (
              researches.map(research => (
                <div
                  key={research.id}
                  onClick={() => {
                    setSelectedResearch(research);
                    setEditTitle(research.title);
                    setEditContent(research.content);
                    setEditLinks(research.links);
                    setEditImages(research.images);
                    setIsEditing(false);
                  }}
                  style={{
                    padding: '14px',
                    background: selectedResearch?.id === research.id ? 'var(--bg-secondary)' : 'transparent',
                    border: `2px solid ${selectedResearch?.id === research.id ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedResearch?.id !== research.id) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedResearch?.id !== research.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {research.title}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)'
                  }}>
                    {new Date(research.timestamp).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 30px',
            borderBottom: '2px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {selectedResearch ? (isEditing ? 'Editando' : 'Visualizando') : 'Selecione uma pesquisa'}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedResearch && (
                <>
                  {isEditing ? (
                    <button
                      onClick={saveCurrentResearch}
                      style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Save size={16} />
                      Salvar
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => deleteResearch(selectedResearch.id)}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Conteúdo */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px'
          }}>
            {!selectedResearch ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
                gap: '16px'
              }}>
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                  <path d="M9 7h6M9 11h6M9 15h3"/>
                </svg>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  Selecione uma pesquisa ao lado ou crie uma nova
                </div>
              </div>
            ) : isEditing ? (
              <>
                {/* Modo Edição */}
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  {/* Título */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Título
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Digite o título da pesquisa"
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                        fontWeight: '600'
                      }}
                    />
                  </div>

                  {/* Conteúdo */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Conteúdo do Artigo
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Escreva o conteúdo da sua pesquisa aqui... Você pode usar formatação markdown."
                      rows={15}
                      style={{
                        width: '100%',
                        padding: '16px',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        lineHeight: '1.8',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {/* Links */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Links Relacionados
                    </label>
                    {editLinks.map((link, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                          type="text"
                          value={link}
                          readOnly
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '13px'
                          }}
                        />
                        <button
                          onClick={() => setEditLinks(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            padding: '10px 14px',
                            background: '#ef4444',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder="Cole um link aqui"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newLink.trim()) {
                            setEditLinks(prev => [...prev, newLink.trim()]);
                            setNewLink('');
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newLink.trim()) {
                            setEditLinks(prev => [...prev, newLink.trim()]);
                            setNewLink('');
                          }
                        }}
                        style={{
                          padding: '10px 18px',
                          background: 'var(--accent)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          fontSize: '13px'
                        }}
                      >
                        <LinkIcon size={16} />
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* Imagens */}
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Imagens
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                      {editImages.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-light)' }}>
                          <img src={img} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                          <button
                            onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              padding: '6px',
                              background: '#ef4444',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--bg-primary)',
                        border: '2px dashed var(--border-light)',
                        borderRadius: '8px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      <ImageIcon size={18} />
                      Adicionar Imagens
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Modo Visualização */}
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                  <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    {selectedResearch.title}
                  </h1>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    {new Date(selectedResearch.timestamp).toLocaleString('pt-BR')}
                  </div>

                  {/* Conteúdo */}
                  <div 
                    onContextMenu={handleTextSelection}
                    style={{
                      fontSize: '15px',
                      lineHeight: '1.8',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '32px',
                      userSelect: 'text',
                      cursor: 'text'
                    }}
                  >
                    {selectedResearch.content}
                  </div>

                  {/* Links */}
                  {selectedResearch.links.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Links Relacionados
                      </h3>
                      {selectedResearch.links.map((link, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            if (onOpenUrl) {
                              onOpenUrl(link);
                              onClose(); // Fecha o painel após abrir o link
                            }
                          }}
                          style={{
                            display: 'block',
                            padding: '10px 14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '6px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            marginBottom: '8px',
                            fontSize: '13px',
                            wordBreak: 'break-all',
                            cursor: 'pointer',
                            transition: 'background 0.15s, border-color 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                            e.currentTarget.style.borderColor = 'var(--accent)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-primary)';
                            e.currentTarget.style.borderColor = 'var(--border-light)';
                          }}
                        >
                          {link}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Imagens */}
                  {selectedResearch.images.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Imagens
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {selectedResearch.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt=""
                            style={{
                              width: '100%',
                              height: '200px',
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
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Menu de contexto para texto selecionado */}
      {contextMenu && (
        <div
          id="research-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-secondary)',
            border: '2px solid var(--border-light)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 10001,
            minWidth: '150px',
            overflow: 'hidden'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(contextMenu.text);
              setContextMenu(null);
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
              setTranslateText(contextMenu.text);
              setTranslatedText('');
              setShowTranslator(true);
              setContextMenu(null);
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
            zIndex: 10002,
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
            {/* Header */}
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
            
            {/* Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Seletores de idioma */}
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

              {/* Área de texto original */}
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

              {/* Botão Traduzir */}
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

              {/* Área de tradução */}
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
