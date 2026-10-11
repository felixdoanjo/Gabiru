"""
vad_detect.py - Voice Activity Detection usando webrtcvad (Google WebRTC).
Detecta VOZ HUMANA, ignorando ruído de fundo (trânsito, chiado, vento, etc).
Não usa IA pesada — é um algoritmo de análise de frequência de voz.

Dependência: pip install webrtcvad
"""
import sys
import os
import json
import struct
import subprocess
import wave
import tempfile

def extract_audio_pcm(video_path, out_wav):
    """Extrai áudio do vídeo como WAV 16kHz mono 16-bit (formato que o webrtcvad aceita)."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-ac", "1",           # mono
        "-ar", "16000",       # 16kHz
        "-sample_fmt", "s16", # 16-bit signed
        "-vn",                # sem vídeo
        out_wav
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg falhou: {r.stderr.decode()}")

def read_wave(path):
    with wave.open(path, 'rb') as wf:
        sample_rate = wf.getframerate()
        num_frames = wf.getnframes()
        data = wf.readframes(num_frames)
    return data, sample_rate

def frame_generator(frame_duration_ms, audio, sample_rate):
    """Gera frames de audio de tamanho fixo (10, 20 ou 30ms)."""
    n = int(sample_rate * (frame_duration_ms / 1000.0) * 2)  # *2 para 16-bit
    offset = 0
    while offset + n <= len(audio):
        yield audio[offset:offset + n]
        offset += n

def vad_detect(video_path, aggressiveness=2, frame_ms=30, min_speech_s=0.3, padding_ms=300):
    """
    Detecta segmentos de voz humana.

    aggressiveness: 0=mais sensível (detecta mais coisas como voz), 3=mais agressivo (só voz clara)
                    Use 2 ou 3 para vídeos barulhentos.
    min_speech_s: duração mínima de um bloco de fala para incluir.
    padding_ms: janela de contexto em ms antes/depois de cada segmento de fala.
    """
    try:
        import webrtcvad
    except ImportError:
        return {"success": False, "error": "webrtcvad não instalado. Execute: pip install webrtcvad"}

    print(f"[VAD] Extraindo áudio de: {video_path}", file=sys.stderr)
    print(f"[VAD] Aggressiveness={aggressiveness} | frame={frame_ms}ms | min_speech={min_speech_s}s", file=sys.stderr)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = tmp.name

    try:
        extract_audio_pcm(video_path, tmp_wav)
        audio, sample_rate = read_wave(tmp_wav)
    finally:
        try:
            os.unlink(tmp_wav)
        except:
            pass

    vad = webrtcvad.Vad(aggressiveness)

    frames = list(frame_generator(frame_ms, audio, sample_rate))
    frame_duration_s = frame_ms / 1000.0
    num_padding_frames = int(padding_ms / frame_ms)

    # Ring buffer para suavizar decisões (evitar micro-cortes)
    from collections import deque
    ring_buffer = deque(maxlen=num_padding_frames)

    triggered = False
    voiced_frames = []
    speech_segments = []
    segment_start = 0.0

    for i, frame in enumerate(frames):
        ts = i * frame_duration_s
        is_speech = vad.is_speech(frame, sample_rate)

        if not triggered:
            ring_buffer.append((ts, is_speech))
            num_voiced = len([f for f in ring_buffer if f[1]])
            if num_voiced > 0.9 * ring_buffer.maxlen:
                triggered = True
                segment_start = ring_buffer[0][0]
                voiced_frames = list(ring_buffer)
                ring_buffer.clear()
        else:
            voiced_frames.append((ts, is_speech))
            ring_buffer.append((ts, is_speech))
            num_unvoiced = len([f for f in ring_buffer if not f[1]])
            if num_unvoiced > 0.9 * ring_buffer.maxlen:
                segment_end = ts + frame_duration_s
                seg_dur = segment_end - segment_start
                if seg_dur >= min_speech_s:
                    speech_segments.append({
                        "start": round(segment_start, 3),
                        "end":   round(segment_end, 3),
                        "text":  "speech",
                        "no_speech_prob": 0.0
                    })
                    print(f"[VAD] Fala: {segment_start:.2f}s → {segment_end:.2f}s ({seg_dur:.1f}s)", file=sys.stderr)
                else:
                    print(f"[VAD] Ignorado (muito curto {seg_dur:.1f}s): {segment_start:.2f}s → {segment_end:.2f}s", file=sys.stderr)
                triggered = False
                voiced_frames = []
                ring_buffer.clear()

    # Fechamento do último segmento (se terminar em fala)
    if triggered and voiced_frames:
        segment_end = voiced_frames[-1][0] + frame_duration_s
        seg_dur = segment_end - segment_start
        if seg_dur >= min_speech_s:
            speech_segments.append({
                "start": round(segment_start, 3),
                "end":   round(segment_end, 3),
                "text":  "speech",
                "no_speech_prob": 0.0
            })
            print(f"[VAD] Fala final: {segment_start:.2f}s → {segment_end:.2f}s", file=sys.stderr)

    print(f"[VAD] Total de segmentos de voz: {len(speech_segments)}", file=sys.stderr)
    return {"success": True, "segments": speech_segments, "language": "vad"}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Uso: python vad_detect.py <video_path> [aggressiveness 0-3]"}))
        sys.exit(1)

    video_path   = sys.argv[1]
    aggressiveness = int(sys.argv[2]) if len(sys.argv) > 2 else 2

    if not os.path.exists(video_path):
        print(json.dumps({"success": False, "error": f"Arquivo não encontrado: {video_path}"}))
        sys.exit(1)

    try:
        result = vad_detect(video_path, aggressiveness)
        print(json.dumps(result))
    except Exception as e:
        import traceback
        print(json.dumps({"success": False, "error": f"{e}\n{traceback.format_exc()}"}))
