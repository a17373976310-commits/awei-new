import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BANANA_API_KEY = os.getenv("BANANA_API_KEY")
    BANANA_MODEL_KEY = os.getenv("BANANA_MODEL_KEY", "nano-banana-2")
    BANANA_API_URL = os.getenv("BANANA_API_URL", "https://ai.comfly.chat/v1")

config = Config()
