# DSH 农历生日提醒插件

给 [大肥鱼 dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 增加每年自动计算的农历和公历生日提醒。通过 DSH 标准插件安装，复用大肥鱼已有的祝福气泡、动画和语音通道。

这是非官方扩展。已在 **DSH 0.2.2-rc.1 + dsh-pet 0.4.9 + macOS Apple Silicon 的 web profile** 实机验证。

## 安装

1. 先安装并启用大肥鱼 `dsh-pet`。
2. 从 [最新 Release](https://github.com/hhdkz123-creator/dsh-lunar-birthday/releases/latest) 下载 `dsh-lunar-birthday-local-0.1.0.tgz`。
3. 在终端运行，文件路径替换成下载文件的完整路径：

   ```bash
   dsh plugin --profile web add "/完整路径/dsh-lunar-birthday-local-0.1.0.tgz"
   ```

4. 重启 DSH；运行 `dsh web` 的用户需重启该服务，然后刷新浏览器页面。
5. 打开 **账号菜单 → 设置 → 农历生日 → 我的生日**，选好生日并开启提醒、保存。

全新安装默认未设置生日，提醒关闭。请保留下载的安装包，DSH profile 会记录该本地文件路径。

## 功能

- 公历/农历选择，支持农历月份、日期及闰月。
- 农历按每年的实际日期换算，不固定重复某一年的公历日期；缺少对应闰月或日期的年份跳过。
- 显示中文生日和下一次公历生日，例如农历四月初一分别对应 2026-05-17、2027-05-06。这两年仅为测试基准。
- DSH 启动时检查当天未送达的生日，此后每 30 秒检查一次；使用持久回执及跨进程锁，同一天只自动提醒一次。
- 默认北京时间 22:00–08:00 免打扰，可在设置中修改；睡眠、隐藏或被其他插件占用时延后，不抢占或唤醒桌宠。
- 动画、语音可单独开关。语音沿用大肥鱼音色、音高及语音总开关。
- 手动「预览祝福」不占当天提醒次数；手动预览不受自动免打扰时段限制，仍遵守桌宠的睡眠和占用状态。

农历使用随包提供的 `lunar-javascript 1.7.8` 离线算法，不需要联网查询或下载年历。可选的语音合成本身仍取决于大肥鱼当前的语音服务。

## 保存与更新

数据单独存放在 `$DSH_HOME/dsh-lunar-birthday/`；未设置 `DSH_HOME` 时为 `~/.dsh/dsh-lunar-birthday/`：

- `config.json`：生日、提醒和免打扰设置。
- `state.json`：自动提醒成功后的日期回执。

生日结构为 `calendar / month / day / leap`，不修改大肥鱼原有配置或其他插件。下一次日期在打开或保存设置时重新计算；后台巡检独立运行。

升级前先退出 DSH 并备份整个 profile 和上述数据目录，再安装新版本包、重启。插件包不包含任何用户的个人配置、登录凭据或提醒回执。

## 卸载与回退

```bash
dsh plugin --profile web remove dsh-lunar-birthday-local
```

重启 DSH 后生效，个人生日和提醒回执保留。重新安装可继续使用。要回退版本，退出 DSH 后安装旧版本 Release 包，必要时恢复升级前的数据备份。

## 适用范围与限制

- 当前适配本机 **HTTP web profile**；HTTPS、远端 DSH 和 desktop profile 未实机验收。它不是旧版 Python 独立桌宠的 `.dshplugin`。
- DSH 需要保持运行；未运行时不会提醒。当天重新启动可补报，跨天不补播过去的生日。
- 仅桌面端在线时，会先等待庆祝动画的真实播放回执再发送祝福。若只开桌面端且关闭祝福动画，需打开 DSH 网页，以确认提醒接收端在线。
- 界面交付与磁盘回执不是一个跨系统事务；恰好在两者之间断电或强杀进程，仍可能出现重复。正常重启及并发去重有测试覆盖；回执损坏时暂停自动提醒。
- 「下一次日期」最多预览未来 100 年，实际当天匹配始终按当前日期计算。

## 源码测试与打包

要求 Node.js ≥24.9.0。离线算法已经随源码提供，无需安装额外依赖。

```bash
git clone https://github.com/hhdkz123-creator/dsh-lunar-birthday.git
cd dsh-lunar-birthday
npm test
npm run check
npm pack --ignore-scripts
```

`npm test` 覆盖 16 项日期、相邻日期、公历、闰月、免打扰、启动补报、正常重启、真实多进程去重、错误处理和鉴权测试。`npm run check` 检查实际打包文件集合，并从全新解包目录验证离线算法和宿主/客户端入口。

## 许可与致谢

MIT。保留原桌宠生日实现的许可，随包附带农历算法的 MIT 许可。来源与完整性信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
