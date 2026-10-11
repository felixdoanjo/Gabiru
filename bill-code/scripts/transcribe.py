import sys
import os
import json
import subprocess

def check_ffmpeg():
    # 1. Tenta env FFMPEG_PATH e caminhos de runtime
    ffmpeg_path = os.environ.get('FFMPEG_PATH', '')
    candidates = [
        ffmpeg_path,
        "ffmpeg",
        os.path.expandvars(r"%APPDATA%\bill-code\runtime\ffmpeg\bin\ffmpeg.exe"),
        os.path.expandvars(r"%APPDATA%\Gabiru\runtime\ffmpeg\bin\ffmpeg.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\bill-code\runtime\ffmpeg\bin\ffmpeg.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Gabiru\runtime\ffmpeg\bin\ffmpeg.exe"),
        os.path.join(os.path.dirname(sys.executable), 'runtime', 'ffmpeg', 'bin', 'ffmpeg.exe'),
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    ]
    for c in candidates:
        if not c: continue
        try:
            subprocess.run([c, "-version"], capture_output=True, check=True)
            print(f"[FFmpeg] Found: {c}", file=sys.stderr)
            ffmpeg_dir = os.path.dirname(c)
            if ffmpeg_dir and ffmpeg_dir not in os.environ.get('PATH', ''):
                os.environ['PATH'] = f"{ffmpeg_dir};{os.environ.get('PATH', '')}"
            return True
        except Exception:
            continue
    return False

def transcribe(video_path):
    if not os.path.exists(video_path):
        return {"success": False, "error": f"Arquivo não encontrado: {video_path}"}

    if not check_ffmpeg():
        return {"success": False, "error": "FFmpeg não encontrado. Instale o FFmpeg."}

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {"success": False, "error": "Instale: pip install faster-whisper"}

    try:
        print(f"[Whisper] Carregando modelo 'base'...", file=sys.stderr)
        model = WhisperModel("base", device="cpu", compute_type="int8")

        print(f"[Whisper] Transcrevendo: {os.path.basename(video_path)}", file=sys.stderr)

        # Configuração simples - auto-detecta idioma
        segments_gen, info = model.transcribe(
            video_path,
            beam_size=5,
            language=None,       # Auto-detecta idioma
            task="transcribe",
            vad_filter=True,     # VAD ativado
        )

        print(f"[Whisper] Idioma detectado: {info.language} (prob={info.language_probability:.2f})", file=sys.stderr)
        print(f"[Whisper] Processando segments...", file=sys.stderr)

        results = []
        for segment in segments_gen:
            no_speech = getattr(segment, 'no_speech_prob', 0.0)
            text = segment.text.strip()

            # Log de cada segmento para debug no terminal
            print(f"[Seg] {segment.start:.2f}s → {segment.end:.2f}s | no_speech={no_speech:.2f} | '{text}'", file=sys.stderr)

            # Descarta segmentos com alta probabilidade de não-fala
            # Threshold mais rigoroso para evitar alucinações
            if no_speech > 0.7:
                print(f"  → DESCARTADO (no_speech={no_speech:.2f} > 0.7)", file=sys.stderr)
                continue

            # Descarta textos muito curtos, números soltos ou alucinações típicas
            common_hallucinations = {"", ".", "..", "...", "…", "obrigado", "obrigada",
                                     "continue", "[música]", "[aplausos]", "[inaudível]",
                                     "legendas", "subtitles", "transcript"}
            
            # Descarta se for só números/pontos (como "1.1.1.2.2.2")
            if all(c in '0123456789. ' for c in text):
                print(f"  → DESCARTADO (só números/pontos)", file=sys.stderr)
                continue
                
            if text.lower() in common_hallucinations or len(text) < 3:
                print(f"  → DESCARTADO (alucinação comum)", file=sys.stderr)
                continue

            results.append({
                "start": round(segment.start, 3),
                "end":   round(segment.end, 3),
                "text":  text,
                "no_speech_prob": round(no_speech, 3),
            })

        print(f"[Whisper] Total de segmentos válidos: {len(results)}", file=sys.stderr)
        return {"success": True, "segments": results, "language": info.language}

    except Exception as e:
        import traceback
        err = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[Whisper] ERRO: {err}", file=sys.stderr)
        return {"success": False, "error": err}

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Caminho do vídeo não fornecido."}))
        sys.exit(1)

    result = transcribe(sys.argv[1])
    print(json.dumps(result))
