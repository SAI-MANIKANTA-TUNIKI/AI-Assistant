# backend/tts.py — updated (add text_to_wav for ESP32)
from gtts import gTTS
from pydub import AudioSegment
import uuid, os

os.makedirs("audio_files", exist_ok=True)

# ── Existing function (browser, returns MP3) ─────────────
def text_to_speech(text: str, lang: str = "en") -> str:
    filename = f"audio_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("audio_files", filename)
    gTTS(text=text, lang=lang, slow=False).save(filepath)
    return filepath

# ── NEW function (ESP32-S3, returns WAV) ─────────────────
def text_to_wav(text: str, lang: str = "en") -> str:
    """
    Convert text to a 16-bit 16kHz mono WAV file.
    ESP32-S3 plays WAV directly over I2S — no MP3 decoder needed.
    pydub converts gTTS MP3 → WAV automatically.
    """
    base     = f"audio_{uuid.uuid4().hex}"
    mp3_path = os.path.join("audio_files", f"{base}.mp3")
    wav_path = os.path.join("audio_files", f"{base}.wav")

    # Step 1: Generate speech as MP3 with gTTS
    gTTS(text=text, lang=lang, slow=False).save(mp3_path)

    # Step 2: Convert to WAV — 16kHz, mono, 16-bit PCM
    # These settings match ESP32-S3 I2S playback exactly
    audio = AudioSegment.from_mp3(mp3_path)
    audio = (
        audio
        .set_frame_rate(16000)   # 16 kHz — matches Whisper input too
        .set_channels(1)         # mono
        .set_sample_width(2)     # 16-bit (2 bytes per sample)
    )
    audio.export(wav_path, format="wav")

    # Step 3: Clean up the MP3
    os.remove(mp3_path)

    return wav_path