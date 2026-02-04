import { chromium } from 'playwright';

/**
 * 浏览器管理器
 * 负责浏览器的生命周期管理，确保每次截图使用独立的浏览器实例
 */
export class BrowserManager {
    #browser = null;
    #context = null;

    /**
     * 初始化浏览器
     * @param {object} deviceInfo - 设备信息（viewport、userAgent 等）
     * @returns {Page} Playwright 页面对象
     */
    async init(deviceInfo) {
        this.#browser = await chromium.launch();
        this.#context = await this.#browser.newContext({ ...deviceInfo });
        return await this.#context.newPage();
    }

    /**
     * 关闭浏览器并清理资源
     */
    async close() {
        try { this.#context?.close(); } catch (e) {}
        try { this.#browser?.close(); } catch (e) {}
        this.#context = null;
        this.#browser = null;
    }
}
