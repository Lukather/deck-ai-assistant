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

# Models offered in the Settings picker. Curated to current Gemini API
# variants; the user can switch at any time.
SUPPORTED_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

# Sliding window over the conversation sent to Gemini. The full transcript
# still lives in localStorage and renders in the UI, but only the last N
# turns go into the prompt so long sessions don't exceed the context window.
# Pure truncation for v1 (no recap of dropped turns); promoting this to a
# user-facing setting is out of scope (#13).
MAX_CONTEXT_TURNS = 20

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


def _read_config() -> dict:
    """Load the plugin config JSON, returning {} if missing/corrupt."""
    if not os.path.exists(CONFIG_PATH):
        return {}
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f) or {}
    except Exception:
        return {}


def _write_config(cfg: dict) -> None:
    """Persist config, creating the settings dir and restricting permissions."""
    os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f)
    os.chmod(CONFIG_PATH, 0o600)


def _get_config_model() -> str:
    """Return the saved model, falling back to GEMINI_MODEL if unset/invalid."""
    model = _read_config().get("model", GEMINI_MODEL)
    return model if model in SUPPORTED_MODELS else GEMINI_MODEL


async def _probe_gemini_key(api_key: str) -> tuple[bool, str]:
    """Cheap authenticated call to check the API key works.

    Hits models.list with pageSize=1 (minimal payload). Returns (ok, message).
    """
    url = f"{GEMINI_API_BASE}?key={api_key}&pageSize=1"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
    except Exception as e:
        return False, f"Probe failed: {e}"
    if resp.status_code == 200:
        return True, "Key verified."
    return False, f"Gemini rejected the key (HTTP {resp.status_code})."


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
            # Gemini's 'model' role and skip empty entries. Apply a sliding
            # window so only the last MAX_CONTEXT_TURNS turns are sent -- older
            # turns stay in the UI/localStorage but are dropped from the prompt.
            contents = []
            if conversation and isinstance(conversation, list):
                window = conversation[-MAX_CONTEXT_TURNS:] if len(conversation) > MAX_CONTEXT_TURNS else conversation
                if window is not conversation:
                    decky.logger.info(
                        f"Context window: sending last {len(window)} of {len(conversation)} turns"
                    )
                for msg in window:
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
            model = _get_config_model()
            url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"

            # Metadata-only log line. No message text, no API key in the URL.
            decky.logger.info(f"Gemini call: model={model} turns={len(contents)}")

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

    async def save_api_key(self, key: str) -> dict:
        """Save the key and probe Gemini to verify it works.

        Returns {"valid": bool, "message": str} so the frontend can drive
        the toast + badge from the probe result, not the key's length.
        The key is saved either way so the user can edit it without retyping.
        """
        key = (key or "").strip()
        if not key:
            return {"valid": False, "message": "Key is empty."}
        try:
            cfg = _read_config()
            cfg["api_key"] = key
            _write_config(cfg)
            decky.logger.info("API key saved, probing Gemini...")
            ok, msg = await _probe_gemini_key(key)
            decky.logger.info(f"Key probe: valid={ok} ({msg})")
            return {"valid": ok, "message": msg}
        except Exception as e:
            decky.logger.error(f"Error saving key: {str(e)}")
            return {"valid": False, "message": f"Failed to save key: {e}"}

    async def validate_api_key(self) -> bool:
        """Probe the currently-saved key. Used on mount to set the badge."""
        key = _read_config().get("api_key", "")
        if not key:
            return False
        ok, _ = await _probe_gemini_key(key)
        return ok

    async def get_api_key(self) -> str:
        return _read_config().get("api_key", "")

    async def get_model(self) -> str:
        return _get_config_model()

    async def set_model(self, model: str) -> str:
        if model not in SUPPORTED_MODELS:
            return f"Unsupported model: {model}"
        cfg = _read_config()
        cfg["model"] = model
        _write_config(cfg)
        decky.logger.info(f"Model set to {model}")
        return "Model saved."

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
                    stderr=subprocess.PIPE,  # Keep stderr separate so errors don't read as transcription
                )

                decky.logger.info(f"Dictation started with PID {self.dictation_process.pid}")

                # Give it a moment to start and check for immediate failures
                await asyncio.sleep(0.5)

                # Check if process died immediately (error during startup)
                if self.dictation_process.poll() is not None:
                    stdout, stderr = self.dictation_process.communicate()
                    parts = []
                    if stdout: parts.append(stdout.decode().strip())
                    if stderr: parts.append(stderr.decode().strip())
                    error_msg = " | ".join(p for p in parts if p) or "Unknown error"
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
            # Already dead; drain pipes to avoid ResourceWarnings, then close.
            try:
                proc.communicate(timeout=1)
            except Exception:
                pass
            return
        
        # Signal graceful stop via nerd-dictation end (cookie), then wait for it.
        # Don't terminate first -- that kills the process mid-flush.
        try:
            env = os.environ.copy()
            env['PYTHONPATH'] = VOSK_PYTHON_PATH + ':' + env.get('PYTHONPATH', '')
            subprocess.run(['python3', NERD_DICTATION_PATH, 'end'], timeout=5, env=env)
        except Exception:
            pass
        
        try:
            proc.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            proc.terminate()
            try:
                proc.communicate(timeout=3)
            except Exception:
                proc.kill()
        except Exception:
            try:
                proc.kill()
            except Exception:
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
                
                # Try graceful stop via nerd-dictation end command. This signals
                # the begin process (via cookie) to finish, flush its transcription
                # to stdout, and exit. Do NOT terminate the begin process first --
                # killing it mid-flush is exactly what produces 'write() failed:
                # Broken pipe' as the 'transcription'.
                try:
                    env = os.environ.copy()
                    env['PYTHONPATH'] = VOSK_PYTHON_PATH + ':' + env.get('PYTHONPATH', '')
                    subprocess.run(['python3', NERD_DICTATION_PATH, 'end'], timeout=5, env=env)
                except Exception as e:
                    decky.logger.warning(f"nerd-dictation end command failed: {e}")
                
                # Collect stdout (the transcription). communicate() also waits for
                # the process to finish, so it doubles as our 'did end bring it down'
                # check. Only fall back to terminate/kill if it's still alive after.
                transcription = ""
                try:
                    stdout, stderr = proc.communicate(timeout=8)
                    if stderr:
                        decky.logger.info(f"nerd-dictation stderr: {stderr.decode().strip()}")
                    if stdout:
                        transcription = stdout.decode().strip()
                        decky.logger.info(f"Transcription from stdout: '{transcription}'")
                    else:
                        decky.logger.info("No stdout data received")
                except subprocess.TimeoutExpired:
                    # end didn't bring it down; force-kill and salvage what we can.
                    decky.logger.warning("nerd-dictation didn't exit after end; terminating")
                    proc.terminate()
                    try:
                        stdout, stderr = proc.communicate(timeout=3)
                        if stdout:
                            transcription = stdout.decode().strip()
                    except Exception:
                        proc.kill()
                except Exception as e:
                    decky.logger.error(f"Error reading transcription: {e}")
                    try:
                        proc.kill()
                    except Exception:
                        pass
                
                decky.logger.info("Dictation process stopped")
                
                return transcription if transcription else "No speech detected"
                
            except Exception as e:
                decky.logger.error(f"Error stopping voice recording: {str(e)}\n{traceback.format_exc()}")
                return f"Error: {str(e)}"

