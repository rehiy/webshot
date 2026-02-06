# Web Screenshot API

基于 Playwright 的网页截图服务，支持多设备模拟、图片处理和盲水印。

**项目地址：** [https://github.com/rehiy/webshot](https://github.com/rehiy/webshot)

## 快速开始

```bash
docker run --name webshot -d \
  --restart unless-stopped \
  -e TOKEN=your-token \
  -p 3000:3000 \
  rehiy/webshot
```

访问 `http://localhost:3000` 打开使用说明页面。

## 安全启动

```bash
docker run --name webshot -d \
  --restart unless-stopped \
  --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json \
  -e TOKEN=your-token \
  -p 3000:3000 \
  rehiy/webshot
```

### seccomp_profile.json

```json
{
  "comment": "Allow create user namespaces",
  "names": [
    "clone",
    "setns",
    "unshare"
  ],
  "action": "SCMP_ACT_ALLOW",
  "args": [],
  "includes": {},
  "excludes": {}
}
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
| `cookies` | array | 否 | Cookie 数组 |
| `evaluate` | string | 否 | 截图前执行的 JavaScript |
| `watermark` | string | 否 | 盲水印文本 |

* `url` 和 `html` 二选一

### 等待策略

| 值 | 策略 |
|----|------|
| `0` | 等待 load 事件 |
| `1` | 等待 domcontentloaded 事件 |
| `2` | 等待 networkidle0 |
| `>2` | 等待指定毫秒数 |

### 使用示例

**URL 截图**:

```bash
curl -X POST http://your-ip:3000/your-token \
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

**使用 Cookies**:

```bash
curl -X POST http://your-ip:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://example.com",
    "cookies":[{"name":"session","value":"abc123","domain":"example.com"}]
  }' \
  -o screenshot.png
```

**执行 JavaScript**:

```bash
curl -X POST http://your-ip:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://example.com",
    "evaluate":"document.body.style.backgroundColor=\"#fff\""
  }' \
  -o screenshot.png
```

### 盲水印

盲水印采用 LSB（最低有效位）隐写技术，将信息编码到图片蓝色通道的最低位，视觉上完全不可见，可用于版权验证和来源追踪。

**添加盲水印**:

```bash
curl -X POST http://your-ip:3000/your-token \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://example.com",
    "watermark":"版权所有 © 2026"
  }' \
  -o screenshot.png
```

水印会自动包含以下信息：

* 自定义文本
* 时间戳
* URL 或 HTML 标识
* 设备类型
* 浏览器 User-Agent
* 等待策略
* 去除背景色设置
* Cookie 数量
* JavaScript 执行状态

**水印格式示例**:

```text
版权所有 © 2026 | 2026-02-04 12:30:45 | URL:https://example.com | Device:Desktop Chrome | UA:Chrome 131.0 | Wait:load | Trim:#ffffff | Cookies:2 | JS:true
```

**提取盲水印**:

```bash
curl -X POST http://your-ip:3000/your-token/extract \
  -H "Content-Type: application/json" \
  -d '{"image":"'$(base64 -w 0 screenshot.png)'"}'
```

或在调试界面生成截图后，点击"提取盲水印"按钮直接查看。

## 设备类型

[Playwright Devices](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json)

### 移动设备

* iPhone 6/7/8/SE/X/XR/11/12/13/14/15 系列
* iPad (gen 5/6/7)/iPad Mini/iPad Pro 11
* Galaxy Note/S 系列、Pixel 系列、Nexus 系列
* BlackBerry、Lumia、Kindle Fire HDX

### 桌面设备

* Desktop Chrome（默认）
* Desktop Edge / Firefox / Safari
* Desktop Chrome/Edge/Firefox HiDPI

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
```

### 项目结构

```dir
web-screenshot/
├── app/
│   ├── app.js                 # 主应用，HTTP 服务器
│   ├── boot.sh                # 启动脚本
│   ├── package.json           # 依赖配置
│   ├── public/
│   │   ├── index.html         # 调试界面（需通过 /{TOKEN} 访问）
│   │   └── landing.html       # 使用说明页面（根路径访问）
│   └── services/
│       ├── browser-manager.js # 浏览器生命周期管理
│       ├── image-processor.js # 图片处理（压缩、裁剪、盲水印）
│       ├── request-handler.js # HTTP 请求处理
│       └── screenshot.js      # 截图业务逻辑
├── Dockerfile                 # 镜像配置
├── .dockerignore              # 构建忽略
└── README.md                  # 文档
```

### 核心模块说明

* **browser-manager.js**: 管理 Playwright 浏览器实例的创建和销毁，每次截图使用独立实例避免状态污染
* **image-processor.js**: 基于 Sharp 处理图片，支持压缩、裁剪和 LSB 盲水印（修改蓝色通道最低位）
* **request-handler.js**: 处理 HTTP 请求体解析和响应发送
* **screenshot.js**: 核心截图逻辑，支持 URL/HTML 两种方式，集成 Cookie、JS 执行和水印功能

## 安全

* ✅ Docker 沙盒隔离
* ✅ 非 Privileged 模式
* ✅ 盲水印支持来源追踪和版权验证
* ✅ 根路径显示使用说明页面，提供清晰的使用指引
* ✅ 基于 URL 路径的 Token 鉴权（访问 `/{TOKEN}` 才可进入调试界面）

## 注意事项

* Token 请妥善保管
* 盲水印通过修改蓝色通道最低位实现
* 沙盒环境可能限制外部网站访问
* 更新代码需重新构建镜像

## 许可证

GPLv3
