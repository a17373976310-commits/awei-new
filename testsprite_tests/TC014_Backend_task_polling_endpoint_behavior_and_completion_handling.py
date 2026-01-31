import asyncio
from playwright import async_api

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
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)

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
        # -> Navigate to http://localhost:5173
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
        # -> Fill the prompt input and click the '应用编辑' / Generate button to submit an image generation task.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[1]/main/div[2]/div[1]/aside/div/div[5]/textarea').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('测试：验证后端任务轮询返回中间状态并最终生成图像以更新前端预览。请返回中间状态消息并最终的图像数据。')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/main/div[2]/div[1]/aside/div/button[1]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Open API provider settings in the UI to inspect provider configuration details (may reveal base URL/paths or additional info useful for polling). Then extract any visible endpoint or test buttons.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/header/div/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        try:
            await expect(frame.locator('text=Image generation complete').first).to_be_visible(timeout=3000)
        except AssertionError:
            raise AssertionError("Test case failed: expected backend task polling to complete and the frontend preview to update with the generated image (indicator 'Image generation complete'), but the success indicator never appeared — polling or preview update likely failed")
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    