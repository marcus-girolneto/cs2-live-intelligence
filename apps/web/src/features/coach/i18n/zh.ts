// 简体中文 (zh) strings of the coach feature. Keys are the English source texts.
import { zh2 } from "./zh-2";

export const zh: Record<string, string> = {
  "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed":
    "解析器 {v} 上已完成 {done}/{total} 个分析 · {pending} 个待处理 · {failed} 个失败",
  "#{r} of {n}": "第 {r}/{n}",
  "A player": "一名玩家",
  "Admins are never charged.": "管理员永远不会被扣费。",
  "AI quality": "AI 质量",
  "Analyses on the current parser": "使用当前解析器的分析",
  "Analyze my new demos automatically": "自动分析我的新 Demo",
  "Automatic reviews are off.": "自动复盘已关闭。",
  "Automatic reviews are on.": "自动复盘已开启。",
  "Automatic reviews": "自动复盘",
  "Average latency": "平均延迟",
  Average: "平均",
  "Back to my review": "返回我的复盘",
  "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.":
    "比赛数据不支持的说法会被更正或删除。使用“说法核查”AI 分配。",
  Cost: "费用",
  "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.":
    "每次自动复盘都会消耗积分。积分不足时会跳过，比赛会显示“积分不足”。你没有参与的 Demo 不会被复盘。",
  "Every player's role": "每名玩家的角色",
  "Grounded claims": "有依据的说法",
  "How players rate each prompt version, and the latest automated check of grounding, language and cost.":
    "玩家对每个提示词版本的评分，以及最近一次对依据、语言和费用的自动检查。",
  "Key rounds": "关键回合",
  "Latest eval": "最近评估",
  "Match integrity": "比赛公平性",
  Prompt: "提示词",
  Purpose: "用途",
  Rated: "已评分",
  Ratings: "评分",
  "Rejected by the verifier": "被核查拒绝",
  "Report in game via the scoreboard.": "在游戏中通过计分板举报。",
  "Right language": "语言正确",
  "Round {n}: {title}": "第 {n} 回合：{title}",
  Runs: "运行次数",
  "Statistically unusual aim": "统计上异常的枪法",
  "Statistically unusual player. This death doesn't count against you":
    "统计上异常的玩家。这次阵亡不计入你的表现",
  "Team patterns": "团队模式",
  "Team plan for the next match": "下一场比赛的团队计划",
  "Team review cost": "团队复盘价格",
  "Team scores vs the enemy team": "团队对比敌方的评分",
  Teammate: "队友",
  "The team review could not be finished.": "团队复盘未能完成。",
  "This is a statistical signal, not proof. Deaths to these players aren't counted against you.":
    "这是统计信号，不是证据。死于这些玩家不计入你的表现。",
  "To fix": "待改进",
  Variant: "变体",
  "Verify every review's claims with a second AI pass":
    "用第二轮 AI 核查每份复盘的说法",
  "What to do instead": "应该怎么做",
  "When a demo of yours finishes processing, the AI Coach reviews it right away.":
    "你的 Demo 处理完成后，AI 教练会立即复盘。",
  "Whole team": "整个团队",
  "You {v} · lobby {m} · best {b}": "你 {v} · 房间 {m} · 最佳 {b}",
  "You vs the lobby": "你对比房间",
  "Your place among the {n} players of this match (1 = best).":
    "你在本场 {n} 名玩家中的排名（1 = 最好）。",
  "Your team, reviewed": "你的团队复盘",
  "{k} very fast snaps landing exactly on the head (in {n} fights)":
    "{k} 次极快的甩枪正好打在头上（共 {n} 次对枪）",
  "Headshot rate far above the rest of the lobby ({n} kills)":
    "爆头率远高于房间其他人（{n} 次击杀）",
  "Unusually many head hits per shot ({n} shots)":
    "每发子弹的爆头命中异常多（{n} 发）",
  "Hit back in {ms} ms on average after being shot ({n} times)":
    "被击中后平均 {ms} 毫秒内还击（{n} 次）",
  "{pct}% of kills through smoke or walls ({n} kills)":
    "{pct}% 的击杀穿过烟雾或墙体（{n} 次击杀）",
  "Statistically unusual play": "统计上异常的打法",
  "Account banned by VAC {d} days after this match":
    "账号在本场比赛 {d} 天后被 VAC 封禁",
  "Account received a game ban {d} days after this match":
    "账号在本场比赛 {d} 天后被游戏封禁",
  "Account banned by VAC after this match": "账号在本场比赛之后被 VAC 封禁",
  "Account received a game ban after this match":
    "账号在本场比赛之后被游戏封禁",
  Entry: "突破手",
  Support: "辅助",
  Lurker: "自由人",
  AWPer: "狙击手",
  Anchor: "防守位",
  Flex: "自由位",
  Openings: "首杀对枪",
  "Converting advantages": "把优势转化为胜利",
  "Run Team review": "开始团队复盘",
  "Five players, one game plan": "五名玩家，一个作战计划",
  "Your whole team, reviewed like an IGL would": "像指挥一样复盘你的整个团队",
  "Team scores: trading, utility, openings, economy, conversion":
    "团队评分：补枪、道具、首杀、经济、转化",
  "Each player's role with strengths and fixes": "每名玩家的角色、优点和改进点",
  "Key rounds with 2D clips": "带 2D 片段的关键回合",
  "A team plan with who does what": "分工明确的团队计划",
  New: "新",
  "Claim verifier": "说法核查",
  "Team review: the IGL view of a whole team. A strong model with a large context.":
    "团队复盘：从指挥视角看整个团队。强模型，大上下文。",
  "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.":
    "对照比赛数据复核复盘中的每个说法。快速、便宜的模型就够了。",
  "Credits per Team review (Pro pays one less).":
    "每次团队复盘的积分（Pro 少付一个）。",
  "{traded} of {deaths} traded": "{deaths} 次中 {traded} 次被补枪",
  "nearest teammate about {m} m away on average": "最近的队友平均约 {m} 米远",
  "{n, plural, one {# death} other {# deaths}} in a crossfire":
    "{n} 次阵亡在交叉火力中",
  "{nade} into {place}": "{nade} 投向 {place}",
  "{nade} at {place}": "{nade} 在 {place}",
  "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.":
    "第 {round} 回合：闪白 {n} 名敌人，持续 {s} 秒。",
  "Round {round}: {damage} damage.": "第 {round} 回合：{damage} 伤害。",
  "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.":
    "房间里有人在这里扔过 {n} 次；你在这里阵亡 {d} 次。",
  "Thrown from {place}.": "从 {place} 投掷。",
  "Multi-kill": "多杀",
  "You got two or more kills this round.": "你在这回合拿到两个或更多击杀。",
  "Clutch won": "残局获胜",
  "You were the last one alive and won the round.":
    "你是最后一个活着的，并且赢下了回合。",
  "You got the first kill of the round.": "你拿到了这回合的首杀。",
  "First death": "首个阵亡",
  "You were the first player to die this round.":
    "你是这回合第一个阵亡的玩家。",
  "Untraded death": "未被补枪的阵亡",
  "No teammate killed your killer within 5 seconds.":
    "5 秒内没有队友击杀击杀你的人。",
  "Early death": "过早阵亡",
  "You died in the first 20 seconds of the round.":
    "你在回合开始后 20 秒内阵亡。",
  "You died without damaging an enemy.": "你阵亡前没有对敌人造成伤害。",
  "Unused utility": "未使用的道具",
  "You died with two or more grenades still in your inventory.":
    "你阵亡时背包里还有两颗或更多投掷物。",
  "Pistol round": "手枪局",
  "Force buy": "强起",
  "Buy type": "购买类型",
  "Enemies blinded per flash": "每颗闪光弹闪到的敌人",
  "Team-flash rate": "闪到队友的比例",
  "{n, plural, one {# kill} other {# kills}}": "{n} 击杀",
  "opening duel": "首杀对枪",
  untraded: "未被补枪",
  "at {place}": "在 {place}",
  "Crosshair already on the enemy in {n} of {total} duels":
    "{total} 次对枪中有 {n} 次准星已经在敌人身上",
  "{place}: crosshair off target in {n} of {total} duels":
    "{place}：{total} 次对枪中有 {n} 次准星没对准",
  "Where your crosshair was when each duel started":
    "每次对枪开始时你的准星在哪里",
  "Duel won": "对枪获胜",
  "Duel lost": "对枪失败",
  "No winner": "无胜者",
  "Your crosshair tends to sit too high, above the head.":
    "你的准星往往太高，高过头部。",
  "Lower it a touch: aim where heads appear, not over them.":
    "稍微放低：瞄准头会出现的位置，而不是头的上方。",
  "Your crosshair usually sits at head height.": "你的准星通常在头部高度。",
  "Good height. Keep it there while you move.":
    "高度很好。移动时也保持在这里。",
  "Your crosshair tends to sit a little low: around neck height.":
    "你的准星往往有点低：在脖子高度。",
  "Raise it slightly so the first bullet goes to the head.":
    "稍微抬高一点，让第一发子弹打到头。",
  "Your crosshair tends to sit low: around chest height.":
    "你的准星往往偏低：在胸口高度。",
  "Raise it to head height before you peek.": "拉枪前把准星抬到头部高度。",
  "Your crosshair tends to sit very low: around stomach height.":
    "你的准星往往很低：在腹部高度。",
  "Raise it to head height before you peek; check it every time you stop.":
    "拉枪前把准星抬到头部高度；每次停下都检查一下。",
  "Your crosshair tends to sit very low: around the legs.":
    "你的准星往往很低：在腿部高度。",
  "It also tends to be to the left of where enemies appear: check the other side of the angle first.":
    "它也常常偏在敌人出现位置的左边：先检查角度的另一侧。",
  "It also tends to be to the right of where enemies appear: check the other side of the angle first.":
    "它也常常偏在敌人出现位置的右边：先检查角度的另一侧。",
  "On target": "已对准",
  "Your crosshair was already on the enemy.": "你的准星已经在敌人身上。",
  Near: "接近",
  "One small adjustment away.": "只差一次小调整。",
  "Big flick": "大幅甩枪",
  "You needed a big flick.": "你需要大幅甩枪。",
  "Duels with the crosshair already on the enemy": "准星已经在敌人身上的对枪",
  "Crosshair already on the enemy": "准星已在敌人身上",
  Strength: "优点",
  "To improve": "待提升",
  "Your AI coach": "你的 AI 教练",
  "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.":
    "选择一场比赛和一名玩家。教练会复盘每个回合，并用 2D 回放展示关键时刻。",
  "Choose a match": "选择比赛",
  "No analyzed matches yet": "还没有已分析的比赛",
  "Upload a demo and come back: the coach needs a match to review.":
    "上传一个 Demo 再回来：教练需要一场比赛来复盘。",
  Change: "更换",
  "Change match": "更换比赛",
  "Choose the player": "选择玩家",
  "Who should the coach review?": "教练要复盘谁？",
  "Started as CT": "开局 CT",
  "Started as T": "开局 T",
  Match: "比赛",
  Review: "复盘",
  Steps: "步骤",
  Reviewed: "已复盘",
  "Choose the player to review": "选择要复盘的玩家",
  "The coach is offline right now": "教练现在不在线",
  "The review could not be finished.": "复盘未能完成。",
  "Please try again later.": "请稍后再试。",
  "Reading {n} events…": "正在读取 {n} 个事件…",
  "Tracking your crosshair…": "正在追踪你的准星…",
  "Mapping every duel you took…": "正在标记你的每一次对枪…",
  "Checking who traded whom…": "正在检查谁补了谁的枪…",
  "Counting your utility…": "正在统计你的道具…",
  "Calling the IGL…": "正在呼叫指挥…",
  "Comparing you with the lobby…": "正在把你和房间对比…",
  "Checking every claim against the demo…": "正在用 Demo 核对每个说法…",
  "Writing your plan for the next match…": "正在写你下一场比赛的计划…",
  "{coach} is reviewing {name}": "{coach} 正在复盘 {name}",
  "A real review takes 10 to 60 seconds. Keep this tab open.":
    "一份真实的复盘需要 10 到 60 秒。请保持此标签页打开。",
  "Your match, reviewed": "你的比赛已复盘",
  "Saved review from {date}": "{date} 保存的复盘",
  "Overall score {n} of 100": "总评分 {n}/100",
  Overall: "总评",
  "Your scores vs the lobby": "你对比房间的评分",
  "Lobby average": "房间平均",
  "Key moments": "关键时刻",
  Priorities: "优先事项",
  "The coach found nothing it could back with evidence for this player.":
    "教练没有找到能用证据支持的关于这名玩家的内容。",
  Drills: "训练项目",
  "Ask again": "再问一次",
  "Open match analysis": "打开比赛分析",
  "Watch clip": "观看片段",
  Highlight: "高光",
  Mistake: "失误",
  Instead: "应该",
  "About {n} minutes in total": "总共约 {n} 分钟",
  "{done} of {n} done": "已完成 {done}/{n}",
  "{n} min": "{n} 分钟",
  Goal: "目标",
  "Get {name}'s full review": "获取 {name} 的完整复盘",
  "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.":
    "对比房间的评分、2D 回放的关键时刻、训练项目和下一场比赛的计划。",
  "Open in the coach": "在教练中打开",
  Players: "玩家",
  "Evidence: rounds {rounds}": "依据：回合 {rounds}",
  "Evidence: {n} metric(s)": "依据：{n} 项指标",
  "Keep doing": "继续保持",
  "Limits of this review": "这份复盘的局限",
  Practice: "练习",
  "Review for {name}": "{name} 的复盘",
  "Plan for your next match": "下一场比赛的计划",
  "Saved to your progress.": "已保存到你的进度。",
  "A Deep review uses a stronger AI and can take a few minutes. Keep this tab open.":
    "Deep 复盘使用更强的 AI，可能需要几分钟。请保持此标签页打开。",
  "Asking again writes a new review and uses credits.":
    "再问一次会写一份新的复盘并消耗积分。",
  "Quick vs Deep": "Quick 对比 Deep",
  "Open full review": "打开完整复盘",
  Scores: "评分",
  Score: "评分",
  Quick: "Quick",
  "What the Deep review revealed": "Deep 复盘发现了什么",
  "Get this with a Deep review": "用 Deep 复盘获取这些",
  "A stronger AI goes through the same match in far more detail:":
    "更强的 AI 会更细致地分析同一场比赛：",
  "Run Deep review": "开始 Deep 复盘",
  "Your Quick review stays, so you can compare both.":
    "你的 Quick 复盘会保留，方便两者对比。",
  "No clips for a reel in this match yet.": "这场比赛还没有可做集锦的片段。",
  "Match reel · {name}": "比赛集锦 · {name}",
  "Review type": "复盘类型",
  "Run both reviews to compare them": "两种复盘都做一次才能对比",
  Compare: "对比",
  Report: "报告",
  "1 credit": "1 积分",
  "Pro analysis": "专业分析",
  "Pro analysis with a stronger AI": "用更强 AI 的专业分析",
  "The essentials in under a minute": "一分钟内看到要点",
  "Free for admins": "管理员免费",
  "Already reviewed · opens free": "已复盘 · 免费打开",
  "Run it to compare side by side": "运行后可以并排对比",
  "Pro price": "Pro 价格",
  "Open my {tier}": "打开我的 {tier}",
  ...zh2,
};
