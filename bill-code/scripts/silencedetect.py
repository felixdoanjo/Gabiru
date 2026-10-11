"""
silencedetect.py - Detecta silêncios usando ffmpeg com pré-filtro de voz.

ESTRATÉGIA:
  1. Aplica bandpass 300–3400Hz (faixa da voz humana).
     - Ruído de tráfego/motor: 50–200Hz  → eliminado
     - Chiado/vento/ar-condicionado: varia, em geral fora de 300–3400Hz → atenuado
     - Voz humana: 300–3400Hz → preservada
  2. Roda silencedetect no áudio filtrado.
  Resultado: detecta silêncio apenas na faixa de voz, ignorando ruído de fundo.
"""
import sys
import os
import json
import re
import subprocess


def get_duration(video_path):
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", video_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def detect_speech_segments(video_path, noise_db=-30, min_silence_s=0.6, min_speech_s=0.3):
    """
    Detecta segmentos com voz humana usando bandpass + silencedetect.

    noise_db     : threshold de silêncio na faixa de voz. -30dB funciona bem
                   para entrevistas ao ar livre com ruído de rua.
                   Valores menos negativos (ex: -20dB) = mais agressivo.
    min_silence_s: silêncios menores que este valor NÃO são cortados (pausa natural).
    min_speech_s : blocos de voz menores que este valor são descartados.
    """
    duration = get_duration(video_path)
    print(
        f"[SilenceDetect] Duração: {duration:.2f}s | "
        f"threshold: {noise_db}dB | min_silence: {min_silence_s}s | "
        f"filtro: bandpass 300-3400Hz (voz humana)",
        file=sys.stderr
    )

    # Filtro: isola a faixa de voz humana, então mede silêncio nessa faixa
    # highpass=300Hz remove tráfego/motor; lowpass=3400Hz remove chiado/sopro
    audio_filter = (
        f"highpass=f=300,"
        f"lowpass=f=3400,"
        f"silencedetect=noise={noise_db}dB:d={min_silence_s}"
    )

    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", audio_filter,
        "-f", "null", "-"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stderr

    silence_starts = []
    silence_ends = []

    for line in output.splitlines():
        m_start = re.search(r"silence_start:\s*([\d.e+\-]+)", line)
        m_end   = re.search(r"silence_end:\s*([\d.e+\-]+)",   line)
        if m_start:
            silence_starts.append(float(m_start.group(1)))
        if m_end:
            silence_ends.append(float(m_end.group(1)))

    print(f"[SilenceDetect] Silêncios detectados (na faixa de voz): {len(silence_starts)}", file=sys.stderr)
    for i, (s, e) in enumerate(zip(silence_starts, silence_ends)):
        print(f"  [{i+1}] {s:.2f}s → {e:.2f}s  ({e-s:.1f}s de silêncio)", file=sys.stderr)

    # Se o vídeo termina em silêncio, silence_end pode não ter sido emitido
    if len(silence_starts) > len(silence_ends):
        silence_ends.append(duration)

    # Deriva os segmentos de VOZ a partir dos gaps entre silêncios
    speech_segments = []
    cursor = 0.0

    for i in range(len(silence_starts)):
        sil_start = max(0.0, silence_starts[i])
        sil_end   = min(duration, silence_ends[i])

        speech_dur = sil_start - cursor
        if speech_dur >= min_speech_s:
            speech_segments.append({
                "start": round(cursor, 3),
                "end":   round(sil_start, 3),
                "text":  "speech",
                "no_speech_prob": 0.0
            })
        cursor = sil_end

    # Fala após o último silêncio
    if duration - cursor >= min_speech_s:
        speech_segments.append({
            "start": round(cursor, 3),
            "end":   round(duration, 3),
            "text":  "speech",
            "no_speech_prob": 0.0
        })

    print(f"[SilenceDetect] Segmentos de voz encontrados: {len(speech_segments)}", file=sys.stderr)
    for seg in speech_segments:
        print(f"  Voz: {seg['start']:.2f}s → {seg['end']:.2f}s  ({seg['end']-seg['start']:.1f}s)", file=sys.stderr)

    return speech_segments, duration


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Uso: python silencedetect.py <video_path> [noise_db] [min_silence_s]"}))
        sys.exit(1)

    video_path  = sys.argv[1]
    noise_db    = float(sys.argv[2]) if len(sys.argv) > 2 else -30
    min_silence = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6

    if not os.path.exists(video_path):
        print(json.dumps({"success": False, "error": f"Arquivo não encontrado: {video_path}"}))
        sys.exit(1)

    try:
        segments, duration = detect_speech_segments(video_path, noise_db, min_silence)
        print(json.dumps({
            "success": True,
            "segments": segments,
            "duration": duration,
            "language": "silencedetect-bandpass"
        }))
    except Exception as e:
        import traceback
        print(json.dumps({"success": False, "error": f"{e}\n{traceback.format_exc()}"}))
