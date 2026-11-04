# multimo-frontend

Multimo 的前端：React 19 + Vite + TypeScript + Tailwind CSS v4，地图用 Leaflet。

这个仓库是 [multimo](https://github.com/MeVeryHandsome/multimo) 主仓库的子模块。

## 页面

| 地址 | 页面 |
| :--- | :--- |
| `#/assets` | 素材列表：按类型、集合、文件名筛选，上传 |
| `#/assets/{id}?kf={关键帧}` | 素材详情：画面与检测框、关键帧时间轴、位置读数、小地图、描述；文档可在文内检索 |
| `#/search?q=` | 混合检索，显示查询被理解成的过滤条件 |
| `#/ask?q=` | 智能问答，答案中的引用链接到证据 |
| `#/map` | 已定位的关键帧和卫星底图 |
| `#/eval` | 运行评测，查看指标和历史报告 |

## 设计

影像是主角：素材页是按类型分组的图片墙，素材详情把画面放在深色观片台上，检测框以品红色叠印，下方是关键帧时间轴。浅冷灰底、白色面板；品红色只用于模型给出的内容（检测框、引用、选中的关键帧），蓝色用于地理信息，绿色和红色只表示达标与否（并配文字）。字体用 Source Sans 3（与思源黑体同一设计体系，中英文混排协调），坐标读数用细体大字和等宽数字，中文用系统字体。字体通过 `@fontsource` 随应用打包，不依赖 Google Fonts。颜色、圆角等在 `src/index.css` 的 `@theme` 中定义。

宽度小于 640 px 时导航收窄、网格变为两列，表格隐藏次要列。

## 本地开发

```bash
npm install
```

```bash
npm run dev          # http://localhost:5173，/api 代理到 VITE_API_TARGET（默认 http://127.0.0.1:8000）
```

## 构建

```bash
npm run build        # 产物在 dist/
```

Docker 镜像用 nginx 提供静态文件，并把 `/api`、`/swagger`、`/api.json` 反向代理到 compose 里的 `backend:8000`。地图背景瓦片地址来自后端的 `MAP_TILE_URL`。
