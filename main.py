import decky  # è il nuovo modulo backend
import asyncio

class Plugin:
    async def ask_question(self, question: str) -> str:
        decky.logger.info(f"Domanda ricevuta: {question}")
        await asyncio.sleep(1)
        return f"Risposta simulata: {question[::-1]}"

plugin = Plugin()
