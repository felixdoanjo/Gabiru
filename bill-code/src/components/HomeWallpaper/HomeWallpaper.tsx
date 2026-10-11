import { useState, useRef, useEffect } from 'react';
import { Upload, Search, Sliders, X, Link, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface WallpaperProps {
  onClose?: () => void;
  onOpenProject?: (appType: 'photo' | 'video' | 'paint', projectId: string) => void;
}

interface WallpaperState {
  type: 'gradient' | 'image';
  imageUrl?: string;
  blur: number;
  brightness: number;
  saturate: number;
}

interface RecentProject {
  id: string;
  timestamp: number;
  thumbnail: string | null;
  appType: 'photo' | 'video' | 'paint';
}

interface ProjectsByType {
  photo: RecentProject[];
  video: RecentProject[];
  code: RecentProject[];
  paint: RecentProject[];
}

export default function HomeWallpaper({ onClose, onOpenProject }: WallpaperProps) {
  const [wallpaper, setWallpaper] = useState<WallpaperState>(() => {
    try {
      const saved = localStorage.getItem('bill-home-wallpaper');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao carregar wallpaper:', e);
    }
    return {
      type: 'image',
      imageUrl: './wallpaperdoapp.png',
      blur: 3,
      brightness: 100,
      saturate: 100,
    };
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showEffects, setShowEffects] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectsByType, setProjectsByType] = useState<ProjectsByType>({
    photo: [],
    video: [],
    code: [],
    paint: [],
  });
  const [expandedSection, setExpandedSection] = useState<'photo' | 'video' | 'paint' | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{ x: number; y: number; imageUrl: string } | null>(null);
  const webviewRef = useRef<any>(null);

  const handleDeleteProject = async (appType: 'photo' | 'video' | 'paint', projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await (window as any).electronAPI.deleteProject(appType, projectId);
    if (result.success) {
      setProjectsByType(prev => ({
        ...prev,
        [appType]: prev[appType].filter(p => p.id !== projectId)
      }));
    }
  };

  const handleApplyWallpaper = (imgUrl: string) => {
    console.log('Aplicando wallpaper:', imgUrl);
    
    if ((window as any).electronAPI?.fetchImageAsDataUrl) {
      (window as any).electronAPI.fetchImageAsDataUrl(imgUrl)
        .then((res: any) => {
          if (res.success && res.dataUrl) {
            console.log('Imagem baixada via Electron');
            setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: res.dataUrl }));
            setShowImageSearch(false);
            setImageContextMenu(null);
          } else {
            console.log('Falha ao baixar, usando URL direta');
            setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: imgUrl }));
            setShowImageSearch(false);
            setImageContextMenu(null);
          }
        })
        .catch(() => {
          console.log('Erro, usando URL direta');
          setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: imgUrl }));
          setShowImageSearch(false);
          setImageContextMenu(null);
        });
    } else {
      console.log('electronAPI não disponível, usando URL direta');
      setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: imgUrl }));
      setShowImageSearch(false);
      setImageContextMenu(null);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('bill-home-wallpaper', JSON.stringify(wallpaper));
    } catch (e) {
      console.error('Erro ao salvar wallpaper:', e);
    }
  }, [wallpaper]);

  useEffect(() => {
    const loadRecentProjects = async () => {
      try {
        const newProjectsByType: ProjectsByType = {
          photo: [],
          video: [],
          code: [],
          paint: [],
        };
        
        const appTypes: Array<'photo' | 'video' | 'paint'> = ['photo', 'video', 'paint'];
        
        for (const appType of appTypes) {
          const result = await (window as any).electronAPI.listRecentSaves(appType, 999);
          if (result.success && result.projects) {
            newProjectsByType[appType] = result.projects;
          }
        }
        
        setProjectsByType(newProjectsByType);
      } catch (e) {
        console.error('Erro ao carregar projetos recentes:', e);
      }
    };
    
    loadRecentProjects();
    const interval = setInterval(loadRecentProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setImageContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    setContextMenu(null);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setWallpaper(prev => ({ ...prev, type: 'image', imageUrl: urlInput.trim() }));
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  useEffect(() => {
    if (showImageSearch && webviewRef.current) {
      const webview = webviewRef.current;
      
      const injectClickListener = () => {
        const script = `(function() {
          if (window.__wallpaperInjected) return;
          window.__wallpaperInjected = true;
          
          // Remove menu de contexto padrão do navegador
          document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
          }, true);
          
          // Detecta clique direito em imagens
          document.addEventListener('contextmenu', function(e) {
            var el = e.target;
            for (var i = 0; i < 8; i++) {
              if (!el) break;
              if (el.tagName === 'IMG' && el.src && el.src.startsWith('http') && !el.src.includes('google.com') && el.naturalWidth > 50) {
                e.preventDefault();
                e.stopPropagation();
                // Envia URL com coordenadas via title
                document.title = '__WALLPAPER_IMG__' + el.src + '__X__' + e.clientX + '__Y__' + e.clientY;
                setTimeout(function(){ document.title = document.title.replace('__WALLPAPER_IMG__',''); }, 100);
                break;
              }
              el = el.parentElement;
            }
          }, true);
        })()`;
        webview.executeJavaScript(script).catch(() => {});
      };

      const handleLoad = () => {
        setTimeout(injectClickListener, 600);
      };

      const handleTitleUpdate = (e: any) => {
        const title: string = e.title || '';
        if (title.startsWith('__WALLPAPER_IMG__')) {
          const parts = title.replace('__WALLPAPER_IMG__', '').split('__X__');
          const imgUrl = parts[0];
          let x = window.innerWidth / 2;
          let y = window.innerHeight / 2;
          
          if (parts[1]) {
            const coords = parts[1].split('__Y__');
            const clickX = parseInt(coords[0]) || 0;
            const clickY = parseInt(coords[1]) || 0;
            
            console.log('Coordenadas recebidas da webview:', clickX, clickY);
            
            // Usa as coordenadas relativas à janela inteira
            // A webview já está em tela cheia, então usamos direto
            x = clickX;
            y = clickY;
          }
          
          if (imgUrl) {
            console.log('Abrindo menu em:', x, y);
            setImageContextMenu({ 
              x, 
              y, 
              imageUrl: imgUrl 
            });
          }
        }
      };

      webview.addEventListener('did-finish-load', handleLoad);
      webview.addEventListener('page-title-updated', handleTitleUpdate);
      
      setTimeout(injectClickListener, 100);

      return () => {
        webview.removeEventListener('did-finish-load', handleLoad);
        webview.removeEventListener('page-title-updated', handleTitleUpdate);
      };
    }
  }, [showImageSearch]);

  const backgroundStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    filter: `blur(${wallpaper.blur}px) brightness(${wallpaper.brightness}%) saturate(${wallpaper.saturate}%)`,
    ...(wallpaper.type === 'gradient'
      ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
      : {
          backgroundImage: `url(${wallpaper.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }),
  };

  const renderProjectCard = (project: RecentProject, appType: 'photo' | 'video' | 'paint', label: string, gradient: string) => (
    <div
      key={project.id}
      onClick={() => onOpenProject?.(appType, project.id)}
      style={{
        width: '160px',
        height: '120px',
        position: 'relative',
        background: project.thumbnail 
          ? `url(${project.thumbnail}) center/cover` 
          : gradient,
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.2)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
      }}
    >
      <button
        onClick={(e) => handleDeleteProject(appType, project.id, e)}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(0,0,0,0.7)',
          border: 'none',
          borderRadius: '6px',
          padding: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
        }}
      >
        <Trash2 size={14} color="white" />
      </button>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        padding: '20px 12px 12px',
        color: 'white',
        fontSize: '13px',
        fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  );

  const renderSection = (title: string, projects: RecentProject[], appType: 'photo' | 'video' | 'paint', gradient: string) => {
    const isExpanded = expandedSection === appType;
    const shouldShow = expandedSection === null || isExpanded;
    
    if (!shouldShow) return null;

    // Mostra apenas 3 se não estiver expandido, todos se expandido
    const displayProjects = isExpanded ? projects : projects.slice(0, 3);

    return (
      <div style={{ width: '100%', maxWidth: isExpanded ? '100%' : '560px', margin: '0 auto' }}>
        {/* Título e seta em cima */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 600, 
            opacity: 0.9, 
            color: 'white', 
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}>
            {title}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedSection(isExpanded ? null : appType);
            }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              pointerEvents: 'all',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
          >
            {isExpanded ? <ChevronUp size={16} color="white" /> : <ChevronDown size={16} color="white" />}
          </button>
        </div>

        {/* Grid de saves */}
        <div style={{ 
          display: isExpanded ? 'grid' : 'flex',
          gridTemplateColumns: isExpanded ? 'repeat(auto-fill, minmax(160px, 1fr))' : undefined,
          gap: '16px',
          justifyContent: isExpanded ? 'flex-start' : 'center',
        }}>
          {displayProjects.map(project => renderProjectCard(project, appType, title, gradient))}
          {!isExpanded && Array.from({ length: Math.max(0, 3 - displayProjects.length) }).map((_, i) => (
            <div key={`placeholder-${i}`} style={{ 
              width: '160px',
              height: '120px',
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '12px', 
              border: '2px dashed rgba(255,255,255,0.2)', 
            }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onContextMenu={handleContextMenu}
    >
      <div style={backgroundStyle} />

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.3)',
      }} />

      <div style={{
        position: 'absolute',
        top: '20px',
        left: 0,
        right: 0,
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: 'white',
        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '48px', fontWeight: 700, marginBottom: '8px' }}>
          {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 300, opacity: 0.9 }}>
          {getGreeting()}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: expandedSection ? '100%' : 'auto',
        maxHeight: expandedSection ? '100%' : 'calc(100% - 350px)',
        zIndex: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
      }}>
        {renderSection('Design', projectsByType.photo, 'photo', 'linear-gradient(135deg, rgba(124, 92, 252, 0.3), rgba(102, 126, 234, 0.3))')}
        {renderSection('Video', projectsByType.video, 'video', 'linear-gradient(135deg, rgba(251, 146, 60, 0.3), rgba(249, 115, 22, 0.3))')}
        {renderSection('Paint', projectsByType.paint, 'paint', 'linear-gradient(135deg, rgba(244, 114, 182, 0.3), rgba(236, 72, 153, 0.3))')}
        <div style={{ height: '40px' }} />
      </div>

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 9999,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setContextMenu(null); document.getElementById('wallpaper-upload')?.click(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Upload size={16} />
            Upload de imagem
          </button>
          <button
            onClick={() => { setContextMenu(null); setShowImageSearch(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Search size={16} />
            Pesquisar na internet
          </button>
          <button
            onClick={() => { setContextMenu(null); setShowUrlInput(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Link size={16} />
            Colar URL da imagem
          </button>
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
          <button
            onClick={() => { setContextMenu(null); setShowEffects(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Sliders size={16} />
            Efeitos
          </button>
        </div>
      )}

      <input
        id="wallpaper-upload"
        type="file"
        accept="image/*,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {showUrlInput && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            minWidth: '400px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>URL da Imagem</span>
            <button
              onClick={() => { setShowUrlInput(false); setUrlInput(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleUrlSubmit(); }}
            placeholder="Cole a URL da imagem aqui..."
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              marginBottom: '12px',
            }}
          />

          <button
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            style={{
              width: '100%',
              padding: '10px',
              background: urlInput.trim() ? '#667eea' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: '8px',
              color: urlInput.trim() ? 'white' : 'var(--text-dim)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Definir como papel de parede
          </button>
        </div>
      )}

      {showEffects && (
        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            zIndex: 10,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            minWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Efeitos</span>
            <button
              onClick={() => setShowEffects(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Desfoque: {wallpaper.blur}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={wallpaper.blur}
                onChange={e => setWallpaper(prev => ({ ...prev, blur: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Brilho: {wallpaper.brightness}%
              </label>
              <input
                type="range"
                min="50"
                max="150"
                value={wallpaper.brightness}
                onChange={e => setWallpaper(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Saturação: {wallpaper.saturate}%
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={wallpaper.saturate}
                onChange={e => setWallpaper(prev => ({ ...prev, saturate: Number(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <button
              onClick={() => setWallpaper(prev => ({ ...prev, blur: 3, brightness: 100, saturate: 100 }))}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              Resetar efeitos
            </button>
          </div>
        </div>
      )}

      {showImageSearch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Pesquisar imagens (clique direito em uma imagem para usar como wallpaper)
            </span>
            <button
              onClick={() => {
                setShowImageSearch(false);
                setImageContextMenu(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Menu de contexto customizado para imagens */}
          {imageContextMenu && (
            <div
              style={{
                position: 'fixed',
                left: imageContextMenu.x,
                top: imageContextMenu.y,
                zIndex: 10001,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '4px',
                minWidth: '200px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => handleApplyWallpaper(imageContextMenu.imageUrl)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Upload size={16} />
                Enviar pro wallpaper
              </button>
              <button
                onClick={() => setImageContextMenu(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={16} />
                Cancelar
              </button>
            </div>
          )}

          <webview
            ref={webviewRef}
            src="https://www.google.com/"
            style={{ flex: 1, width: '100%' } as any}
            partition="persist:bill-browser"
          />
        </div>
      )}
    </div>
  );
}
