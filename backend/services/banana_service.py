import requests
import base64
import json
from config import config
from models import MODEL_REGISTRY

# 1. 【多级尺寸映射系统】
# 1K 标准版 (约 1MP)
SIZE_MAP_1K = {
    "1:1":  {"width": 1024, "height": 1024},
    "4:3":  {"width": 1152, "height": 896},
    "3:4":  {"width": 896,  "height": 1152},
    "16:9": {"width": 1280, "height": 720},
    "9:16": {"width": 720,  "height": 1280}
}

# 2K 高清版 (约 4MP)
SIZE_MAP_2K = {
    "1:1":  {"width": 2048, "height": 2048},
    "4:3":  {"width": 2304, "height": 1728},
    "3:4":  {"width": 1728, "height": 2304},
    "16:9": {"width": 2688, "height": 1512},
    "9:16": {"width": 1512, "height": 2688}
}

# 4K 超高清版 (约 8MP-12MP)
SIZE_MAP_4K = {
    "1:1":  {"width": 3072, "height": 3072},
    "4:3":  {"width": 3840, "height": 2880},
    "3:4":  {"width": 2880, "height": 3840},
    "16:9": {"width": 3840, "height": 2160},
    "9:16": {"width": 2160, "height": 3840}
}

OPENAI_SIZE_MAP = {
    "1:1": "1024x1024",
    "4:3": "1024x768",
    "3:4": "768x1024",
    "16:9": "1280x720",
    "9:16": "720x1280"
}

