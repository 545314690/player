# 赞美诗交互约定

界面语言 zh-CN。个人数据由 src/lib/storage.js 单一所有者管理，写入 praise-player-v1；备份格式带version、导入校验并明确确认覆盖。PWA和APK各自存储。

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | App.vue native select | 原生平台排序菜单 | native | browser-review |
| Form | App.vue共享表单与本机校验 | UX-CONTRACT.md | 歌单名称、LRC编辑 | core tests / browser-review |
| Scrollbar | src/style.css 全局基线 | DESIGN.md | 内部歌词滚动 | browser-review |
| Toast | App.vue toast | UX-CONTRACT.md | 成功、错误、提示 | browser-review |
| CRUD | App.vue歌单流程 | UX-CONTRACT.md | 创建/重命名/移出/删除 | browser-review |

## Workflow

创建歌单→校验非空和重名→保存本机→进入该歌单。取消不保存。
收藏/取消收藏即时生效，按钮标识与Toast同步；刷新保留。
添加到歌单防重复；上下移动有按钮替代拖拽。删除歌单必须确认；不删除音乐和收藏。
搜索完全本地匹配歌曲、编号、完整歌词；URL保留view/q，清空立即刷新且恢复输入焦点。
歌曲播放→建立队列→当前音乐状态同步到所有播放入口。浏览器使用Media Session；安卓使用ExoPlayer与前台Service。

## Lyrics

src/lib/lyrics.js负责时间戳解析、二分定位和序列化。Lyrics.vue按实际offsetTop/offsetHeight居中；ResizeObserver响应换行和字号变化。手动滚动暂停跟随，可主动恢复；点击一句跳转。快切歌通过AbortController防旧请求覆盖。
歌词统一取修订库，禁止回退旧远程LRC。完整文字来源原工程歌本；时间轴近似匹配及未覆盖段落明确待复核。用户的本机纠错优先，并可确认恢复原稿。

## Offline

首次播放通过链接。Web完整音频响应进入CacheStorage，Service Worker对缓存支持Range；未缓存时联网。安卓SimpleCache对已读取区间复用，显式下载补齐整曲；512MB LRU上限。离线完整歌曲列出，清理前确认。缓存失败不影响在线播放。
PWA只预缓存界面和歌词，不预缓存曲库音频。APK只打包界面和歌词；不含MP3。

## Accessibility and errors

原生button、label、input、select、dialog；无需浏览器alert/confirm/prompt。dialog自带焦点圈定、Escape和恢复。所有图标按钮提供中文aria-label。错误以文本显示，网络错误提供重试；本地保存失败保留当前会话并提供导出。

## Playback modes

播放模式点击左侧带文字的按钮直接循环切换：全部循环→随机播放→单曲循环→全部循环，不弹窗；图标、文字和提示同步更新，保存在本机。单曲循环只影响自然播完，手动上一首/下一首仍切歌。随机使用固定打乱队列，每轮各播放一次，上一首沿该顺序回退；接下来与队列显示同一引擎顺序。安卓和Web均报告真实下一首。只有一首时明确提示。
