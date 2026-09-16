# 传播物料（先发 X + 掘金，再考虑 Trending）

## X 中文帖（主帖 + 2 条回复）

主帖（<280字中文习惯，配 hero.svg 转 PNG + strands.html 截图）：

> 从鸿蒙外包转 Agent 开发，我的简历缺一个能证明自己的东西。
> 学 @tt-a1i Archify 的链路，做了一个最小复刻：agent-loop-trace
> 输入 event-loop 日志 → JSON IR → 5 项校验 → 单文件 HTML，可切主题、可导出 PNG。
> 第一个图讲我合并进 AWS Strands 的 bug：tool_choice=any 被 provider 内置工具抢占。
> 开源 MIT，求 star 和 issue：<repo-url>

回复1：第二个图是 DSPy 的 reward 腐蚀：1-of-2 的 0.0 被 `or` 改写成 -1，最好的一次变成最差。

回复2：链路细节：SKILL.md 40 行约束 Agent 先写 JSON 再画图，两轮修不好就老实上报。validator 5 项全过才 deliver，receipt 带 sha256。

## X English (quote-tweet the Chinese one)

> Minimal Archify-style clone for agent debugging: JSON trace → 5 validation checks → single HTML (dark/light + PNG export). First diagram visualizes my merged Strands fix (tool_choice=any preemption). MIT, feedback welcome.

## 掘金标题3选1

1. 学 Archify 做了个最小复刻：把 Strands 合并的 bug 变成一张可验证的时序图
2. 从鸿蒙外包转 Agent：我用两个 PR 故事做了个开源 Skill
3. Agent 调试可视化：JSON IR + 5 项校验，前端人做开源的窄切口

掘金结构：背景（转行缺背书）→ 学到了什么（Archify 链路拆解）→ 两个例子 → 怎么用（Skill 一句话）→ 求 star/issue

## Checklist

- [ ] hero.svg 转 1200×630 PNG（浏览器打开 SVG 截图，或用 deliver 页 Export PNG）
- [ ] strands.html / dspy.html 各截 1 张深色图
- [ ] 先发掘金（中文长文），再发 X（短 + 图 + repo 链接）
- [ ] 去 tt-a1i/archify 下提 1 个真诚 issue：感谢 + 说明学了链路做了窄切口（别打广告灌水）