class BananaService:
    def _make_request(self, method, url, headers, json_data=None, files=None, data=None, timeout=120):
        import time
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        max_retries = 3
        retry_count = 0
        last_error = None
        verify_ssl = True # Default to secure

        while retry_count <= max_retries:
            try:
                if method == "POST":
                    if files:
                        response = requests.post(url, headers=headers, files=files, data=data, timeout=timeout, verify=verify_ssl)
                    else:
                        response = requests.post(url, json=json_data, headers=headers, timeout=timeout, verify=verify_ssl)
                else:
                    response = requests.get(url, headers=headers, timeout=timeout, verify=verify_ssl)
                
                if response.status_code in [502, 503, 504]:
                    raise requests.exceptions.HTTPError(f"Server Error {response.status_code}", response=response)
                
                response.raise_for_status()
                return response
            except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError, 
                    requests.exceptions.ChunkedEncodingError, requests.exceptions.HTTPError,
                    requests.exceptions.Timeout, requests.exceptions.SSLError) as e:
                last_error = e
                retry_count += 1
                error_type = type(e).__name__
                print(f"DEBUG_LOG: Request failed (Attempt {retry_count}/{max_retries + 1}): {error_type}: {e}")
                
                # If it's an SSL or Connection error, try disabling SSL verification for the next attempt
                if isinstance(e, (requests.exceptions.SSLError, requests.exceptions.ConnectionError)):
                    print("DEBUG_LOG: SSL/Connection error detected. Disabling SSL verification for retry...")
                    verify_ssl = False
                
                if retry_count <= max_retries:
                    wait_time = 2 * retry_count
                    print(f"DEBUG_LOG: Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    break
            except Exception as e:
                raise e
        
        if last_error:
            error_detail = ""
            if hasattr(last_error, 'response') and last_error.response is not None:
                try:
                    error_detail = f" - Detail: {last_error.response.text}"
                except:
                    pass
            raise Exception(f"API请求失败(已重试{max_retries}次): {str(last_error)}{error_detail}")

    def generate_image(self, prompt: str, ratio: str, images: list = None, mask: bytes = None, model_id: str = "nano_banana_2", api_key: str = None, api_url: str = None, thought_signature: str = None, thinking_level: str = None, identity_ref: int = None, logic_ref: int = None):
        # Clean ratio
        ratio = ratio.strip()

        # Get model config
        model_config = MODEL_REGISTRY.get(model_id)
        if not model_config:
            print(f"DEBUG_LOG: Model {model_id} not found, falling back to nano_banana_2")
            model_config = MODEL_REGISTRY["nano_banana_2"]
        
        print(f"DEBUG_LOG: Using Model: {model_config['name']} ({model_id})")
            
        # 智能尺寸选择
        model_id_lower = model_id.lower()
        image_size_param = "1K"
        if "4k" in model_id_lower:
            size_config = SIZE_MAP_4K.get(ratio, SIZE_MAP_4K["1:1"])
            image_size_param = "4K"
            print(f"DEBUG_LOG: Resolution Tier: 4K")
        elif "2k" in model_id_lower or "doubao" in model_id_lower:
            size_config = SIZE_MAP_2K.get(ratio, SIZE_MAP_2K["1:1"])
            image_size_param = "2K"
            print(f"DEBUG_LOG: Resolution Tier: 2K")
        else:
            size_config = SIZE_MAP_1K.get(ratio, SIZE_MAP_1K["1:1"])
            image_size_param = "1K"
            print(f"DEBUG_LOG: Resolution Tier: 1K")
            
        width = size_config["width"]
        height = size_config["height"]
        
        # Robust API Key & URL selection: Prefer .env if provided value is placeholder or empty
        is_placeholder_key = api_key and ("REPLACE" in api_key or "sk-test" in api_key)
        use_backend_key = not api_key or not api_key.strip() or is_placeholder_key
        final_api_key = config.BANANA_API_KEY if use_backend_key else api_key.strip()

        is_placeholder_url = api_url and "comfly.chat" in api_url and "bltcy" in config.BANANA_API_URL
        use_backend_url = not api_url or not api_url.strip() or is_placeholder_url
        base_url = config.BANANA_API_URL.rstrip('/') if use_backend_url else api_url.rstrip('/')

        real_model_id = model_config["model_key"]
        provider = model_config.get("provider", "default")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {final_api_key}"
        }

        print(f"DEBUG_LOG: 用户选择={ratio}, 正在发送尺寸: {width} x {height}, 模型ID: {real_model_id}")

        if images and provider == "comfly":
            # --- Image-to-Image (Multipart) with multi-image support ---
            url = f"{base_url}/images/edits"
            
            # Build files list - support multiple images with same key 'image'
            files = [('image', (f'image_{i}.png', img, 'image/png')) for i, img in enumerate(images)]
            if mask:
                files.append(('mask', ('mask.png', mask, 'image/png')))
            
            data = {
                "prompt": prompt,
                "model": real_model_id,
                "n": 1,
                "aspect_ratio": ratio,
                "strength": 0.7,
                "response_format": "url",
                "image_size": image_size_param
            }
            
            if thought_signature:
                data["thought_signature"] = thought_signature
            if thinking_level:
                data["thinking_level"] = thinking_level
                
            if "Content-Type" in headers:
                del headers["Content-Type"]
                
            print(f"DEBUG_LOG: Sending Multipart Request (Img2Img) with {len(images)} images. URL={url}")
            print(f"DEBUG_LOG: Img2Img Data: {data}")
            response = self._make_request("POST", url, headers=headers, files=files, data=data)
            
        elif provider == "openai":
            # --- OpenAI Format ---
            url = f"{base_url}/images/generations"
            openai_size = OPENAI_SIZE_MAP.get(ratio, "1024x1024")
            current_payload = {
                "model": real_model_id,
                "prompt": prompt,
                "size": openai_size,
                "n": 1,
                "response_format": "url"
            }
            print(f"DEBUG_LOG: Sending OpenAI Request. URL={url}")
            response = self._make_request("POST", url, headers=headers, json_data=current_payload)
            
        else:
            # --- Standard JSON Request ---
            url = f"{base_url}/images/generations"
            
            current_payload = {
                "prompt": prompt,
                "negative_prompt": "",
                "model": real_model_id,
            }
            
            if thought_signature:
                current_payload["thought_signature"] = thought_signature
            if thinking_level:
                current_payload["thinking_level"] = thinking_level
                
            if provider == "comfly_json":
                current_payload.update({
                    "size": f"{width}x{height}",
                    "image_size": image_size_param,
                    "n": 1,
                    "response_format": "url"
                })
                if images and len(images) > 0:
                    base64_data = base64.b64encode(images[0]).decode('utf-8')
                    current_payload["image"] = f"data:image/png;base64,{base64_data}"
                    current_payload["strength"] = 0.7
            else:
                # Use aspect_ratio for standard ratios, width/height for others
                standard_ratios = ["1:1", "4:3", "3:4", "16:9", "9:16"]
                if ratio in standard_ratios:
                    current_payload["aspect_ratio"] = ratio
                else:
                    current_payload["width"] = width
                    current_payload["height"] = height
                    
                if images and len(images) > 0:
                    current_payload["image"] = base64.b64encode(images[0]).decode('utf-8')
                    current_payload["strength"] = 0.7

            print(f"DEBUG_LOG: Sending JSON Request. URL={url}")
            print(f"DEBUG_LOG: Payload: {json.dumps(current_payload, indent=2)}")
            response = self._make_request("POST", url, headers=headers, json_data=current_payload)

        try:
            response.raise_for_status()
            result = response.json()
            print(f"DEBUG_LOG: API Response Type: {type(result)}")
            
            # Extract image and thought_signature
            image_url = ""
            new_thought_signature = None
            
            # Safely extract thought_signature
            if isinstance(result, dict):
                new_thought_signature = result.get("thought_signature")
            
            if not isinstance(result, dict):
                print(f"DEBUG_LOG: API Response Content: {result}")
                if isinstance(result, list) and len(result) > 0:
                    item = result[0]
                    if isinstance(item, str): image_url = item
                    if isinstance(item, dict): 
                        result = item
                        if not new_thought_signature:
                            new_thought_signature = result.get("thought_signature")
                else:
                    image_url = str(result)

            if not image_url:
                # Try to find image in various common locations
                if "output" in result and result["output"]:
                    if isinstance(result["output"], list) and len(result["output"]) > 0:
                        image_url = result["output"][0]
                    else:
                        image_url = result["output"]
                
                elif "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
                    item = result["data"][0]
                    if isinstance(item, dict):
                        if "url" in item:
                            image_url = item["url"]
                        elif "b64_json" in item:
                            image_url = item["b64_json"]
                    elif isinstance(item, str):
                        image_url = item
                
                # Doubao 4.5 specific response handling if needed
                elif "image_url" in result:
                    image_url = result["image_url"]

                # Fallback to root url or other common fields
                else:
                    for key in ["url", "image", "img_url"]:
                        if key in result and result[key]:
                            image_url = result[key]
                            break

            if not image_url:
                print(f"DEBUG_LOG: Could not find image in response: {result}")
            
            return {
                "url": image_url,
                "thought_signature": new_thought_signature
            }
        except Exception as e:
            error_msg = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.text # Use text to be safe
                    print(f"API Error Detail: {error_detail}")
                    error_msg = f"{str(e)} - Detail: {error_detail}"
                except:
                    error_msg = f"{str(e)} - Detail: (could not read response text)"
            else:
                print(f"Local Error: {str(e)}")
            
            # Log to file
            with open("backend_error.log", "a", encoding="utf-8") as f:
                import datetime
                now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"[{now}] Error: {error_msg}\n")
            
            print(f"Error generating image: {error_msg}")
            import traceback
            traceback.print_exc()
            raise Exception(error_msg)

banana_service = BananaService()
