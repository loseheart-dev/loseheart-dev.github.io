---
title: 用 CSS Grid 搭一个舒服的阅读布局
date: 2026-10-19 08:30:00
categories: 技术笔记
tags:
  - CSS
  - 前端
description: 主栏和侧栏怎么分配，什么时候收成一列，以及一个容易忽略的 min-width 问题。
---

博客布局不复杂：文章占主要空间，侧栏放作者信息和内容入口。真正需要留意的是窗口变窄之后，它们如何变化。

## 先定阅读宽度

屏幕越宽，正文并不需要无限变宽。给容器一个最大宽度，两边自然留白，长文更容易阅读。

```css
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  max-width: 1200px;
  margin-inline: auto;
  padding: 40px 20px;
}
```

`minmax(0, 1fr)` 的下限是零，能让主栏缩小。否则，长代码或长链接的最小内容宽度可能把整个页面撑开。

## 小屏幕变成一列

侧栏不是必须一直待在文章右边。空间不够时，让它自然排到下面。

```css
@media (max-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

## 单独处理代码横向滚动

代码行不应迫使整个页面一起横向滚动。把滚动限制在代码块内部，布局才会稳定。

```css
pre {
  max-width: 100%;
  overflow-x: auto;
}
```

调试时可以逐渐缩窄窗口，再放入一条特别长的代码，观察是代码块在滚动，还是整个页面被撑开。
