import sharp from 'sharp';

/**
 * 图片处理器
 * 提供盲水印嵌入/提取、图片压缩、背景去除等功能
 */
export class ImageProcessor {
    /** 像素间隔，避免集中修改影响画质 */
    static BIT_INTERVAL = 4;
    /** 最大读取字节数，防止死循环 */
    static MAX_BYTES = 1000;
    /** 水印魔术头（用于验证和定位） */
    static WATERMARK_MAGIC = 'WMSK';
    /** 魔术头编码（缓存） */
    static #magicBytes = new TextEncoder().encode(this.WATERMARK_MAGIC);

    /**
     * 构建水印载荷（魔术头 + 文本 + null 结束符）
     * @private
     */
    static #buildPayload(text) {
        const textBytes = new TextEncoder().encode(text);
        const payload = new Uint8Array(this.#magicBytes.length + textBytes.length + 1);
        payload.set(this.#magicBytes, 0);
        payload.set(textBytes, this.#magicBytes.length);
        return payload;
    }

    /**
     * 将载荷嵌入图片数据（LSB 隐写）
     * @private
     */
    static #embedPayload(imageData, payload) {
        let bitIndex = 0;
        for (const byte of payload) {
            for (let bit = 7; bit >= 0 && bitIndex + 2 < imageData.length; bit--) {
                // 修改蓝色通道（RGBA 索引 2）的最低位
                imageData[bitIndex + 2] = (imageData[bitIndex + 2] & 0xFE) | ((byte >> bit) & 1);
                bitIndex += this.BIT_INTERVAL;
            }
        }
    }

    /**
     * 从图片数据中提取载荷字节
     * @private
     */
    static #extractPayload(imageData) {
        const bytes = [];
        let currentByte = 0;
        let bitCount = 0;

        for (let i = 0; i < imageData.length && bytes.length < this.MAX_BYTES; i += 4) {
            currentByte = (currentByte << 1) | (imageData[i + 2] & 1);
            bitCount++;

            if (bitCount === 8) {
                bytes.push(currentByte);
                currentByte = 0;
                bitCount = 0;
            }
        }
        return bytes;
    }

    /**
     * 添加盲水印（LSB 隐写）
     * 通过修改蓝色通道的最低有效位嵌入水印
     * @param {Buffer} image - 图片数据
     * @param {string} text - 水印文本
     * @returns {Promise<Buffer>} 嵌入水印的图片
     */
    static async addWatermark(image, text) {
        if (!text) return image;

        const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const imageData = new Uint8ClampedArray(data);
        const payload = this.#buildPayload(text);
        this.#embedPayload(imageData, payload);

        return await sharp(imageData, {
            raw: { width: info.width, height: info.height, channels: info.channels }
        }).png().toBuffer();
    }

    /**
     * 提取盲水印
     * @param {Buffer} image - 图片数据
     * @returns {Promise<string|null>} 水印文本或 null
     */
    static async extractWatermark(image) {
        try {
            const { data } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const imageData = new Uint8ClampedArray(data);
            const bytes = this.#extractPayload(imageData);

            // 查找魔术头位置
            const magicStr = new TextDecoder().decode(new Uint8Array(bytes));
            const magicIndex = magicStr.indexOf(this.WATERMARK_MAGIC);
            if (magicIndex === -1) return null; // 未找到有效水印

            // 提取魔术头后的文本
            const textBytes = bytes.slice(magicIndex + this.#magicBytes.length);
            const nullIndex = textBytes.indexOf(0);
            const validBytes = nullIndex >= 0 ? textBytes.slice(0, nullIndex) : textBytes;

            return new TextDecoder().decode(new Uint8Array(validBytes));
        } catch (error) {
            console.error('提取水印失败:', error.message);
            return null;
        }
    }

    /**
     * 处理图片（水印、压缩、裁剪）
     * @param {Buffer} image - 原始图片
     * @param {string} trimColor - 去除背景色（十六进制，不含 #）
     * @param {string} watermark - 水印文本
     * @returns {Promise<Buffer>} 处理后的图片
     */
    static async processImage(image, trimColor, watermark) {
        let result = image;

        // 嵌入水印
        if (watermark) {
            result = await this.addWatermark(result, watermark);
        }

        // 去除背景色并压缩
        if (trimColor) {
            result = await sharp(result)
                .resize(1080)
                .png({ quality: 80 })
                .trim({ background: '#' + trimColor, inlineArt: true })
                .toBuffer();
        }

        return result;
    }
}
