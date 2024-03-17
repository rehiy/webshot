const { chromium, devices } = require('playwright');
const express = require('express');
const sharp = require('sharp');

const app = express();

const port = process.env.PORT || 3000;
const token = process.env.TOKEN + '';

app.get('/' + token + '/:wait/:trim/:device/*', async (req, res) => {
    const hexColor = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const params = req.params || {};
    try {
        // 获取参数
        const waitFor = params.wait > 0 ? +params.wait : 0;
        const trimColor = hexColor.test(params.trim) ? params.trim : '';
        const deviceInfo = devices[params.device] || devices['Desktop'];
        const queryString = req.url.indexOf('?') > 0 ? '?' + req.url.split('?')[1] : '';
        const targetUrl = req.params[0] ? req.params[0] + queryString : 'https://example.com';
        // 截取屏幕
        const image = await screenshot({ waitFor, trimColor, deviceInfo, targetUrl });
        // 输出图片
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': image.length,
        });
        res.end(image);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Screenshot API listening at http://localhost:${port}`);
});

// 无头浏览器截图

async function screenshot(args) {
    const { waitFor, trimColor, deviceInfo, targetUrl } = args

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
    await context.close();
    await browser.close();

    // 压缩图片
    if (trimColor) {
        const trimParams = { background: '#' + trimColor, inlineArt: true };
        image = await sharp(image).resize(1080).png({ quality: 80 }).trim(trimParams).toBuffer();
    }

    return image;
}
