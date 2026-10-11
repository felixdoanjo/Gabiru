import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Newspaper, RefreshCw, ExternalLink, Clock, Maximize, Minimize, Settings, Plus, Trash2, X, Edit2, Star } from 'lucide-react';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  time: string;
  description?: string;
  imageUrl?: string;
}

interface CustomFeed {
  id: string;
  label: string;
  urls: string[];
}

interface HomeNewsProps {
  onOpenUrl: (url: string) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onBack?: () => void; // Callback para voltar ao menu
}

const NEWS_FEEDS = [
  { 
    label: 'Geral', 
    urls: [
      'https://g1.globo.com/rss/g1/',
      'https://rss.uol.com.br/feed/noticias.xml',
      'https://www1.folha.uol.com.br/rss/ultimasnoticias.xml',
      'https://www.cnnbrasil.com.br/feed/',
      'https://feeds.bbci.co.uk/portuguese/rss.xml'
    ]
  },
  { 
    label: 'Tech', 
    urls: [
      'https://g1.globo.com/rss/g1/tecnologia/',
      'https://www1.folha.uol.com.br/tec/rss.xml',
      'https://olhardigital.com.br/feed/'
    ]
  },
  { 
    label: 'Esporte', 
    urls: [
      'https://ge.globo.com/rss/ge/',
      'https://www.espn.com.br/espn/rss/news',
      'https://www.lance.com.br/feed'
    ]
  },
];

function timeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  } catch { return ''; }
}

