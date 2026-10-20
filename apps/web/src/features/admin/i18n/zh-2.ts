// 简体中文 (zh) strings of the admin feature, part 2.
export const zh2: Record<string, string> = {
  "Falls back to .env": "回退到 .env",
  "Not configured": "未配置",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "基于玩家所有比赛生成的 Personal Coach 计划（Pro）。你最强的长上下文模型。",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    '我们已在额外请求体中预填 provider.data_collection = "deny"：这样 OpenRouter 只会转发给不保存、也不用你的提示词（玩家的比赛数据）训练的上游服务商。只有在你接受时才删除它。',
  "{n}k context": "{n}k 上下文",
  "no structured outputs": "不支持结构化输出",
  Integrations: "集成",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "更改立即生效，并加密保存在数据库中。无需重启。",
  "Configured · Database": "已配置 · 数据库",
  "From .env (read-only bootstrap)": "来自 .env（只读初始配置）",
  "Testing…": "测试中…",
  Connected: "已连接",
  "{ms} ms": "{ms} 毫秒",
  "Live mode": "正式模式",
  "Test mode": "测试模式",
  "The test failed.": "测试失败。",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "个人资料、头像，以及新人积分背后的账号检查。",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "在 Steam 开发者页面创建密钥（使用拥有本站的账号登录）：",
  "Web API key": "Web API 密钥",
  "Remove the stored Steam key?": "移除已保存的 Steam 密钥？",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.": "方案订阅和积分包购买。",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "密钥：Stripe Dashboard → Developers → API keys。Webhook：Developers → Webhooks → Add endpoint，然后复制它的 signing secret。",
  "Webhook URL": "Webhook URL",
  "Secret key": "私密密钥",
  "Remove the stored Stripe secret key?": "移除已保存的 Stripe 私密密钥？",
  "Webhook signing secret": "Webhook 签名密钥",
  "Remove the stored webhook secret?": "移除已保存的 Webhook 密钥？",
  "Publishable key (public)": "可公开密钥",
  "Accept payments": "接受付款",
  "When off, checkout buttons show “Coming soon”.":
    "关闭时，付款按钮显示“即将推出”。",
  "Add the secret key first.": "请先添加私密密钥。",
  "Add key": "添加密钥",
  "Save key": "保存密钥",
  Copy: "复制",
  Copied: "已复制",
  Save: "保存",
  "Enter a value.": "请输入一个值。",
  "Keys never contain spaces.": "密钥中不会有空格。",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Steam Web API 密钥是 32 位十六进制字符。",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Stripe 私密密钥以 sk_live_、sk_test_ 开头（受限密钥以 rk_ 开头）。",
  "Stripe webhook secrets start with whsec_.":
    "Stripe Webhook 密钥以 whsec_ 开头。",
  "Publishable keys start with pk_live_ or pk_test_.":
    "可公开密钥以 pk_live_ 或 pk_test_ 开头。",
  "Steam key saved.": "Steam 密钥已保存。",
  "Steam key removed.": "Steam 密钥已移除。",
  "Stripe secret key saved.": "Stripe 私密密钥已保存。",
  "Stripe secret key removed.": "Stripe 私密密钥已移除。",
  "Webhook secret saved.": "Webhook 密钥已保存。",
  "Webhook secret removed.": "Webhook 密钥已移除。",
  "Publishable key saved.": "可公开密钥已保存。",
  "Payments enabled.": "已启用付款。",
  "Payments disabled.": "已停用付款。",
  Product: "产品",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "每日限制和月度报告使用的时区、Personal Coach 频率和上传大小。",
  "Time zone": "时区",
  "Days and months start at midnight in this zone.":
    "每天和每月从这个时区的午夜开始。",
  "Not available on this server yet.": "此服务器暂不支持。",
  "Personal Coach: days between new plans": "Personal Coach：新计划间隔天数",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach：重写所需新比赛数",
  "Demo upload limit (MB)": "Demo 上传上限（MB）",
  "A player can ask for a new plan after this many days.":
    "玩家在这么多天后可以请求新计划。",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…或在这么多场新比赛后更早（也是自动重写的条件）。",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "默认 500 MB。网页代理最多传输这个大小的上传。",
  "Between 1 and 90 days.": "1 到 90 天之间。",
  "Between 1 and 50 matches.": "1 到 50 场比赛之间。",
  "Between 1 and 1024 MB.": "1 到 1024 MB 之间。",
};
