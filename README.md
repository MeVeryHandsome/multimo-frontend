# multimo-frontend

Multimo 的前端：React 19 + Vite + TypeScript + Tailwind CSS v4。

这个仓库是 [multimo](https://github.com/MeVeryHandsome/multimo) 主仓库的子模块。

## 本地开发

```bash
npm install
npm run dev          # http://localhost:5173，/api 代理到 VITE_API_TARGET（默认 http://127.0.0.1:8000）
```

## 构建

```bash
npm run build        # 产物在 dist/
```

Docker 镜像用 nginx 提供静态文件，并把 `/api`、`/swagger`、`/api.json` 反向代理到 compose 里的 `backend:8000`。
