# 部署说明

当前第二版支持机构统一开户、四级角色及机构隔离。请以 [免费正式部署步骤](free-deployment.md) 为准，包含 Supabase Free 项目创建、数据库迁移、平台管理员初始化、开户函数和前端部署。

现有 GitHub Pages 地址 https://zhaofei2023-cpu.github.io/chatgptlearning/ 是演示站，使用 `gh-pages` 分支。源代码在 `flowspark-website` 分支 `website/` 目录。只更新源代码不会连接真实数据库。现有 Pages 设置已经完成，无需反复开启。

部署前端时只上传 `dist/`，不上传 `.env.local`、学生清单或临时密码。正式机构服务需核对托管用途限制；建议源码保留 GitHub，前端采用适合应用托管的免费静态服务。

AI 首期关闭；如未来明确启用，需要同时配置前端 `VITE_AI_ENABLED=true`、服务端 `AI_ENABLED=true`、mentor 函数以及模型服务密钥和来源限制。这可能产生模型费用，不能认为属于本次免费部署。
