---
title: GitHub连接失败解决方法
description: >-
  GitHub 443报错源于Git代理设置与实际网络不一致。解决办法：使用代理时，需通过git
  config同步端口号；不使用代理时，需执行--unset命令清除代理配置。
pubDate: 2026-05-09T13:32
image: https://img.131714.xyz/file/blog/GitHub/XBu35QXY.webp
draft: false
tags:
  - GitHub
  - Proxy
categories:
  - 教程
badge: ''
---
# GitHub 连接失败：Failed to connect to github.com port 443 解决方案

在使用 Git 进行 `push` 或 `pull` 操作时，如果遇到 `fatal: unable to access... Failed to connect to github.com port 443` 报错，通常是因为开启了 VPN（梯子）导致**系统代理端口与 Git 代理配置不一致**，或者在关闭 VPN 后 Git 仍残留了无效的代理设置。

## 场景一：在使用代理（梯子）时报错

**原因**：Git 无法自动识别系统的代理通道，需要手动指定端口。

1. **查看系统代理端口**：
* 进入：`设置` -> `网络和 Internet` -> `代理`。
* 查看“手动设置代理”中的**端口号**（常见端口如：7890、1080、4780 等）。


2. **同步 Git 代理配置**：
打开终端（cmd 或 PowerShell），执行以下命令（将 `7890` 替换为你实际查看到的端口号）：
```bash
# 设置 HTTP 代理
git config --global http.proxy 127.0.0.1:7890

# 设置 HTTPS 代理
git config --global https.proxy 127.0.0.1:7890

```


3. **生效验证**：
* 建议先执行 `ipconfig /flushdns` 刷新 DNS 缓存。
* 再次尝试 `push` 或 `pull` 即可恢复正常。

---

## 场景二：在未开启代理时报错

**原因**：之前配置过 Git 代理，但在关闭 VPN 后，Git 仍在尝试通过已失效的端口连接网络。

**解决办法**：直接清除 Git 的全局代理设置，让其回归直连模式。

1. **取消代理配置**：
在终端执行以下命令：

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

2.  **再次尝试**：
    此时 Git 将使用系统默认网络连接，问题通常迎刃而解。

---

## 💡 进阶技巧：如何快速检查当前代理状态？
如果你不确定 Git 当前是否配置了代理，可以使用以下命令查看：

```bash
git config --global --get http.proxy
git config --global --get https.proxy
```

> *如果返回为空，说明当前未设置代理；如果返回了 IP 和端口，请确保该端口与你当前的 VPN 软件一致。*
