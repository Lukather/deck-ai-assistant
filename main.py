import decky  # è il nuovo modulo backend
import asyncio
import os
import json

CONFIG_PATH = os.path.expanduser("~/.aiassistant_config.json")

class Plugin:
    async def ask_question(self, question: str) -> str:
        decky.logger.info(f"Domanda ricevuta: {question}")
        await asyncio.sleep(1)
        return f"Risposta simulata: {question[::-1]}"

    async def save_api_key(self, key: str) -> str:
        with open(CONFIG_PATH, "w") as f:
            json.dump({ "api_key": key }, f)
        return "Chiave salvata."

    async def get_api_key(self) -> str:
        if not os.path.exists(CONFIG_PATH):
            return ""
        with open(CONFIG_PATH, "r") as f:
            data = json.load(f)
        return data.get("api_key", "")

plugin = Plugin()
