# macOS 桌面端：签名与公证

从浏览器 / GitHub Releases 下载的 `.dmg` 若未签名且未公证，macOS 会提示 **「已损坏，无法打开」**（实为 Gatekeeper 拦截，不是文件坏了）。

配置 Apple 开发者账号后，由 CI 自动 **签名 + 公证**，用户即可正常双击安装。

## 一、在 Apple Developer 准备证书

1. 登录 [Certificates, IDs & Profiles](https://developer.apple.com/account/resources/certificates/list)
2. 创建证书类型：**Developer ID Application**（用于在 App Store 外分发）
3. 按提示在 Mac 上生成 CSR（钥匙串访问 → 证书助理 → 请求证书）
4. 下载 `.cer` 并双击安装到「登录」钥匙串

在终端确认签名身份名称：

```bash
security find-identity -v -p codesigning
```

记下类似下面这一整行（供 `APPLE_SIGNING_IDENTITY` 使用）：

```text
Developer ID Application: Your Name (TEAM_ID)
```

## 二、导出 p12 供 GitHub Actions 使用

1. 打开「钥匙串访问」→「我的证书」
2. 展开 **Developer ID Application** 条目，右键其 **私钥** →「导出…」
3. 保存为 `.p12`，设置导出密码
4. 转为 Base64（不要提交到仓库）：

```bash
openssl base64 -A -in /path/to/certificate.p12 -out certificate-base64.txt
```

## 三、公证凭据（二选一）

### 方式 A：App Store Connect API Key（推荐）

1. [Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. 新建 Key，权限至少包含 **Developer**
3. 记录 **Issuer ID**、**Key ID**，下载 `.p8`（仅可下载一次）

### 方式 B：Apple ID + 专用密码

1. [appleid.apple.com](https://appleid.apple.com) → 登录与安全 → **App 专用密码**，生成一个密码
2. 在 [Membership](https://developer.apple.com/account) 查看 **Team ID**

## 四、配置 GitHub Secrets

仓库 → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | 必填 | 说明 |
|--------|------|------|
| `APPLE_CERTIFICATE` | 是 | 上一步 `certificate-base64.txt` 的完整内容 |
| `APPLE_CERTIFICATE_PASSWORD` | 是 | 导出 `.p12` 时设置的密码 |
| `KEYCHAIN_PASSWORD` | 是 | 任意强密码（仅 CI 临时钥匙串用） |
| `APPLE_SIGNING_IDENTITY` | 建议 | 如 `Developer ID Application: … (TEAM_ID)`；不填则 CI 从钥匙串自动匹配 |
| `APPLE_API_ISSUER` | A | App Store Connect Issuer ID |
| `APPLE_API_KEY` | A | Key ID |
| `APPLE_API_KEY_PRIVATE_KEY` | A | `.p8` 文件全文（含 `-----BEGIN PRIVATE KEY-----`） |
| `APPLE_ID` | B | Apple ID 邮箱 |
| `APPLE_PASSWORD` | B | App 专用密码（不是登录密码） |
| `APPLE_TEAM_ID` | B | 10 位 Team ID |

配置证书相关 3 项 + 公证方式 A **或** B 后，推送 `main` 触发 [desktop-release.yml](../.github/workflows/desktop-release.yml)，新发布的 `desktop-latest` DMG 应可直接打开。

## 五、本地已下载的旧包（临时绕过）

在官方签名包发布前，可对已下载的 `.app` 执行（仅本机信任，不替代签名）：

```bash
xattr -cr "/Applications/Skill Base.app"
```

然后重新打开应用。

## 六、本地 Release 构建（可选）

证书已装在 Mac 钥匙串时：

```bash
cd desktop-tauri
export APPLE_SIGNING_IDENTITY="Developer ID Application: …"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
pnpm build
```

Tauri 会在 `tauri build` 时签名并提交公证（需网络）。
