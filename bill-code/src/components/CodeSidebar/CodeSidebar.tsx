import { useState, useEffect, useRef } from 'react';
import { Files, Search, FolderOpen, Folder, FileCode, ChevronRight, ChevronDown, X, Lightbulb, Target, ImagePlus, Loader2, Palette } from 'lucide-react';
import { FileItem, SettingsType } from '../../App';
import './CodeSidebar.css';

interface CodeSidebarProps {
  files: FileItem[];
  workFolder: string;
  onFileClick: (filePath: string) => void;
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
  onToggleDesignPreview?: () => void;
  showDesignPreview?: boolean;
  selectedFile?: string | null;
  fileContent?: string;
  selectedHtmlElement?: any;
}

export default function CodeSidebar({
  files,
  workFolder,
  onFileClick,
  settings,
  onSettingsChange,
  onToggleDesignPreview,
  showDesignPreview,
  selectedFile,
  fileContent
}: CodeSidebarProps) {
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'design'>('search');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileItem[]>>(new Map());
  const [projects, setProjects] = useState<Array<{name: string, path: string, lastModified: number}>>([]);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);

  // Função para alternar expansão de pasta
  const toggleFolder = async (folderPath: string) => {
    const isCurrentlyExpanded = expandedFolders.has(folderPath);
    
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
    
    // Se está expandindo e ainda não carregou os arquivos dessa pasta
    if (!isCurrentlyExpanded && !folderContents.has(folderPath)) {
      console.log(`[toggleFolder] Carregando arquivos de: ${folderPath}`);
      try {
        const result = await (window as any).electronAPI.listDirectory(folderPath);
        console.log(`[toggleFolder] Resultado completo:`, result);
        
        if (result.success && result.items) {
          console.log(`[toggleFolder] Carregados ${result.items.length} itens de ${folderPath}`);
          setFolderContents(prev => {
            const newMap = new Map(prev);
            newMap.set(folderPath, result.items);
            return newMap;
          });
        } else {
          console.error(`[toggleFolder] Falhou - success: ${result.success}, error: ${result.error}`);
        }
      } catch (err) {
        console.error(`[toggleFolder] Exception ao carregar pasta ${folderPath}:`, err);
      }
    }
  };

  // Função para renderizar árvore de arquivos recursivamente
  const renderFileTree = (items: FileItem[], parentPath: string = '', level: number = 0) => {
    // Para o nível 0, usa os items passados (arquivos da raiz)
    // Para níveis maiores, busca do folderContents
    const itemsToRender = level === 0 ? items : (folderContents.get(parentPath) || []);
    
    console.log(`[renderFileTree] level=${level}, parentPath="${parentPath}", items=${itemsToRender.length}`);

    return itemsToRender.map((file) => {
      const isExpanded = expandedFolders.has(file.path);
      const paddingLeft = 22 + (level * 16);

      return (
        <div key={file.path}>
          <div
            onClick={() => {
              if (file.isDirectory) {
                toggleFolder(file.path);
              } else {
                onFileClick(file.path);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 8px',
              fontSize: '11px',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '1px',
              borderRadius: '3px',
              gap: '6px',
              position: 'relative',
              marginLeft: '-14px',
              paddingLeft: `${paddingLeft}px`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Linha horizontal conectando */}
            {level > 0 && (
              <div style={{
                position: 'absolute',
                left: `${(level - 1) * 16 + 8}px`,
                top: '50%',
                width: '14px',
                height: '2px',
                background: 'var(--accent)',
                opacity: 0.6
              }} />
            )}

            {file.isDirectory ? (
              <>
                {isExpanded ?
                  <ChevronDown size={12} style={{ opacity: 0.5, color: 'var(--accent)' }} /> :
                  <ChevronRight size={12} style={{ opacity: 0.5, color: 'var(--accent)' }} />
                }
                <Folder size={14} style={{ flexShrink: 0, color: 'var(--accent)', opacity: 0.7 }} />
              </>
            ) : (
              <FileCode size={14} style={{ flexShrink: 0, color: 'var(--accent)', marginLeft: level === 0 ? '12px' : '0' }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
          </div>

          {/* Renderiza filhos se a pasta estiver expandida */}
          {file.isDirectory && isExpanded && (
            <div>{renderFileTree(items, file.path, level + 1)}</div>
          )}
        </div>
      );
    });
  };
  const [newProjectName, setNewProjectName] = useState('');
  const [projectPlatform, setProjectPlatform] = useState<'web-universal' | 'desktop-web' | 'desktop-app' | 'android' | 'ios' | null>(null);
  const [projectReferenceUrl, setProjectReferenceUrl] = useState('');
  const [projectReferenceFidelity, setProjectReferenceFidelity] = useState<'inspiration' | 'exact'>('inspiration');
  const [projectReferenceImage, setProjectReferenceImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectExpanded, setProjectExpanded] = useState(false);
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const scrapeWebviewRef = useRef<HTMLWebViewElement | null>(null);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    loadProjects();
  }, [activeTab]);

  const loadProjects = async () => {
    console.log('[CodeSidebar] Carregando projetos...');
    try {
      const result = await (window as any).electronAPI.listInternalProjects();
      console.log('[CodeSidebar] Projetos carregados:', result);
      if (result.success && result.projects) {
        // Força re-render criando um novo array
        setProjects([...result.projects]);
        console.log('[CodeSidebar] State atualizado com', result.projects.length, 'projetos');
      }
    } catch (err) {
      console.error('[CodeSidebar] Erro ao carregar projetos:', err);
    }
  };

  const handleCreateProject = async () => {
    setShowCreateProjectDialog(true);
  };
  
  const handleConfirmCreateProject = async () => {
    const projectName = newProjectName.trim();
    if (!projectName || !projectPlatform) {
      alert('Preencha o nome e selecione a plataforma');
      return;
    }
    
    try {
      // Pede ao usuário para escolher onde criar o projeto
      const folderResult = await (window as any).electronAPI.selectFolder();
      if (!folderResult.success || !folderResult.path) {
        // Usuário cancelou a seleção
        return;
      }
      
      const selectedFolder = folderResult.path;
      
      let scrapedData = null;
      if (projectReferenceUrl) {
        scrapedData = await scrapeWebsite(projectReferenceUrl);
      }
      
      // Cria o projeto na pasta selecionada
      const result = await (window as any).electronAPI.createInternalProject(projectName, selectedFolder);
      if (result.success) {
        const projectMetadata = {
          name: projectName,
          platform: projectPlatform,
          referenceUrl: projectReferenceUrl || null,
          referenceFidelity: projectReferenceFidelity,
          referenceImage: projectReferenceImage || null,
          scrapedData: scrapedData,
          createdAt: Date.now()
        };
        
        await (window as any).electronAPI.writeFile(
          `${result.path}\\.project-meta.json`,
          JSON.stringify(projectMetadata, null, 2)
        );
        
        await loadProjects();
        onSettingsChange({ ...settings, workFolder: result.path });
      } else {
        alert(`Erro ao criar projeto: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setShowCreateProjectDialog(false);
      setNewProjectName('');
      setProjectPlatform(null);
      setProjectReferenceUrl('');
      setProjectReferenceFidelity('inspiration');
      setProjectReferenceImage(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProjectReferenceImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const scrapeWebsite = async (url: string): Promise<any> => {
    return new Promise((resolve) => {
      setIsScrapingUrl(true);
      const webview = document.createElement('webview') as any;
      webview.src = url;
      webview.style.position = 'fixed';
      webview.style.top = '-9999px';
      webview.style.width = '1920px';
      webview.style.height = '1080px';
      webview.nodeintegration = false;
      webview.webpreferences = 'contextIsolation=yes';
      document.body.appendChild(webview);
      scrapeWebviewRef.current = webview;
      const timeout = setTimeout(() => { cleanup(); resolve(null); }, 15000);
      const cleanup = () => {
        clearTimeout(timeout);
        if (scrapeWebviewRef.current) {
          document.body.removeChild(scrapeWebviewRef.current);
          scrapeWebviewRef.current = null;
        }
        setIsScrapingUrl(false);
      };
      webview.addEventListener('did-finish-load', async () => {
        try {
          const extractScript = `(function(){try{const result={title:document.title,colors:[],fonts:[],html:'',css:''};const allElements=document.querySelectorAll('*');const colorSet=new Set();allElements.forEach(el=>{const computed=window.getComputedStyle(el);[computed.backgroundColor,computed.color,computed.borderColor].forEach(color=>{if(color&&color!=='rgba(0, 0, 0, 0)'&&color!=='transparent')colorSet.add(color);});});result.colors=Array.from(colorSet).slice(0,20);const fontSet=new Set();allElements.forEach(el=>{const font=window.getComputedStyle(el).fontFamily;if(font)fontSet.add(font);});result.fonts=Array.from(fontSet).slice(0,10);const bodyClone=document.body.cloneNode(true);bodyClone.querySelectorAll('script, style, noscript, iframe').forEach(el=>el.remove());result.html=bodyClone.innerHTML.slice(0,500000);const styles=[];document.querySelectorAll('style').forEach(styleEl=>{if(styleEl.textContent)styles.push(styleEl.textContent.slice(0,50000));});result.css=styles.join('\\n').slice(0,200000);return result;}catch(e){return{error:e.message};}})()`;
          const scrapedData = await webview.executeJavaScript(extractScript);
          cleanup();
          resolve(scrapedData);
        } catch (err) {
          cleanup();
          resolve(null);
        }
      });
      webview.addEventListener('did-fail-load', () => { cleanup(); resolve(null); });
    });
  };

  const handleOpenProject = async (projectPath: string) => {
    onSettingsChange({ ...settings, workFolder: projectPath });
    setProjectExpanded(true);
  };

  const handleDeleteProject = async (projectName: string, projectPath: string) => {
    console.log('[CodeSidebar] ========================================');
    console.log('[CodeSidebar] handleDeleteProject CHAMADO!');
    console.log('[CodeSidebar] Nome:', projectName);
    console.log('[CodeSidebar] Path:', projectPath);
    console.log('[CodeSidebar] ========================================');
    
    try {
      const result = await (window as any).electronAPI.deleteInternalProject(projectPath);
      console.log('[CodeSidebar] Resultado da deleção:', result);
      
      if (result.success) {
        console.log('[CodeSidebar] Projeto deletado com sucesso, recarregando lista...');
        await loadProjects();
        console.log('[CodeSidebar] Lista recarregada');
        
        if (workFolder === projectPath) {
          console.log('[CodeSidebar] Limpando workFolder pois era o projeto ativo');
          onSettingsChange({ ...settings, workFolder: '' });
        }
      } else {
        console.error('[CodeSidebar] Erro ao deletar:', result.error);
        alert(`Erro ao excluir projeto: ${result.error}`);
      }
    } catch (err: any) {
      console.error('[CodeSidebar] Exceção ao deletar:', err);
      alert(`Erro: ${err.message}`);
    }
  };

  const handleSelectExternalFolder = async () => {
    const result = await (window as any).electronAPI.selectFolder();
    if (result.success && result.path) {
      onSettingsChange({ ...settings, workFolder: result.path });
    }
  };

  return (
    <div className="code-sidebar" style={{ position: 'relative' }}>
      <div className="activity-bar">
        <button
          className={`activity-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
          title="Explorador"
        >
          <Files size={24} strokeWidth={1.5} />
        </button>
        <button
          className={`activity-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
          title="Pesquisar"
        >
          <Search size={24} strokeWidth={1.5} />
        </button>
        {onToggleDesignPreview && (
          <button
            className={`activity-btn ${activeTab === 'design' ? 'active' : ''}`}
            onClick={async () => {
              setActiveTab('design');
              
              // Busca automaticamente o index.html do projeto se houver workFolder
              if (workFolder && (!selectedFile || !selectedFile.endsWith('.html'))) {
                console.log('[CodeSidebar] Buscando index.html automaticamente...');
                try {
                  // Tenta encontrar index.html recursivamente
                  const result = await (window as any).electronAPI.listRecursive(workFolder);
                  if (result.success && result.files) {
                    const indexHtml = result.files.find((f: FileItem) => 
                      f.name.toLowerCase() === 'index.html' && !f.isDirectory
                    );
                    
                    if (indexHtml) {
                      console.log('[CodeSidebar] index.html encontrado:', indexHtml.path);
                      onFileClick(indexHtml.path);
                    } else {
                      console.log('[CodeSidebar] index.html não encontrado no projeto');
                    }
                  }
                } catch (err) {
                  console.error('[CodeSidebar] Erro ao buscar index.html:', err);
                }
              }
              
              onToggleDesignPreview();
            }}
            title="Design Preview"
          >
            <Palette size={24} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="side-panel">
        {activeTab === 'explorer' && (
          <div className="explorer-panel">
            <div className="panel-header">NOVO PROJETO</div>
            
            {/* Criar Novo Projeto */}
            <div style={{ padding: '10px' }}>
              {!showCreateProjectDialog ? (
                <button 
                  className="action-btn" 
                  onClick={handleCreateProject}
                  style={{ width: '100%', marginBottom: '8px', fontSize: '11px', padding: '6px 8px' }}
                >
                  <FolderOpen size={12} style={{ marginRight: 4 }} /> Criar Projeto
                </button>
              ) : (
                <div style={{ marginBottom: '8px', padding: '12px', background: 'var(--editor-background)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  {/* Nome do projeto */}
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Nome do projeto"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '11px',
                      background: 'var(--sidebar-background)',
                      border: '1px solid var(--accent)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                      outline: 'none'
                    }}
                  />
                  
                  {/* Plataforma */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>PLATAFORMA</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {[
                        { id: 'web-universal', label: 'Web Universal' },
                        { id: 'desktop-web', label: 'Desktop Web' },
                        { id: 'desktop-app', label: 'Desktop App' },
                        { id: 'android', label: 'Android App' },
                        { id: 'ios', label: 'iOS App' }
                      ].map(platform => (
                        <button
                          key={platform.id}
                          onClick={() => setProjectPlatform(platform.id as any)}
                          style={{
                            padding: '8px 6px',
                            fontSize: '10px',
                            background: projectPlatform === platform.id ? 'var(--accent)' : 'var(--sidebar-background)',
                            border: `1px solid ${projectPlatform === platform.id ? 'var(--accent)' : 'var(--border-light)'}`,
                            borderRadius: '4px',
                            color: projectPlatform === platform.id ? 'white' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: projectPlatform === platform.id ? 600 : 400,
                            transition: 'all 0.2s'
                          }}
                        >
                          {platform.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Link de referência */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>LINK DE REFERÊNCIA (OPCIONAL)</div>
                    <input
                      type="text"
                      value={projectReferenceUrl}
                      onChange={(e) => setProjectReferenceUrl(e.target.value)}
                      placeholder="https://exemplo.com"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '10px',
                        background: 'var(--sidebar-background)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    
                    {/* Nível de fidelidade - só aparece se tiver URL */}
                    {projectReferenceUrl && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setProjectReferenceFidelity('inspiration')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '9px',
                            background: projectReferenceFidelity === 'inspiration' ? 'var(--accent)' : 'var(--sidebar-background)',
                            border: `1px solid ${projectReferenceFidelity === 'inspiration' ? 'var(--accent)' : 'var(--border-light)'}`,
                            borderRadius: '4px',
                            color: projectReferenceFidelity === 'inspiration' ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: projectReferenceFidelity === 'inspiration' ? 600 : 400,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Lightbulb size={12} /> Inspiração
                        </button>
                        <button
                          onClick={() => setProjectReferenceFidelity('exact')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '9px',
                            background: projectReferenceFidelity === 'exact' ? 'var(--accent)' : 'var(--sidebar-background)',
                            border: `1px solid ${projectReferenceFidelity === 'exact' ? 'var(--accent)' : 'var(--border-light)'}`,
                            borderRadius: '4px',
                            color: projectReferenceFidelity === 'exact' ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: projectReferenceFidelity === 'exact' ? 600 : 400,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Target size={12} /> Cópia Fiel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Imagem de referência */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>IMAGEM DE REFERÊNCIA (OPCIONAL)</div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px',
                      background: 'var(--sidebar-background)',
                      border: `2px dashed ${projectReferenceImage ? 'var(--accent)' : 'var(--border-light)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: projectReferenceImage ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}>
                      <ImagePlus size={14} />
                      {projectReferenceImage ? 'Imagem selecionada' : 'Clique para escolher imagem'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  
                  {/* Botões */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setShowCreateProjectDialog(false);
                        setNewProjectName('');
                        setProjectPlatform(null);
                        setProjectReferenceUrl('');
                        setProjectReferenceFidelity('inspiration');
                        setProjectReferenceImage(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '10px',
                        background: 'transparent',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmCreateProject}
                      disabled={!newProjectName.trim() || !projectPlatform || isScrapingUrl}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '10px',
                        background: (newProjectName.trim() && projectPlatform && !isScrapingUrl) ? 'var(--accent)' : '#555',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: (newProjectName.trim() && projectPlatform && !isScrapingUrl) ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      {isScrapingUrl ? (
                        <>
                          <Loader2 size={12} className="spin-animation" />
                          Analisando site...
                        </>
                      ) : (
                        'Criar Projeto'
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Abrir Pasta Externa */}
              <button 
                className="action-btn" 
                onClick={handleSelectExternalFolder}
                style={{ width: '100%', fontSize: '11px', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderColor: 'var(--border-light)' }}
              >
                <FolderOpen size={12} style={{ marginRight: 4 }} /> Abrir Pasta do PC
              </button>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="search-panel">
            <div className="panel-header">MEUS PROJETOS</div>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Pesquisar projetos..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            {/* Lista de TODOS os Projetos como blocos separados */}
            <div className="search-results" style={{ padding: '10px' }}>
              {filteredProjects.length === 0 && (
                <p className="empty-message">Nenhum projeto encontrado</p>
              )}
              
              {/* Se não tem projeto ativo, mostra todos */}
              {!workFolder && filteredProjects.map((project) => (
                <div
                  key={project.path}
                  onClick={() => handleOpenProject(project.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    fontSize: '11px',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderRadius: '6px',
                    gap: '8px',
                    border: '1px solid transparent',
                    marginBottom: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <Folder size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span 
                    style={{ 
                      flex: 1, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      fontWeight: 500,
                      color: 'var(--text-primary)'
                    }}
                    title={project.name}
                  >
                    {project.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.name, project.path);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      opacity: 0.6,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '3px',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    title="Excluir projeto"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {/* Se tem projeto ativo, mostra só ele expandido */}
              {workFolder && filteredProjects.map((project) => {
                const isActive = workFolder === project.path;
                
                // Só renderiza o projeto ativo
                if (!isActive) return null;
                
                return (
                  <div key={project.path} style={{ marginBottom: '4px' }}>
                    {/* Header do Projeto Ativo */}
                    <div
                      onClick={() => setProjectExpanded(!projectExpanded)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        fontSize: '11px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderRadius: '6px',
                        gap: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {projectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <Folder size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span 
                        style={{ 
                          flex: 1, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap', 
                          fontWeight: 600,
                          color: 'var(--accent)'
                        }}
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSettingsChange({ ...settings, workFolder: '' });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          opacity: 0.6,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '3px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.6';
                        }}
                        title="Voltar para lista de projetos"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    {/* Arquivos do Projeto */}
                    {projectExpanded && (
                      <div style={{ paddingLeft: '14px', borderLeft: '2px solid var(--accent)', marginLeft: '16px', marginTop: '6px', opacity: 0.8 }}>
                        {files.length === 0 && (
                          <p className="empty-message" style={{ fontSize: '10px', padding: '8px 0' }}>Nenhum arquivo</p>
                        )}
                        
                        {renderFileTree(files, workFolder, 0)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'design' && (
          <div className="design-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div id="design-sidebar-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div id="design-sidebar-placeholder" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <Palette size={48} style={{ color: 'var(--accent)', marginBottom: '16px', opacity: 0.5 }} />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
                  Preview HTML ativo.<br/>
                  Clique em um elemento no preview para editá-lo aqui.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
