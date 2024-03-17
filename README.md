# 在线网页截图工具

示例请求 `https://example.org/9RPwAcjKpwxSs4Z6/2/ffffff/iPad%20Mini/https://www.baidu.com/s?wd=screenshot`

## 参数解析

`https://localhost:3000/{token}/{wait-for}/{trim-color}/{device-type}/{target-url}`

- `token`: 你的机器人 token

- `wait-for`: 截图等待时间，单位秒
  
  - `0` 等待页面加载状态为 load
  - `1` 等待页面加载状态为 domcontentloaded
  - `2` 等待页面加载状态为 networkidle0

- `trim-color`: 截图去除的颜色

- `device-type`: 设备类型

- `target-url`: 目标网址
