import { useState } from 'react';
import { Search, Download, Star, Lock, Zap, Palette, Wrench, Globe, Film, Image, Code, CheckCircle, ShoppingBag, ImageIcon, Send, X } from 'lucide-react';

interface Plugin {
  id: string; name: string; description: string; author: string; version: string;
  category: 'visual' | 'tool' | 'web' | 'video' | 'photo' | 'code';
  price: number; stars: number; downloads: number; installed: boolean;
  featured?: boolean; tags: string[]; downloadUrl?: string;
}

const PLUGINS: Plugin[] = [
  { id: 'paint', name: 'Paint', description: 'Um poderoso editor de imagens e telas de pintura nativo para o Gabiru, perfeito para anotações e desenhos livres.', author: 'felixdoanjo', version: '1.0.0', category: 'tool', price: 0, stars: 5.0, downloads: 1, installed: false, featured: true, tags: ['paint', 'desenho', 'imagem'], downloadUrl: 'https://github.com/felixdoanjo/paint/archive/refs/heads/main.zip' },
];

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: <Zap size={14} /> },
  { id: 'visual', label: 'Visual', icon: <Palette size={14} /> },
  { id: 'tool', label: 'Ferramentas', icon: <Wrench size={14} /> },
  { id: 'code', label: 'Code', icon: <Code size={14} /> },
  { id: 'video', label: 'Video', icon: <Film size={14} /> },
  { id: 'photo', label: 'Design', icon: <Image size={14} /> },
  { id: 'web', label: 'Web', icon: <Globe size={14} /> },
];

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  visual: <Palette size={14} />, tool: <Wrench size={14} />, code: <Code size={14} />,
  video: <Film size={14} />, photo: <Image size={14} />, web: <Globe size={14} />,
};

