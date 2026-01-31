import asyncio
from backend.services.banana_service import banana_service

def test_generation():
    print("Starting test generation...")
    try:
        # Test parameters matching the user's request
        prompt = "A girl"
        ratio = "1:1"
        model = "doubao_seedream_4_5"
        
        # Call the service directly
        result = banana_service.generate_image(
            prompt=prompt,
            ratio=ratio,
            model_id=model
        )
        print(f"Success! Result: {result}")
    except Exception as e:
        print(f"Test Failed with Error: {e}")

if __name__ == "__main__":
    test_generation()
