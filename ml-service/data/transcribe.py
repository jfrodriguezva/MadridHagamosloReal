"""
Transcripción local de audio a texto con faster-whisper -- para generar
shownotes/descripción de YouTube desde tu propia grabación del podcast, sin
ningún servicio externo de pago (mismo principio que el editor de imagen:
nunca IA externa que requiera tu propia API key y billing).

El modelo se descarga UNA vez (~150MB el "small", desde Hugging Face) la
primera vez que corre y se cachea en ~/.cache/huggingface -- de ahí en
adelante funciona sin internet.

Uso:
    python transcribe.py <ruta-al-audio> [--model small] [--lang es]

Imprime el transcrito en texto plano a stdout (una línea por segmento, sin
timestamps) -- api/Program.cs lo captura tal cual desde el subproceso.
"""
import argparse
import sys


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium"])
    parser.add_argument("--lang", default="es")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        log("Falta faster-whisper. Instálalo con:")
        log("  cd ml-service")
        log("  .venv\\Scripts\\python.exe -m pip install -r requirements-transcribe.txt")
        sys.exit(1)

    log(f"Cargando el modelo '{args.model}' (la primera vez se descarga, después queda en caché)...")
    # int8 en CPU es varias veces más rápido que float32 con pérdida de precisión
    # mínima -- suficiente para shownotes, no hace falta precisión de transcripción legal.
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    log("Transcribiendo (puede tardar varios minutos según la duración del audio)...")
    segments, info = model.transcribe(args.audio_path, language=args.lang, beam_size=5)

    log(f"Detectado: idioma={info.language} duración={info.duration:.0f}s")

    for seg in segments:
        text = seg.text.strip()
        if text:
            print(text)


if __name__ == "__main__":
    main()