function formatNum(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${n}`; }

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f59e0b', fontSize: '11px' }}>
      <Star size={11} fill="#f59e0b" />{rating.toFixed(1)}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const colors = ['#7c3aed','#2563eb','#dc2626','#059669','#d97706'];
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: colors[name.charCodeAt(0) % 5], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={16}
          fill={(hover||value)>=i ? '#f59e0b' : 'none'}
          color={(hover||value)>=i ? '#f59e0b' : 'var(--text-dim)'}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(i)}
        />
      ))}
    </span>
  );
}

function InstallBtn({ p, installed, installing, onInstall, onUninstall, full }: {
  p: Plugin; installed: Set<string>; installing: string | null;
  onInstall: (p: Plugin, e?: React.MouseEvent) => void; onUninstall?: (p: Plugin, e?: React.MouseEvent) => void; full?: boolean;
}) {
  const isInstalled = installed.has(p.id);
  const isInstalling = installing === p.id;
  const base: React.CSSProperties = { borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: isInstalling ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s', whiteSpace: 'nowrap', border: 'none', padding: full ? '10px 20px' : '6px 14px', width: full ? '100%' : 'auto' };
  
  if (isInstalled) {
    return (
      <div style={{ display: 'flex', gap: '6px', width: full ? '100%' : 'auto' }}>
        <button style={{ ...base, flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}><CheckCircle size={13} />Instalado</button>
        {onUninstall && <button onClick={e => onUninstall(p, e)} style={{ ...base, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 10px' }}><X size={13} /></button>}
      </div>
    );
  }
  return (
    <button onClick={e => onInstall(p, e)} disabled={isInstalling}
      style={{ ...base, background: isInstalling ? 'rgba(124,58,237,0.2)' : p.price === 0 ? '#7c3aed' : 'transparent', border: `1px solid ${p.price === 0 ? '#7c3aed' : 'rgba(124,58,237,0.5)'}`, color: p.price === 0 ? '#fff' : '#c084fc' }}
      onMouseEnter={e => { if (!isInstalling) e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {isInstalling ? <><span style={{ width: 11, height: 11, border: '2px solid #c084fc', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'storeSpinX 0.7s linear infinite' }} />Instalando</> : p.price === 0 ? <><Download size={12} />Instalar</> : <><Lock size={12} />R$ {p.price.toFixed(2)}</>}
      <style>{`@keyframes storeSpinX { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

// -- Main Store -----------------------------------------------------------------

// -- Store principal com 1 banner -------------------------------------------------
const BANNERS = [
  { id: 'paint', title: 'Paint', sub: 'Editor de desenho e pintura gratuito para o Gabiru', color: 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)' },
];

export default function Store() {
  const [tab, setTab] = useState<'destaques' | 'explorar'>('destaques');
  const [search, setSearch] = useState('');
  const [bannerIdx, setBannerIdx] = useState(0);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plugin | null>(null);

  // Auto-rotate banners
  useState(() => {
    const t = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 3500);
    return () => clearInterval(t);
  });

  // Initialize installed state from backend
  useState(() => {
    PLUGINS.forEach(p => {
      window.electronAPI?.checkPluginInstalled(p.id).then(res => {
        if (res.installed) setInstalled(prev => new Set([...prev, p.id]));
      });
    });
  });

  const handleInstall = async (p: Plugin, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (installed.has(p.id) || installing === p.id) return;
    setInstalling(p.id);

    try {
      if (p.downloadUrl) {
        const res = await window.electronAPI.installPlugin(p.id, p.downloadUrl);
        if (!res.success) throw new Error(res.error);
      } else {
        // Mock install for plugins without URL
        await new Promise(r => setTimeout(r, 1800));
      }
      setInstalled(prev => new Set([...prev, p.id]));
    } catch (err: any) {
      console.error('Install failed:', err);
      alert('Falha ao instalar o plugin: ' + err.message);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (p: Plugin, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!installed.has(p.id) || installing === p.id) return;
    
    try {
      const res = await window.electronAPI.uninstallPlugin(p.id);
      if (!res.success) throw new Error(res.error);
      setInstalled(prev => { const n = new Set(prev); n.delete(p.id); return n; });
    } catch (err: any) {
      console.error('Uninstall failed:', err);
      alert('Falha ao desinstalar: ' + err.message);
    }
  };

  const featured = PLUGINS.filter(p => p.featured);

  if (selected) {
    return <PluginDetail plugin={selected} allPlugins={PLUGINS} installed={installed} installing={installing}
      onInstall={handleInstall} onUninstall={handleUninstall} onClose={() => setSelected(null)} onSelect={setSelected} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>GABIRU</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.05em', color: '#c084fc' }}>STORE</span>
              <ShoppingBag size={19} color="#7c3aed" strokeWidth={2} />
            </div>
          </div>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Buscar plugins..." value={search}
              onChange={e => { setSearch(e.target.value); setTab('explorar'); }}
              style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '7px 10px 7px 30px', borderRadius: '8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#c084fc')} onBlur={e => (e.target.style.borderColor = 'var(--border-color)')} />
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)' }}>
          {(['destaques', 'explorar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t ? '#c084fc' : 'transparent'}`,
              color: tab === t ? '#c084fc' : 'var(--text-secondary)', padding: '8px 20px', fontSize: '12px',
              fontWeight: tab === t ? 700 : 500, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
              transition: 'all 0.15s', marginBottom: '-1px',
            }}>
              {t === 'destaques' ? 'Destaques' : 'Explorar'}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar — sempre visível abaixo das abas */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 14, color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={tab === 'destaques' ? 'Buscar plugins em destaque...' : 'Buscar entre todos os plugins...'}
            value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value && tab !== 'explorar') setTab('explorar'); }}
            style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 40px 10px 40px', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocus={e => { e.target.style.borderColor = '#c084fc'; e.target.style.boxShadow = '0 0 0 3px rgba(192,132,252,0.12)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', borderRadius: '4px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            ><X size={14} /></button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>

        {/* ── ABA DESTAQUES ── */}
        {tab === 'destaques' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Banners */}
            <div style={{ position: 'relative' }}>
              {BANNERS.map((b, i) => (
                <div key={b.id} onClick={() => { const p = PLUGINS.find(x => x.id === b.id); if (p) setSelected(p); }}
                  style={{ display: i === bannerIdx ? 'flex' : 'none', flexDirection: 'column', justifyContent: 'flex-end', height: '160px', borderRadius: '14px', background: b.color, padding: '24px', cursor: 'pointer', border: '1px solid rgba(124,58,237,0.3)', transition: 'opacity 0.4s' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{b.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{b.sub}</div>
                  <div style={{ position: 'absolute', bottom: 12, right: 16, display: 'flex', gap: '5px' }}>
                    {BANNERS.map((_, j) => (
                      <div key={j} onClick={e => { e.stopPropagation(); setBannerIdx(j); }}
                        style={{ width: j === bannerIdx ? 18 : 6, height: 6, borderRadius: 3, background: j === bannerIdx ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.3s', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Featured cards */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Em destaque</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
                {featured.map(p => (
                  <div key={p.id} onClick={() => setSelected(p)} style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, var(--bg-secondary) 60%)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px', padding: '14px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, background: '#7c3aed', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '0 12px 0 6px', color: '#fff' }}>DESTAQUE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '7px', background: 'rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>{CATEGORY_ICON[p.category]}</div>
                      <div><div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div><div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{p.author}</div></div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.4 }}>{p.description.slice(0, 75)}...</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stars rating={p.stars} />
                      <InstallBtn p={p} installed={installed} installing={installing} onInstall={handleInstall} onUninstall={handleUninstall} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA EXPLORAR ── */}
        {tab === 'explorar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {(['visual','tool','code','video','photo','web'] as const).map(cat => {
              const list = PLUGINS.filter(p => p.category === cat && (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())));
              if (list.length === 0) return null;
              const catLabel: Record<string, string> = { visual: 'Visual', tool: 'Ferramentas', code: 'Code', video: 'Video', photo: 'Design', web: 'Web' };
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ color: '#c084fc' }}>{CATEGORY_ICON[cat]}</div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{catLabel[cat]}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>({list.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                    {list.map(p => (
                      <div key={p.id} onClick={() => setSelected(p)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '6px' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '7px', background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>{CATEGORY_ICON[p.category]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{p.author}</div>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>{p.description.slice(0, 60)}...</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Stars rating={p.stars} />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: p.price === 0 ? '#22c55e' : '#c084fc' }}>{p.price === 0 ? 'Grátis' : `R$${p.price}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ABA MEU PROJETO ── */}
        {tab === 'meus' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Publique seu plugin na Gabiru Store e compartilhe com outros usuários.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              <div style={{ aspectRatio: '1', background: 'var(--bg-secondary)', border: '2px dashed rgba(124,58,237,0.4)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c084fc'; e.currentTarget.style.background = 'rgba(124,58,237,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', fontSize: '22px', fontWeight: 300 }}>+</div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Criar plugin</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Plugin Detail - tela cheia
const MOCK_COMMENTS = [
  { user: 'rafaeldev', text: 'Incrivel, mudou meu fluxo de trabalho completamente!', stars: 5, date: '2 dias atras' },
  { user: 'lucas_code', text: 'Funciona muito bem, recomendo para quem usa bastante.', stars: 4, date: '5 dias atras' },
  { user: 'bia_design', text: 'Exatamente o que precisava. Interface bem pensada.', stars: 5, date: '1 semana atras' },
];

function PluginDetail({ plugin, allPlugins, installed, installing, onInstall, onUninstall, onClose, onSelect }: {
  plugin: Plugin; allPlugins: Plugin[]; installed: Set<string>; installing: string | null;
  onInstall: (p: Plugin, e?: React.MouseEvent) => void; onUninstall?: (p: Plugin, e?: React.MouseEvent) => void; onClose: () => void; onSelect: (p: Plugin) => void;
}) {
  const [comment, setComment] = useState('');
  const [myRating, setMyRating] = useState(0);
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const related = allPlugins.filter(p => p.id !== plugin.id && p.category === plugin.category).slice(0, 6);

  const submit = () => {
    if (!comment.trim() && myRating === 0) return;
    setComments(prev => [{ user: 'você', text: comment.trim() || '(só avaliação)', stars: myRating || 5, date: 'agora' }, ...prev]);
    setComment(''); setMyRating(0);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#c084fc'; e.currentTarget.style.color = '#c084fc'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        ><X size={13} /> Voltar à loja</button>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Gabiru Store /</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{plugin.name}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '36px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ width: 80, height: 80, borderRadius: '18px', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', flexShrink: 0 }}>
              <div style={{ transform: 'scale(2.2)' }}>{CATEGORY_ICON[plugin.category]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>{plugin.name}</h1>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', padding: '4px 12px', borderRadius: '20px', marginBottom: '10px' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{plugin.author[0]}</div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc' }}>{plugin.author}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>· v{plugin.version}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <StarRating value={Math.round(plugin.stars)} />
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>{plugin.stars}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={12} />{formatNum(plugin.downloads)}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: plugin.price === 0 ? '#22c55e' : '#c084fc' }}>{plugin.price === 0 ? 'Grátis' : `R$ ${plugin.price.toFixed(2)}`}</span>
              </div>
            </div>
            <div style={{ flexShrink: 0, minWidth: 160 }}><InstallBtn p={plugin} installed={installed} installing={installing} onInstall={onInstall} onUninstall={onUninstall} full /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Sobre</div>
              <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.75 }}>{plugin.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {plugin.tags.map(t => <span key={t} style={{ fontSize: '10px', background: 'rgba(124,58,237,0.12)', color: '#c084fc', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(124,58,237,0.25)' }}>{t}</span>)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              {[['Avaliação', plugin.stars.toFixed(1), '#f59e0b'], ['Downloads', formatNum(plugin.downloads), 'var(--text-primary)'], ['Preço', plugin.price === 0 ? 'Grátis' : `R$ ${plugin.price.toFixed(2)}`, '#c084fc'], ['Versão', plugin.version, 'var(--text-secondary)']].map(([label, value, color], i, arr) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Screenshots</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ aspectRatio: '16/9', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                  <ImageIcon size={24} strokeWidth={1.2} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Avaliações ({comments.length})</div>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Avatar name="você" />
                <div><div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>Sua avaliação</div><StarRating value={myRating} onChange={setMyRating} /></div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="Comentário opcional..."
                  style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                  onFocus={e => (e.target.style.borderColor = '#c084fc')} onBlur={e => (e.target.style.borderColor = 'var(--border-color)')} />
                <button onClick={submit} style={{ padding: '8px 16px', background: '#7c3aed', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                ><Send size={13} />Enviar</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comments.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                  <Avatar name={c.user} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>@{c.user}</span>
                      <StarRating value={c.stars} />
                      <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: 'auto' }}>{c.date}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {related.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Parecidos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {related.map(p => (
                  <div key={p.id} onClick={() => onSelect(p)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>{CATEGORY_ICON[p.category]}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>{p.description.slice(0, 55)}...</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stars rating={p.stars} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: p.price === 0 ? '#22c55e' : '#c084fc' }}>{p.price === 0 ? 'Grátis' : `R$${p.price}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
