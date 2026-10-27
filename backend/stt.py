# backend/stt.py
import subprocess
import os
import whisper
from typing import Any

# Load the model ONCE. 
# "base" is a good balance of speed and accuracy. Use "small" for better accuracy.
model = whisper.load_model("base")

def transcribe_audio(file_path: str) -> str:
    """
    Converts the input audio to a standard WAV format using robust ffmpeg flags,
    then transcribes it using Whisper.
    """
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        raise ValueError("Audio file is empty or does not exist")

    wav_path = f"{file_path}.wav"
    
    try:
        print(f"[stt] Converting {file_path} to WAV using robust ffmpeg...")
        
        # Use subprocess to call ffmpeg directly with robust flags
        # -err_detect ignore_err : Tells ffmpeg to ignore errors in the broken WebM header
        # -analyzeduration 100M  : Spends more time analyzing the input file
        # -probesize 100M        : Reads more data to find the audio stream
        command = [
            "ffmpeg",
            "-y",                           # Overwrite output file
            "-err_detect", "ignore_err",    # Ignore errors in corrupted files
            "-analyzeduration", "100M",     # Increase analysis duration
            "-probesize", "100M",           # Increase probe size
            "-i", file_path,
            "-ar", "16000",                 # 16kHz sample rate
            "-ac", "1",                     # Mono
            "-c:a", "pcm_s16le",            # 16-bit PCM
            wav_path
        ]
        
        result = subprocess.run(command, capture_output=True, check=True)
        
        print(f"[stt] Transcribing {wav_path}...")
        result_data: dict[str, Any] = model.transcribe(wav_path, fp16=False)
        text = result_data["text"].strip()
        return text
        
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode()
        print(f"❌ ffmpeg failed: {error_msg}")
        raise RuntimeError(f"Audio conversion failed: {error_msg}")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise e
    finally:
        # Clean up the temporary WAV file
        if os.path.exists(wav_path):
            os.remove(wav_path)