# Global reference to the main asyncio event loop.
# Set in main.py lifespan startup so background threads can safely schedule coroutines.
loop = None
