import os
import sys
import json
import base64
import time
import hashlib
import requests

# Add parent directory to sys.path to support imports in production (Zeabur)
# This allows both "from config import" and "from backend.config import" to work
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from typing import Optional
from fastapi import FastAPI, UploadFile, Form, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Now imports should work regardless of how the script is run
from services.banana_service import banana_service
from services.prompt_service import prompt_service
from services.task_service import task_service
from services.chat_service import chat_service

def debug_log(message: str):
    """Helper to log debug info to a file since terminal output might be truncated or hard to follow."""
    try:
        log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "debug.log")
        with open(log_path, "a", encoding="utf-8") as f:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {message}\n")
    except:
        pass

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}

# Serve static files
dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
static_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

# Ensure static directory exists
os.makedirs(static_path, exist_ok=True)
os.makedirs(os.path.join(static_path, "history"), exist_ok=True)

# Mount static folder for history and other assets
# Static files should be defined early, but after API routes that might use same prefix (none here)
app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/chat")
async def chat(
    messages: str = Form(...),
    visual_dna: Optional[str] = Form(None),
    product_identity: Optional[str] = Form(None),
    reference_images: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    api_url: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    image_model: Optional[str] = Form(None),
    thought_signature: Optional[str] = Form(None),
    thinking_level: Optional[str] = Form(None),
    grounding: Optional[str] = Form(None),
    image: Optional[list[UploadFile]] = File(None),
    track_a: Optional[list[UploadFile]] = File(None),
    track_b: Optional[list[UploadFile]] = File(None)
):
    try:
        print(f">>> API CALL: /api/chat | Model: {model} | Grounding: {grounding}")
        # Convert grounding string to boolean
        is_grounding = grounding.lower() == "true" if grounding else False
        # Form data sends messages as a JSON string
        if isinstance(messages, str):
            try:
                messages_list = json.loads(messages)
            except json.JSONDecodeError as je:
                debug_log(f"JSON Decode Error in messages: {je}")
                raise HTTPException(status_code=400, detail=f"Invalid JSON in messages: {str(je)}")
        else:
            messages_list = messages
            
        image_bytes_list = []
        if image:
            for img in image:
                content = await img.read()
                if content:
                    image_bytes_list.append(content)

        track_a_bytes = []
        if track_a:
            for img in track_a:
                content = await img.read()
                if content:
                    track_a_bytes.append(content)

        track_b_bytes = []
        if track_b:
            for img in track_b:
                content = await img.read()
                if content:
                    track_b_bytes.append(content)

        # Use chat_service.chat but ensure we're using the new DIRECTOR_AGENT_PROMPT internally
        # Note: chat_service needs to be aware of the 'mode' or we can inject the system prompt here
        # For now, let's assume chat_service handles the prompt selection based on mode or input
        
        print(f"DEBUG: Calling chat_service.chat with {len(messages_list)} messages...")
        
        # Use run_in_threadpool to avoid blocking the async event loop with synchronous requests
        from fastapi.concurrency import run_in_threadpool
        
        chat_result = await run_in_threadpool(
            chat_service.chat,
            messages=messages_list, 
            visual_dna=visual_dna, 
            product_identity=product_identity, 
            reference_images=reference_images, 
            api_key=api_key, 
            api_url=api_url, 
            model=model, 
            images=image_bytes_list, 
            image_model=image_model,
            thought_signature=thought_signature,
            thinking_level=thinking_level,
            grounding=is_grounding,
            track_a_images=track_a_bytes,
            track_b_images=track_b_bytes
        )
        print("DEBUG: chat_service.chat returned successfully")
        
        response_text = chat_result.get("content", "")
        new_thought_signature = chat_result.get("thought_signature")
        
        # Check if response indicates an error (e.g., 401)
        if response_text.startswith("抱歉，聊天服务出现错误：401"):
            raise HTTPException(status_code=401, detail="API Key 无效或未配置，请在设置中检查。")
            
        print(f"DEBUG: Returning response (len={len(response_text)})")
        # Return response text and thought signature
        return {
            "response": response_text,
            "thought_signature": new_thought_signature
        }
    except HTTPException as he:
        print(f"ERROR: HTTPException in /api/chat: {he.detail}")
        raise he
    except Exception as e:
        print(f"ERROR: Unhandled exception in /api/chat: {str(e)}")
        import traceback
        traceback.print_exc()
        debug_log(f"Unhandled error in /api/chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    ratio: str = Form(...),
    scenario: str = Form("general"),
    model: str = Form("nano_banana_2"),
    api_key: Optional[str] = Form(None),
    api_url: Optional[str] = Form(None),
    thought_signature: Optional[str] = Form(None),
    thinking_level: Optional[str] = Form(None),
    identity_ref: Optional[int] = Form(None),
    logic_ref: Optional[int] = Form(None),
    image: Optional[list[UploadFile]] = File(None),
    mask: Optional[UploadFile] = File(None)
):
    task_id = task_service.create_task("image_generation")
    
    # Read files immediately before background task
    image_bytes_list = []
    if image:
        for img in image:
            content = await img.read()
            if content:
                image_bytes_list.append(content)
    
    mask_bytes = await mask.read() if mask else None
    
    background_tasks.add_task(
        run_generation_task,
        task_id, prompt, ratio, scenario, model, api_key, api_url, image_bytes_list, mask_bytes, thought_signature, thinking_level, identity_ref, logic_ref
    )
    
    return {"task_id": task_id, "status": "pending"}



