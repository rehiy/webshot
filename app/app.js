const http = require('http');
const sharp = require('sharp');
const { chromium, devices } = require('playwright');

const port = process.env.PORT || 3000;
const token = process.env.TOKEN || 'token';

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const paths = url.pathname.split('/').filter(Boolean);

    if (paths[0] === token && paths.length > 4) {
        const hexColor = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        try {
            const args = {
                waitFor: paths[1] > 0 ? +paths[1] : 0,
                trimColor: hexColor.test(paths[2]) ? paths[2] : '',
                deviceInfo: devices[paths[3]] || devices['Desktop'],
                targetUrl: paths.slice(4).join('/') + (url.search || ''),
            };
            // 截取屏幕
            const image = await screenshot(args);
            // 输出图片
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': image.length,
            });
            res.end(image);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            console.error('Error:', error);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Url shoude be like http://${req.headers.host}/:token/:wait/:trim/:device/*`);
    }
});

server.listen(port, () => {
    console.log(`Screenshot API listening at http://localhost:${port}`);
});

// 无头浏览器截图

async function screenshot(args) {
    const { waitFor, trimColor, deviceInfo, targetUrl } = args;

    // 加载页面
    const browser = await chromium.launch();
    const context = await browser.newContext(deviceInfo);
    const page = await context.newPage();
    await page.goto(targetUrl);

    // 等待加载
    if (waitFor == 0) {
        await page.waitForLoadState('load')
    } else if (waitFor == 1) {
        await page.waitForLoadState('domcontentloaded')
    } else if (waitFor == 2) {
        await page.waitForLoadState('networkidle0')
    } else {
        await page.waitForTimeout(waitFor);
    }

    // 开始截图
    let image = await page.screenshot({ fullPage: true });

    // 销毁资源
    context.close(), browser.close();

    // 压缩图片
    if (trimColor) {
        const trimParams = { background: '#' + trimColor, inlineArt: true };
        image = await sharp(image).resize(1080).png({ quality: 80 }).trim(trimParams).toBuffer();
    }

    return image;
}