export default function HomeNews({ onOpenUrl, isFullScreen, onToggleFullScreen, onBack }: HomeNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CustomFeed | null>(null);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [defaultFeedId, setDefaultFeedId] = useState<string>(''); // ID do feed padrão
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Carrega fontes customizadas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('custom-news-feeds');
    if (saved) {
      try {
        setCustomFeeds(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar fontes customizadas:', e);
      }
    }
    
    // Carrega feed padrão
    const savedDefault = localStorage.getItem('default-news-feed-id');
    if (savedDefault) {
      setDefaultFeedId(savedDefault);
    }
  }, []);

  // Salva fontes customizadas no localStorage
  const saveCustomFeeds = (feeds: CustomFeed[]) => {
    setCustomFeeds(feeds);
    localStorage.setItem('custom-news-feeds', JSON.stringify(feeds));
  };
  
  // Define feed padrão
  const setAsDefault = (feedId: string) => {
    setDefaultFeedId(feedId);
    localStorage.setItem('default-news-feed-id', feedId);
    
    // Encontra o índice do feed e muda para essa aba
    const allFeeds = [...NEWS_FEEDS, ...customFeeds];
    const index = allFeeds.findIndex(f => 'id' in f && f.id === feedId);
    if (index !== -1) {
      handleTabChange(index);
    }
  };

  const fetchNews = useCallback(async (tabIndex = activeTab) => {
    setLoading(true);
    setError('');
    try {
      // Combina feeds padrão com customizados
      const allFeeds = [...NEWS_FEEDS, ...customFeeds];
      const feed = allFeeds[tabIndex];
      
      if (!feed) {
        setNews([]);
        return;
      }
      
      const allNews: NewsItem[] = [];
      
      // Busca de TODOS os URLs da categoria
      for (const feedUrl of feed.urls) {
        try {
          console.log(`[HomeNews] Buscando feed: ${feedUrl}`);
          // Usa IPC do Electron para buscar RSS sem CORS
          const api = (window as any).electronAPI;
          let xml = '';
          if (api?.fetchRss) {
            const res = await api.fetchRss(feedUrl);
            console.log(`[HomeNews] Resposta fetchRss:`, res.success ? 'Sucesso' : `Erro: ${res.error}`);
            if (res.success) xml = res.content;
            else throw new Error(res.error);
          } else {
            console.log(`[HomeNews] electronAPI não disponível, usando fetch direto`);
            // Fallback browser fetch
            const res = await fetch(feedUrl);
            xml = await res.text();
          }

          // Parse RSS XML
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'text/xml');
          
          // Verifica se é RSS válido
          const items = Array.from(doc.querySelectorAll('item, entry')); // Suporta RSS e Atom
          
          if (items.length === 0) {
            console.warn(`[HomeNews] ${feedUrl} não contém itens RSS/Atom válidos`);
            console.log(`[HomeNews] Primeiros 500 caracteres do conteúdo:`, xml.substring(0, 500));
            continue;
          }
          
          const parsed: NewsItem[] = items.slice(0, 15).map(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = item.querySelector('link')?.textContent || item.querySelector('link')?.getAttribute('href') || '';
            const pubDate = item.querySelector('pubDate')?.textContent || item.querySelector('published')?.textContent || item.querySelector('updated')?.textContent || '';
            
            // Usando XMLSerializer para evitar problemas de namespace e CDATA com o DOMParser
            const itemXml = new XMLSerializer().serializeToString(item);
            
            const descRaw = item.querySelector('description')?.textContent || '';
            
            let imageUrl = undefined;
            // Tenta múltiplos formatos de imagem RSS
            // 1. <media:content url="...">
            let match = itemXml.match(/(?:<media:content|<content)[^>]+url="([^">]+)"/i);
            if (match) imageUrl = match[1];
            
            // 2. <enclosure url="..." type="image/...">
            if (!imageUrl) {
              match = itemXml.match(/<enclosure[^>]+type="image[^"]*"[^>]+url="([^">]+)"/i);
              if (!match) match = itemXml.match(/<enclosure[^>]+url="([^">]+)"[^>]+type="image/i);
              if (match) imageUrl = match[1];
            }
            
            // 3. <media:thumbnail url="...">
            if (!imageUrl) {
              match = itemXml.match(/<media:thumbnail[^>]+url="([^">]+)"/i);
              if (match) imageUrl = match[1];
            }
            
            // 4. <img src="..."> dentro de description
            if (!imageUrl) {
              match = itemXml.match(/<img[^>]+src="([^">]+)"/i);
              if (match) imageUrl = match[1];
            }
            
            // 5. URL de imagem solta no description
            if (!imageUrl) {
              match = descRaw.match(/(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp))/i);
              if (match) imageUrl = match[1];
            }
            
            const desc = descRaw.replace(/<[^>]+>/g, '').trim().slice(0, 120) || '';
            
            let source = item.querySelector('source')?.textContent || '';
            if (!source && link) {
              try { source = new URL(link).hostname.replace('www.', '').replace('.com.br', '').replace('.com', '').toUpperCase(); } catch(e){}
            }
            
            return {
              title: title.trim(),
              url: link,
              source: source || 'Notícias',
              time: timeAgo(pubDate),
              description: desc,
              imageUrl,
            };
          });
          
          console.log(`[HomeNews] ${feedUrl} → ${parsed.length} notícias`);
          allNews.push(...parsed);
        } catch (err) {
          console.warn(`Erro ao buscar feed ${feedUrl}:`, err);
          // Continua com os outros feeds mesmo se um falhar
        }
      }
      
      // Ordena por tempo (mais recentes primeiro) e limita a 40 notícias
      allNews.sort((a, b) => {
        const timeA = a.time.includes('min') ? parseInt(a.time) : a.time.includes('h') ? parseInt(a.time) * 60 : 9999;
        const timeB = b.time.includes('min') ? parseInt(b.time) : b.time.includes('h') ? parseInt(b.time) * 60 : 9999;
        return timeA - timeB;
      });
      
      console.log(`[HomeNews] Total de notícias carregadas: ${allNews.length}`);
      setNews(allNews.slice(0, 40));
    } catch (err: any) {
      console.error('Erro ao buscar notícias:', err);
      setError(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [activeTab, customFeeds]);

  useEffect(() => {
    // Só roda uma vez após customFeeds e defaultFeedId estarem carregados
    if (initialLoadDone) return;
    
    // Aguarda o primeiro render para garantir que os dados do localStorage foram carregados
    const timer = setTimeout(() => {
      // Carrega o feed padrão se definido
      if (defaultFeedId) {
        const allFeeds = [...NEWS_FEEDS, ...customFeeds];
        const index = allFeeds.findIndex(f => 'id' in f && f.id === defaultFeedId);
        console.log(`[HomeNews] Buscando feed padrão: ${defaultFeedId}, índice: ${index}`);
        if (index !== -1) {
          setActiveTab(index);
          fetchNews(index);
          setInitialLoadDone(true);
          return;
        }
      }
      // Senão, carrega o primeiro
      console.log('[HomeNews] Carregando feed padrão (Geral)');
      fetchNews(0);
      setInitialLoadDone(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [customFeeds, defaultFeedId]);

  const handleTabChange = (i: number) => {
    setActiveTab(i);
    fetchNews(i);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-light)', width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Newspaper size={16} color="var(--accent)" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Notícias</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setShowSettings(true)} title="Configurar Fontes"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
              <Settings size={14} />
            </button>
            {onBack ? (
              <button onClick={onBack} title="Voltar ao Menu"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                <X size={14} />
              </button>
            ) : onToggleFullScreen && (
              <button onClick={onToggleFullScreen} title={isFullScreen ? "Minimizar" : "Tela Cheia"}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            )}
            <button onClick={() => fetchNews(activeTab)} disabled={loading} title="Recarregar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: '2px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
              <RefreshCw size={14} style={{ animation: loading ? 'lucide-spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[...NEWS_FEEDS, ...customFeeds].map((f, i) => (
            <button key={f.label} onClick={() => handleTabChange(i)}
              style={{
                background: activeTab === i ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none', borderRadius: '4px', color: activeTab === i ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '10px', padding: '3px 8px', fontWeight: activeTab === i ? 600 : 400,
                transition: 'all 0.15s',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* News List */}
      <div style={{ 
        flex: 1, overflowY: 'auto', padding: '12px', 
        display: isFullScreen ? 'grid' : 'flex', 
        flexDirection: isFullScreen ? 'unset' : 'column',
        gridTemplateColumns: isFullScreen ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'none',
        gap: '12px',
        alignContent: 'start'
      }}>
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
            Carregando...
          </div>
        )}
        {error && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--error)', fontSize: '11px' }}>
            {error}
          </div>
        )}
        {!loading && !error && news.map((item, i) => (
          <div key={i}
            onClick={() => onOpenUrl(item.url)}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: item.imageUrl ? 'none' : '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
              backgroundImage: item.imageUrl ? `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%), url(${item.imageUrl})` : 'none',
              backgroundColor: item.imageUrl ? 'transparent' : 'var(--bg-tertiary)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              minHeight: item.imageUrl ? (isFullScreen ? '220px' : '130px') : 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={e => {
               if (item.imageUrl) {
                 e.currentTarget.style.backgroundImage = `linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%), url(${item.imageUrl})`;
               } else {
                 e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
               }
               e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
               if (item.imageUrl) {
                 e.currentTarget.style.backgroundImage = `linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%), url(${item.imageUrl})`;
               } else {
                 e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
               }
               e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: item.imageUrl ? '#fff' : 'var(--text-primary)', lineHeight: 1.4, marginBottom: '6px', textShadow: item.imageUrl ? '0 1px 3px rgba(0,0,0,0.8)' : 'none' }}>
              {item.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.time && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: item.imageUrl ? '#ddd' : 'var(--text-dim)', textShadow: item.imageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>
                  <Clock size={10} />
                  {item.time}
                </span>
              )}
              <span style={{ fontSize: '9px', color: item.imageUrl ? '#aaa' : 'var(--text-dim)', textShadow: item.imageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: item.imageUrl ? '#aaa' : 'var(--text-dim)', textShadow: item.imageUrl ? '0 1px 2px rgba(0,0,0,0.8)' : 'none' }}>
                {item.source}
                <ExternalLink size={10} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Configurações */}
      {showSettings && createPortal(
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '999999' }}>
          <div style={{ position: 'relative', background: '#1a1a24', borderRadius: '12px', padding: '20px', width: '500px', maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto', border: '1px solid #333', zIndex: '1000000', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700', color: '#fff' }}>Fontes de Notícias Personalizadas</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
                <X size={20} />
              </button>
            </div>

            {/* Lista de Fontes Customizadas */}
            <div style={{ marginBottom: '20px' }}>
              {customFeeds.map(feed => (
                <div key={feed.id} style={{ background: '#0f0f18', padding: '12px', borderRadius: '8px', marginBottom: '10px', border: defaultFeedId === feed.id ? '2px solid #7c5cfc' : '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#fff' }}>{feed.label}</strong>
                      {defaultFeedId === feed.id && <Star size={12} fill="#7c5cfc" color="#7c5cfc" />}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setAsDefault(feed.id)} 
                        title="Definir como padrão"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: defaultFeedId === feed.id ? '#7c5cfc' : '#888' }}
                      >
                        <Star size={14} fill={defaultFeedId === feed.id ? '#7c5cfc' : 'none'} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingFeed(feed);
                          setNewFeedName(feed.label);
                          setNewFeedUrl(feed.urls.join('\n'));
                        }} 
                        title="Editar"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          saveCustomFeeds(customFeeds.filter(f => f.id !== feed.id));
                          if (defaultFeedId === feed.id) {
                            setDefaultFeedId('');
                            localStorage.removeItem('default-news-feed-id');
                          }
                        }} 
                        title="Remover"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {feed.urls.map((url, i) => (
                      <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>• {url}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Formulário para Adicionar/Editar Fonte */}
            <div style={{ background: '#0f0f18', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                {editingFeed ? (
                  <>
                    <Edit2 size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                    Editar Fonte
                  </>
                ) : (
                  <>
                    <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                    Adicionar Nova Fonte
                  </>
                )}
              </h4>
              
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#888', marginBottom: '5px' }}>
                  Nome do Grupo
                </label>
                <input 
                  type="text" 
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  placeholder="Ex: Meus Sites Favoritos"
                  style={{ width: '100%', padding: '8px', background: '#000', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#888', marginBottom: '5px' }}>
                  URLs RSS (um por linha)
                </label>
                <textarea 
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  placeholder="https://exemplo.com/rss&#10;https://outrosite.com/feed.xml"
                  rows={4}
                  style={{ width: '100%', padding: '8px', background: '#000', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '11px', fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    if (!newFeedName.trim()) {
                      return;
                    }
                    const urls = newFeedUrl.split('\n').map(u => u.trim()).filter(u => u);
                    if (urls.length === 0) {
                      return;
                    }
                    
                    if (editingFeed) {
                      // Atualiza feed existente
                      const updatedFeeds = customFeeds.map(f => 
                        f.id === editingFeed.id 
                          ? { ...f, label: newFeedName.trim(), urls }
                          : f
                      );
                      saveCustomFeeds(updatedFeeds);
                      setEditingFeed(null);
                    } else {
                      // Adiciona novo feed
                      const newFeed: CustomFeed = {
                        id: Date.now().toString(),
                        label: newFeedName.trim(),
                        urls
                      };
                      saveCustomFeeds([...customFeeds, newFeed]);
                    }
                    
                    setNewFeedName('');
                    setNewFeedUrl('');
                  }}
                  style={{ 
                    flex: 1,
                    padding: '10px', 
                    background: '#7c5cfc', 
                    border: 'none', 
                    borderRadius: '6px', 
                    color: '#fff', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    cursor: 'pointer',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {editingFeed ? 'Salvar Alterações' : 'Adicionar Fonte'}
                </button>
                
                {editingFeed && (
                  <button 
                    onClick={() => {
                      setEditingFeed(null);
                      setNewFeedName('');
                      setNewFeedUrl('');
                    }}
                    style={{ 
                      padding: '10px 15px', 
                      background: '#333', 
                      border: 'none', 
                      borderRadius: '6px', 
                      color: '#fff', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      cursor: 'pointer',
                      transition: 'opacity 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', background: '#0f0f18', borderRadius: '6px', fontSize: '10px', color: '#888', border: '1px solid #333' }}>
              <strong style={{ color: '#7c5cfc' }}>💡 Dica:</strong> Use URLs de <strong>feeds RSS/Atom</strong>, não páginas HTML normais.<br/>
              Exemplos válidos:<br/>
              • <code style={{ background: '#000', padding: '2px 4px', borderRadius: '3px' }}>https://site.com/feed</code><br/>
              • <code style={{ background: '#000', padding: '2px 4px', borderRadius: '3px' }}>https://site.com/rss.xml</code><br/>
              • <code style={{ background: '#000', padding: '2px 4px', borderRadius: '3px' }}>https://site.com/feed.xml</code><br/>
              <br/>
              <strong style={{ color: '#7c5cfc' }}>⭐ Dica:</strong> Clique na estrela para definir um grupo como notícia inicial do app.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
