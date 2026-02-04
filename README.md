# Web Screenshot API

基于 Playwright 的网页截图服务，支持多设备模拟和图片处理。

## 快速开始

```bash
docker run --name webshot -d \
  --restart unless-stopped \
  -e TOKEN=your-token \
  -p 3000:3000 \
  rehiy/webshot
```

## API 使用

### 请求格式

```http
POST http://{HOST}:{PORT}/{TOKEN}
Content-Type: application/json
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是* | 网页 URL |
| `html` | string | 是* | HTML 内容 |
| `waitFor` | number | 否 | 等待策略，默认 0 |
| `trimColor` | string | 否 | 去除背景色（十六进制），如 `ffffff` |
| `device` | string | 否 | 设备类型，默认 Desktop Chrome |

* `url` 和 `html` 二选一

### 等待策略

| 值 | 策略 |
|----|------|
| `0` | 等待 load 事件 |
| `1` | 等待 domcontentloaded 事件 |
| `2` | 等待 networkidle0 |
| `>2` | 等待指定毫秒数 |

### 示例

**URL 截图**:

```bash
curl -X POST http://you r:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","waitFor":2}' \
  -o screenshot.png
```

**HTML 截图**:

```bash
curl -X POST http://your-ip:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Hello</h1>","device":"iPhone 14 Pro"}' \
  -o screenshot.png
```

**去除背景**:

```bash
curl -X POST http://your-ip:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","trimColor":"ffffff"}' \
  -o screenshot.png
```

## 设备类型

### 移动设备

* iPhone 6/7/8/SE/X/XR/11/12/13/14/15 系列
* iPad (gen 5/6/7)/iPad Mini/iPad Pro 11
* Galaxy Note/S 系列、Pixel 系列、Nexus 系列
* BlackBerry、Lumia、Kindle Fire HDX

### 桌面设备

* Desktop Chrome（默认）
* Desktop Edge / Firefox / Safari
* Desktop Chrome/Edge/Firefox HiDPI

完整列表: [Playwright Devices](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json)

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TOKEN` | your-token | API 鉴权 Token |
| `PORT` | 3000 | 服务端口 |

## 开发

```bash
cd app
npm install
npm start      # 启动服务
npm test       # 运行测试
```

### 项目结构

```dir
web-screenshot/
├── app/
│   ├── app.js                 # 主应用
│   ├── boot.sh                # 启动脚本
│   ├── package.json           # 依赖配置
│   ├── services/
│   │   ├── browser-manager.js # 浏览器管理
│   │   ├── image-processor.js # 图片处理
│   │   ├── request-handler.js # 请求处理
│   │   └── screenshot.js      # 截图服务
│   └── test/                  # 测试
├── Dockerfile                 # 镜像配置
├── .dockerignore              # 构建忽略
└── README.md                  # 文档
```

## 安全

* ✅ Docker 沙盒隔离
* ✅ 非 Privileged 模式
* ✅ Token 鉴权

## 注意事项

1. 沙盒环境可能限制外部网站访问
2. 每次截图创建独立浏览器实例
3. 更新代码需重新构建镜像
4. Token 请妥善保管

## 许可证

Copyright © 2010 - 2026 Rehiy <wang@rehiy.com>
