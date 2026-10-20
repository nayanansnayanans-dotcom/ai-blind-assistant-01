"""
VisionAssist AI - Continuous Background Voice Launcher for Blind Users
Listens for: "hey assistant, open vision assistant ai" (and variations)
Directly launches the live Vercel application in the browser with ZERO typing or tapping.
"""

import os
import sys
import time
import io
import argparse
import subprocess
import webbrowser
import speech_recognition as sr
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav
import pyttsx3

# Default Live Vercel Application URLs and Local Development URLs
DEFAULT_VERCEL_URL = os.environ.get("VERCEL_APP_URL", "https://ai-blind-assistant-01.vercel.app")
DEFAULT_LOCAL_URL = os.environ.get("LOCAL_APP_URL", "http://localhost:5173")
FALLBACK_VERCEL_URL = "https://ai-blind-assistant-frontend.vercel.app"

# Initialize pyttsx3 Text-To-Speech engine
tts_engine = None
try:
    tts_engine = pyttsx3.init()
    tts_engine.setProperty('rate', 170)
    voices = tts_engine.getProperty('voices')
    if voices and len(voices) > 0:
        # Prefer English voice if available
        for v in voices:
            if "english" in v.name.lower() or "zira" in v.name.lower() or "david" in v.name.lower():
                tts_engine.setProperty('voice', v.id)
                break
except Exception as e:
    print(f"[TTS Init Warning] {e}")

def speak(text):
    """Speaks text aloud for visually impaired users."""
    print(f"\n[VisionAssist Audio] {text}")
    if tts_engine:
        try:
            tts_engine.say(text)
            tts_engine.runAndWait()
        except Exception as e:
            print(f"[TTS Error] {e}")

def open_browser_handsfree(url):
    """
    Directly opens the browser to the live Vercel application with full-screen
    and unmuted autoplay policy flags so audio narration starts without tapping.
    """
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
    ]
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]

    # Try Google Chrome first with audio autoplay enabled
    for p in chrome_paths:
        if os.path.exists(p):
            try:
                subprocess.Popen([
                    p,
                    "--start-maximized",
                    "--autoplay-policy=no-user-gesture-required",
                    "--enable-speech-dispatcher",
                    url
                ])
                print(f"[Browser] Launched Google Chrome with hands-free audio autoplay: {url}")
                return True
            except Exception:
                pass

    # Try Microsoft Edge
    for p in edge_paths:
        if os.path.exists(p):
            try:
                subprocess.Popen([
                    p,
                    "--start-maximized",
                    "--autoplay-policy=no-user-gesture-required",
                    url
                ])
                print(f"[Browser] Launched Microsoft Edge: {url}")
                return True
            except Exception:
                pass

    # Default browser fallback
    try:
        webbrowser.open_new(url)
        print(f"[Browser] Launched default system browser: {url}")
        return True
    except Exception as e:
        print(f"[Browser Launch Error] {e}")
        return False

def is_target_wake_command(text):
    """
    Checks if spoken text contains the wake command.
    Returns: (is_matched: bool, mode: 'local' | 'vercel')
    Matches:
    - 'open vision assistant ai in vs' -> (True, 'local')
    - 'open vision assistant in vs' -> (True, 'local')
    - 'open vision assistant local' -> (True, 'local')
    - 'hey assistant open vision assistant ai' -> (True, 'vercel')
    - 'open vision assistant ai' -> (True, 'vercel')
    """
    clean = text.lower().replace(",", "").replace(".", "").replace("-", " ")
    tokens = clean.split()
    s = " ".join(tokens)

    # Check if local / VS Code development intent is present
    is_local_intent = any(w in tokens for w in ["vs", "vscode", "local", "localhost", "dev"]) or ("in vs" in s)

    # 1. Exact or near-exact target phrase match
    direct_phrases = [
        "hey assistant open vision assistant ai",
        "hey assistant open vision assistant",
        "hey assistant open vision assist",
        "assistant open vision assistant ai",
        "assistant open vision assistant",
        "open vision assistant ai",
        "open vision assistant",
        "open vision assist ai",
        "open vision assist",
        "open vision ai",
        "open vision",
        "vision assistant ai",
        "vision assistant",
        "vision assist ai",
        "vision assist",
        "open visual assistant",
        "launch vision assistant",
        "start vision assistant"
    ]

    for phrase in direct_phrases:
        if phrase in s:
            return True, ("local" if is_local_intent else "vercel")

    # 2. Token combination checks
    has_open = any(w in tokens for w in ["open", "launch", "start", "load", "access", "go"])
    has_vision = any(w in tokens for w in ["vision", "visionassist", "visionassistant", "visual"])
    has_assist = any(w in tokens for w in ["assistant", "assist", "ai"])

    if has_vision and (has_open or has_assist):
        return True, ("local" if is_local_intent else "vercel")

    if "assistant" in tokens and has_vision:
        return True, ("local" if is_local_intent else "vercel")

    return False, "vercel"

