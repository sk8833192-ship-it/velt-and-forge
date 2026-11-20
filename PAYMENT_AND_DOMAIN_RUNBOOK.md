# Velt & Forge — Payment & Domain Runbook / 支付与域名上线手册

此目录是 Cloudflare Pages 的发布目录。`site/`、`studio/` 是源文件；不要只修改部署副本。当前交付不注册域名、不发布线上站点、不发生真实扣款。

## 1. Domain / 域名

1. 在 Cloudflare Dashboard → Domain Registration 搜索 `veltandforge.com`，确认可注册、续费价格及实名资料后购买。若已被注册，先核实归属；不要假设域名可用。Cloudflare Registrar 要求使用 Cloudflare nameservers。
2. Cloudflare → Workers & Pages → Create → Pages，创建项目 `velt-and-forge`。推荐使用下面 Wrangler 目录发布，**不要使用不支持 Functions 的纯静态拖拽上传**。Node.js 22+，首次使用 `npx wrangler login` 登录。
3. Pages → Custom domains → Set up a custom domain，添加 `veltandforge.com`；跟随页面创建 DNS 记录，确认 HTTPS 证书 Active。可选添加 `www` 并重定向到根域名。
4. 配置 `orders@veltandforge.com` 的收件与回复能力。Email Routing 可用于转发收信；发送邮件需要真实邮箱服务及其 SPF / DKIM / DMARC。

```sh
# Run from project root / 在项目根目录执行
node --version
python3 deploy/tools/sync-site.py
node deploy/tests/verify-site.cjs
npx wrangler login
# Local sandbox development / 本地沙箱开发（密钥放入未共享的 .dev.vars）
cd deploy
npx wrangler pages dev .
# Publish after verification / 验证通过后发布
npx wrangler pages deploy . --project-name velt-and-forge
```

不要使用 GitHub Pages 承载支付接口。GitHub Pages 与 file:// 保留免费本地 Studio 和 proof 导出；Cloudflare Pages 才运行此目录的 Functions。Vercel 适配器目前仅提供 Stripe endpoint；完整 PayPal 部署以 Cloudflare Pages 为准。

## 2. PayPal / 沙箱先行

PayPal Developer Dashboard → Apps & Credentials → Sandbox，新建 REST App，使用对应 Sandbox Business 商家与 Personal 买家账户。Pages → Settings → Variables and Secrets 中设置对应环境的变量；Secret 类型用于机密值。更新后重新部署。

| Binding / variable | Value / 值 |
| --- | --- |
| `PAYPAL_CLIENT_ID` | 当前环境的 REST App client ID；这是公开 SDK 标识 |
| `PAYPAL_CLIENT_SECRET` | 同一个 App 的 secret；仅服务端 Secret，绝不能提交源码或前端 |
| `PAYPAL_ENV` | `sandbox`（默认）或 `live`；不得混用沙箱和生产凭据 |
| `STRIPE_SECRET_KEY` | 可选；先用 `sk_test_…`，启用 Stripe 次级 Card 按钮 |
| `ESTIMATED_SHIP_DATE` | 实际预计发货日期，`YYYY-MM-DD`，不得早于 UTC 当天；启用 live PayPal / Stripe 前必须设置并及时更新 |
| `ORDER_WEBHOOK_URL` | 可选，可信 HTTPS 订单通知接收器；失败不回滚付款 |

```sh
# Alternative secret entry via CLI; enter values at the prompt, never in shell history.
# 也可通过交互式 CLI 输入，避免将 secret 写进历史记录。
npx wrangler pages secret put PAYPAL_CLIENT_ID --project-name velt-and-forge
npx wrangler pages secret put PAYPAL_CLIENT_SECRET --project-name velt-and-forge
# Set PAYPAL_ENV in dashboard as sandbox / 控制台设置环境变量为 sandbox
# Inspect only public config / 这里只返回安全的公共配置
curl --fail --silent --show-error https://veltandforge.com/api/payment-config
```

Expected public fields: `paypalEnabled`, `paypalClientId` only when enabled, `paypalEnv`, `stripeEnabled`, `currency: "USD"`, `estimatedShipDate`, `checkoutReady`. `checkoutReady=false` 会让 Studio 保持预览；缺少有效日期时，live 创建订单接口也会拒绝收款，但已创建订单仍可 capture。 未配置时正常显示 preview-only，不把 secret 放进 HTML、浏览器存储、截图或版本库。

## 3. Artwork storage / R2 图稿存档

Cloudflare R2 → Create bucket `velt-and-forge-orders`。保持 bucket 私有；不开启 Public Development URL 或公开自定义域名。Pages → Settings → Bindings → R2 bucket，变量名 `ORDERS_BUCKET`，绑定对应 bucket。Production / Preview 分别绑定隔离的 bucket，重新部署。未绑定时可付款但图稿不会持久化，必须依靠顾客下载的备份和人工收稿；正式履约推荐启用 R2。

```sh
npx wrangler r2 bucket create velt-and-forge-orders
# Binding is configured in Pages dashboard / 绑定在 Pages 控制台完成
```

