# emtionji

一个只做运行时能力的 Vue Core：输入一个 Emoji 字符串和一份动画 JSON，在内存中把 Emoji 转成 SVG，并按 JSON 播放部件动画。

```vue
<script setup lang="ts">
import { AnimatedEmoji } from "@w0fv1/emtionji"
</script>

<template>
  <AnimatedEmoji data="./sunflower.json" />
</template>
```

组件内部加载并校验 JSON，再读取其中的 `emoji`。JSON 不保存 SVG，它只有三类数据：

- `emoji`：需要转换成 SVG 的单个 Emoji 字符串。
- `parts`：把运行时生成的 SVG 元素绑定成稳定部件；既支持单个 `selector`，也支持由多个 `members` 组成的复合部件。
- `animations.press`：点击时各部件的关键帧。
- `directional`：声明哪些数值随点击方向镜像。

每条关键帧必须从中性状态开始并回到中性状态。Core 会在校验阶段拒绝留下位移、缩放、透明度或旋转残留的配置，并在动画完成、停止或被打断时恢复 SVG 的原始属性。

数值关键帧在播放前会经过平滑曲线加密，每两个设计帧之间补充两个采样点，实际控制帧达到原始数量的两倍以上。对于反光等由多个 Emoji 共用的 SVG 图层，`members[].clip` 可以按指定几何元素裁剪出专属图层，再与主体组合成一个同步运动的部件。

`data` 支持浏览器 `fetch` 的常见资源地址：

- 相对路径和绝对路径；
- HTTP/HTTPS URL；
- `data:application/json;base64,...` Base64 Data URL；
- percent-encoded Data URL；
- 浏览器创建的 `blob:` URL。

```vue
<AnimatedEmoji data="https://example.com/emtionji/sunflower.json" />
<AnimatedEmoji data="data:application/json;base64,eyJ2ZXJzaW9uIjoxLC4uLn0=" />
```

跨域加载时，JSON 服务器需要允许浏览器 CORS 请求。

完整样例见 [`examples/emojis/1f33b-sunflower.json`](examples/emojis/1f33b-sunflower.json)。JSON 可以由 AI 生成，但进入组件前仍会经过结构、引用和回归原位校验。

## Emoji 转 SVG

Core 使用 `@twemoji/parser` 把 Emoji 解析为 Unicode 资产键，再从固定版本 Twemoji 获取 SVG 文本。SVG 只存在于内存中，经过标签和属性清理后转成 DOM；调用方不传 SVG，也不使用 `v-html`。

当前默认资产版本固定为 Twemoji 17.0.2。固定版本很重要，因为 `parts` 中的选择器必须始终对应同一套 SVG 结构。

## 本地示例

```bash
pnpm example
```

命令会启动开发服务器并自动打开浏览器。选择任意 Emoji 后，工作台左侧播放当前组件，右侧同步展示它的 JSON；每个文件使用 `Unicode代码-英文名.json` 命名。

Twemoji 代码采用 MIT 许可，其图形资产采用 CC BY 4.0 许可。项目使用时应保留恰当署名。
