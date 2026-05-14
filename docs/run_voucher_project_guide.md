# 跑量券活动项目说明（run）

最后更新：2026-05-14（Asia/Shanghai）

## 1. 项目目标

本项目用于承接「夏练三伏」活动：

- 用户在前台提交上月跑量与截图申请
- 系统按手机号自动关联银豹会员
- 审核员在后台一键通过/拒绝
- 审核通过后自动调用银豹优惠券 API 发券

## 2. 线上地址

- 前台页面：`/run-voucher`
- 后台登录：`/admin/login`
- 后台审核：`/admin/run-voucher`

生产域名：`https://run.dbbrewbeer.com`

## 3. 当前功能范围（已实现）

- 前台提交信息：姓名、手机号、上月跑量、截图
- 截图上传：最多 6 张、每张不超过 10MB、仅图片格式
- 统计月份动态提示：始终提示“上一个自然月”（按上海时区）
- 手机号自动关联会员：后端调用银豹会员接口获取 `customerNum/customerUid`
- 审核后台筛选：待审核、发券失败、已通过、已拒绝、全部
- 审核操作：
  - 通过并发券
  - 拒绝（手动拒绝，不发券）
- 发券失败记录可重试
- 后台可逐张查看截图（签名 URL）

## 4. 业务规则（跑量到发券）

- `<100km`：不发券（状态会进入拒绝）
- `100-199km`：发 1 套 `40+40+20`
- `200-299km`：发 2 套 `40+40+20`
- `>=300km`：不走优惠券，进入“老板请喝酒”流程（状态通过，但不发券）

## 5. 前后台处理流程

1. 用户在 `/run-voucher` 填手机号并提交截图。
2. 后端 `/api/run-voucher/submit`：
   - 校验月份必须为上一个自然月
   - 校验截图数量/大小/格式
   - 用手机号查银豹会员，写入 `customerNum/customerUid`
   - 上传截图到 COS，写入 JSON 记录
3. 审核员在 `/admin/run-voucher` 查看待审核记录。
4. 点击“审核通过并通知银豹发券”：
   - 计算发券档位
   - 自动解析券规则 UID（可用 UID 或按名称匹配）
   - 调银豹 `addCouponcode` 发券
5. 点击“拒绝”：
   - 状态改为 `rejected`
   - 标记“审核拒绝，未发券”

## 6. 存储结构（COS）

活动按 `activitySlug + month` 分目录：

- 截图：`run-voucher/{slug}/{YYYY/MM}/screenshots/{id}.ext`
- 多图：同目录下追加 `-2`, `-3`...
- 记录：`run-voucher/{slug}/{YYYY/MM}/records/{id}.json`

记录字段（核心）：

- `name`, `contact`, `km`, `month`
- `customerNum`, `customerUid`
- `screenshotKey`, `screenshotKeys[]`
- `status`：`pending | approved | rejected | issue_failed`
- `yinbao`：发券返回与错误信息

## 7. 环境变量说明（Vercel）

以下变量建议全部配置在 **Production**：

### 必填（基础）

- `ADMIN_PASSWORD`：后台登录密码
- `SESSION_SECRET`：会话签名密钥
- `NEXT_PUBLIC_SITE_URL`：站点地址（如 `https://run.dbbrewbeer.com`）
- `NEXT_PUBLIC_ACTIVITY_SLUG`：活动标识（默认 `default`）

### 必填（腾讯 COS）

- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

### 必填（银豹发券）

- `POSPAL_AREA_ID`：区域 ID（如 `1`）
- `POSPAL_APP_ID`：发券门店凭证 AppId
- `POSPAL_APP_KEY`：发券门店凭证 AppKey
- `POSPAL_QUERY_APP_ID`：会员查询凭证（通常总部）
- `POSPAL_QUERY_APP_KEY`：会员查询凭证（通常总部）

### 可选（银豹行为）

- `POSPAL_GROUP_SHARE`：默认 `1`，跨门店共享查询时使用
- `POSPAL_COUPON_UID_40`：40元券规则 UID（纯数字）
- `POSPAL_COUPON_UID_20`：20元券规则 UID（纯数字）
- `POSPAL_COUPON_NAME_40`：如未填 UID，可按名称自动匹配
- `POSPAL_COUPON_NAME_20`：如未填 UID，可按名称自动匹配
- `POSPAL_USER_AGENT`：默认 `openApi`
- `YINBAO_TIMEOUT_MS`：默认 `10000`
- `YINBAO_MOCK_MODE`：联调阶段可设 `true`，生产必须 `false`

## 8. 银豹联调要点（关键）

- `customerNum` 不等于 `customerUid`，发券最终要用 `customerUid`
- 建议流程：
  1. 用手机号/编号查到会员（拿到 `customerUid`）
  2. 查询可用券规则（拿到 `promotionCouponUid`）
  3. 调用添加券号接口发券
- 如果报“指定会员不存在”，优先检查：
  - 查询会员用的凭证是否总部凭证
  - 发券凭证是否与券规则所属门店一致
  - `POSPAL_AREA_ID` 与环境是否一致

## 9. 常见问题与排查

### 9.1 审核失败，提示会员不存在

- 先确认手机号在银豹确实绑定会员
- 确认 `POSPAL_QUERY_APP_ID/KEY` 是可查该会员的凭证
- 若会员属于总部共享体系，确认 `POSPAL_GROUP_SHARE=1`

### 9.2 发券失败，提示券规则问题

- 若用 UID：`POSPAL_COUPON_UID_40/20` 必须是纯数字 Long
- 若用名称：改填 `POSPAL_COUPON_NAME_40/20`
- 券规则名称必须精确匹配银豹配置

### 9.3 后台看不到“拒绝”按钮

- 确认部署版本包含拒绝功能提交
- 强刷浏览器缓存（`Ctrl/Cmd + Shift + R`）
- 只在 `pending/issue_failed` 记录显示拒绝按钮

### 9.4 只能上传 1 张图

- 当前版本支持最多 6 张
- 上传按钮为“继续添加截图”
- 若仍只能 1 张，先清缓存并确认部署是否最新

## 10. 本地开发

```bash
npm install
npm run dev
```

本地地址：

- 前台：`http://localhost:3000/run-voucher`
- 后台登录：`http://localhost:3000/admin/login`
- 后台审核：`http://localhost:3000/admin/run-voucher`

构建检查：

```bash
npm run build
```

## 11. 当前对外操作建议（给运营）

- 用户端只收：手机号、跑量、截图，不让用户自己填会员编号
- 审核端优先看：
  - 跑量是否符合规则
  - 截图是否完整且月份正确
  - 自动带出的会员编号是否存在
- 发券失败时切到“发券失败”筛选，修正后重试

