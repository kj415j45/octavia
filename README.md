# Octavia - 千星奇域工具

<div align="center">
    <img src="public/lib/icon.png" width="128" height="128" />
</div>

Octavia 是一个部署在 Cloudflare Workers 上的服务，提供对《原神·千星奇域》（Miliastra Wonderland）相关数据的查询。

[网页版](https://octavia.kj415j45.space)

## 功能特性

- **奇域详情查询**：提供奇域的基本信息、作者信息、当前状态等数据，支持缓存以提升响应速度。
- **奇域搜索**：支持按名称搜索奇域，返回匹配结果列表。
- **作者信息查询**：提供奇域作者的基本信息和相关数据。
- **排行榜**：提供奇域排行榜数据，展示当前收录奇域的好评率排名。

本服务当且仅当有用户请求获取过特定奇域时，才会抓取相关数据，并进行轮询更新。

## 公开接口

参见 [openapi.json](./openapi.json) 中的接口定义。

任何人都可以使用这些公开接口查询数据，但请注意：

- 数据可能会有一定的延迟。
- 不保证这些接口的稳定性，可能会随时更改或废弃。

## 本地开发

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境

按需调整 `wrangler.jsonc` 中的以下项：

- `DB` ，D1 数据库，用于存储奇域数据和作者信息，必须配置
- `kv` ，KV 存储，提供彩蛋信息数据
- `analytics` ，Analytics Engine 数据库，用于记录上游连接情况

按需配置下列三项 secret：

- `ACCOUNT_ID` ，Cloudflare 账号 ID
- `ANALYTICS_API_TOKEN` ，Analytics Engine API Token，只需要读权限
- `TOTP_SECRET` ，TOTP 密钥，用于管理后台操作验证

### 3) 运行与部署

```bash
npm run cf-typegen # 生成/更新 Env 类型
npx wrangler d1 migrations apply octavia --local # 本地应用 D1 数据库迁移
npm run dev        # 本地开发
npm run deploy     # 部署到 Cloudflare Workers
```

## 版权与合规声明

本项目为非官方社区工具，仅用于技术学习交流，不受 miHoYo 或 HoYoverse 官方支持或认可。

《原神》及其相关名称、角色、素材与商标归其各自权利人所有；本项目不提供、不分发任何游戏客户端资源、受版权保护素材或破解内容。

奇域信息为各自的作者创作，版权归原作者所有；本项目仅提供数据查询接口，不涉及内容创作或修改。

如果您认为本项目侵犯了您的版权或其他合法权益，请通过 GitHub Issues 提交请求或发送邮件至 `octavia # kj415j45.space` 。
