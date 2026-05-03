# Vercel 配置指南（ChronoBrewery）

本文对应 M1 阶段，目标是让仓库和 Vercel 可用，并为后续腾讯云 COS 接入留好配置位。

## 1. 创建 Vercel 项目

1. 登录 Vercel，点击 `Add New...` -> `Project`。
2. 导入 GitHub 仓库：`maverick-why/run`。
3. Framework 选择 `Next.js`（通常自动识别）。
4. 点击 `Deploy` 完成首次部署。

## 2. 配置环境变量

在 Vercel 项目设置 `Settings` -> `Environment Variables` 中添加：

- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`
- `WATERMARK_IMAGE_KEY`
- `WATERMARK_TEXT`
- `ADMIN_PASSWORD`
- `ADMIN_USERNAME`（可选，仅用于后台显示名）
- `SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_ACTIVITY_SLUG`

建议：

- `NEXT_PUBLIC_SITE_URL`：生产环境填 `https://run.dbbrewbeer.com`
- `NEXT_PUBLIC_ACTIVITY_SLUG`：首版固定 `default`
- `SESSION_SECRET`：至少 32 位随机字符串

修改后执行一次 `Redeploy`。

## 3. 绑定域名

1. 在 Vercel 项目 `Settings` -> `Domains` 中添加 `run.dbbrewbeer.com`。
2. 若 DNS 在 Wix 托管，新增 CNAME：
   - 主机记录：`run`
   - 记录值：以 Vercel 域名页面提示值为准（可能是 `xxx.vercel-dns-017.com`）
3. 等待证书签发完成后，访问：
   - 前台：`https://run.dbbrewbeer.com`
   - 后台：`https://run.dbbrewbeer.com/admin/login`

## 4. 联调检查项

- `GET /api/auth/session`：未登录返回 `loggedIn: false`
- 使用环境变量密码登录 `/admin/login` 成功后可进入 `/admin`
- `GET /api/photos` 返回占位数据（M3 再接真实图片）
- 生产环境下 cookie 为 `httpOnly + secure`

## 5. 腾讯云接入注意点（下一阶段）

- 建议前端直传 COS `originals`，不走 Vercel 文件中转。
- 通过后端签发临时凭证或签名，避免暴露永久密钥。
- 使用数据万象（CI）生成 `display` 与 `download` 两份衍生图。
