import { devices } from 'playwright';

import { BrowserManager } from './browser-manager.js';
import { ImageProcessor } from './image-processor.js';

// 退出时清理浏览器资源
process.on('SIGINT', async () => {
    try {
        await BrowserManager.cleanup();
    } catch (error) {
        console.error('Cleanup error:', error);
    }
    process.exit(0);
});
process.on('SIGTERM', async () => {
    try {
        await BrowserManager.cleanup();
    } catch (error) {
        console.error('Cleanup error:', error);
    }
    process.exit(0);
});

/**
 * 截图服务
 */
export class ScreenshotService {
    /** HEX 颜色正则表达式 */
    static HEX_COLOR_REGEX = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    /** 等待策略映射 */
    static WAIT_STATES = {
        0: 'load',
        1: 'domcontentloaded',
        2: 'networkidle0'
    };

    /** 默认等待超时（毫秒） */
    static DEFAULT_TIMEOUT = 30000;

    /**
     * 获取设备信息
     * @param {string} deviceName - 设备名称
     * @returns {object} 设备配置信息
     */
    static getDeviceInfo(deviceName) {
        return devices[deviceName] || devices['Desktop Chrome'];
    }

    /**
     * 验证 hex 颜色格式
     * @param {string} color - 颜色值
     * @returns {boolean} 是否有效
     */
    static isValidHexColor(color) {
        return typeof color === 'string' && this.HEX_COLOR_REGEX.test(color);
    }

    /**
     * 等待页面加载（带超时保护）
     * @param {Page} page - Playwright 页面对象
     * @param {number} waitFor - 等待策略：0=load, 1=domcontentloaded, 2=networkidle0, >2=毫秒数
     * @param {number} timeout - 最大等待时间（毫秒）
     */
    static async waitForPage(page, waitFor, timeout = this.DEFAULT_TIMEOUT) {
        const state = this.WAIT_STATES[waitFor];

        if (state) {
            return Promise.race([
                page.waitForLoadState(state),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout waiting for ${state}`)), timeout)
                )
            ]);
        }

        const waitTime = Math.min(waitFor, timeout);
        return page.waitForTimeout(waitTime);
    }

    /**
     * 构建用户代理信息部分
     * @private
     */
    static #buildUserAgentPart(deviceInfo) {
        if (!deviceInfo?.userAgent) return null;
        const uaMatch = deviceInfo.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/([\d.]+)/);
        return uaMatch ? `UA:${uaMatch[1]} ${uaMatch[2]}` : null;
    }

    /**
     * 构建等待策略描述部分
     * @private
     */
    static #buildWaitForPart(waitFor) {
        if (waitFor === undefined) return null;
        const descriptions = { 0: 'load', 1: 'dom', 2: 'networkidle' };
        return `Wait:${descriptions[waitFor] || `${waitFor}ms`}`;
    }

    /**
     * 构建水印文本
     * 格式：{自定义文本} | {时间戳} | URL:{url} | Device:{device} | UA:{浏览器版本} | Wait:{策略} | Trim:{颜色} | Cookies:{数量} | JS:{true/false}
     * @param {object} params - 参数对象
     * @returns {string|null} 水印文本或 null
     */
    static buildWatermarkText({ watermark, url, html, device, waitFor, trimColor, cookies, evaluate, deviceInfo }) {
        if (!watermark) return null;

        const parts = [
            watermark,
            new Date().toISOString().slice(0, 19).replace('T', ' ')
        ];

        // 添加可选部分
        if (url) parts.push(`URL:${url}`);
        if (html) parts.push('HTML');
        if (device) parts.push(`Device:${device}`);

        const uaPart = this.#buildUserAgentPart(deviceInfo);
        if (uaPart) parts.push(uaPart);

        const waitPart = this.#buildWaitForPart(waitFor);
        if (waitPart) parts.push(waitPart);

        if (trimColor) parts.push(`Trim:#${trimColor}`);
        if (cookies?.length) parts.push(`Cookies:${cookies.length}`);
        if (evaluate) parts.push('JS:true');

        return parts.join(' | ');
    }

    /**
     * 设置页面 Cookies
     * @private
     */
    static async #setCookies(page, cookies) {
        if (!cookies?.length) return;
        await page.context().addCookies(cookies);
    }

    /**
     * 执行页面 JavaScript
     * @private
     */
    static async #evaluateJavaScript(page, evaluate) {
        if (!evaluate) return;
        try {
            await page.evaluate(evaluate);
        } catch (error) {
            console.error('JS evaluation error:', error.message);
        }
    }

    /**
     * 执行截图核心逻辑
     * @private
     */
    static async #captureCore(pageAction, params) {
        const { waitFor, trimColor, deviceInfo, cookies, evaluate } = params;
        const page = await BrowserManager.createPage(deviceInfo);

        try {
            await this.#setCookies(page, cookies);
            await pageAction(page);
            await this.waitForPage(page, waitFor);
            await this.#evaluateJavaScript(page, evaluate);

            const image = await page.screenshot({ fullPage: true });
            const watermarkText = this.buildWatermarkText(params);
            return await ImageProcessor.processImage(image, trimColor, watermarkText);
        } finally {
            await BrowserManager.closePage(page);
        }
    }

    /**
     * 统一截图入口
     * @param {object} options - 截图选项
     * @returns {Promise<Buffer>} 截图数据
     */
    static async capture({ url, html, waitFor = 0, trimColor = '', device, cookies, evaluate, watermark }) {
        if (!url && !html) {
            throw new Error('Either "url" or "html" parameter is required');
        }

        const deviceInfo = this.getDeviceInfo(device);
        const pageAction = url
            ? page => page.goto(url)
            : page => page.setContent(html, { waitUntil: 'domcontentloaded' });

        return this.#captureCore(pageAction, {
            waitFor: +waitFor,
            trimColor: this.isValidHexColor(trimColor) ? trimColor : '',
            deviceInfo,
            cookies,
            evaluate,
            watermark,
            url,
            html,
            device
        });
    }
}
