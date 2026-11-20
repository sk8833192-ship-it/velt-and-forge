# VELT & FORGE 部署入口

完整配置、沙箱验收、R2、域名、提现及 Search Console 步骤见 [PAYMENT_AND_DOMAIN_RUNBOOK.md](PAYMENT_AND_DOMAIN_RUNBOOK.md)。

在项目根目录同步并验证：

```sh
python3 deploy/tools/sync-site.py
node deploy/tests/verify-site.cjs
node studio/tests/engine.test.cjs
node studio/tests/studio.test.cjs
node deploy/tests/payments.test.cjs
```

然后从 **deploy 目录** 发布，确保 Wrangler 发现同级 `functions/`：

```sh
cd deploy
npx wrangler login
npx wrangler pages project create velt-and-forge --production-branch main
npx wrangler pages deploy . --project-name velt-and-forge --branch main
```

已有项目可跳过创建命令。首次只配 Sandbox 凭据；完成法人、材料、运费税费和实际预计发货日期披露后才开启 Live。不要使用不支持 Functions 的静态拖拽上传。

未配置支付时 Studio 平静降级为预览，file:// 和 GitHub Pages 可继续本地图稿检查与导出。付款成功跳转不能作为 Stripe 履约凭证；须后台核单。当前没有执行线上部署或真实扣款。
