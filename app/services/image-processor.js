import sharp from 'sharp';

/**
 * 图片处理器
 */
export class ImageProcessor {
    // 像素间隔，避免集中修改影响画质
    static BIT_INTERVAL = 4;
    // 最大读取字节数，防止死循环
    static MAX_BYTES = 1000;

    /**
     * 添加盲水印（LSB 隐写）
     * 通过修改蓝色通道的最低有效位嵌入水印
     * @param {Buffer} image - 图片数据
     * @param {string} text - 水印文本
     * @returns {Buffer} 嵌入水印的图片
     */
    static async addWatermark(image, text) {
        if (!text) return image;

        const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const imageData = new Uint8ClampedArray(data);
        const bytes = new TextEncoder().encode(text + '\0');

        // 将每个字节的 8 位嵌入到蓝色通道（RGBA 中的 B 分量）的最低位
        let bitIndex = 0;
        for (const byte of bytes) {
            for (let bit = 7; bit >= 0 && bitIndex + 2 < imageData.length; bit--) {
                const pixelIndex = bitIndex;
                imageData[pixelIndex + 2] = (imageData[pixelIndex + 2] & 0xFE) | ((byte >> bit) & 1);
                bitIndex += this.BIT_INTERVAL;
            }
        }

        return await sharp(imageData, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
    }

    /**
     * 提取盲水印
     * @param {Buffer} image - 图片数据
     * @returns {string|null} 水印文本或 null
     */
    static async extractWatermark(image) {
        try {
            const { data } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            const imageData = new Uint8ClampedArray(data);

            const bytes = [];
            let currentByte = 0;
            let bitCount = 0;

            // 从蓝色通道提取最低位，重新组合成字节
            for (let i = 0; i < imageData.length && bytes.length < this.MAX_BYTES; i += 4) {
                currentByte = (currentByte << 1) | (imageData[i + 2] & 1);
                bitCount++;

                if (bitCount === 8) {
                    bytes.push(currentByte);
                    if (currentByte === 0) break; // 遇到 null 结束符
                    currentByte = 0;
                    bitCount = 0;
                }
            }

            // 移除 null 结束符并解码
            const nullIndex = bytes.indexOf(0);
            return nullIndex >= 0 ? new TextDecoder().decode(new Uint8Array(bytes.slice(0, nullIndex))) : null;
        } catch (e) {
            console.error('提取水印失败:', e);
            return null;
        }
    }

    /**
     * 处理图片（水印、压缩、裁剪）
     * @param {Buffer} image - 原始图片
     * @param {string} trimColor - 去除背景色（十六进制）
     * @param {string} watermark - 水印文本
     * @returns {Buffer} 处理后的图片
     */
    static async processImage(image, trimColor, watermark) {
        let result = watermark ? await this.addWatermark(image, watermark) : image;

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
