import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ScreenshotService } from './services/screenshot.js';
import { ImageProcessor } from './services/image-processor.js';
import { RequestHandler } from './services/request-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 服务器配置 */
const CONFIG = {
    PORT: process.env.PORT || 3000,
    TOKEN: process.env.TOKEN || 'token'
};

/**
 * 验证 Token 中间件
 * @param {string[]} paths - URL 路径数组
 * @returns {boolean} 是否通过验证
 */
function validateToken(paths) {
    return paths[0] === CONFIG.TOKEN;
}

/**
 * 处理截图请求
 * @param {object} body - 请求体
 * @param {import('http').ServerResponse} res - 响应对象
 */
async function handleScreenshot(body, res) {
    const image = await ScreenshotService.capture(body);
    RequestHandler.sendImage(res, image);
}

/**
 * 处理水印提取请求
 * @param {object} body - 请求体
 * @param {import('http').ServerResponse} res - 响应对象
 */
async function handleWatermarkExtract(body, res) {
    if (!body.image) {
        RequestHandler.sendError(res, 400, 'Missing image data');
        return;
    }
    const watermark = await ImageProcessor.extractWatermark(
        Buffer.from(body.image, 'base64')
    );
    RequestHandler.sendJson(res, 200, { watermark });
}

/**
 * 发送静态文件
 * @param {string} filename - 文件名
 * @param {import('http').ServerResponse} res - HTTP 响应对象
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

/**
 * 主请求处理器
 * @param {import('http').IncomingMessage} req - 请求对象
 * @param {import('http').ServerResponse} res - 响应对象
 */
async function requestHandler(req, res) {
    const paths = req.url.split('/').filter(Boolean);

    // GET 请求 - 仅允许带 token 的路径访问调试页面
    if (req.method === 'GET') {
        // 如果路径为空，返回使用说明页面
        if (paths.length === 0) {
            serveStatic('public/landing.html', res);
            return;
        }
        // 如果路径只有一个部分，可能是 token
        if (paths.length === 1) {
            if (!validateToken(paths)) {
                RequestHandler.sendError(res, 401, 'Invalid token');
                return;
            }
            serveStatic('public/index.html', res);
            return;
        }
    }

    // 仅支持 POST 请求
    if (req.method !== 'POST') {
        RequestHandler.sendError(res, 405, 'Method not allowed. Use POST instead.');
        return;
    }

    // 验证 Token
    if (!validateToken(paths)) {
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
                await handleWatermarkExtract(body, res);
            } else {
                await handleScreenshot(body, res);
            }
        } catch (error) {
            RequestHandler.sendError(res, 500, 'Internal Server Error', error.message);
            console.error('Request processing error:', error);
        } finally {
            handler.reset();
        }
    });
}

// 创建并启动服务器
const server = http.createServer(requestHandler);
server.listen(CONFIG.PORT, () => {
    console.log(`Screenshot API listening at http://localhost:${CONFIG.PORT}`);
});
