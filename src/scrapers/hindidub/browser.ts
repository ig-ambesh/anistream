import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

let browserInstance: any = null;

export const getBrowser = async () => {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled'
            ],
            ignoreDefaultArgs: ["--enable-automation"],
            executablePath: process.env.CHROME_BIN || undefined,
        });
    }
    return browserInstance;
};

export const fetchHtml = async (url: string): Promise<string> => {
    let page: any = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait to bypass cloudflare
        await new Promise(r => setTimeout(r, 3000));

        const title = await page.title();
        if (title.includes('Just a moment')) {
            console.log("Cloudflare Turnstile detected. Attempting bypass...");
            try {
                // Try clicking the turnstile iframe
                const frameElement = await page.$('iframe');
                if (frameElement) {
                    const box = await frameElement.boundingBox();
                    if (box) {
                        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                        await new Promise(r => setTimeout(r, 6000));
                    }
                }
            } catch (e) {
                console.log("Turnstile bypass click failed", e);
            }
        }

        const html = await page.content();
        return html;
    } catch (e) {
        console.error("Puppeteer fetch error:", e);
        throw e;
    } finally {
        if (page) await page.close().catch(() => {});
    }
};
