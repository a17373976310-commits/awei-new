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
        
        # -> Enter a multi-line request into the sidebar chat to trigger AI proposal cards, then send it.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[1]/main/aside/div[4]/div[2]/textarea').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('这是一个测试需求：
请为产品详情页生成3个创意方案，每个方案包含：
- 模块名（例如：主图、场景图、细节图）
- 主题选择（请在每个方案中返回缩略图索引或标识）
- 推荐比例（例如 1:1、4:3、3:4）
- 最终优化后的提示词（用于图像生成）

参考图片将稍后上传。请以结构化卡片形式返回（模块名、主题缩略图索引、推荐比例、最终提示词）。
谢谢。')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/main/aside/div[4]/div[2]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Open API/provider settings to configure or re-enable the backend so the AI can generate proposal cards.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/header/div/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the provider option (comfly测试) in the API settings to enable the backend so the AI can generate proposal cards (click element index 936).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[2]/div/div[2]/div/div[2]/div[1]/span').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Select the 'comfly测试' provider in API settings, save settings, then resend the same multi-line chat message in the sidebar to trigger AI proposal cards and observe results.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[2]/div/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[2]/div/div[3]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[1]/main/aside/div[4]/div[2]/textarea').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('这是一个测试需求：
请为产品详情页生成3个创意方案，每个方案包含：
- 模块名（例如：主图、场景图、细节图）
- 主题选择（请在每个方案中返回缩略图索引或标识）
- 推荐比例（例如 1:1、4:3、3:4）
- 最终优化后的提示词（用于图像生成）

参考图片将稍后上传。请以结构化卡片形式返回（模块名、主题缩略图索引、推荐比例、最终提示词）。
谢谢。')
        
        # -> Send the re-typed multi-line chat message by clicking the send button so the backend can produce proposal cards, then inspect the results.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/main/aside/div[4]/div[2]/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Open API provider settings and confirm 'comfly测试' is actually enabled (or change provider) so backend becomes available. Immediate action: open the API settings panel.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[1]/header/div/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    