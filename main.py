import decky
import os
import json
import asyncio
import httpx
import traceback
import threading
import time
import subprocess
import tempfile
from httpx import ReadTimeout

CONFIG_PATH = os.path.expanduser("~/.aiassistant_config.json")

class PulseAudioRecorder:
    def __init__(self):
        self.recording = False
        self.audio_process = None
        self.temp_file = None
        
    def start_recording(self):
        if self.recording:
            return False
            
        try:
            # Create temporary file for audio
            self.temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            temp_path = self.temp_file.name
            self.temp_file.close()
            
            # Use PulseAudio to record audio with GStreamer
            # Similar to decky-recorder-fork approach
            cmd = [
                "gst-launch-1.0",
                "pulsesrc", "device=default",
                "!", "audioconvert",
                "!", "audioresample",
                "!", "audio/x-raw,rate=16000,channels=1,format=S16LE",
                "!", "wavenc",
                "!", "filesink", f"location={temp_path}"
            ]
            
            decky.logger.info(f"Starting PulseAudio recording: {' '.join(cmd)}")
            self.audio_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.recording = True
            decky.logger.info("PulseAudio recording started")
            return True
            
        except Exception as e:
            decky.logger.error(f"Failed to start PulseAudio recording: {e}")
            return False
    
    def stop_recording(self):
        if not self.recording:
            return ""
            
        try:
            self.recording = False
            
            # Stop the recording process
            if self.audio_process:
                self.audio_process.terminate()
                self.audio_process.wait(timeout=5)
            
            # Get the recorded file path
            if self.temp_file:
                temp_path = self.temp_file.name
                
                # For now, return a placeholder message
                # In a full implementation, you'd send this to a speech-to-text service
                decky.logger.info(f"Recording saved to: {temp_path}")
                
                # Clean up the temporary file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                
                return "Audio recorded successfully. Speech-to-text processing not yet implemented."
            
            return ""
            
        except Exception as e:
            decky.logger.error(f"Failed to stop PulseAudio recording: {e}")
            return ""

