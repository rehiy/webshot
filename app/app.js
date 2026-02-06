import http from 'http';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { RequestHandler } from './services/request-handler.js';

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN || 'token';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 创建 HTTP 服务器
const server = http.createServer(async function httpHandler(req, res) {
    const paths = req.url.split('/').filter(Boolean);

    // GET 请求 - 仅允许带 token 的路径访问调试页面
    if (req.method === 'GET') {
        // 如果路径为空，返回使用说明页面
        if (paths.length === 0) {
            RequestHandler.handleStaticFile('public/landing.html', res, __dirname);
            return;
        }
        // 如果路径只有一个部分，可能是 token
        if (paths.length === 1) {
            if (paths[0] !== TOKEN) {
                RequestHandler.sendError(res, 401, 'Invalid token');
                return;
            }
            RequestHandler.handleStaticFile('public/index.html', res, __dirname);
            return;
        }
    }

    // 拦截所有非 POST 请求
    if (req.method !== 'POST') {
        RequestHandler.sendError(res, 405, 'Method not allowed. Use POST instead.');
        return;
    }

    // 验证 Token
    if (paths[0] !== TOKEN) {
        RequestHandler.sendError(res, 401, 'Invalid token');
        return;
    }

    // 收集请求体数据
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
        try {
            const body = RequestHandler.parseBody(chunks);
            // 提取水印
            if (paths[1] === 'extract') {
                await RequestHandler.handleWatermarkExtract(body, res);
                return;
            }
            // 页面截图
            await RequestHandler.handleScreenshot(body, res);
        } catch (error) {
            console.error('Request processing error:', error);
            RequestHandler.sendError(res, 500, 'Internal Server Error', error.message);
        }
    });
});

// 启动 HTTP 服务器
server.listen(PORT, () => {
    console.log(`Screenshot API listening at http://localhost:${PORT}`);
});
