import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { ScreenshotService } from './screenshot.js';
import { ImageProcessor } from './image-processor.js';

export class RequestHandler {
    /**
     * 解析请求体数据块为 JSON
     * @param {Buffer[]} chunks - 数据块数组
     * @returns {object} 解析后的对象
     * @throws {SyntaxError} JSON 解析错误
     */
    static parseBody(chunks) {
        const raw = Buffer.concat(chunks).toString() || '{}';
        try {
            return JSON.parse(raw);
        } catch (error) {
            throw new SyntaxError(`Invalid JSON: ${error.message}`);
        }
    }

    /**
     * 发送图片响应
     * @param {import('http').ServerResponse} res - HTTP 响应对象
     * @param {Buffer} image - 图片数据
     */
    static sendImage(res, image) {
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': image.length
        });
        res.end(image);
    }

    /**
     * 发送 JSON 响应
     * @param {import('http').ServerResponse} res - HTTP 响应对象
     * @param {number} statusCode - 状态码
     * @param {object} data - JSON 数据
     */
    static sendJson(res, statusCode, data) {
        const json = JSON.stringify(data);
        res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(json)
        });
        res.end(json);
    }

    /**
     * 发送错误响应
     * @param {import('http').ServerResponse} res - HTTP 响应对象
     * @param {number} statusCode - 状态码
     * @param {string} error - 错误信息
     * @param {string} message - 详细消息
     */
    static sendError(res, statusCode, error, message = '') {
        this.sendJson(res, statusCode, { error, message });
    }

    /**
     * 处理截图请求
     * @param {object} body - 请求体
     * @param {import('http').ServerResponse} res - 响应对象
     */
    static async handleScreenshot(body, res) {
        const image = await ScreenshotService.capture(body);
        this.sendImage(res, image);
    }

    /**
     * 处理水印提取请求
     * @param {object} body - 请求体
     * @param {import('http').ServerResponse} res - 响应对象
     */
    static async handleWatermarkExtract(body, res) {
        if (!body.image) {
            this.sendError(res, 400, 'Missing image data');
            return;
        }
        const watermark = await ImageProcessor.extractWatermark(
            Buffer.from(body.image, 'base64')
        );
        this.sendJson(res, 200, { watermark });
    }

    /**
     * 发送静态文件
     * @param {string} filename - 文件名
     * @param {import('http').ServerResponse} res - HTTP 响应对象
     * @param {string} baseDir - 基础目录路径
     */
    static handleStaticFile(filename, res, baseDir) {
        try {
            const filePath = join(baseDir, filename);
            if (!existsSync(filePath)) {
                this.sendError(res, 404, 'File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(readFileSync(filePath, 'utf-8'));
        } catch (error) {
            this.sendError(res, 500, 'Internal Server Error');
        }
    }
}