class Plugin:
    
    def __init__(self):
        self.audio_recorder = PulseAudioRecorder()
    
    async def ask_question(self, payload) -> str:
        try:
            # Support both string and dict payloads
            if isinstance(payload, dict):
                question = payload.get('question', '')
                game = payload.get('game', None)
                conversation = payload.get('conversation', None)
            else:
                question = payload
                game = None
                conversation = None

            # 🔍 Controllo domanda
            if not question or not isinstance(question, str) or not question.strip():
                decky.logger.warning("Domanda non valida o vuota.")
                return "Domanda non valida."

            # Recupero chiave API
            if not os.path.exists(CONFIG_PATH):
                decky.logger.warning("File config mancante.")
                return "Chiave API non trovata."

            with open(CONFIG_PATH, "r") as f:
                api_key = json.load(f).get("api_key", "")

            if not api_key:
                decky.logger.warning("Chiave API vuota.")
                return "Chiave API non impostata."

            decky.logger.info(f"Chiave API usata: {repr(api_key)}") # 🔍 Log chiave API

            # Build prompt from conversation if available
            if conversation and isinstance(conversation, list) and len(conversation) > 0:
                # Format: User: ...\nAI: ...\n etc.
                prompt_lines = []
                if game and isinstance(game, dict) and game.get('name'):
                    prompt_lines.append(f"[Game: {game['name']} (AppID: {game['appid']})]")
                for msg in conversation:
                    role = msg.get('role', '')
                    text = msg.get('text', '')
                    if role == 'user':
                        prompt_lines.append(f"User: {text}")
                    elif role == 'ai':
                        prompt_lines.append(f"AI: {text}")
                prompt = "\n".join(prompt_lines)
            else:
                # Fallback to old behavior
                if game and isinstance(game, dict) and game.get('name'):
                    prompt = f"[Game: {game['name']} (AppID: {game['appid']})]\n{question.strip()}"
                else:
                    prompt = question.strip()

            # Preparazione richiesta Gemini
            headers = {
                "Content-Type": "application/json"
            }

            gemini_payload = {
                "contents": [
                    {
                        "parts": [
                            { "text": prompt }
                        ]
                    }
                ]
            }

            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + api_key

            decky.logger.info(f"Richiesta Gemini: {gemini_payload}")

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=gemini_payload)
            except ReadTimeout:
                decky.logger.error("Timeout while waiting for Gemini API response.")
                return "Timeout: The AI service took too long to respond. Please try again."

            decky.logger.info(f"Risposta grezza: {response.text}")

            if response.status_code != 200:
                decky.logger.error(f"Errore HTTP {response.status_code}: {response.text}")
                return f"Errore nella richiesta: {response.status_code}"

            data = response.json()

            output = data["candidates"][0]["content"]["parts"][0]["text"]
            decky.logger.info(f"Risposta Gemini: {output}")
            return output

        except Exception as e:
            decky.logger.error(f"Errore ask_question: {str(e)}\n{traceback.format_exc()}")
            return f"Errore nella richiesta: {str(e)}"

    async def save_api_key(self, key: str) -> str:
        try:
            with open(CONFIG_PATH, "w") as f:
                json.dump({ "api_key": key.strip() }, f)
            os.chmod(CONFIG_PATH, 0o600)  # 🔐 Sicurezza
            decky.logger.info("Chiave API salvata.")
            return "Chiave salvata correttamente."
        except Exception as e:
            decky.logger.error(f"Errore salvataggio chiave: {str(e)}")
            return "Errore nel salvataggio."

    async def get_api_key(self) -> str:
        try:
            if not os.path.exists(CONFIG_PATH):
                return ""
            with open(CONFIG_PATH, "r") as f:
                data = json.load(f)
            return data.get("api_key", "")
        except Exception as e:
            decky.logger.error(f"Errore lettura chiave: {str(e)}")
            return ""

    async def log_message(self, message: str) -> str:
        """
        Log a message from the frontend to the Decky Loader log file.
        Args:
            message (str): The message to log.
        Returns:
            str: Confirmation message.
        """
        try:
            decky.logger.info(f"Frontend: {message}")
            return "Message logged."
        except Exception as e:
            decky.logger.error(f"Failed to log message: {str(e)}")
            return f"Failed to log message: {str(e)}"

    async def start_speech_recognition(self) -> str:
        """
        Start speech recognition process.
        Returns:
            str: Status message.
        """
        try:
            decky.logger.info("Starting PulseAudio recording...")
            success = self.audio_recorder.start_recording()
            if success:
                return "Audio recording started. Speak now."
            else:
                return "Failed to start audio recording. Check if PulseAudio and GStreamer are available."
        except Exception as e:
            decky.logger.error(f"Failed to start audio recording: {str(e)}")
            return f"Failed to start audio recording: {str(e)}"

    async def stop_speech_recognition(self) -> str:
        """
        Stop speech recognition process and return transcript.
        Returns:
            str: Recognized text or status message.
        """
        try:
            decky.logger.info("Stopping PulseAudio recording...")
            result = self.audio_recorder.stop_recording()
            if result:
                decky.logger.info(f"Recording result: {result}")
                return result
            else:
                return "No audio recorded or recording failed."
        except Exception as e:
            decky.logger.error(f"Failed to stop audio recording: {str(e)}")
            return f"Failed to stop audio recording: {str(e)}"

    async def get_speech_status(self) -> str:
        """
        Get the status of speech recognition.
        Returns:
            str: Status message.
        """
        try:
            # Check if GStreamer is available
            try:
                subprocess.run(["gst-launch-1.0", "--version"], 
                             capture_output=True, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                return "GStreamer not available. Install gstreamer package."
            
            # Check if PulseAudio is available
            try:
                subprocess.run(["pactl", "info"], 
                             capture_output=True, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                return "PulseAudio not available. Install pulseaudio package."
            
            if self.audio_recorder.recording:
                return "Recording in progress..."
            else:
                return "Ready for audio recording"
        except Exception as e:
            decky.logger.error(f"Failed to get speech status: {str(e)}")
            return f"Error getting speech status: {str(e)}"
