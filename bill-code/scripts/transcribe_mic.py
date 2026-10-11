import sys
import os
import json
import subprocess

def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except:
        return False

def transcribe_mic_audio(audio_path):
    """
    Transcrição otimizada para áudio de microfone (push-to-talk e chamada de voz).
    Usa filtros MENOS agressivos que o transcribe.py padrão.
    """
    if not os.path.exists(audio_path):
        return {"success": False, "error": f"Arquivo não encontrado: {audio_path}"}

    if not check_ffmpeg():
        return {"success": False, "error": "FFmpeg não encontrado. Instale o FFmpeg."}

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return {"success": False, "error": "Instale: pip install faster-whisper"}

    try:
        print(f"[Whisper Mic] Carregando modelo 'base'...", file=sys.stderr)
        model = WhisperModel("base", device="cpu", compute_type="int8")

        print(f"[Whisper Mic] Transcrevendo áudio: {os.path.basename(audio_path)}", file=sys.stderr)
        print(f"[Whisper Mic] Tamanho: {os.path.getsize(audio_path)} bytes", file=sys.stderr)
        print(f"[Whisper Mic] Extensão: {os.path.splitext(audio_path)[1]}", file=sys.stderr)
        
        # Testa se o FFmpeg consegue ler o arquivo
        try:
            probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
            result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=5)
            duration = result.stdout.strip()
            print(f"[Whisper Mic] Duração do áudio: {duration}s", file=sys.stderr)
        except Exception as e:
            print(f"[Whisper Mic] ⚠️ Aviso: FFprobe falhou: {e}", file=sys.stderr)

        # Configuração OTIMIZADA para áudio de microfone:
        # - vad_filter=False: NÃO filtra silêncios (captura tudo que foi gravado)
        # - beam_size=5: mantém qualidade
        # - language="pt": força português (mais rápido e preciso para pt-BR)
        segments_gen, info = model.transcribe(
            audio_path,
            beam_size=5,
            language="pt",        # Força português (melhora precisão)
            task="transcribe",
            vad_filter=False,     # NÃO filtra silêncios (queremos TUDO que foi gravado)
            condition_on_previous_text=False,  # Evita alucinações baseadas em contexto anterior
            word_timestamps=False,  # Não precisa de timestamps de palavras (mais rápido)
        )

        print(f"[Whisper Mic] Idioma: {info.language} (prob={info.language_probability:.2f})", file=sys.stderr)

        results = []
        segment_count = 0
        for segment in segments_gen:
            segment_count += 1
            no_speech = getattr(segment, 'no_speech_prob', 0.0)
            text = segment.text.strip()

            # Log detalhado para debug
            print(f"[Seg {segment_count}] {segment.start:.2f}s → {segment.end:.2f}s | no_speech={no_speech:.2f} | '{text}'", file=sys.stderr)

            # Filtro MUITO MENOS agressivo para microfone:
            # - Aceita no_speech até 0.85 (vs 0.6 do padrão)
            # - Não filtra palavras comuns (obrigado, continue, etc)
            # - Tamanho mínimo de apenas 1 caractere
            if no_speech > 0.85:
                print(f"  → DESCARTADO (no_speech={no_speech:.2f} muito alto)", file=sys.stderr)
                continue

            # Descarta APENAS textos completamente vazios ou pontuação pura
            if not text or text in {"", ".", "..", "...", "…"}:
                print(f"  → DESCARTADO (vazio ou só pontuação)", file=sys.stderr)
                continue

            print(f"  → ✓ ACEITO", file=sys.stderr)
            results.append({
                "start": round(segment.start, 3),
                "end":   round(segment.end, 3),
                "text":  text,
                "no_speech_prob": round(no_speech, 3),
            })

        print(f"[Whisper Mic] Total de segmentos processados: {segment_count}", file=sys.stderr)
        print(f"[Whisper Mic] Total de segmentos aceitos: {len(results)}", file=sys.stderr)
        
        if len(results) == 0:
            print(f"[Whisper Mic] ⚠️ NENHUM segmento válido encontrado!", file=sys.stderr)
            print(f"[Whisper Mic] Possíveis causas:", file=sys.stderr)
            print(f"  - Áudio muito curto ou vazio", file=sys.stderr)
            print(f"  - Sem fala detectada (apenas ruído/silêncio)", file=sys.stderr)
            print(f"  - Problema no codec do arquivo", file=sys.stderr)
        
        return {"success": True, "segments": results, "language": info.language}

    except Exception as e:
        import traceback
        err = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[Whisper Mic] ERRO: {err}", file=sys.stderr)
        return {"success": False, "error": err}

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Caminho do áudio não fornecido."}))
        sys.exit(1)

    result = transcribe_mic_audio(sys.argv[1])
    print(json.dumps(result))
