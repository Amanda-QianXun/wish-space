# 心愿空间 Wish Space

一个围绕“记录自己的心愿”和“为朋友挑礼物”设计的移动端 Web App。用户可以整理日常想要的东西，也可以在熟人群组中查看彼此的心愿、生日和礼物认领状态，让送礼更合适，同时保留惊喜。

## 在线体验

- [产品演示](https://wish-space-gifts.myuna8848.chatgpt.site/)
- [GitHub Pages](https://amanda-qianxun.github.io/wish-space/)

当前公开版本为 `v1.0.0`。站点默认使用演示数据，无需登录即可体验主要流程。
仓库中的姓名、生日、邀请码和礼物认领关系均为虚构示例，不对应真实用户。

## 迭代历程

| 版本 | 关键变化 | 快照 |
| --- | --- | --- |
| v0.3 | 完成心愿、群组与秘密认领的核心原型 | [`milestone/v0.3-prototype`](https://github.com/Amanda-QianXun/wish-space/tree/milestone/v0.3-prototype) |
| v0.6 | 加入成员空间、生日日历与筛选 | [`milestone/v0.6-birthday-groups`](https://github.com/Amanda-QianXun/wish-space/tree/milestone/v0.6-birthday-groups) |
| v0.9 | 调整为个人心愿优先，补齐商品图片与编辑闭环 | [`milestone/v0.9-personal-wishes`](https://github.com/Amanda-QianXun/wish-space/tree/milestone/v0.9-personal-wishes) |
| v1.0 | 完成视觉层级、排序、消息入口和交互细节收口 | `main` |

完整需求说明见 [`docs/PRD.md`](docs/PRD.md)，版本取舍见 [`docs/ITERATIONS.md`](docs/ITERATIONS.md)。

## 核心功能

- 记录心愿灵感或具体商品，支持图片、预算、分类、优先级和分享范围
- 在“我的心愿”中筛选、排序、编辑并标记已实现
- 在“群组心愿”中查看成员空间，并按条件筛选礼物参考
- 通过邀请码创建或加入群组
- 汇总所有群组成员生日，并显示当前群组的下一位生日
- 朋友可秘密认领或标记已购买，心愿发布者不会提前看到状态
- 提供可切换的体验身份，便于完整演示多角色流程

## 技术栈

- React 19
- TypeScript
- Vite
- Supabase（可选，用于真实多账号、数据存储与权限控制）
- Lucide React

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 接入真实多账号

1. 创建 Supabase 项目。
2. 在 SQL Editor 中依次执行 `supabase/migrations/001_initial_schema.sql`、`supabase/migrations/002_update_wish.sql` 和 `supabase/migrations/003_delete_wish.sql`。
3. 将 `.env.example` 复制为 `.env.local`，填写项目配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

4. 在 Supabase Authentication 的 URL Configuration 中加入本地与正式部署地址。
5. 重新构建。存在有效配置时启用邮箱 Magic Link 登录；未配置时自动使用演示模式。

浏览器端仅使用 Publishable Key。不要将 `service_role` 密钥写入前端或提交到仓库。

## 数据权限设计

- 用户只能编辑自己的心愿
- 只有同群成员能读取分享至该群的心愿
- 心愿发布者无法读取秘密认领记录
- 送礼者只能更改自己创建的认领状态
- 群组通过唯一邀请码加入

## 部署

仓库内置 GitHub Pages 工作流。推送到 `main` 后，会自动安装依赖、构建并发布 `dist`。
