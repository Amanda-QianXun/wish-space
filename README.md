# 心愿空间 Wish Space

> 历史里程碑快照 v0.6：成员空间、生日日历与筛选。演示身份与数据均为虚构内容。

面向熟人关系的送礼参考与秘密协作 Web App。用户既可以记录模糊的心愿灵感，也可以添加具体商品；朋友在群组中查看心愿、秘密认领礼物，认领状态不会向心愿发布者显示。

## 已实现

- 移动端优先的完整交互界面
- 心愿灵感 / 具体商品两种表达方式
- 多群组可见范围
- 群组切换、创建和邀请码加入
- 群组成员主页、生日登记、生日簿及最近生日提醒
- 按类别、心愿类型、预算上限和优先级筛选
- 心愿优先级、预算、风格偏好及购买链接
- 仅送礼者可见的秘密认领 / 已购买状态
- 发布者标记心愿已实现
- Supabase 邮箱免密码登录与真实多账号数据结构
- 无后端配置时自动进入可交互演示模式

## 本地启动

```bash
npm install
npm run dev
```

## 接入真实多账号

1. 创建 Supabase 项目。
2. 在 SQL Editor 中执行 `supabase/migrations/001_initial_schema.sql`。
3. 复制 `.env.example` 为 `.env.local`，填入项目 URL 和 Publishable Key：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

4. 在 Supabase Authentication 的 URL Configuration 中加入本地及正式部署地址。
5. 重新构建。配置存在时应用自动启用邮箱 Magic Link 登录；没有配置时使用演示模式。

浏览器端只使用 Publishable Key。不要将 `service_role` 密钥写入前端或提交到仓库。

## 数据权限

- 用户只能编辑自己的心愿。
- 只有同群成员能读取分享至该群的心愿。
- 心愿发布者无法读取秘密认领记录。
- 送礼者只能更改自己创建的认领状态。
- 群组加入通过唯一邀请码完成。
