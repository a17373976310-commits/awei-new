import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5174", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input a multi-line textual prompt into the textarea and upload an image to the sidebar chat input area.
        frame = context.pages[-1]
        # Input multi-line textual prompt into the textarea for AI generation
        elem = frame.locator('xpath=html/body/div/main/aside/div[4]/div[2]/textarea').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('这是一个多行文本提示，用于测试AI生成的提案卡。\n请注意模块名称、主题选择缩略图的正确索引、推荐的宽高比和最终提示。')
        

        frame = context.pages[-1]
        # Click upload image button to attach an image for the prompt
        elem = frame.locator('xpath=html/body/div/main/aside/div[4]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Upload an image to the sidebar chat input area to accompany the multi-line prompt.
        frame = context.pages[-1]
        # Click upload image button to open file selector for image upload
        elem = frame.locator('xpath=html/body/div/main/aside/div[4]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Upload an image file to the sidebar chat input area to accompany the multi-line prompt for AI proposal card generation.
        frame = context.pages[-1]
        # Click upload image button to open file selector for image upload
        elem = frame.locator('xpath=html/body/div/main/aside/div[4]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        try:
            await expect(frame.locator('text=Proposal Card Module XYZ').first).to_be_visible(timeout=1000)
        except AssertionError:
            raise AssertionError('Test failed: Proposal cards did not display module name, subject selection thumbnails with correct indices, recommended aspect ratios, or final prompts as expected.')
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    