def continuous_voice_listener(target_url, local_url=DEFAULT_LOCAL_URL):
    """
    Continuously listens for wake command in background with sliding audio overlap.
    """
    recognizer = sr.Recognizer()
    sample_rate = 16000
    chunk_duration = 3.0   # Record 3.0 seconds per slice
    overlap_duration = 1.0 # Keep last 1.0 second for smooth rolling window

    print(f"\n=======================================================")
    print(f"  VisionAssist AI - Hands-Free Background Voice Launcher")
    print(f"  Vercel Cloud URL: {target_url}")
    print(f"  VS Code Local URL: {local_url}")
    print(f"  Commands:")
    print(f"    - 'Hey assistant, open vision assistant ai' (opens Vercel)")
    print(f"    - 'Open vision assistant ai in vs' (opens VS local dev server)")
    print(f"=======================================================\n")

    speak("Vision Assist Voice Launcher is active and listening. Say: Hey Assistant, open Vision Assistant AI at any time.")

    prev_overlap_samples = np.zeros(int(overlap_duration * sample_rate), dtype='int16')

    while True:
        try:
            # 1. Capture audio slice from default microphone
            raw_chunk = sd.rec(int(chunk_duration * sample_rate), samplerate=sample_rate, channels=1, dtype='int16')
            sd.wait()
            raw_chunk = raw_chunk.flatten()

            # 2. Measure audio energy (RMS) to filter out quiet background silence
            rms = np.sqrt(np.mean(raw_chunk.astype(np.float32)**2))
            if rms < 350:  # Ambient silence, skip speech recognition to avoid latency
                prev_overlap_samples = raw_chunk[-int(overlap_duration * sample_rate):]
                continue

            # 3. Concatenate overlap from previous slice to avoid cutting words
            combined_audio = np.concatenate((prev_overlap_samples, raw_chunk))
            prev_overlap_samples = raw_chunk[-int(overlap_duration * sample_rate):]

            # 4. Pack into in-memory WAV buffer
            byte_io = io.BytesIO()
            wav.write(byte_io, sample_rate, combined_audio)
            byte_io.seek(0)

            # 5. Recognize speech using Google Speech API
            with sr.AudioFile(byte_io) as source:
                audio_data = recognizer.record(source)

            command = recognizer.recognize_google(audio_data).lower()
            print(f"[Heard] \"{command}\" (RMS: {int(rms)})")

            # 6. Verify if command matches wake target
            matched, mode = is_target_wake_command(command)
            if matched:
                if mode == "local":
                    speak("Opening Vision Assist A I in VS Code local mode.")
                    open_browser_handsfree(local_url)
                else:
                    speak("Opening Vision Assist A I on Vercel now. Please wait.")
                    open_browser_handsfree(target_url)

                # Reset overlap and pause briefly to let browser take focus
                prev_overlap_samples = np.zeros(int(overlap_duration * sample_rate), dtype='int16')
                time.sleep(10)
                print("\n[VisionAssist AI] Resuming background listener...")

        except sr.UnknownValueError:
            # Normal speech unintelligible or noise
            continue
        except sr.RequestError as req_err:
            print(f"[Network] Speech Recognition API unreachable: {req_err}")
            time.sleep(2)
        except Exception as e:
            # Catch transient device errors safely
            time.sleep(0.5)
            continue

def main():
    parser = argparse.ArgumentParser(description="VisionAssist AI Voice Launcher for Blind Users")
    parser.add_argument("--url", default=DEFAULT_VERCEL_URL, help="Target Vercel deployment URL")
    parser.add_argument("--local", action="store_true", help="Default to local mode (http://localhost:5173)")
    parser.add_argument("--local-url", default=DEFAULT_LOCAL_URL, help="Local development URL")
    args = parser.parse_args()

    target_url = args.url.strip()
    if not target_url.startswith("http"):
        target_url = f"https://{target_url}"

    local_url = args.local_url.strip()
    if not local_url.startswith("http"):
        local_url = f"http://{local_url}"

    if args.local:
        target_url = local_url

    continuous_voice_listener(target_url, local_url)

if __name__ == "__main__":
    main()
