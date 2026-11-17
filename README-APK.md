# DeepSeek Chat APK

把 [`deepseek-ai/chat-demo`](https://github.com/deepseek-ai/chat-demo) 用 Capacitor 8 包成 Android 应用，保留原项目的聊天、深度思考、联网搜索、文件输入、阅读链接、语音输入/朗读、Markdown/公式/图表、历史导入导出等功能。

## 与上游的差异

- 移除请求体中的 `safety_check` 参数（不开启 high 级内容审核），仅用于个人自用 / 内测。
- 设置页新增「思考深度」，可选低 / 高 / 最大，默认低（与官方 App / Web 当前默认一致）。
- Android 端补齐：录音运行时权限、历史 ZIP 导出走系统分享、外链用系统浏览器打开、返回键处理、状态栏与安全区适配、自定义图标与启动图。

> 说明：移除的是可选的 high 级审核。DeepSeek API 默认的底层内容检查仍然存在，无法通过参数关闭；声明联网工具的请求仍可能返回 `refusal`，客户端会按原逻辑展示拒答。若对外提供服务，必须重新开启 `safety_check`，并自行承担内容安全审核、大模型登记、AI 标识等义务。

## 构建

推送到 `v*` 标签或手动触发 `Build Android APK` 工作流：

```bash
git tag v0.1.1
git push origin v0.1.1
```

工作流会依次执行类型检查、lint、Web 构建、Capacitor 同步、Gradle 签名打包、`apksigner` 验签，并上传 APK 与签名指纹。标签构建会自动创建 GitHub Release。

本地构建需要 JDK 21 与 Android SDK 36：

```bash
pnpm install --frozen-lockfile
pnpm build
npx cap sync android
cd android && ./gradlew assembleRelease
```

本地构建默认没有签名配置；CI 通过仓库 Secrets 注入 keystore。

## 安装与使用

1. 从 Release 或 Actions Artifact 下载 `deepseek-chat-*.apk`，在 Android 手机上允许安装未知来源应用。
2. 打开应用，进入「设置 → 数据管理」填入自己的 DeepSeek API Key。
3. 聊天、搜索、文件解析、语音识别/合成均直接调用 `https://api.deepseek.com`，按官方用量计费。

聊天记录和 API Key 保存在应用本地（localStorage / IndexedDB）。覆盖安装会保留，卸载会清空；`allowBackup` 已关闭，避免 Key 进入系统备份。

## 签名

- 使用固定的 PKCS12 keystore（RSA 2048，别名 `deepseekchat`，有效期 10000 天），保证后续版本可用同一签名覆盖升级。
- keystore 及其密码只保存在 GitHub Actions Secrets 和本地备份中，不进入仓库。
- 每次构建都会用 `apksigner verify --print-certs` 输出证书指纹，可在 Release 附件 `signature.txt` 中核对。
