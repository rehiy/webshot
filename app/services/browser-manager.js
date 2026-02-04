import { chromium } from 'playwright';

/**
 * 浏览器管理器
 * 使用连接池复用浏览器实例，提高并发性能
 */
export class BrowserManager {
    static #browser = null;
    static #contexts = new Map(); // contextKey -> Context
    static #contextQueue = []; // LRU 队列
    static #maxContexts = 10; // 最大 Context 数量

    /**
     * 配置浏览器管理器参数
     * @param {object} options - 配置选项
     * @param {number} [options.maxContexts] - 最大 Context 数量
     */
    static configure(options) {
        if (options.maxContexts !== undefined) {
            this.#maxContexts = options.maxContexts;
        }
    }

    /**
     * 生成稳定的缓存键（排序属性避免 JSON 不确定性）
     * @private
     */
    static #contextKey(deviceInfo) {
        const sorted = Object.fromEntries(Object.entries(deviceInfo).sort());
        return JSON.stringify(sorted);
    }

    /**
     * 获取全局浏览器实例（单例模式）
     * @private
     */
    static async #getBrowser() {
        if (!this.#browser) {
            this.#browser = await chromium.launch();
        }
        return this.#browser;
    }

    /**
     * 淘汰最久未使用的 Context
     * @private
     */
    static async #evictOldestContext() {
        const oldestKey = this.#contextQueue.shift();
        if (!oldestKey) return;
        try {
            await this.#contexts.get(oldestKey)?.close();
        } catch (error) {
            console.warn('Failed to close old context:', error.message);
        }
        this.#contexts.delete(oldestKey);
    }

    /**
     * 更新 LRU 队列，将 key 移至末尾
     * @private
     */
    static #updateLRU(key) {
        const idx = this.#contextQueue.indexOf(key);
        if (idx > -1) {
            this.#contextQueue.splice(idx, 1);
        }
        this.#contextQueue.push(key);
    }

    /**
     * 获取或创建 Context（LRU 缓存）
     * @private
     */
    static async #getContext(deviceInfo) {
        const key = this.#contextKey(deviceInfo);

        // 缓存命中，更新 LRU
        if (this.#contexts.has(key)) {
            this.#updateLRU(key);
            return this.#contexts.get(key);
        }

        // 缓存未命中，淘汰最久未用的
        if (this.#contexts.size >= this.#maxContexts) {
            await this.#evictOldestContext();
        }

        // 创建新 Context
        const browser = await this.#getBrowser();
        const context = await browser.newContext({ ...deviceInfo });
        this.#contexts.set(key, context);
        this.#contextQueue.push(key);
        return context;
    }

    /**
     * 创建新页面
     * @param {object} deviceInfo - 设备信息
     * @returns {Promise<Page>} Playwright 页面对象
     */
    static async createPage(deviceInfo) {
        const context = await this.#getContext(deviceInfo);
        return await context.newPage();
    }

    /**
     * 关闭指定页面
     * @param {Page} page - 要关闭的页面
     */
    static async closePage(page) {
        try {
            await page?.close();
        } catch (error) {
            console.warn('Failed to close page:', error.message);
        }
    }

    /**
     * 清理所有资源
     */
    static async cleanup() {
        for (const context of this.#contexts.values()) {
            try {
                await context.close();
            } catch (error) {
                console.warn('Failed to close context:', error.message);
            }
        }
        this.#contexts.clear();
        this.#contextQueue = [];

        try {
            await this.#browser?.close();
        } catch (error) {
            console.warn('Failed to close browser:', error.message);
        }
        this.#browser = null;
    }
}
