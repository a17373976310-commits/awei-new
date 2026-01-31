# backend/services/chat_service.py

import requests
import json
import base64
from typing import List, Optional
from config import config
from prompts_v3 import UNIFIED_CONTROLLER_PROMPT, DNA_ANALYZER_PROMPT, IMAGE_COMPILER_PROMPT

import os
import time

class ChatService:
    def chat(self, messages: List[dict], visual_dna: Optional[str] = None, product_identity: Optional[str] = None, reference_images: Optional[str] = None, api_key: Optional[str] = None, api_url: Optional[str] = None, model: Optional[str] = None, images: Optional[List[bytes]] = None, image_model: Optional[str] = None, thought_signature: Optional[str] = None, thinking_level: Optional[str] = None, grounding: bool = False, track_a_images: Optional[List[bytes]] = None, track_b_images: Optional[List[bytes]] = None) -> dict:
        # Robust API Key & URL selection: Prefer .env if provided value is placeholder or empty
        is_placeholder_key = api_key and ("REPLACE" in api_key or "sk-test" in api_key)
        use_backend_key = not api_key or not api_key.strip() or is_placeholder_key
        
        final_api_key = config.BANANA_API_KEY if use_backend_key else api_key.strip()
        
        is_placeholder_url = api_url and "comfly.chat" in api_url and "bltcy" in config.BANANA_API_URL
        use_backend_url = not api_url or not api_url.strip() or is_placeholder_url
        
        url = f"{config.BANANA_API_URL.rstrip('/')}/chat/completions" if use_backend_url else f"{api_url.rstrip('/')}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {final_api_key}"
        }

        # Construct system prompt
        if visual_dna:
            # Step 2: Generation Mode - Provide Controller with DNA Context and Compiler Instructions
            system_prompt = f"{UNIFIED_CONTROLLER_PROMPT}\n\n# Active Visual DNA Context\n{visual_dna}\n\n# Product Fingerprint\n{product_identity or 'Standard industrial design'}\n\n# Module Instruction: IMAGE_COMPILER\n{IMAGE_COMPILER_PROMPT}"
            
            if image_model:
                system_prompt = f"# Context: Image Model={image_model}\n\n" + system_prompt
        else:
            # Step 1: Initial Audit & Decision Mode
            system_prompt = UNIFIED_CONTROLLER_PROMPT
            
            if image_model:
                system_prompt = f"# Context: Image Model={image_model}\n\n" + system_prompt

        # Inject Dual-Track Asset logic if track images are provided
        if track_a_images or track_b_images:
            system_prompt += "\n\n# Dual-Track Asset Context\n"
            system_prompt += "- TRACK A: Product Appearance & Angles (Primary source for Subject Lock/Physical Fingerprint).\n"
            system_prompt += "- TRACK B: Functional, Internal, or Usage scenarios (Primary source for Visual Strategy & Selling Points).\n"

        # Prepare messages for multi-modal support
        formatted_messages = [{"role": "system", "content": system_prompt}]
        
        # Process reference images
        ref_image_payloads = []
        if reference_images:
            try:
                ref_urls = json.loads(reference_images)
                for ref_url in ref_urls:
                    if ref_url.startswith("data:image"):
                        ref_image_payloads.append({"type": "image_url", "image_url": {"url": ref_url}})
                    elif ref_url.startswith("/static/"):
                        # Local file, read and convert to base64
                        # Assuming running from backend directory or root
                        # Need to find the absolute path. 
                        # backend/services/chat_service.py -> backend/services -> backend -> root -> static
                        
                        # Get project root
                        current_file = os.path.abspath(__file__)
                        backend_dir = os.path.dirname(os.path.dirname(current_file))
                        project_root = os.path.dirname(backend_dir)
                        
                        # Remove leading slash from url
                        rel_path = ref_url.lstrip('/')
                        file_path = os.path.join(project_root, rel_path)
                        
                        if os.path.exists(file_path):
                            with open(file_path, "rb") as img_file:
                                b64_data = base64.b64encode(img_file.read()).decode('utf-8')
                                ref_image_payloads.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_data}"}})
            except Exception as e:
                print(f"Error processing reference images: {e}")

        for i, msg in enumerate(messages):
            # Support thought_signature in previous messages if provided
            msg_to_add = msg.copy()
            
            if i == len(messages) - 1 and msg["role"] == "user":
                # Add images to the last user message
                content = [{"type": "text", "text": msg["content"]}]
                
                # Add uploaded images
                if images:
                    for img_bytes in images:
                        b64_img = base64.b64encode(img_bytes).decode('utf-8')
                        content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"}
                        })
                
                # Add Track A images (Appearance)
                if track_a_images:
                    content.append({"type": "text", "text": "\n[ASSET TRACK A: Product Appearance/Angles]"})
                    for img_bytes in track_a_images:
                        b64_img = base64.b64encode(img_bytes).decode('utf-8')
                        content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"}
                        })

                # Add Track B images (Functional/Internal)
                if track_b_images:
                    content.append({"type": "text", "text": "\n[ASSET TRACK B: Functional/Internal/Usage]"})
                    for img_bytes in track_b_images:
                        b64_img = base64.b64encode(img_bytes).decode('utf-8')
                        content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_img}"}
                        })

                # Add reference images
                if ref_image_payloads:
                    content.extend(ref_image_payloads)
                    
                formatted_messages.append({"role": "user", "content": content})
            else:
                formatted_messages.append(msg_to_add)

        payload = {
            "model": model if model else "gemini-3-flash-preview-thinking-*",
            "messages": formatted_messages,
            "stream": False
        }
        
        # Pass thought_signature and thinking_level to the API if provided
        if thought_signature:
            payload["thought_signature"] = thought_signature
        if thinking_level:
            payload["thinking_level"] = thinking_level
            
        # Enable Google Search Grounding if requested
        if grounding:
            payload["tools"] = [
                {
                    "google_search_retrieval": {
                        "dynamic_retrieval_config": {
                            "mode": "DYNAMIC",
                            "dynamic_threshold": 0.3
                        }
                    }
                }
            ]

        last_error = None
        for attempt in range(1, 4):
            try:
                # Remove proxies=None to allow system proxy (e.g. VPN/Clash) to work
                response = requests.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=60
                )
                response.raise_for_status()
                res_json = response.json()
                
                choice = res_json["choices"][0]
                content = choice["message"]["content"]
                
                # Extract new thought_signature if present
                new_thought_signature = choice.get("thought_signature") or res_json.get("thought_signature")
                
                return {
                    "content": content,
                    "thought_signature": new_thought_signature
                }
            except (
                requests.exceptions.SSLError,
                requests.exceptions.ProxyError,
                requests.exceptions.ConnectionError,
                requests.exceptions.ChunkedEncodingError,
                requests.exceptions.Timeout,
                requests.exceptions.HTTPError,
            ) as e:
                last_error = e
                wait_s = attempt * 1.5
                print(f"ERROR: Chat failed (Attempt {attempt}/3): {type(e).__name__}: {e}")
                if attempt < 3:
                    time.sleep(wait_s)
            except Exception as e:
                print(f"ERROR: Chat failed: {e}")
                return {"content": f"抱歉，聊天服务出现错误：{str(e)}", "thought_signature": None}

        detail = ""
        if hasattr(last_error, "response") and last_error.response is not None:
            try:
                detail = last_error.response.text
            except Exception:
                detail = ""
        suffix = f"（{detail[:200]}）" if detail else ""
        return {"content": f"抱歉，聊天服务出现错误：{str(last_error)}{suffix}", "thought_signature": None}

chat_service = ChatService()
