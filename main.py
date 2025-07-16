import decky
import os
import json
import asyncio
import httpx

CONFIG_PATH = os.path.expanduser("~/.aiassistant_config.json")

class Plugin:
    
    async def ask_question(self, question: str) -> str:
        try:
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
            
            # Preparazione richiesta Gemini
            headers = {
                "Content-Type": "application/json"
            }

            payload = {
                "contents": [
                    {
                    "parts": [
                        { "text": question.strip() }
                    ]
                    }
                ]
            }

            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + api_key

            decky.logger.info(f"Richiesta Gemini: {payload}")

            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload)

            decky.logger.info(f"Risposta grezza: {response.text}")

            if response.status_code != 200:
                decky.logger.error(f"Errore HTTP {response.status_code}: {response.text}")
                return f"Errore nella richiesta: {response.status_code}"

            data = response.json()

            output = data["candidates"][0]["content"]["parts"][0]["text"]
            decky.logger.info(f"Risposta Gemini: {output}")
            return output

        except Exception as e:
            decky.logger.error(f"Errore ask_question: {str(e)}")
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
