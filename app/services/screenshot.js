import { devices } from 'playwright';

import { BrowserManager } from './browser-manager.js';
import { ImageProcessor } from './image-processor.js';

/**
 * 截图服务
 */
export class ScreenshotService {
    // HEX 颜色正则表达式
    static HEX_COLOR_REGEX = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    /**
     * 获取设备信息
     * @param {string} deviceName - 设备名称
     * @returns {object} 设备配置信息
     */
    static getDeviceInfo(deviceName) {
        return devices[decodeURI(deviceName)] || devices['Desktop Chrome'];
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
     * 等待页面加载
     * @param {object} page - Playwright 页面对象
     * @param {number} waitFor - 等待策略：0=load, 1=domcontentloaded, 2=networkidle0, >2=毫秒数
     */
    static async waitForPage(page, waitFor) {
        const states = { 0: 'load', 1: 'domcontentloaded', 2: 'networkidle0' };
        const state = states[waitFor];
        state ? await page.waitForLoadState(state) : await page.waitForTimeout(waitFor);
    }

    /**
     * 构建水印文本
     * 格式：{自定义文本} | {时间戳} | URL:{url} | Device:{device} | UA:{浏览器版本} | Wait:{策略} | Trim:{颜色} | Cookies:{数量} | JS:{true/false}
     */
    static buildWatermarkText({ watermark, url, html, device, waitFor, trimColor, cookies, evaluate, deviceInfo }) {
        if (!watermark) return null;

        const parts = [
            watermark,
            new Date().toISOString().slice(0, 19).replace('T', ' ')
        ];

        url && parts.push(`URL:${url}`);
        html && parts.push('HTML');
        device && parts.push(`Device:${device}`);

        if (deviceInfo?.userAgent) {
            const uaMatch = deviceInfo.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/([\d.]+)/);
            uaMatch && parts.push(`UA:${uaMatch[1]} ${uaMatch[2]}`);
        }

        waitFor !== undefined && parts.push(`Wait:${
            waitFor === 0 ? 'load' : waitFor === 1 ? 'dom' : waitFor === 2 ? 'networkidle' : `${waitFor}ms`
        }`);
        trimColor && parts.push(`Trim:#${trimColor}`);
        cookies?.length && parts.push(`Cookies:${cookies.length}`);
        evaluate && parts.push('JS:true');

        return parts.join(' | ');
    }

    /**
     * 执行截图
     * @param {function} pageAction - 页面操作函数
     * @param {object} params - 截图参数
     * @returns {Buffer} 截图数据
     */
    static async _capture(pageAction, params) {
        const { waitFor, trimColor, deviceInfo, cookies, evaluate } = params;
        const manager = new BrowserManager();

        try {
            const page = await manager.init(deviceInfo);

            // 设置 Cookies
            cookies?.length && (await page.context().addCookies(cookies));

            // 执行页面操作
            await pageAction(page);

            // 等待页面加载
            await this.waitForPage(page, waitFor);

            // 执行 JavaScript
            if (evaluate) {
                try { await page.evaluate(evaluate); }
                catch (e) { console.error('JS evaluation error:', e); }
            }

            // 截图并处理
            const image = await page.screenshot({ fullPage: true });
            const watermarkText = this.buildWatermarkText(params);
            return await ImageProcessor.processImage(image, trimColor, watermarkText);
        } finally {
            await manager.close();
        }
    }

    /**
     * 统一截图入口
     * @param {object} options - 截图选项
     * @returns {Buffer} 截图数据
     */
    static async capture({ url, html, waitFor = 0, trimColor = '', device, cookies, evaluate, watermark }) {
        if (!url && !html) {
            throw new Error('Either "url" or "html" parameter is required');
        }

        const deviceInfo = this.getDeviceInfo(device);

        return this._capture(
            url ? page => page.goto(url) : page => page.setContent(html, { waitUntil: 'domcontentloaded' }),
            {
                waitFor: +waitFor,
                trimColor: this.isValidHexColor(trimColor) ? trimColor : '',
                deviceInfo,
                cookies,
                evaluate,
                watermark,
                url,
                html,
                device
            }
        );
    }
}
