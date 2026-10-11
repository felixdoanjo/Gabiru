import { useState, useRef, useEffect } from 'react';
import { Target, X, Check, Loader } from 'lucide-react';

interface MotionTrackerProps {
  currentTime: number;
  duration: number;
  onTrackingComplete: (trackingData: TrackingData) => void;
  onClose: () => void;
  videoPath: string;
  videoUrl: string;
  clipStartTime: number;
  clipTrimStart: number;
  clipTrimEnd: number;
  clipDuration: number;
}

export interface TrackingData {
  id: string;
  name: string;
  tracking_data: Array<{
    frame: number;
    x: number;
    y: number;
    width: number;
    height: number;
    timestamp: number;
    tracked: boolean;
  }>;
  fps: number;
  videoPath: string;
  video_width?: number;
  video_height?: number;
  start_frame?: number;
}

interface SelectionRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export const MotionTracker = ({ 
  currentTime, 
  duration, 
  onTrackingComplete, 
  onClose, 
  videoPath, 
  videoUrl,
  clipStartTime,
  clipTrimStart,
  clipTrimEnd,
  clipDuration
}: MotionTrackerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState(0);
  const [trackerType, setTrackerType] = useState<'CSRT' | 'KCF' | 'MOSSE'>('CSRT');
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [scrubTime, setScrubTime] = useState<number>(() => {
    return Math.max(clipTrimStart, Math.min(clipDuration - clipTrimEnd, currentTime));
  });

  // Listener para progresso do backend
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.onMotionTrackProgress) {
      const unsub = api.onMotionTrackProgress((data: any) => {
        if (data && typeof data.progress === 'number') {
          setTrackingProgress(data.progress);
        }
      });
      return unsub;
    }
  }, []);

  // Carrega o vídeo e posiciona no tempo inicial
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initialTime = Math.max(clipTrimStart, Math.min(clipDuration - clipTrimEnd, currentTime));
    setScrubTime(initialTime);

    const onReady = () => {
      try {
        video.currentTime = initialTime;
      } catch {}
      setVideoLoaded(true);
    };

    if (video.readyState >= 1) {
      onReady();
    } else {
      video.addEventListener('loadedmetadata', onReady);
    }
    
    const onSeeked = () => {
      setVideoLoaded(true);
    };
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [currentTime, clipTrimStart, clipDuration, clipTrimEnd]);

  // Redesenha o canvas ao mudar o tempo ou a seleção
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.videoWidth > 0 && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    } else if (canvas.width === 0) {
      canvas.width = 1920;
      canvas.height = 1080;
    }

    const drawFrame = () => {
      if (video.readyState >= 2) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      if (selection) {
        ctx.strokeStyle = '#7c5cfc';
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(selection.startX, selection.startY, selection.width, selection.height);
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(124, 92, 252, 0.15)';
        ctx.fillRect(selection.startX, selection.startY, selection.width, selection.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Outfit, sans-serif';
        ctx.fillText(
          `${Math.round(selection.width)}x${Math.round(selection.height)}`,
          selection.startX + 6,
          Math.max(24, selection.startY - 8)
        );
      }
    };

    drawFrame();
    const interval = setInterval(drawFrame, 150);
    return () => clearInterval(interval);
  }, [selection, videoLoaded, scrubTime]);

  const handleScrubChange = (newTime: number) => {
    setScrubTime(newTime);
    setSelection(null);
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = newTime;
      } catch {}
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isTracking) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsSelecting(true);
    setStartPoint({ x, y });
    setSelection({ startX: x, startY: y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    setSelection({
      startX: Math.min(startPoint.x, currentX),
      startY: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setStartPoint(null);
  };

  const handleStartTracking = async () => {
    if (!selection || selection.width < 10 || selection.height < 10) {
      alert('Selecione uma área maior para rastrear');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const api = (window as any).electronAPI;
    if (!api?.motionTrack) {
      alert('API de motion tracking não disponível');
      return;
    }

    setIsTracking(true);
    setTrackingProgress(0);

    try {
      const fps = 30; // base padrão de amostragem
      const startFrame = Math.max(0, Math.floor(scrubTime * fps));
      const endLimit = clipDuration - clipTrimEnd;
      const endFrame = Math.max(startFrame + 1, Math.floor(endLimit * fps));

      const config = {
        videoPath: videoPath,
        bbox: [
          Math.floor(selection.startX),
          Math.floor(selection.startY),
          Math.floor(selection.width),
          Math.floor(selection.height)
        ] as [number, number, number, number],
        startFrame,
        endFrame,
        trackerType
      };

      const result = await api.motionTrack(config);

      if (result.success && result.tracking_data) {
        const trackingData: TrackingData = {
          id: `track_${Date.now()}`,
          name: `Track ${new Date().toLocaleTimeString()}`,
          tracking_data: result.tracking_data,
          fps: result.fps || fps,
          videoPath: videoPath,
          video_width: result.video_width || video.videoWidth || 1920,
          video_height: result.video_height || video.videoHeight || 1080,
          start_frame: result.start_frame || startFrame
        };

        onTrackingComplete(trackingData);
        onClose();
      } else {
        alert(`Erro no tracking: ${result.error || 'Desconhecido'}`);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.95)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Vídeo oculto para renderizar frames */}
      <video
        ref={videoRef}
        src={videoUrl}
        style={{ display: 'none' }}
        muted
        preload="auto"
        crossOrigin="anonymous"
      />
      <div style={{
        background: '#0d0d12',
        border: '1px solid #1a1a24',
        borderRadius: '12px',
        maxWidth: '92vw',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header fixo */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1a1a24',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={22} color="#7c5cfc" />
            <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Motion Tracker</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              padding: '5px'
            }}
            disabled={isTracking}
          >
            <X size={22} />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{ color: '#aaa', fontSize: '13px', width: '100%', maxWidth: '720px' }}>
            <p style={{ margin: '0 0 6px 0' }}>Posicione o slider no momento em que o objeto aparece e arraste sobre o vídeo para demarcar a área.</p>
          </div>

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              maxWidth: '100%',
              maxHeight: '48vh',
              objectFit: 'contain',
              border: '2px solid #7c5cfc',
              borderRadius: '8px',
              cursor: isTracking ? 'wait' : 'crosshair',
              background: '#000'
            }}
          />

          {/* Scrubber de vídeo */}
          <div style={{ width: '100%', maxWidth: '720px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#888', fontSize: '12px', minWidth: '45px' }}>{scrubTime.toFixed(1)}s</span>
            <input
              type="range"
              min={clipTrimStart}
              max={Math.max(clipTrimStart + 0.1, clipDuration - clipTrimEnd)}
              step={0.05}
              value={scrubTime}
              onChange={(e) => handleScrubChange(parseFloat(e.target.value))}
              disabled={isTracking}
              style={{ flex: 1, accentColor: '#7c5cfc', cursor: 'pointer' }}
            />
            <span style={{ color: '#888', fontSize: '12px', minWidth: '45px' }}>
              {(clipDuration - clipTrimEnd).toFixed(1)}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '720px' }}>
            <label style={{ color: '#fff', fontSize: '13px' }}>Algoritmo:</label>
            <select
              value={trackerType}
              onChange={(e) => setTrackerType(e.target.value as any)}
              disabled={isTracking}
              style={{
                background: '#1a1a24',
                border: '1px solid #333',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px'
              }}
            >
              <option value="CSRT">CSRT (Alta Precisão)</option>
              <option value="KCF">KCF (Balanceado/Rápido)</option>
              <option value="MOSSE">MOSSE (Ultra Rápido)</option>
            </select>
          </div>
        </div>

        {/* Footer fixo com progresso e botões */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #1a1a24',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {isTracking && (
            <div style={{ width: '100%' }}>
              <div style={{
                background: '#1a1a24',
                height: '8px',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#7c5cfc',
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, trackingProgress))}%`,
                  transition: 'width 0.2s'
                }} />
              </div>
              <p style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', marginTop: '6px', marginBottom: 0 }}>
                Rastreando frames... {trackingProgress.toFixed(0)}%
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isTracking}
              style={{
                background: '#1a1a24',
                border: '1px solid #333',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '8px',
                cursor: isTracking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isTracking ? 0.5 : 1
              }}
            >
              <X size={16} />
              Cancelar
            </button>
            <button
              onClick={handleStartTracking}
              disabled={!selection || selection.width < 10 || isTracking}
              style={{
                background: '#7c5cfc',
                border: 'none',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '8px',
                cursor: (!selection || selection.width < 10 || isTracking) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (!selection || selection.width < 10 || isTracking) ? 0.5 : 1,
                fontWeight: 600
              }}
            >
              {isTracking ? <Loader size={16} className="spin" /> : <Check size={16} />}
              {isTracking ? 'Rastreando...' : 'Iniciar Tracking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
