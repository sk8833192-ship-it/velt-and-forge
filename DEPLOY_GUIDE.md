# VELT & FORGE 部署（3 步）

1. **部署 Cloudflare Pages**
   在本目录执行（已有项目可省略创建命令）：
   ```sh
   cd "/Users/peng/探索 dtc /ice-brass-mvp/deploy"
   npx wrangler login
   npx wrangler pages project create velt-and-forge --production-branch main
   npx wrangler pages deploy . --project-name velt-and-forge --branch main
   ```
   必须从本目录运行 Wrangler，才能识别 `functions/`；不要用仪表盘拖拽上传来部署函数。无需构建。Pages 设置中绑定自定义域名 `veltandforge.com`。本地预览：`npx wrangler pages dev .`。
   如用 Vercel：将本目录设为项目根目录，选择 Other、无需构建，再运行 `npx vercel --prod`。已提供 `vercel.json` 安全/缓存配置和 `api/create-checkout.js` 适配层。

2. **配置 Stripe 密钥并验证**
   ```sh
   npx wrangler pages secret put STRIPE_SECRET_KEY --project-name velt-and-forge
   npx wrangler pages deploy . --project-name velt-and-forge --branch main
   ```
   提示时粘贴密钥，不要写入 JS、仓库或命令参数。先用 `sk_test_…` 测试，再切换正式密钥；Preview 与 Production 环境分别配置。Vercel 在项目 Environment Variables 中添加同名变量并重新部署。
   ```sh
   curl -i https://veltandforge.com/api/create-checkout \
     -H 'Content-Type: application/json' \
     --data '{"material":"brass","size":50,"handle":"walnut"}'
   ```
   未配密钥返回 JSON 503；配置正确返回 `{id,url}`，打开 `url` 进入 Stripe 托管付款页。38/50/63 mm 分别为 $69/$89/$109，钢材 +$15、钢手柄 +$18，其他手柄免费。所有金额均由服务端计算，数量固定 1；兼容 Studio 导出的 `material.id`、`diameterMM`、`handle.id`。
   本包保留原页面行为，现有 Studio 尚未调用付款 API。成功跳转不代表付款已核验；实际履约需通过 Stripe 后台确认，自动履约需另接验签 webhook。运费、税费及定制图稿收集不在此接口范围内。

3. **提交 Google Search Console**
   通过 DNS 验证域名所有权，在「站点地图」提交 `https://veltandforge.com/sitemap.xml`。先确认首页、产品、两篇指南和 Studio 均可访问；若换域名，同步修改 `robots.txt` 与 `sitemap.xml` 中的占位域名。

静态 HTML 每次重新验证缓存；未带版本号的 JS/CSS 缓存 1 小时。API 始终 `no-store`。本包只创建部署文件，没有执行线上部署或真实扣款。
