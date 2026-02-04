import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ScreenshotService } from './services/screenshot.js';
import { ImageProcessor } from './services/image-processor.js';
import { RequestHandler } from './services/request-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN || 'token';

const server = http.createServer((req, res) => {
    const paths = req.url.split('/').filter(Boolean);

    // GET 请求 - 返回调试页面
    if (req.method === 'GET') {
        paths.length === 0 ? serveStatic('public/index.html', res) : RequestHandler.sendError(res, 401, 'Invalid token');
        return;
    }

    // 仅支持 POST 请求
    if (req.method !== 'POST') {
        RequestHandler.sendError(res, 405, 'Method not allowed');
        return;
    }

    // 验证 Token
    if (paths[0] !== TOKEN) {
        RequestHandler.sendError(res, 401, 'Invalid token');
        return;
    }

    const handler = new RequestHandler();
    req.on('data', chunk => handler.handleBody(chunk));
    req.on('end', async () => {
        try {
            const body = await handler.parseBody();

            // 提取水印接口
            if (paths[1] === 'extract') {
                if (!body.image) {
                    RequestHandler.sendError(res, 400, 'Missing image data');
                    return;
                }
                const watermark = await ImageProcessor.extractWatermark(Buffer.from(body.image, 'base64'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ watermark }));
            } else {
                // 截图接口
                const image = await ScreenshotService.capture(body);
                RequestHandler.sendImage(res, image);
            }
        } catch (error) {
            RequestHandler.sendError(res, 500, 'Internal Server Error', error.message);
            console.error('Error:', error);
        } finally {
            handler.reset();
        }
    });
});

/**
 * 发送静态文件
 * @param {string} filename - 文件名
 * @param {object} res - HTTP 响应对象
 */
function serveStatic(filename, res) {
    try {
        const filePath = join(__dirname, filename);
        if (!existsSync(filePath)) {
            RequestHandler.sendError(res, 404, 'File not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(readFileSync(filePath, 'utf-8'));
    } catch (error) {
        RequestHandler.sendError(res, 500, 'Internal Server Error');
    }
}

server.listen(PORT, () => {
    console.log(`Screenshot API listening at http://localhost:${PORT}`);
});
