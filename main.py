import decky
import os
import sys
import json
import asyncio
import time
import glob
import re
import httpx
import traceback
import tempfile
import subprocess
from httpx import ReadTimeout

# Use Decky Loader recommended paths for settings
CONFIG_PATH = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "config.json")

# Default Gemini model. Promoted to a user setting in a follow-up; the URL
# and all log lines read this constant.
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Plugin directory paths for bundled dependencies. The Decky loader adds
# `py_modules/` to sys.path automatically, so importable Python packages
# should live there.
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
PY_MODULES_DIR = os.path.join(PLUGIN_DIR, "py_modules")
NERD_DICTATION_PATH = os.path.join(PY_MODULES_DIR, "nerd-dictation", "nerd-dictation")
VOSK_MODEL_PATH = os.path.join(PY_MODULES_DIR, "vosk-model")
# Path to the directory containing the bundled vosk Python package and its
# dependency tree. Used as PYTHONPATH for the nerd-dictation subprocess
# (which imports vosk via its own sys.path, not through Decky).
VOSK_PYTHON_PATH = os.path.join(PY_MODULES_DIR, "vosk")


def _subprocess_python_version() -> tuple[int, int] | None:
    """Return (major, minor) of the `python3` that runs nerd-dictation.

    nerd-dictation is spawned as a `python3` subprocess, which is the system
    interpreter, not the plugin's own. The bundled cffi .so must match *that*
    interpreter's ABI, so this is the version we compare against.
    """
    try:
        out = subprocess.check_output(
            ["python3", "-c", "import sys; print(sys.version_info.major, sys.version_info.minor)"],
            text=True, timeout=5, stderr=subprocess.STDOUT,
        ).strip()
        major_str, minor_str = out.split()
        return int(major_str), int(minor_str)
    except Exception as e:
        decky.logger.warning(f"Could not determine system python3 version: {e}")
        return None


def _check_voice_deps_python_version() -> None:
    """Compare the bundled cffi .so against the python3 that runs nerd-dictation.

    The bundled vosk ships a cffi .so compiled for one specific CPython ABI
    (e.g. cpython-313-x86_64-linux-gnu.so for Python 3.13). nerd-dictation is
    spawned as a `python3` subprocess, so the .so must match the system
    python3, not the plugin's own interpreter. A mismatch surfaces as a
    confusing ImportError mid-recording; surface it clearly at plugin start.

    Does nothing if the bundled cffi .so is not present (e.g. relying on a
    system-installed vosk) or if the version can't be parsed.
    """
    pattern = os.path.join(VOSK_PYTHON_PATH, "_cffi_backend.cpython-*-x86_64-linux-gnu.so")
    matches = glob.glob(pattern)
    if not matches:
        return
    filename = os.path.basename(matches[0])
    m = re.search(r"cpython-(\d+)-", filename)
    if not m:
        decky.logger.warning(
            f"Could not parse Python version from bundled {filename}; "
            f"skipping voice-deps compatibility check"
        )
        return
    bundled = int(m.group(1))  # e.g. 313 for Python 3.13
    sub = _subprocess_python_version()
    if sub is None:
        return
    running = sub[0] * 100 + sub[1]
    if bundled != running:
        bundled_py = f"{bundled // 100}.{bundled % 100:02d}"
        running_py = f"{sub[0]}.{sub[1]}"
        decky.logger.error(
            f"Bundled voice deps are compiled for Python {bundled_py} "
            f"but the system python3 (used by nerd-dictation) is {running_py}. "
            f"Voice recording will not work. Rebuild the voice deps for "
            f"Python {running_py}."
        )
    else:
        decky.logger.info(
            f"Voice deps ABI check OK: bundled cpython-{bundled} matches system python3 {sub[0]}.{sub[1]}"
        )

class Plugin:
    def __init__(self):
        self.dictation_process = None
        self._voice_lock = asyncio.Lock()  # Prevent concurrent voice operations
        # Run the ABI check at load so a mismatch is logged immediately, not
        # as an ImportError mid-recording. Blocking subprocess call is fine
        # here: __init__ runs before the plugin's event loop starts.
        _check_voice_deps_python_version()
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

            # Build a stable system instruction. Carries role + persistent
            # context (current game) that the model should always see.
            system_parts = [
                "You are an AI assistant for a Steam Deck user. Be concise and helpful."
            ]
            if game and isinstance(game, dict) and game.get('name'):
                system_parts.append(
                    f"The user is currently playing {game['name']} (Steam AppID: {game['appid']}). "
                    "Use this context when relevant, but do not force game references if the question is unrelated."
                )
            system_instruction = {"parts": [{"text": " ".join(system_parts)}]}

            # Build a structured multi-turn contents array. The frontend sends
            # the full transcript including the new user message; map 'ai' to
            # Gemini's 'model' role and skip empty entries.
            contents = []
            if conversation and isinstance(conversation, list):
                for msg in conversation:
                    role = msg.get('role', '')
                    text = (msg.get('text') or '').strip()
                    if not text:
                        continue
                    if role == 'user':
                        contents.append({"role": "user", "parts": [{"text": text}]})
                    elif role == 'ai':
                        contents.append({"role": "model", "parts": [{"text": text}]})

            # Safety net: if the transcript is missing/empty, just send the question.
            if not contents:
                contents.append({"role": "user", "parts": [{"text": question.strip()}]})

            gemini_payload = {
                "systemInstruction": system_instruction,
                "contents": contents,
            }

            headers = {"Content-Type": "application/json"}
            url = f"{GEMINI_API_BASE}/{GEMINI_MODEL}:generateContent?key={api_key}"

            # Metadata-only log line. No message text, no API key in the URL.
            decky.logger.info(f"Gemini call: model={GEMINI_MODEL} turns={len(contents)}")

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    start = time.monotonic()
                    response = await client.post(url, headers=headers, json=gemini_payload)
                    latency = time.monotonic() - start
            except ReadTimeout:
                decky.logger.error("Timeout while waiting for Gemini API response.")
                return "Timeout: The AI service took too long to respond. Please try again."

            # Metadata-only response log. No response body.
            if response.status_code != 200:
                decky.logger.error(
                    f"Gemini HTTP {response.status_code} in {latency:.2f}s"
                )
                return f"Request error: {response.status_code}"

            data = response.json()

            # Log token usage if Gemini returned it. No message text.
            usage = data.get("usageMetadata") or {}
            if usage:
                decky.logger.info(
                    f"Gemini tokens: prompt={usage.get('promptTokenCount')} "
                    f"output={usage.get('candidatesTokenCount')} "
                    f"total={usage.get('totalTokenCount')} "
                    f"latency={latency:.2f}s"
                )

            output = data["candidates"][0]["content"]["parts"][0]["text"]
            # Don't log the response text. Only its length.
            decky.logger.info(f"Gemini output: {len(output)} chars")
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
                env['PYTHONPATH'] = VOSK_PYTHON_PATH + ':' + env.get('PYTHONPATH', '')
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
            env['PYTHONPATH'] = VOSK_PYTHON_PATH + ':' + env.get('PYTHONPATH', '')
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
                    env['PYTHONPATH'] = VOSK_PYTHON_PATH + ':' + env.get('PYTHONPATH', '')
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

