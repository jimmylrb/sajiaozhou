# 零号禁区 3D // BLACKSITE ZERO

> 第一人称 3D 搜打撤 · 单文件 WebGL 游戏 · 可直接部署到 GitHub Pages

部署完成后，把这里替换成你的线上地址：

`https://jimmylrb.github.io/sajiaozhou/`

---

## 部署到 GitHub Pages（3 步）

1. 打开 https://github.com/new?name=sajiaozhou&visibility=public 新建**公开**仓库，名称 `sajiaozhou`，不要勾选 README / .gitignore。
2. 在本目录推送到仓库：

   ```bash
   ./publish.sh
   ```

   也可以手动：

   ```bash
   git remote add origin git@github.com:jimmylrb/sajiaozhou.git
   git push -u origin main
   ```

3. 打开 https://github.com/jimmylrb/sajiaozhou/settings/pages ，**Build and deployment → Source** 选择 **GitHub Actions**。

工作流 `.github/workflows/pages.yml` 会自动把 `index.html` / `404.html` / `robots.txt` 发布到 Pages。等待 Actions 变绿后访问上面的地址。

### 首次推送授权（本机部署密钥）

本目录已生成本仓库专用 SSH 部署密钥，公钥在 `.deploykey/id_ed25519.pub`。首次推送前，在仓库
`Settings → Deploy keys → Add deploy key` 添加它，并勾选 **Allow write access**。

> 如果不想用 Actions：Pages 的 Source 选 **Deploy from a branch → main → / (root)** 也可以，因为站点首页就在仓库根目录。

## 本地预览

直接双击 `index.html` 能玩；但更推荐起一个静态服务器：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 操作

`WASD` 移动 · `Shift` 冲刺 · `Ctrl` 蹲伏 · `Space` 跳跃 · 左键射击 · 右键机瞄
`R` 换弹 · `F` 检视武器 · `V` 干员战术技能 · `E` 搜刮/撤离 · `Q` 医疗 · `G` 手雷 · `Esc` 暂停

## 内容

- 两张独立 3D 地图：灰港（夜雨设施）/ 沙脊（沙暴前哨）
- 8 把可改装枪械（瞄具/枪口/握把/弹匣/枪托）
- 第一人称双臂、换弹/检视动画、Mandelbrick 大金、安全箱、行动保险
- 3 名干员（红狼/蜂医/夜莺），`V` 战术技能
- AI 小队、动态空投、Boss、金库、双撤离路线
- 单文件离线运行，所有模型/贴图已内嵌；WebGL 桌面浏览器

## 文件

- `index.html` — 最终可玩版本（约 6.8MB）
- `src/` — 可编辑源码与本地模型/贴图素材（不会被 Pages Actions 发布）
- `404.html` — GitHub Pages 404 回跳
- `.github/workflows/pages.yml` — 自动部署
- `publish.sh` — 推送辅助脚本

## 版权

原创代码与程序化场景以 MIT 许可发布，详见 `LICENSE`。第三方模型、贴图与库的授权见 `ATTRIBUTION.md`，它们各自保留原许可，不适用 MIT。
