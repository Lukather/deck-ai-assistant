import decky
import os
import json
import asyncio
import httpx
import traceback
from httpx import ReadTimeout

CONFIG_PATH = os.path.expanduser("~/.aiassistant_config.json")

class Plugin:
    
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
