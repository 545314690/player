# 赞美诗 · 音乐播放器

Vue 3 + Vite 的本地优先播放器，默认静夜黑；另有青绿、玫粉、纯白。手机、平板与桌面响应式，PWA 与原生 Android 媒体服务。

```sh
npm ci
npm run dev
npm run build
npm test
npm run preview
npm run android:sync
bash scripts/build-android.sh
```

- 网页入口 `/player/`，相对路径部署。编译产物 `dist/`，部署仓库中保存为 `web-dist/`。
- 音频仅使用链接。优先从同域 `/songs/assets/media/` 读取，固定提交 `1abd9c7` 的 Raw 链接只作备用；新版构建不复制音乐；避免把1.5GB音乐再次装进Pages产物或APK。
- 浏览器播放自动完整缓存；Service Worker支持Range。安卓ExoPlayer使用512MB LRU缓存，已缓存区间自动复用，更多菜单下载可补齐整曲。
- 个人歌单、收藏、皮肤、音量、播放进度、歌词偏移与纠错保存在本机；支持JSON导入导出，不包含音乐文件。
- 原生后台服务持有ExoPlayer，独立于WebView；支持媒体通知、锁屏、媒体键、音频焦点与拔耳机暂停。
- 歌词正式显示仅使用原工程歌本文字。自动对齐不是人工听校；剩余不确定时间点在界面标记，并可查看完整文本或本机编辑。

## 目录

`src/` 界面、状态、播放引擎；`static/` 小体积封面与修订歌词；`android/` 原生Activity和播放Service；`tests/` 核心与实际Service Worker测试；`docs/` 校订记录与验收。

`static/library/catalog.json` 为稳定id索引，每个JSON歌词带revision。原始识别稿只供对照，禁止回退作为正式歌词。用户本机纠错优先。

更新曲库可先运行 `python3 scripts/migrate-library.py`，再运行 `node scripts/refine-lyrics.mjs`；必须复核校订记录后才发布，不能把原始ASR直接投放。

## 发布

原仓库 `545314690/player` 使用 GitHub Pages Actions。工作流只上传已检查的 `web-dist/`，音乐继续通过固定版本原文件链接读取。发布前将最新dist同步到web-dist，APK单独存放downloads。保留历史提交，可回滚。

Android需要Java17、SDK34、Gradle8.2.1；可通过环境变量PRAISE_GRADLE覆盖本机Gradle路径。产物为debug签名，适合直接安装验收；上架前另行配置正式签名。
