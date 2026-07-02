import decky
import os
import json
import asyncio
import httpx
import traceback
import tempfile
import subprocess
from httpx import ReadTimeout

# Use Decky Loader recommended paths for settings
CONFIG_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "config.json")

# Plugin directory paths for bundled dependencies
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
NERD_DICTATION_PATH = os.path.join(PLUGIN_DIR, "nerd-dictation", "nerd-dictation")
VOSK_MODEL_PATH = os.path.join(PLUGIN_DIR, "vosk-model")
VOSK_LIB_PATH = os.path.join(PLUGIN_DIR, "vosk")

class Plugin:
    def __init__(self):
        self.dictation_process = None
        self._voice_lock = asyncio.Lock()  # Prevent concurrent voice operations
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

            # Question validation
            if not question or not isinstance(question, str) or not question.strip():
                decky.logger.warning("Invalid or empty question.")
                return "Invalid question."

            # Retrieve API key from settings directory
            if not os.path.exists(CONFIG_PATH):
                decky.logger.warning("Config file not found.")
                return "API key not found."

            with open(CONFIG_PATH, "r") as f:
                api_key = json.load(f).get("api_key", "")

            if not api_key:
                decky.logger.warning("API key is empty.")
                return "API key not set."

            # Security: Never log full API key - mask all but last 4 chars
            masked_key = f"****{api_key[-4:]}" if len(api_key) >= 4 else "****"
            decky.logger.info(f"API key used: {masked_key}")

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

            # Prepare Gemini request
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

            decky.logger.info(f"Gemini request: {gemini_payload}")

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, headers=headers, json=gemini_payload)
            except ReadTimeout:
                decky.logger.error("Timeout while waiting for Gemini API response.")
                return "Timeout: The AI service took too long to respond. Please try again."

            decky.logger.info(f"Raw response: {response.text}")

            if response.status_code != 200:
                decky.logger.error(f"HTTP error {response.status_code}: {response.text}")
                return f"Request error: {response.status_code}"

            data = response.json()

            output = data["candidates"][0]["content"]["parts"][0]["text"]
            decky.logger.info(f"Gemini response: {output}")
            return output

        except Exception as e:
            decky.logger.error(f"Error in ask_question: {str(e)}\n{traceback.format_exc()}")
            return f"Request error: {str(e)}"

    async def save_api_key(self, key: str) -> str:
        try:
            # Ensure the settings directory exists
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            with open(CONFIG_PATH, "w") as f:
                json.dump({ "api_key": key.strip() }, f)
            os.chmod(CONFIG_PATH, 0o600)  # Security: restrict file permissions
            decky.logger.info("API key saved.")
            return "Key saved successfully."
        except Exception as e:
            decky.logger.error(f"Error saving key: {str(e)}")
            return "Error saving key."

    async def get_api_key(self) -> str:
        try:
            if not os.path.exists(CONFIG_PATH):
                return ""
            with open(CONFIG_PATH, "r") as f:
                data = json.load(f)
            return data.get("api_key", "")
        except Exception as e:
            decky.logger.error(f"Error reading key: {str(e)}")
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

    async def start_voice_recording(self) -> str:
        """
        Start voice recording using nerd-dictation (similar to decky-dictation plugin).
        Returns:
            str: Status message.
        """
        async with self._voice_lock:
            try:
                decky.logger.info("=== Starting voice recording with nerd-dictation ===")
                
                # Check if already recording
                if self.dictation_process is not None:
                    if self.dictation_process.poll() is None:
                        decky.logger.info("Already recording, stopping first")
                        await self._cleanup_dictation_process()
                    else:
                        # Zombie process, clean up reference
                        self.dictation_process = None
                
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

                # Start nerd-dictation with explicit PulseAudio monitor source
                cmd = [
                    'python3', NERD_DICTATION_PATH, 'begin',
                    '--vosk-model-dir', VOSK_MODEL_PATH,
                    '--timeout', '10',  # 10 second timeout
                    '--output', 'STDOUT',
                    '--input', 'PAREC',
                    '--full-sentence'
                ]

                decky.logger.info(f"Starting nerd-dictation: {cmd}")

                self.dictation_process = subprocess.Popen(
                    cmd,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT  # Combine stderr with stdout to capture all output
                )

                decky.logger.info(f"Dictation started with PID {self.dictation_process.pid}")

                # Give it a moment to start and check for immediate failures
                await asyncio.sleep(0.5)

                # Check if process died immediately (error during startup)
                if self.dictation_process.poll() is not None:
                    stdout, _ = self.dictation_process.communicate()
                    error_msg = stdout.decode().strip() if stdout else "Unknown error"
                    decky.logger.error(f"nerd-dictation failed to start: {error_msg}")
                    self.dictation_process = None
                    return f"Failed to start voice recording: {error_msg}"

                return "Voice recording started successfully"

            except Exception as e:
                decky.logger.error(f"Error starting voice recording: {str(e)}\n{traceback.format_exc()}")
                self.dictation_process = None
                return f"Error: {str(e)}"

    async def _cleanup_dictation_process(self) -> None:
        """
        Internal: Clean up the dictation process safely.
        Must be called while holding _voice_lock.
        """
        if self.dictation_process is None:
            return
        
        proc = self.dictation_process
        self.dictation_process = None  # Clear reference FIRST
        
        # Check if already dead
        if proc.poll() is not None:
            # Already dead, just close pipes
            try:
                proc.stdout.close()
            except:
                pass
            return
        
        # Try graceful termination via nerd-dictation end command
        try:
            env = os.environ.copy()
            env['PYTHONPATH'] = VOSK_LIB_PATH + ':' + env.get('PYTHONPATH', '')
            subprocess.run(['python3', NERD_DICTATION_PATH, 'end'], timeout=3, env=env)
        except:
            pass
        
        # If still alive, terminate
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        
        # Close pipes
        try:
            proc.stdout.close()
        except:
            pass

    async def stop_voice_recording(self) -> str:
        """
        Stop voice recording and return transcribed text using nerd-dictation.
        Returns:
            str: Transcribed text or error message.
        """
        async with self._voice_lock:
            try:
                decky.logger.info("Stopping voice recording...")
                
                if self.dictation_process is None:
                    return "Error: No recording in progress"
                
                # Get reference and clear immediately to prevent double-reads
                proc = self.dictation_process
                self.dictation_process = None
                
                decky.logger.info("Terminating nerd-dictation process")
                
                # Try graceful termination via nerd-dictation end command
                try:
                    env = os.environ.copy()
                    env['PYTHONPATH'] = VOSK_LIB_PATH + ':' + env.get('PYTHONPATH', '')
                    subprocess.run(['python3', NERD_DICTATION_PATH, 'end'], timeout=3, env=env)
                except:
                    pass
                
                # If still alive, terminate/kill
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait()
                
                # Read transcription (ONLY ONCE - communicate closes pipes)
                transcription = ""
                try:
                    stdout, _ = proc.communicate(timeout=2)
                    if stdout:
                        transcription = stdout.decode().strip()
                        decky.logger.info(f"Transcription from stdout: '{transcription}'")
                    else:
                        decky.logger.info("No stdout data received")
                except Exception as e:
                    decky.logger.error(f"Error reading transcription: {e}")
                
                decky.logger.info("Dictation process stopped")
                
                return transcription if transcription else "No speech detected"
                
            except Exception as e:
                decky.logger.error(f"Error stopping voice recording: {str(e)}\n{traceback.format_exc()}")
                return f"Error: {str(e)}"

