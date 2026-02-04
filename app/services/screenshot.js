import { devices } from 'playwright';

import { BrowserManager } from './browser-manager.js';
import { ImageProcessor } from './image-processor.js';

/**
 * 等待加载策略
 */
export const WAIT_STRATEGIES = {
    LOAD: 0,
    DOM: 1,
    NETWORK_IDLE: 2,
    TIMEOUT: 3
};

/**
 * 截图服务
 * 负责截图业务逻辑
 */
export class ScreenshotService {
    static hexColorRegex = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    /**
     * 获取设备信息
     */
    static getDeviceInfo(deviceName) {
        return devices[decodeURI(deviceName)] || devices['Desktop Chrome'];
    }

    /**
     * 验证 hex 颜色
     */
    static isValidHexColor(color) {
        return typeof color === 'string' && this.hexColorRegex.test(color);
    }

    /**
     * 等待页面加载
     */
    static async waitForPage(page, waitFor) {
        const strategies = {
            [WAIT_STRATEGIES.LOAD]: 'load',
            [WAIT_STRATEGIES.DOM]: 'domcontentloaded',
            [WAIT_STRATEGIES.NETWORK_IDLE]: 'networkidle0'
        };

        const state = strategies[waitFor];
        if (state) {
            await page.waitForLoadState(state);
        } else {
            await page.waitForTimeout(waitFor);
        }
    }

    /**
     * 执行截图的通用方法
     */
    static async _capturePage(pageAction, params) {
        const { waitFor, trimColor, deviceInfo, cookies, evaluate } = params;
        const manager = new BrowserManager();

        try {
            const page = await manager.init(deviceInfo);

            // 设置 cookies
            if (cookies && Array.isArray(cookies) && cookies.length > 0) {
                const context = page.context();
                await context.addCookies(cookies);
            }

            await pageAction(page);
            await this.waitForPage(page, waitFor);

            // 执行 JavaScript
            if (evaluate && typeof evaluate === 'string') {
                try {
                    await page.evaluate(evaluate);
                } catch (error) {
                    console.error('JavaScript evaluation error:', error);
                }
            }

            const image = await page.screenshot({ fullPage: true });
            return await ImageProcessor.processImage(image, trimColor);
        } finally {
            await manager.close();
        }
    }

    /**
     * 通过 URL 截图
     */
    static async captureByUrl(targetUrl, params) {
        return await this._capturePage(
            page => page.goto(targetUrl),
            { ...params, targetUrl }
        );
    }

    /**
     * 通过 HTML 截图
     */
    static async captureByHtml(html, params) {
        return await this._capturePage(
            page => page.setContent(html, { waitUntil: 'domcontentloaded' }),
            { ...params, html }
        );
    }

    /**
     * 统一截图入口
     */
    static async capture({ url, html, waitFor = 0, trimColor = '', device, cookies, evaluate }) {
        if (!url && !html) {
            throw new Error('Either "url" or "html" parameter is required');
        }

        const deviceInfo = this.getDeviceInfo(device);
        const params = {
            waitFor: +waitFor,
            trimColor: this.isValidHexColor(trimColor) ? trimColor : '',
            deviceInfo,
            cookies,
            evaluate
        };

        return url
            ? await this.captureByUrl(url, params)
            : await this.captureByHtml(html, params);
    }
}
