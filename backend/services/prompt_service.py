import requests
import base64
import json
from typing import List
from config import config
from prompts import PRODUCT_LOCK_PROMPT, MAIN_ENGINE_INSTRUCTION, PROMPT_REGISTRY, PROMPT_TEMPLATES
import time

class PromptService:
    def _post_json_with_retry(self, url: str, headers: dict, payload: dict, timeout: int = 60):
        last_error = None
        for attempt in range(1, 4):
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=timeout, proxies={"http": None, "https": None})
                resp.raise_for_status()
                return resp
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
                print(f"ERROR: PromptService request failed (Attempt {attempt}/3): {type(e).__name__}: {e}")
                if attempt < 3:
                    time.sleep(wait_s)
            except Exception as e:
                raise e
        raise last_error

    def optimize_prompt(self, prompt: str, scenario: str, image_bytes_list: List[bytes] = None, api_key: str = None, api_url: str = None, task_id: str = None, task_service = None) -> str:
        print(f"DEBUG_LOG: optimize_prompt called. Scenario: {scenario}, Image Count: {len(image_bytes_list) if image_bytes_list else 0}")
        
        final_api_key = api_key if api_key else config.BANANA_API_KEY
        if not final_api_key:
            print("ERROR: No API Key provided for optimization.")
            return prompt

        # 1. Stage 1: Multi-view Visual Fingerprint Extraction
        fingerprint = {}
        if image_bytes_list:
            print(f"DEBUG_LOG: Stage 1 - Extracting Fingerprint from {len(image_bytes_list)} images...")
            if task_service and task_id:
                task_service.update_task(task_id, progress=18, progress_message=f"🔍 正在使用 gemini-3-pro-preview 分析 {len(image_bytes_list)} 张图片...")
            fingerprint = self._extract_fingerprint(image_bytes_list, final_api_key, api_url, task_id, task_service)
            print(f"DEBUG_LOG: Fingerprint: {fingerprint}")
            if task_service and task_id:
                task_service.update_task(task_id, progress=25, progress_message="✅ 产品特征提取完成")

        # 2. Stage 2: Dual-Core Prompt Engine
        print(f"DEBUG_LOG: Stage 2 - Generating Dual-Core Prompts for scenario: {scenario}")
        if task_service and task_id:
            task_service.update_task(task_id, progress=28, progress_message="📝 正在使用 gemini-3-pro-preview 生成优化提示词...")
        optimized_json = self._generate_dual_core_prompts(prompt, scenario, fingerprint, image_bytes_list, final_api_key, api_url, task_id, task_service)
        
        return optimized_json

    def _extract_fingerprint(self, image_bytes_list: List[bytes], api_key: str, api_url: str = None, task_id: str = None, task_service = None) -> dict:
        url = f"{api_url.rstrip('/')}/chat/completions" if api_url else f"{config.BANANA_API_URL.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        if task_service and task_id:
            task_service.update_task(task_id, progress=20, progress_message="📷 正在编码图片数据...")
        
        # Prepare content with multiple images
        content_list = [
            {"type": "text", "text": "Analyze these product images and extract the visual fingerprint."}
        ]
        
        for img_bytes in image_bytes_list:
            base64_image = base64.b64encode(img_bytes).decode('utf-8')
            content_list.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
            })
        
        # Format the system prompt with image count
        system_prompt = PRODUCT_LOCK_PROMPT.format(img_count=len(image_bytes_list))
        
        payload = {
            "model": "gemini-3-pro-preview",
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": content_list
                }
            ],
            "response_format": {"type": "json_object"}
        }

        if task_service and task_id:
            task_service.update_task(task_id, progress=22, progress_message="🚀 正在调用 gemini-3-pro-preview 提取产品特征...")
        
        try:
            response = self._post_json_with_retry(url, headers, payload, timeout=60)
            content = response.json()["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception as e:
            print(f"ERROR: Fingerprint extraction failed: {e}")
            return {}

    def _generate_dual_core_prompts(self, user_prompt: str, scenario: str, fingerprint: dict, image_bytes_list: List[bytes], api_key: str, api_url: str = None, task_id: str = None, task_service = None) -> str:
        url = f"{api_url.rstrip('/')}/chat/completions" if api_url else f"{config.BANANA_API_URL.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        # Get mode template
        mode_template = PROMPT_REGISTRY.get(scenario, PROMPT_TEMPLATES.get(scenario, "General Mode"))
        
        system_content = f"{MAIN_ENGINE_INSTRUCTION}\n\n# Current Mode Template\n{mode_template}"
        
        user_text = f"User Request: {user_prompt}"
        if fingerprint:
            user_text += f"\n\n[Subject Lock - Visual Fingerprint]:\n{json.dumps(fingerprint, indent=2, ensure_ascii=False)}"

        user_content = [{"type": "text", "text": user_text}]
        
        # Include all images in stage 2 as well for full context
        if image_bytes_list:
            for img_bytes in image_bytes_list:
                base64_image = base64.b64encode(img_bytes).decode('utf-8')
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                })

        payload = {
            "model": "gemini-3-pro-preview",
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"}
        }

        if task_service and task_id:
            task_service.update_task(task_id, progress=29, progress_message="🚀 正在调用 gemini-3-pro-preview 生成双核提示词...")

        try:
            response = self._post_json_with_retry(url, headers, payload, timeout=60)
            content = response.json()["choices"][0]["message"]["content"]
            
            # Log the raw content for debugging
            with open("prompt_debug.log", "a", encoding="utf-8") as f:
                f.write(f"\n--- LLM Response ---\n{content}\n")
            
            # Validate it's proper JSON
            try:
                json_data = json.loads(content)
                print(f"DEBUG_LOG: Successfully parsed LLM JSON response.")
                return content
            except json.JSONDecodeError as je:
                print(f"ERROR: LLM output is not valid JSON: {je}")
                # Try to extract JSON if it's wrapped in markdown
                if "```json" in content:
                    try:
                        extracted = content.split("```json")[1].split("```")[0].strip()
                        json.loads(extracted)
                        print(f"DEBUG_LOG: Successfully extracted JSON from markdown block.")
                        return extracted
                    except:
                        pass
                raise je
        except Exception as e:
            print(f"ERROR: Dual-core prompt generation failed: {e}")
            import traceback
            traceback.print_exc()
            # Fallback to a structure compatible with the new Unified Director architecture
            fallback = {
                "analysis": {
                    "asset_audit": [
                        {"index": 0, "type": "subject", "confidence": 0.9, "reason": "Default subject selection (Fallback mode)"}
                    ]
                },
                "proposal": {
                    "module_name": "基础详情图 (回退模式)",
                    "prompt": f"{user_prompt}, high quality, cinematic lighting, 8k",
                    "ratio": "3:4",
                    "selected_asset_index": 0
                },
                "nano_banana_en": f"{user_prompt}, high quality, 4k",
                "seadream_cn": f"{user_prompt}, 高质量, 4k",
                "layout_logic": "Default layout (Fallback due to error)."
            }
            fallback_json = json.dumps(fallback, ensure_ascii=False)
            
            with open("prompt_debug.log", "a", encoding="utf-8") as f:
                f.write(f"Optimization ERROR: {str(e)}. Using fallback.\n")
            
            return fallback_json

prompt_service = PromptService()
