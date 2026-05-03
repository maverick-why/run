# 腾讯云 COS 配置指南（M2 上传）

本文用于完成摄影师后台直传 COS 的必备配置。

## 1. 基础信息

- Bucket：`chronobrewery-photo-1419349000`
- Region：`ap-guangzhou`
- 上传目录：`originals/{activitySlug}/YYYY-MM-DD/...`
- 水印图建议路径：`watermark/logo.png`（当前代码会自动生成签名 URL，可保持私有）

## 2. 账号密钥权限建议

服务端环境变量使用 `SecretId/SecretKey` 时，建议该 CAM 子账号只授予当前 Bucket 最小权限，例如：

- `name/cos:PutObject`
- `name/cos:PostObject`
- `name/cos:InitiateMultipartUpload`
- `name/cos:UploadPart`
- `name/cos:CompleteMultipartUpload`
- `name/cos:AbortMultipartUpload`
- `name/cos:GetBucket`
- `name/cos:GetObject`
- `name/cos:HeadObject`

## 3. COS 跨域（CORS）配置

浏览器直传必须配置 CORS，否则前端会出现上传网络错误。

推荐规则：

- `Origin`：
  - `https://photo.dbbrewbeer.com`
  - `http://localhost:3000`
- `Method`：`PUT`, `POST`, `GET`, `HEAD`, `OPTIONS`
- `AllowedHeaders`：建议 `*`；若需手动填写至少包含 `authorization,content-type,pic-operations`
- `ExposeHeaders`：`ETag`, `x-cos-request-id`
- `MaxAgeSeconds`：`300`

## 4. 上传验证

1. 登录 `https://photo.dbbrewbeer.com/admin/login`。
2. 进入 `/admin` 上传 1 张测试图。
3. 在 COS 控制台确认已出现：
   - `originals/default/YYYY-MM-DD/{timestamp}-{random}.ext`
   - `display/default/YYYY-MM-DD/{timestamp}-{random}.jpg`
   - `download/default/YYYY-MM-DD/{timestamp}-{random}.jpg`
4. 检查 `display/download` 图片右下角是否出现 logo 水印。

## 5. 常见报错排查

- `403 SignatureDoesNotMatch`：检查 `TENCENT_SECRET_ID/KEY`、Bucket、Region 是否一致。
- 上传成功但未生成 `display/download`：确认 Bucket 已开通并绑定数据万象（CI）。
- 水印不显示：确认 `WATERMARK_IMAGE_KEY` 指向存在对象（例如 `watermark/logo.png`），且该对象可通过 `http://{bucket}.cos.{region}.myqcloud.com/{key}` 访问。
- 前端显示上传网络错误：优先检查 COS CORS 规则是否生效。
- `ADMIN_PASSWORD is not configured`：Vercel 环境变量未绑定 Production 或未 Redeploy。
