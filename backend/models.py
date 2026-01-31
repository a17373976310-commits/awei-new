# backend/models.py
from config import config

# Model Registry
# Format:
# "model_id": {
#     "name": "Display Name",
#     "url": "API Endpoint URL",
#     "model_key": "Model Key (if needed by API)",
#     "description": "Short description"
# }

MODEL_REGISTRY = {
    "nano_banana_2": {
        "name": "Nano Banana 2 (基础版)",
        "url": config.BANANA_API_URL, # Default from config
        "model_key": config.BANANA_MODEL_KEY,
        "description": "速度快，通用性强",
        "provider": "default"
    },
    "comfly_nano_banana": {
        "name": "Comfly Nano Banana 2 (官方源)",
        "url": config.BANANA_API_URL,
        "model_key": "nano-banana-2",
        "description": "Comfly 官方渠道，支持文生图与图生图",
        "provider": "comfly"
    },

    "nano_banana_official": {
        "name": "Nano Banana (Google)",
        "url": config.BANANA_API_URL,
        "model_key": "nano-banana",
        "description": "Google 最先进的图像生成和编辑模型，支持文生图、图生图、多图生图",
        "provider": "comfly"
    },
    "nano_banana_2_2k": {
        "name": "Nano Banana 2-2k (高清版)",
        "url": config.BANANA_API_URL,
        "model_key": "nano-banana-2-2k",
        "description": "Nano-banana 2 高清版，支持 1K/2K/4K 分辨率控制",
        "provider": "comfly"
    },
    "nano_banana_2_4k": {
        "name": "Nano Banana 2-4k (超高清版)",
        "url": config.BANANA_API_URL,
        "model_key": "nano-banana-2-4k",
        "description": "Nano-banana 2 超高清版，默认支持 4K 分辨率输出",
        "provider": "comfly"
    },

    "doubao_seedream_4_0": {
        "name": "Doubao Seedream 4.0 (即梦4)",
        "url": config.BANANA_API_URL,
        "model_key": "doubao-seedream-4-0-250828",
        "description": "字节跳动最新即梦4.0模型，画质细腻",
        "provider": "comfly"
    },
    "doubao_seedream_4_5": {
        "name": "Doubao Seedream 4.5 (即梦4.5)",
        "url": config.BANANA_API_URL,
        "model_key": "doubao-seedream-4-5-251128",
        "description": "字节跳动最新即梦4.5模型，支持多模态生成",
        "provider": "comfly_json"
    },
    "gpt_image_1_5": {
        "name": "GPT-Image-1.5 (OpenAI)",
        "url": config.BANANA_API_URL,
        "model_key": "gpt-image-1.5",
        "description": "OpenAI 图像生成模型，支持文生图与图生图",
        "provider": "openai"
    }
}

def get_model_info(model_id: str):
    """Get model information from the registry."""
    return MODEL_REGISTRY.get(model_id)