async def run_generation_task(
    task_id: str,
    prompt: str,
    ratio: str,
    scenario: str,
    model: str,
    api_key: Optional[str],
    api_url: Optional[str],
    image_bytes_list: list[bytes],
    mask_bytes: Optional[bytes],
    thought_signature: Optional[str] = None,
    thinking_level: Optional[str] = None,
    identity_ref: Optional[int] = None,
    logic_ref: Optional[int] = None
):
    try:
        task_service.update_task(task_id, status="processing", progress=5, progress_message="🎬 初始化生成任务...")
        print(f"\n>>> [ASYNC TASK {task_id}] Prompt: {prompt[:50]}... | Model: {model}")
        
        # 1. Optimize prompt (skip for free_mode or if thought_signature is present)
        # thought_signature implies this is a multi-turn instruction from Director Agent
        if scenario == 'free_mode' or thought_signature:
            task_service.update_task(task_id, progress=30, progress_message="✅ 使用精确指令：跳过提示词优化")
            optimized_result = prompt
        else:
            if image_bytes_list:
                task_service.update_task(task_id, progress=10, progress_message=f"📸 分析上传的 {len(image_bytes_list)} 张产品图...")
            
            task_service.update_task(task_id, progress=15, progress_message="🤖 准备提示词优化引擎...")
            try:
                optimized_result = prompt_service.optimize_prompt(prompt, scenario, image_bytes_list, api_key, api_url, task_id, task_service)
                task_service.update_task(task_id, progress=30, progress_message="✨ 提示词优化完成")
            except Exception as e:
                print(f"Prompt optimization failed: {e}")
                task_service.update_task(task_id, progress=30, progress_message="⚠️ 提示词优化失败,使用原始提示词")
                optimized_result = prompt # Fallback to original prompt
        
        final_prompt = optimized_result
        layout_logic = ""
        
        try:
            prompt_data = json.loads(optimized_result)
            
            # Extract thinking_level from optimized prompt if present
            if "thinking_level" in prompt_data and not thinking_level:
                thinking_level = prompt_data["thinking_level"]
                
            # Handle Dual-Track indexing from optimized result if present
            if "proposal" in prompt_data:
                p = prompt_data["proposal"]
                if "identity_ref" in p and identity_ref is None:
                    identity_ref = p["identity_ref"]
                if "logic_ref" in p and logic_ref is None:
                    logic_ref = p["logic_ref"]

            # Handle Luxury Visual Strategy format
            if "luxury_visual_strategy" in prompt_data:
                strategy = prompt_data["luxury_visual_strategy"]
                screens = strategy.get("screens", [])
                if screens:
                    # Default to the first screen (Brand Impact)
                    first_screen = screens[0]
                    final_prompt = first_screen.get("positive_prompt", optimized_result)
                    layout_logic = f"Screen: {first_screen.get('screen_name_zh', '1')}\n{strategy.get('visual_grammar_handbook', {}).get('composition_rules', {})}"
                else:
                    final_prompt = optimized_result
            else:
                # Standard Dual-Core format
                is_seadream = "doubao" in model.lower() or "seadream" in model.lower()
                if is_seadream:
                    final_prompt = prompt_data.get("seadream_cn", prompt_data.get("nano_banana_en", optimized_result))
                else:
                    final_prompt = prompt_data.get("nano_banana_en", prompt_data.get("seadream_cn", optimized_result))
                layout_logic = prompt_data.get("layout_logic", "")
        except Exception as e:
            print(f"DEBUG_LOG: JSON parsing failed or format mismatch: {e}")
            final_prompt = optimized_result

        task_service.update_task(task_id, progress=35, progress_message="🔧 准备图像生成参数...")
        # 2. Generate Image
        from models import get_model_info
        model_info = get_model_info(model)
        model_display_name = model_info.get("name", model) if model_info else model
        provider = model_info.get("provider", "default") if model_info else "default"
        
        # More detailed progress based on whether it's text-to-image or image-to-image
        if image_bytes_list:
            task_service.update_task(task_id, progress=40, progress_message=f"🖌️ 正在使用 {model_display_name} 处理 {len(image_bytes_list)} 张图像...")
        else:
            task_service.update_task(task_id, progress=40, progress_message=f"🎨 正在使用 {model_display_name} 生成图像...")
        
        task_service.update_task(task_id, progress=45, progress_message=f"📡 正在发送请求到 {provider} 服务器...")
        
        try:
            try:
                with open("prompt_debug.log", "a", encoding="utf-8") as f:
                    f.write("\n--- FINAL_IMAGE_REQUEST ---\n")
                    f.write(f"task_id: {task_id}\n")
                    f.write(f"scenario: {scenario}\n")
                    f.write(f"model: {model}\n")
                    f.write(f"provider: {provider}\n")
                    f.write(f"ratio: {ratio}\n")
                    f.write(f"thought_signature: {thought_signature}\n")
                    f.write(f"thinking_level: {thinking_level}\n")
                    f.write(f"identity_ref: {identity_ref}\n")
                    f.write(f"logic_ref: {logic_ref}\n")
                    f.write(f"images_count: {len(image_bytes_list)}\n")
                    for idx, img_bytes in enumerate(image_bytes_list):
                        sha1 = hashlib.sha1(img_bytes).hexdigest()
                        f.write(f"image_{idx}: bytes={len(img_bytes)} sha1={sha1}\n")
                    if mask_bytes:
                        f.write(f"mask: bytes={len(mask_bytes)} sha1={hashlib.sha1(mask_bytes).hexdigest()}\n")
                    f.write("prompt:\n")
                    f.write(final_prompt)
                    f.write("\n")
            except Exception as e:
                debug_log(f"Failed to write prompt_debug.log FINAL_IMAGE_REQUEST: {e}")

            result_data = banana_service.generate_image(final_prompt, ratio, image_bytes_list, mask_bytes, model, api_key, api_url, thought_signature, thinking_level, identity_ref, logic_ref)
            result = result_data.get("url", "")
            new_thought_signature = result_data.get("thought_signature")
            
            task_service.update_task(task_id, progress=70, progress_message="🖼️ 图像生成完成,正在处理...")
        except Exception as e:
            error_msg = str(e)
            if "Remote end closed connection" in error_msg or "Connection aborted" in error_msg:
                error_msg = "与生成服务器连接中断，请稍后重试。"
            elif "timeout" in error_msg.lower():
                error_msg = "生成超时，请尝试缩短提示词或稍后再试。"
            raise Exception(error_msg)

        if not result:
            raise Exception("生成服务器未返回有效图像，请检查 API Key 或余额。")

        debug_log(f"Task {task_id}: Generation result type: {type(result)}")
        if isinstance(result, str):
            debug_log(f"Task {task_id}: Result prefix: {result[:50]}...")
        
        # 3. Proxy image (Download and convert to Base64)
        if result and isinstance(result, str) and result.startswith("http"):
            task_service.update_task(task_id, progress=80, progress_message="📥 正在下载生成的图像...")
            try:
                # Retry download up to 2 times
                for attempt in range(2):
                    try:
                        # Bypass proxies to avoid connection issues
                        img_response = requests.get(result, timeout=30, proxies={"http": None, "https": None})
                        img_response.raise_for_status()
                        b64_data = base64.b64encode(img_response.content).decode('utf-8')
                        result = f"data:image/png;base64,{b64_data}"
                        break
                    except Exception as download_err:
                        print(f"Proxy download attempt {attempt+1} failed: {download_err}")
                        if attempt == 0: time.sleep(2)
            except Exception as e:
                print(f"Proxy failed completely: {e}")
                # Keep original URL if proxy fails

        if result and isinstance(result, str):
            result = result.strip()
            if not result.startswith("http") and not result.startswith("data:"):
                result = f"data:image/png;base64,{result}"
            
        # 4. Save History
        task_service.update_task(task_id, progress=85, progress_message="💾 正在保存到历史记录...")
        try:
            timestamp = int(time.time() * 1000)
            history_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "history")
            os.makedirs(history_dir, exist_ok=True)

            # Save generated image
            saved_image = False
            if result:
                if result.startswith("data:image"):
                    try:
                        header, encoded = result.split(",", 1)
                        img_data = base64.b64decode(encoded)
                        save_path = os.path.join(history_dir, f"{timestamp}.png")
                        with open(save_path, "wb") as f:
                            f.write(img_data)
                        saved_image = True
                        debug_log(f"Task {task_id}: Saved base64 image to {save_path}")
                    except Exception as e:
                        debug_log(f"Task {task_id}: Error saving base64 image: {e}")
                elif result.startswith("http"):
                    try:
                        # Download the image if it's a URL
                        debug_log(f"Task {task_id}: Downloading image from {result}")
                        # Use system proxies (do not disable them) to support VPNs
                        img_response = requests.get(result, timeout=30)
                        img_response.raise_for_status()
                        save_path = os.path.join(history_dir, f"{timestamp}.png")
                        with open(save_path, "wb") as f:
                            f.write(img_response.content)
                        saved_image = True
                        debug_log(f"Task {task_id}: Downloaded and saved image to {save_path}")
                    except Exception as e:
                        debug_log(f"Task {task_id}: Error downloading image for history: {e}")
                else:
                    debug_log(f"Task {task_id}: Result format not recognized for saving: {result[:50]}...")

            if not saved_image:
                debug_log(f"Task {task_id}: Warning: Generated image was not saved to history")

            # Save original images and collect their relative URLs
            original_images_urls = []
            for idx, img_bytes in enumerate(image_bytes_list):
                orig_filename = f"{timestamp}_orig_{idx}.jpg"
                with open(os.path.join(history_dir, orig_filename), "wb") as f:
                    f.write(img_bytes)
                original_images_urls.append(f"/static/history/{orig_filename}")
            
            print(f"DEBUG_LOG: Saved {len(image_bytes_list)} original images")

            # Save metadata
            metadata = {
                "timestamp": timestamp,
                "original_prompt": prompt,
                "optimized_prompt": final_prompt,
                "scenario": scenario,
                "model": model,
                "ratio": ratio,
                "layout_logic": layout_logic,
                "original_images_count": len(image_bytes_list)
            }
            with open(os.path.join(history_dir, f"{timestamp}.json"), "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            
            print(f"History saved successfully for timestamp: {timestamp}")
        except Exception as e:
            print(f"History save error: {e}")

        task_service.update_task(task_id, status="succeed", progress=100, progress_message="✅ 完成!", result={
            "id": str(timestamp),
            "url": f"/static/history/{timestamp}.png" if saved_image else result,
            "optimized_prompt": final_prompt,
            "original_prompt": prompt,
            "original_images": original_images_urls,
            "timestamp": timestamp,
            "thought_signature": new_thought_signature # Pass back to frontend
        })
        debug_log(f"Task {task_id}: Success. Result URL: {f'/static/history/{timestamp}.png' if saved_image else result}")
        print(f"<<< [ASYNC TASK {task_id} SUCCESS] Result URL: {f'/static/history/{timestamp}.png' if saved_image else result}")

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ASYNC TASK ERROR: {str(e)}\n{error_trace}")
        task_service.update_task(task_id, status="failed", error=str(e))

# SPA Serving - MUST BE DEFINED LAST
if os.path.exists(dist_path):
    # In production (Zeabur), serve from dist
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Prevent catch-all from swallowing 404s for API
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail=f"API endpoint not found: {full_path}")
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    # Fallback for local development
    app.mount("/frontend", StaticFiles(directory=frontend_path), name="frontend")
    
    @app.get("/")
    async def read_root():
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    import os
    import argparse
    
    # Detect if running in production (Zeabur) or development
    is_production = os.getenv("ZEABUR_SERVICE_ID") is not None
    
    # Setup argument parser
    parser = argparse.ArgumentParser(description="Run the AI Image Gen backend.")
    parser.add_index = False # Not needed for argparse
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", 8080)), help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args, unknown = parser.parse_known_args()
    
    if is_production:
        # Production mode: use backend.main:app and disable reload
        uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=False)
    else:
        # Development mode: use main:app (for running from backend directory) and enable reload
        # If --reload is not passed, we use the default logic or the passed flag
        should_reload = args.reload or not is_production
        uvicorn.run("main:app", host=args.host, port=args.port, reload=should_reload)
