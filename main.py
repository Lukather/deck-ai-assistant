import decky
import os
import json
import asyncio
import httpx
import traceback
import tempfile
import subprocess
from httpx import ReadTimeout

CONFIG_PATH = os.path.expanduser("~/.aiassistant_config.json")

# Plugin directory paths for bundled dependencies
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
NERD_DICTATION_PATH = os.path.join(PLUGIN_DIR, "nerd-dictation", "nerd-dictation")
VOSK_MODEL_PATH = os.path.join(PLUGIN_DIR, "vosk-model")
VOSK_LIB_PATH = os.path.join(PLUGIN_DIR, "vosk")

class Plugin:
    def __init__(self):
        self.dictation_process = None
        decky.logger.info("Plugin initialized with voice recording support")
    
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

            # Controllo domanda
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

            decky.logger.info(f"Chiave API usata: {repr(api_key)}")  # Log chiave API

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
            os.chmod(CONFIG_PATH, 0o600)  # Sicurezza
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

    async def test_voice_method(self) -> str:
        """
        Simple test method to verify backend communication for voice features.
        Returns:
            str: Test confirmation message.
        """
        try:
            decky.logger.info("=== TEST VOICE METHOD CALLED ===")
            return "Voice method test successful"
        except Exception as e:
            decky.logger.error(f"Test voice method failed: {str(e)}\n{traceback.format_exc()}")
            return f"Test failed: {str(e)}"

    async def start_voice_recording(self) -> str:
        """
        Start voice recording using nerd-dictation (similar to decky-dictation plugin).
        Returns:
            str: Status message.
        """
        try:
            decky.logger.info("=== Starting voice recording with nerd-dictation ===")
            
            # Initialize instance variables if they don't exist
            if not hasattr(self, 'dictation_process'):
                self.dictation_process = None
                
            # Stop any existing recording
            if self.dictation_process:
                decky.logger.info("Stopping existing dictation process")
                await self.stop_voice_recording()
            
            # Check if bundled nerd-dictation is available
            if not os.path.exists(NERD_DICTATION_PATH):
                decky.logger.error(f"Bundled nerd-dictation not found at {NERD_DICTATION_PATH}")
                return "Error: nerd-dictation not available in plugin"
            
            if not os.path.exists(VOSK_MODEL_PATH):
                decky.logger.error(f"Vosk model not found at {VOSK_MODEL_PATH}")
                return "Error: Vosk model not available in plugin"
            
            # Set up environment variables for audio and Python path (like decky-dictation)
            env = os.environ.copy()
            env['PULSE_DEVICE'] = 'default'
            env['PYTHONPATH'] = VOSK_LIB_PATH + ':' + env.get('PYTHONPATH', '')
            # Critical Steam Deck environment variables from decky-dictation
            env['XDG_RUNTIME_DIR'] = '/run/user/1000'
            env['XDG_SESSION_TYPE'] = 'wayland'
            env['DISPLAY'] = ':1'
            
            # Start nerd-dictation process with bundled paths (use default PAREC like decky-dictation)
            cmd = [
                'python3', NERD_DICTATION_PATH, 'begin',
                '--vosk-model-dir', VOSK_MODEL_PATH,
                '--timeout', '10',  # 10 second timeout
                '--output', 'STDOUT',
                # No --input specified, uses default PAREC like decky-dictation
                '--full-sentence'
            ]
            
            decky.logger.info(f"Starting nerd-dictation: {cmd}")
            
            self.dictation_process = subprocess.Popen(
                cmd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT  # Combine stderr with stdout to capture all output
            )
            # No temp file needed since we're using STDOUT
            
            decky.logger.info(f"Dictation started with PID {self.dictation_process.pid}")
            
            # Give it a moment to start and capture any immediate output
            await asyncio.sleep(0.5)
            if self.dictation_process.poll() is not None:
                # Process already ended, capture output
                stdout, _ = self.dictation_process.communicate()
                if stdout:
                    decky.logger.error(f"nerd-dictation failed to start: {stdout.decode()}")
                    return f"Failed to start voice recording: {stdout.decode()}"
            
            return "Voice recording started successfully"
            
        except Exception as e:
            decky.logger.error(f"Error starting voice recording: {str(e)}\n{traceback.format_exc()}")
            return f"Error: {str(e)}"

    async def stop_voice_recording(self) -> str:
        """
        Stop voice recording and return transcribed text using nerd-dictation.
        Returns:
            str: Transcribed text or error message.
        """
        try:
            decky.logger.info("Stopping voice recording...")
            
            # Initialize instance variables if they don't exist
            if not hasattr(self, 'dictation_process'):
                self.dictation_process = None
            
            if not self.dictation_process:
                return "Error: No recording in progress"
            
            # Stop the dictation process
            decky.logger.info("Terminating nerd-dictation process")
            try:
                # First try to end dictation gracefully using bundled nerd-dictation
                env = os.environ.copy()
                env['PYTHONPATH'] = VOSK_LIB_PATH + ':' + env.get('PYTHONPATH', '')
                subprocess.run(['python3', NERD_DICTATION_PATH, 'end'], timeout=3, env=env)
            except:
                # If that fails, kill the process
                if self.dictation_process.poll() is None:
                    self.dictation_process.terminate()
                    try:
                        self.dictation_process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self.dictation_process.kill()
                        self.dictation_process.wait()
            
            # Capture any output from the process
            if self.dictation_process.stdout:
                try:
                    output, _ = self.dictation_process.communicate(timeout=1)
                    if output:
                        decky.logger.info(f"nerd-dictation output: {output.decode()}")
                except:
                    pass
            
            decky.logger.info("Dictation process stopped")
            
            # Wait a moment for output to be written
            await asyncio.sleep(0.5)
            
            # Read transcription from stdout
            transcription = ""
            try:
                if self.dictation_process and self.dictation_process.stdout:
                    stdout_data, _ = self.dictation_process.communicate(timeout=2)
                    if stdout_data:
                        transcription = stdout_data.decode().strip()
                        decky.logger.info(f"Transcription from stdout: '{transcription}'")
                    else:
                        decky.logger.info("No stdout data received")
                else:
                    decky.logger.warning("No dictation process stdout available")
            except Exception as e:
                decky.logger.error(f"Error reading transcription from stdout: {e}")
            
            # Clean up
            self.dictation_process = None
            
            return transcription if transcription else "No speech detected"
            
        except Exception as e:
            decky.logger.error(f"Error stopping voice recording: {str(e)}\n{traceback.format_exc()}")
            # Clean up on error
            self.dictation_process = None
            return f"Error: {str(e)}"

