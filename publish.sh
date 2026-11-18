#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-git@github.com:jimmylrb/sajiaozhou.git}"
if ! git ls-remote "$REPO" >/dev/null 2>&1; then
  echo "远程仓库还不存在。先打开下面链接创建空仓库（不要勾选 README）："
  echo "https://github.com/new?name=sajiaozhou&visibility=public"
  echo "建好后，把 .deploykey/id_ed25519.pub 添加为仓库 Deploy key（勾选 Allow write access），再运行本脚本。"
  exit 1
fi
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git push -u origin main
echo ""
echo "推送完成。打开仓库 → Settings → Pages → Build and deployment → Source 选择「GitHub Actions」。"
echo "等待 Actions 完成后访问: https://jimmylrb.github.io/sajiaozhou/"
