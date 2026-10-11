import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, X, Terminal } from 'lucide-react';

interface DependencyInstallerProps {
  onClose?: () => void;
  blockClose?: boolean;
  onInstallComplete?: () => void;
}

export const DependencyInstaller: React.FC<DependencyInstallerProps> = ({ onClose, blockClose = false, onInstallComplete }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    checkInstallation();
  }, []);

  const checkInstallation = async () => {
    try {
      const result = await (window as any).electronAPI.checkRuntimeInstalled();
      console.log('[DependencyInstaller] Check result:', result);
      setIsInstalled(result.installed);
      
      if (!result.installed && result.checks) {
        const missing = [];
        if (!result.checks.ffmpeg) missing.push('FFmpeg');
        if (!result.checks.python) missing.push('Python');
        if (missing.length > 0) {
          setOutput([`⚠️ Faltando: ${missing.join(', ')}`]);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar instalação:', error);
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    setOutput(['🚀 Iniciando instalação das dependências...', '']);

    try {
      const result = await (window as any).electronAPI.installRuntimeDependencies();
      
      if (result.success) {
        setOutput(prev => [...prev, '✅ Download concluído!', '', '🔍 Verificando instalação...']);
        
        // Aguarda 2s e verifica se realmente instalou
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const checkResult = await (window as any).electronAPI.checkRuntimeInstalled();
        
        if (checkResult.installed) {
          setOutput(prev => [...prev, '✅ Tudo instalado e funcionando!']);
          setIsInstalled(true);
          onInstallComplete?.();
        } else {
          const missing = [];
          if (!checkResult.checks?.ffmpeg) missing.push('FFmpeg');
          if (!checkResult.checks?.python) missing.push('Python');
          setOutput(prev => [...prev, `❌ Faltando: ${missing.join(', ')}`, '', `📁 Verifique: ${checkResult.runtimeDir || '%APPDATA%\\bill-code\\runtime'}`]);
        }
      } else {
        setOutput(prev => [...prev, `❌ Erro: ${result.error}`]);
      }
    } catch (error: any) {
      setOutput(prev => [...prev, `❌ Erro: ${error.message}`]);
    } finally {
      setIsInstalling(false);
    }
  };

  // Listener para output do terminal
  useEffect(() => {
    const handleOutput = (data: { line: string }) => {
      setOutput(prev => [...prev, data.line]);
    };

    (window as any).electronAPI.onInstallOutput?.(handleOutput);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: '#1e1e1e',
        borderRadius: '12px',
        width: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #3e3e3e',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #3e3e3e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Download size={24} color={isInstalled ? '#10b981' : '#3b82f6'} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                {isInstalled ? 'Dependências Instaladas' : 'Concluir Instalação'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                {isInstalled 
                  ? 'Todas as dependências estão instaladas e funcionando'
                  : 'Para funcionamento completo do app, instale as dependências necessárias'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={blockClose && !isInstalled}
            style={{
              background: 'transparent',
              border: 'none',
              color: (blockClose && !isInstalled) ? '#444' : '#888',
              cursor: (blockClose && !isInstalled) ? 'not-allowed' : 'pointer',
              padding: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
          {isInstalled ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle size={64} color="#10b981" style={{ marginBottom: '16px' }} />
              <p style={{ color: '#fff', fontSize: '16px', marginBottom: '8px' }}>
                ✅ Instalação Concluída
              </p>
              <p style={{ color: '#888', fontSize: '14px' }}>
                FFmpeg, Python, Piper TTS e todas as bibliotecas estão instaladas.
              </p>
            </div>
          ) : (
            <>
              {!isInstalling && output.length === 0 && (
                <div>
                  <p style={{ color: '#fff', fontSize: '14px', marginBottom: '16px' }}>
                    O instalador irá baixar e instalar:
                  </p>
                  <ul style={{ color: '#888', fontSize: '13px', lineHeight: '1.8' }}>
                    <li><strong style={{ color: '#fff' }}>FFmpeg</strong> - Processamento de vídeo e áudio</li>
                    <li><strong style={{ color: '#fff' }}>Python</strong> - Interpretador Python 3.11</li>
                    <li><strong style={{ color: '#fff' }}>Piper TTS</strong> - Síntese de voz</li>
                    <li><strong style={{ color: '#fff' }}>Bibliotecas Python</strong> - OpenCV, Pillow, Whisper, etc</li>
                  </ul>
                  <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '16px', background: '#f59e0b22', padding: '12px', borderRadius: '8px' }}>
                    ⚠️ <strong>Tamanho total:</strong> ~1.5 GB • <strong>Tempo estimado:</strong> 5-15 minutos
                  </p>
                </div>
              )}

              {output.length > 0 && (
                <div style={{
                  background: '#0a0a0a',
                  border: '1px solid #3e3e3e',
                  borderRadius: '8px',
                  padding: '16px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#10b981',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}>
                  {output.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #3e3e3e',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            disabled={blockClose && !isInstalled}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid #3e3e3e',
              borderRadius: '6px',
              color: (blockClose && !isInstalled) ? '#444' : '#fff',
              cursor: (blockClose && !isInstalled) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {isInstalled ? 'Fechar' : 'Cancelar'}
          </button>
          {!isInstalled && (
            <button
              onClick={startInstallation}
              disabled={isInstalling}
              style={{
                padding: '10px 20px',
                background: isInstalling ? '#666' : '#3b82f6',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isInstalling ? (
                <>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Instalando...
                </>
              ) : (
                <>
                  <Terminal size={16} />
                  Instalar Agora
                </>
              )}
            </button>
          )}
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};
