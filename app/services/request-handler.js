/**
 * HTTP 请求处理器
 * 负责处理请求体解析和响应发送
 */
export class RequestHandler {
    #chunks = [];

    /**
     * 处理请求体数据
     * @param {Buffer} chunk - 数据块
     */
    handleBody(chunk) {
        this.#chunks.push(chunk);
    }

    /**
     * 解析请求体为 JSON
     * @returns {object} 解析后的对象
     */
    async parseBody() {
        return JSON.parse(Buffer.concat(this.#chunks).toString() || '{}');
    }

    /**
     * 重置处理器状态
     */
    reset() {
        this.#chunks = [];
    }

    /**
     * 发送图片响应
     * @param {object} res - HTTP 响应对象
     * @param {Buffer} image - 图片数据
     */
    static sendImage(res, image) {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': image.length });
        res.end(image);
    }

    /**
     * 发送错误响应
     * @param {object} res - HTTP 响应对象
     * @param {number} statusCode - 状态码
     * @param {string} error - 错误信息
     * @param {string} message - 详细消息
     */
    static sendError(res, statusCode, error, message = '') {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error, message }));
    }
}
