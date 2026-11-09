---
version: alpha
name: 赞美诗播放器
description: 适中字号、清晰控件与克制色彩的本地音乐播放器
colors:
  background: "#ffffff"
  foreground: "#252a28"
  primary: "#12865b"
  pink: "#c73770"
  white: "#252b31"
  darkBackground: "#171b19"
  darkPrimary: "#b7cdb5"
  darkLyric: "#d7bc7e"
  border: "#e9ecea"
  muted: "#737b77"
typography:
  sans:
    fontFamily: "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    lineHeight: "1.7"
  utility:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
rounded:
  DEFAULT: "12px"
  control: "7px"
  album: "10px"
spacing:
  phoneInset: "26px"
  desktopInset: "36px"
components:
  player:
    titleSize: "20px"
    lyricSize: "17px"
  button:
    minHeight: "38px"
  dialog:
    maxWidth: "620px"
---

## Overview

面向现有中文赞美诗曲库的个人聆听工具，zh-CN 产品界面。支持手机 PWA、桌面浏览器和安卓 APK，无账号与服务器个人数据。
用户确认绿色、粉色、白色三种设计加最初黑色款，默认黑色。不要大字、整屏染色、拟物磁带、纸质书或过度个性的造型。
界面上的明确表达是：完整歌词与播放控制优先，其他功能放入菜单。
本文件镜像运行时的规范；`src/style.css` 为唯一 CSS token 所有者，根节点 data-theme 选择主题，所有组件共享变量。App 的主题选项来自同一份固定四主题目录。不得引入独立屏幕颜色表。

## Colors

浅色共用白底、深灰正文；绿色与粉色只用于播放按钮、已播放进度、当前歌词、选中状态。黑色共用深色面板、柔绿控件、金色当前句。不会给封面染色。
语义错误用 danger，与主题强调区分。焦点始终可见，不只用颜色区分歌曲选中状态。

## Typography

系统中文无衬线字体。标题20px、正文14px、歌词默认17px；歌词可在设置调整14–24px，这是用户选择，不改变默认。时间和编号使用 tabular-nums。当前句只改变颜色和字重，不改变字号，避免滚动高度跳变。

## Layout

桌面为222px侧栏、弹性曲库、354px播放面板；1050px以下使用底部导航与迷你播放器，全屏播放器通过固定独立面板展开。移动正文内边距20px，播放器26px。支持320px宽度与安全区。曲库分页加载30首；歌词容器独立滚动，其他内容自然滚动。

## Elevation & Depth

以分隔线和轻微表面色建立层次。仅弹窗、浮动跟随按钮有必要阴影。无整屏色罩，无厚重底部色块。

## Shapes

封面10px圆角、控件7px、面板12px。播放按钮54px圆形。图标使用Lucide单线条，1.7px描边。

## Components

Icon.vue是图标所有者，Lyrics.vue是歌词测量与滚动所有者。搜索、歌曲行、菜单、弹窗与Toast由App.vue共享实现。禁用/忙碌态保留按钮尺寸；加载用旋转指示器。空状态说明去哪里添加内容，错误提供重试。原生dialog提供模态焦点管理，平台原生select拥有歌曲排序弹出菜单。
滚动条全局继承thumb/track/hover/active变量；不隐藏。遵守prefers-reduced-motion，滚动与颜色过渡可被禁用。forced-colors保留选中标识。

## Do's and Don'ts

- 主题影响全部屏幕并保存本机；切换不能打断播放。
- 同一封面不因皮肤而改变。用实际歌词行的位置居中，支持换行和缩放。
- 不显示未经核对的语音识别乱码；不把源歌本的近似对齐宣称为人工听校完成。
- 不上传个人歌单，不在APK中放入音乐文件，不默认开启大字。
