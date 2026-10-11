#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motion Tracker - OpenCV tracking para Bill Code
Rastreia uma região selecionada ao longo do vídeo e exporta coordenadas
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path

def create_tracker(tracker_type='CSRT'):
    """Cria um tracker OpenCV com fallbacks robustos para qualquer versão do OpenCV."""
    candidates = [tracker_type]
    if tracker_type != 'CSRT':
        candidates.append('CSRT')
    candidates.extend(['KCF', 'MIL', 'MOSSE', 'MedianFlow'])
    
    for c in candidates:
        name = f'Tracker{c}'
        methods = [
            lambda n=name: getattr(cv2, f'{n}_create')(),
            lambda n=name: getattr(cv2, n).create(),
            lambda n=name: getattr(getattr(cv2, 'legacy', None), f'{n}_create')() if hasattr(cv2, 'legacy') else None,
            lambda n=name: getattr(getattr(cv2, 'legacy', None), n).create() if hasattr(cv2, 'legacy') else None,
        ]
        for m in methods:
            try:
                t = m()
                if t is not None:
                    print(json.dumps({'type': 'info', 'message': f'Tracker inicializado: {c}'}), flush=True)
                    return t
            except Exception:
                pass
                
    print(json.dumps({'error': 'Nenhum tracker OpenCV disponível'}), flush=True)
    return None