创建订单保存 `drafts/{orderId}.json`、可选 `drafts/{orderId}.svg`；付款后保存 `paid/{orderId}/order.json` 和 `artwork-mirrored.svg`。SVG 是制作校样，未经人工确认不能直接当作 CNC 刀路。限制员工访问；为未付款草稿制定清理周期，为已付款记录设定依法需要的保留期及删除流程。

通知 webhook 是 best effort，不是保证送达的订单队列。每日核对 PayPal 商家后台和 R2 paid 记录，及时处理“付款成功但图稿未保存”的情况；不要仅凭浏览器回执或 Stripe success URL 安排生产。Stripe 目前提供 Checkout Session 创建与配送地址采集；自动履约需另接验签 webhook、订单存储及图稿关联后启用，当前按 Stripe Dashboard 人工核单处理。

## 4. Sandbox acceptance / 沙箱验收

- `node deploy/tests/payments.test.cjs`，随后运行下方全部离线验证。
- 在 Pages Preview 配置 sandbox credentials；打开 `/studio/index.html`，检查 PayPal、Venmo/Card 是否按账户/地区资格呈现（PayPal 决定实际可用 funding）。
- 50mm brass + walnut：单头 $89；额外头 $138。验证 PayPal 明细两项 $89 + $49，运送地址、取消后重试、拒付/待处理不显示成功。
- 成功完成一次 Sandbox 交易，核对 receipt 的 Order ID / Capture ID / email 与商家后台一致；核对 R2 draft → paid 图稿及 spec，下载备份。
- 测试 webhook 接收和不可达情况；付款不应因通知故障回报失败。检查支付弹窗、CSP、手机尺寸；测试 SDK 被阻断时仍可下载证明。
- 如启用 Stripe，完成一次 test Checkout，核对 extraHead item 和 US/CA/GB/AU 地址采集。
- file:// 不请求接口；`*.github.io` 保持预览；404、非 JSON、网络不可达时显示平静预览说明。

## 5. Live activation / 正式收款门槛

先完成 PayPal Business 实名、经营实体/地址/联系方式验证以及平台需要的材料。**域名接通不等于获准收款；代码或政策页不保证 PayPal 审核通过。** Policies 中的 pre-launch 法人及发货地点说明必须替换为已核实的信息，发布材料文件与样品证据，明确税费、运费及目的地范围，并在顾客付款前展示实际预计发货日期（当前不能用“ship date shown before checkout”这句话代替真实日期）。安排人工 artwork proof approval 及加工前取消流程后再启用 live keys。

PayPal Developer 切换 Live，创建/选择 Live App；同时更换 `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET` 和 `PAYPAL_ENV=live`，并设置 `ESTIMATED_SHIP_DATE=YYYY-MM-DD` 为真实预计发货日期。该日期会在付款前展示，失效或缺失时 live 创建订单返回 503；需要持续维护，不能长期填一个虚假远期日期。Stripe `sk_live_…` 使用同一日期门槛。仅 Production 使用 live keys；Preview 保留 sandbox。重新部署，核对 `/api/payment-config` 的环境，再用授权的小额真实订单验证完整流程、退款和银行到账。R2 缺失/故障时保留并人工补齐订单与图稿，避免付款成功后遗漏。

## 6. Withdrawal / PayPal 提现到收款账户

WorldFirst / Payoneer / SUNRATE 的产品和可绑定银行资料因开户主体、地区、币种和 PayPal 规则而异；不能保证任一虚拟银行账户均可绑定或提现。

1. 在本人经营主体名下完成收款机构 KYC，向该机构确认它提供的**本人同名 USD 银行账户**是否支持当前地区 PayPal Business 提现。
2. 在 PayPal Business → Wallet / Money → Link a bank，填写机构正式提供的银行名称、routing/account 等信息；不要把商户收款链接当银行账户，也不要使用他人账户。
3. 按 PayPal 完成银行验证，先试小额提现，核对收款币种、汇率、手续费、到账时间和退回条款，再提高金额。必要时联系双方支持；不可绑定时使用合规的本人银行账户。

## 7. Google Search Console / 搜索收录

添加 Domain property `veltandforge.com`，将 Google 提供的 TXT 验证记录加到 Cloudflare DNS，验证后提交 `https://veltandforge.com/sitemap.xml`。Sitemap 含九个站点页面与 Studio，共十条 URL。上线后确认每条 URL 200、HTTPS/canonical 一致、无意外 noindex，抽查产品与政策页的 URL inspection。

```sh
# Return to project root before these commands / 以下命令在项目根目录运行
# Complete local validation / 全量本地验收
python3 deploy/tools/sync-site.py
node deploy/tests/verify-site.cjs
node studio/tests/engine.test.cjs
node studio/tests/studio.test.cjs
node deploy/tests/payments.test.cjs
# verify-site also node --checks every JS/CJS file under site/, studio/, deploy/.
# 检查线上响应 / Check live response after deployment
curl -I https://veltandforge.com/
curl -I https://veltandforge.com/pages/policies.html
curl --fail https://veltandforge.com/sitemap.xml
```
