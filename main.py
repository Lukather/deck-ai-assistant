import os
import decky
import asyncio

class Plugin:
    async def ask_question(self, question: str):
        decky.logger.info(f"Domanda ricevuta dal frontend: {question}")
        return f"Hai chiesto: {question}"

    async def add(self, left: int, right: int) -> int:
        return left + right

    async def long_running(self):
        await asyncio.sleep(15)
        await decky.emit("timer_event", "Hello from the backend!", True, 2)

    async def _main(self):
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Hello World!")

    async def _unload(self):
        decky.logger.info("Goodnight World!")

    async def _uninstall(self):
        decky.logger.info("Goodbye World!")

    async def start_timer(self):
        self.loop.create_task(self.long_running())

    async def _migration(self):
        decky.logger.info("Migrating")
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template", "template.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))