def track_video(video_path, bbox, start_frame=0, end_frame=None, tracker_type='CSRT', output_json=None):
    """
    Rastreia uma região do vídeo
    
    Args:
        video_path: caminho do vídeo
        bbox: tupla (x, y, width, height) da região inicial
        start_frame: frame inicial
        end_frame: frame final (None = até o fim)
        tracker_type: tipo de tracker ('CSRT', 'KCF', 'MIL', 'MOSSE')
        output_json: caminho para salvar os dados de tracking
    
    Returns:
        Lista de dicionários com {frame, x, y, width, height, confidence}
    """
    print(json.dumps({'type': 'info', 'message': f'Iniciando tracking de {video_path}'}), flush=True)
    print(json.dumps({'type': 'info', 'message': f'BBox: {bbox}, Tracker solicitado: {tracker_type}, StartFrame: {start_frame}'}), flush=True)
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(json.dumps({'error': f'Não foi possível abrir o vídeo: {video_path}'}), flush=True)
        return None
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0 or np.isnan(fps):
        fps = 30.0
        
    print(json.dumps({'type': 'info', 'message': f'Total frames: {total_frames}, FPS: {fps}'}), flush=True)
    
    if start_frame < 0:
        start_frame = 0
    if start_frame >= total_frames and total_frames > 0:
        start_frame = max(0, total_frames - 1)
        
    if end_frame is None or end_frame <= start_frame or end_frame > total_frames:
        end_frame = total_frames
    
    # Vai para o frame inicial
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    # Lê o primeiro frame e inicializa o tracker
    ret, frame = cap.read()
    if not ret:
        print(json.dumps({'error': f'Não foi possível ler o frame inicial {start_frame}'}), flush=True)
        cap.release()
        return None
    
    # Salva dimensões do frame para usar depois
    frame_height, frame_width = frame.shape[:2]
    print(json.dumps({'type': 'info', 'message': f'Dimensões do vídeo: {frame_width}x{frame_height}'}), flush=True)
    
    tracker = create_tracker(tracker_type)
    if tracker is None:
        cap.release()
        return None
        
    # Valida e ajusta bbox inicial (OpenCV 5 requer int explicitamente)
    bx = int(round(max(0.0, min(float(frame_width - 2), float(bbox[0])))))
    by = int(round(max(0.0, min(float(frame_height - 2), float(bbox[1])))))
    bw = int(round(max(2.0, min(float(frame_width - bx), float(bbox[2])))))
    bh = int(round(max(2.0, min(float(frame_height - by), float(bbox[3])))))
    bbox_tuple = (bx, by, bw, bh)
    
    print(json.dumps({'type': 'info', 'message': f'Inicializando tracker com bbox: {bbox_tuple}'}), flush=True)
    
    try:
        init_res = tracker.init(frame, bbox_tuple)
        if init_res is False:
            print(json.dumps({'error': 'Tracker.init() retornou False - inicialização falhou'}), flush=True)
            cap.release()
            return None
        print(json.dumps({'type': 'info', 'message': 'Tracker inicializado com sucesso'}), flush=True)
    except Exception as e:
        print(json.dumps({'error': f'Erro ao inicializar tracker: {str(e)}'}), flush=True)
        cap.release()
        return None
    
    tracking_data = []
    current_frame = start_frame
    
    # Frame 0 inicial
    tracking_data.append({
        'frame': current_frame,
        'x': int(round(bx)),
        'y': int(round(by)),
        'width': int(round(bw)),
        'height': int(round(bh)),
        'timestamp': 0.0,
        'tracked': True
    })
    
    total_to_process = max(1, end_frame - start_frame)
    current_frame += 1
    
    # Progresso inicial
    print(json.dumps({
        'type': 'progress',
        'current': 1,
        'total': total_to_process,
        'progress': round((1 / total_to_process) * 100, 1),
        'fps': fps
    }), flush=True)
    
    while current_frame < end_frame:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Atualiza o tracker
        success = False
        box = None
        try:
            success, box = tracker.update(frame)
        except Exception:
            success = False
            
        rel_time = (current_frame - start_frame) / fps
        
        if success and box is not None:
            x, y, w, h = [int(round(v)) for v in box]
            
            # Clamp valores para dentro do frame
            x_clamped = max(0, min(x, frame_width - 1))
            y_clamped = max(0, min(y, frame_height - 1))
            w_clamped = max(1, min(w, frame_width - x_clamped))
            h_clamped = max(1, min(h, frame_height - y_clamped))
            
            if w_clamped > 0 and h_clamped > 0:
                tracking_data.append({
                    'frame': current_frame,
                    'x': x_clamped,
                    'y': y_clamped,
                    'width': w_clamped,
                    'height': h_clamped,
                    'timestamp': round(rel_time, 4),
                    'tracked': True
                })
            else:
                success = False
        
        if not success:
            # Perdeu o tracking - mantém última posição conhecida
            if tracking_data:
                last = tracking_data[-1]
                tracking_data.append({
                    'frame': current_frame,
                    'x': last['x'],
                    'y': last['y'],
                    'width': last['width'],
                    'height': last['height'],
                    'timestamp': round(rel_time, 4),
                    'tracked': False
                })
        
        current_frame += 1
        
        # Envia progresso a cada 10 frames
        processed = current_frame - start_frame
        if processed % 10 == 0 or current_frame >= end_frame:
            pct = min(100.0, (processed / total_to_process) * 100)
            print(json.dumps({
                'type': 'progress',
                'current': processed,
                'total': total_to_process,
                'progress': round(pct, 1)
            }), flush=True)
    
    cap.release()
    
    print(json.dumps({
        'type': 'info',
        'message': f'Loop finalizado. Frames processados: {len(tracking_data)}'
    }), flush=True)
    
    if not tracking_data:
        print(json.dumps({'error': 'Nenhum frame foi rastreado.'}), flush=True)
        return None
        
    result = {
        'video': str(Path(video_path).name),
        'tracker_type': tracker_type,
        'start_frame': start_frame,
        'end_frame': current_frame,
        'fps': fps,
        'total_frames': len(tracking_data),
        'initial_bbox': bbox,
        'video_width': frame_width,
        'video_height': frame_height,
        'tracking_data': tracking_data
    }
    
    if output_json:
        try:
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            
            print(json.dumps({
                'type': 'complete',
                'output': output_json,
                'frames_tracked': len(tracking_data)
            }), flush=True)
        except Exception as e:
            print(json.dumps({'error': f'Erro ao salvar JSON: {str(e)}'}), flush=True)
            return None
            
    return tracking_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: motion_tracker.py <config_json>'}), flush=True)
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    try:
        try:
            with open(config_path, 'r', encoding='utf-8-sig') as f:
                config = json.load(f)
        except:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
    except Exception as e:
        print(json.dumps({'error': f'Erro ao ler config: {str(e)}'}), flush=True)
        sys.exit(1)
    
    video_path = config.get('videoPath')
    bbox = config.get('bbox')  # [x, y, width, height]
    start_frame = config.get('startFrame', 0)
    end_frame = config.get('endFrame')
    tracker_type = config.get('trackerType', 'CSRT')
    output_json = config.get('outputJson')
    
    if not video_path or not bbox:
        print(json.dumps({'error': 'videoPath e bbox são obrigatórios'}), flush=True)
        sys.exit(1)
    
    try:
        track_video(video_path, bbox, start_frame, end_frame, tracker_type, output_json)
    except Exception as e:
        import traceback
        print(json.dumps({'error': f'Erro durante tracking: {str(e)}', 'traceback': traceback.format_exc()}), flush=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
