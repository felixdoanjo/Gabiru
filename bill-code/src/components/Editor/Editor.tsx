import Editor, { loader } from '@monaco-editor/react';
import { useEffect, useState } from 'react';
import { Eye, Code, FileCode, FileType, FileJson, FileText, File, PenLine } from 'lucide-react';
import HtmlPreview from './HtmlPreview';
import './Editor.css';

// Configurar Monaco para carregar localmente do node_modules
import * as monaco from 'monaco-editor';
loader.config({ monaco });

interface EditorProps {
  filePath: string | null;
  content: string;
  onChange: (content: string) => void;
  onSendToAI?: (message: string) => void;
  onReloadFile?: () => Promise<void>;
  showDesignPreview?: boolean;
  onToggleDesignPreview?: (show: boolean) => void;
}

const PREVIEW_EXTS = ['html', 'htm', 'jsx', 'tsx', 'svg'];

export default function CodeEditor({ filePath, content, onChange, onSendToAI, onReloadFile, showDesignPreview, onToggleDesignPreview }: EditorProps) {
  const [language, setLanguage] = useState<string>('plaintext');
  const [showPreview, setShowPreview] = useState(false);
  
  // Usa prop externa se fornecida, senão usa estado interno
  const isPreviewShown = showDesignPreview !== undefined ? showDesignPreview : showPreview;
  const togglePreview = () => {
    if (onToggleDesignPreview) {
      onToggleDesignPreview(!isPreviewShown);
    } else {
      setShowPreview(v => !v);
    }
  };

  useEffect(() => {
    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        py: 'python',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        cs: 'csharp',
        go: 'go',
        rs: 'rust',
        rb: 'ruby',
        php: 'php',
        html: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yaml',
        md: 'markdown',
        sh: 'shell',
        bash: 'shell',
        sql: 'sql',
      };
      setLanguage(langMap[ext || ''] || 'plaintext');
    }
  }, [filePath]);

  const getFileName = () => {
    if (!filePath) return 'Nenhum arquivo';
    return filePath.split('\\').pop() || filePath.split('/').pop() || 'Arquivo';
  };

  const ext = filePath?.split('.').pop()?.toLowerCase() || '';
  const canPreview = PREVIEW_EXTS.includes(ext);

  // Gera HTML real para preview (JSX/TSX mostra só como HTML estático)
  const getPreviewContent = () => {
    if (ext === 'html' || ext === 'htm' || ext === 'svg') return content;
    // Para JSX/TSX: tenta extrair o JSX como HTML aproximado
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#1a1a2e;color:#fff;font-family:sans-serif;padding:20px}</style></head><body><div id="root">${content.replace(/<[^>]*>/g, tag => tag)}</div></body></html>`;
  };

  return (
    <div className="editor-container">
      <div className="editor-tabs">
        <div className={`tab ${filePath ? 'active' : ''}`}>
          <span className="tab-icon" style={{ display: 'flex', alignItems: 'center' }}>
            {filePath?.endsWith('.ts') || filePath?.endsWith('.tsx') ? <FileCode size={13} color="#3b82f6" /> :
             filePath?.endsWith('.js') || filePath?.endsWith('.jsx') ? <FileCode size={13} color="#eab308" /> :
             filePath?.endsWith('.py') ? <FileCode size={13} color="#22c55e" /> :
             filePath?.endsWith('.json') ? <FileJson size={13} color="#f97316" /> :
             filePath?.endsWith('.html') || filePath?.endsWith('.htm') ? <FileType size={13} color="#e25822" /> :
             filePath?.endsWith('.css') || filePath?.endsWith('.scss') ? <FileType size={13} color="#60a5fa" /> :
             filePath?.endsWith('.md') ? <FileText size={13} color="#a78bfa" /> :
             <File size={13} color="#9ca3af" />}
          </span>
          <span className="tab-name">{getFileName()}</span>
        </div>
        {/* Botão Design — só aparece para arquivos que suportam preview */}
        {canPreview && (
          <button
            onClick={togglePreview}
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: '5px',
              background: isPreviewShown ? 'rgba(124,92,252,0.15)' : 'transparent',
              border: `1px solid ${isPreviewShown ? '#7c5cfc' : 'var(--border-color)'}`,
              borderRadius: '4px',
              color: isPreviewShown ? '#7c5cfc' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '3px 10px',
              marginRight: '8px',
              transition: 'all 0.15s',
            }}
          >
            {isPreviewShown ? <Code size={12} /> : <Eye size={12} />}
            {isPreviewShown ? 'Código' : 'Design'}
          </button>
        )}
      </div>

      {/* Split: Editor + Preview */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Monaco Editor — oculto quando preview está aberto */}
        <div style={{ flex: 1, display: isPreviewShown ? 'none' : 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="editor-wrapper" style={{ flex: 1 }}>
            {filePath ? (
              <Editor
                height="100%"
                language={language}
                value={content}
                onChange={(value) => onChange(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 10 },
                  readOnly: false,
                }}
              />
            ) : (
              <div className="editor-empty">
                <div className="empty-icon"><PenLine size={48} strokeWidth={1} color="#7c5cfc" /></div>
                <h2>Gabiru</h2>
                <p>Selecione um arquivo para editar ou</p>
                <p>abra uma pasta no explorador</p>
                <div className="quick-start">
                  <h3>Atalhos úteis:</h3>
                  <ul>
                    <li><kbd>Ctrl</kbd> + <kbd>S</kbd> - Salvar arquivo</li>
                    <li><kbd>Ctrl</kbd> + <kbd>`</kbd> - Alternar terminal</li>
                    <li><kbd>Ctrl</kbd> + <kbd>P</kbd> - Buscar arquivo</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel — ocupa tudo quando aberto */}
        {isPreviewShown && !canPreview && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
            Abra um arquivo HTML, HTM, JSX, TSX ou SVG para usar o Design.
          </div>
        )}
        {isPreviewShown && canPreview && (
          <div style={{ flex: 1, borderLeft: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <HtmlPreview
              content={getPreviewContent()}
              filePath={filePath}
              onEditRequest={async (instruction) => {
                // Intercepta __SAVE_HTML__ e salva diretamente
                if (instruction.startsWith('__SAVE_HTML__')) {
                  const htmlContent = instruction.slice('__SAVE_HTML__'.length);
                  console.log('[Editor] 💾 Salvando HTML diretamente, tamanho:', htmlContent.length);
                  await onChange(htmlContent);
                  if (onReloadFile) {
                    await onReloadFile();
                  }
                  console.log('[Editor] ✅ HTML salvo com sucesso!');
                  return;
                }
                
                // Intercepta __DOM_PATCHES__ e processa localmente
                if (instruction.startsWith('__DOM_PATCHES__')) {
                  const jsonEnd = instruction.indexOf('\n\n');
                  const jsonStr = instruction.slice('__DOM_PATCHES__'.length, jsonEnd > 0 ? jsonEnd : undefined);
                  try {
                    const patches: Array<any> = JSON.parse(jsonStr);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'text/html');
                    let applied = 0;
                    
                    patches.forEach((p: any) => {
                      if (!p || !p.tempId) return;
                      try {
                        // Busca pelo atributo temporário único
                        const target = doc.querySelector(`[data-temp-id="${p.tempId}"]`) as HTMLElement | null;
                        
                        if (!target) {
                          console.warn('[Editor] ⚠️ Elemento não encontrado com tempId:', p.tempId);
                          return;
                        }
                        
                        if (p.type === 'style') {
                          // Aplica como style inline
                          let existing = target.getAttribute('style') || '';
                          // Remove propriedade existente se houver
                          existing = existing.replace(new RegExp(`${p.prop}\\s*:[^;]+;?`, 'g'), '').trim();
                          const newStyle = existing ? `${existing}; ${p.prop}: ${p.value}` : `${p.prop}: ${p.value}`;
                          target.setAttribute('style', newStyle);
                          // Remove o atributo temporário
                          target.removeAttribute('data-temp-id');
                          applied++;
                        } else if (p.type === 'text') {
                          target.textContent = p.text;
                          // Remove o atributo temporário
                          target.removeAttribute('data-temp-id');
                          applied++;
                        }
                      } catch (err) {
                        console.warn('[Editor] Erro ao aplicar patch:', err);
                      }
                    });
                    
                    if (applied > 0) {
                      // Serializa o HTML de volta
                      const ser = new XMLSerializer();
                      let newContent = '<!DOCTYPE html>\n' + ser.serializeToString(doc.documentElement);
                      // Fallback se XMLSerializer quebrar
                      if (!newContent.includes('<html')) {
                        newContent = `<!DOCTYPE html>\n<html>${doc.documentElement.innerHTML}</html>`;
                      }
                      // AGUARDA o onChange completar antes de continuar
                      await onChange(newContent);
                      // Recarrega o arquivo do disco para garantir que o content está atualizado
                      if (onReloadFile) {
                        await onReloadFile();
                      }
                      console.log(`[Editor] ✅ ${applied} mudança(s) aplicada(s) e salvas no arquivo`);
                    } else {
                      console.warn('[Editor] ⚠️ Nenhum patch foi aplicado!');
                    }
                  } catch (e: any) {
                    console.error('[Editor] ❌ Erro ao processar DOM patches:', e);
                  }
                  return; // NÃO envia para o chat
                }
                
                // Outros tipos de mensagem vão para o chat normalmente
                if (onSendToAI) onSendToAI(instruction);
              }}
              onApplyDirectHtml={(selector, tag, src, idx) => {
                let newContent = content;
                const parser = new DOMParser();
                const doc = parser.parseFromString(newContent, 'text/html');
                const els = doc.querySelectorAll(selector);
                const target = els[idx] as HTMLElement | null;

                if (!target) { onChange(newContent); return; }

                if (tag === 'IMG') {
                  if (src === '__CLEAR_IMG__') {
                    target.setAttribute('src', '');
                  } else {
                    target.setAttribute('src', src);
                  }
                } else {
                  if (src === '__CLEAR_BG__') {
                    const existing = (target.getAttribute('style') || '')
                      .replace(/background-image:[^;]+;?/gi, '')
                      .replace(/background-size:[^;]+;?/gi, '')
                      .replace(/background-position:[^;]+;?/gi, '');
                    target.setAttribute('style', existing);
                    // Mostra imgs filhas escondidas
                    target.querySelectorAll('img').forEach((img: Element) => {
                      (img as HTMLElement).style.removeProperty('display');
                    });
                  } else if (src === '__CLEAR_TEXT__') {
                    target.textContent = '';
                  } else {
                    const existing = (target.getAttribute('style') || '').replace(/background-image:[^;]+;?/g, '');
                    target.setAttribute('style', `${existing};background-image:url(${src});background-size:cover;background-position:center;min-height:150px`);
                    // Esconde imgs filhos quebrados
                    target.querySelectorAll('img').forEach((img: Element) => {
                      const imgEl = img as HTMLImageElement;
                      const s = imgEl.getAttribute('src') || '';
                      if (!s || s === '#' || (!s.startsWith('http') && !s.startsWith('data:'))) {
                        imgEl.setAttribute('style', (imgEl.getAttribute('style')||'') + ';display:none');
                      }
                    });
                  }
                }
                onChange('<!DOCTYPE html>' + doc.documentElement.outerHTML);
              }}
              onClose={() => {
                if (onToggleDesignPreview) {
                  onToggleDesignPreview(false);
                } else {
                  setShowPreview(false);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
