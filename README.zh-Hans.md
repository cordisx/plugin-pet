# CordisX Pet

Pet 在 CordisX Composer 中加入可互动的宠物伙伴，并提供完整的照顾、
收藏、商店、背包与设置体验。内置 OneWorks Avatar 的 32 个原生角色和
142 款品种／花色。[English](README.md)

## 安装

先登记公开 CordisX Marketplace 源，再使用 manifest id 安装精确版本：

```sh
npx cordisx@beta source add https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json --yes
npx cordisx@beta plugin install plugin-composer-animal --source https://raw.githubusercontent.com/cordisx/marketplace/main/marketplace.json --version 0.1.2
```

`--source` 只选择已经登记并启用的发现源，不会临时登记该源，也不会把它
自动设为信任根。`--yes` 只确认源管理操作，不会批准插件权限。CLI 不支持
`id@version` 简写。

使用非默认 Host profile 时，请为两条命令添加相同的
`--profile <profile>` 参数。

## 环境要求

- CordisX `0.1.0-beta.11` 或更高的兼容 Host。
- 能访问 GitHub Release 制品和公开 Marketplace feed 的网络环境。
- 允许插件在受控的 Composer 视觉位置渲染；交互权限按需授权。
- 若要通过本机用量获取宠物币，需要可选的当前 profile 用量权限。

GitHub Release 中的安装包已预构建，无需安装 npm 依赖或自行编译插件。
包保持 `private`，用于避免意外发布到 npm。

## 使用

完成安装和 Host 权限审核后，可从宠物右键菜单或
**设置 > 宠物** 打开管理界面。

- 领养多只伙伴，设置主宠、改名，并管理哪些宠物在 Composer 中出场。
- 拖动、拎起、放下、滚动、跳跃、休息、唤醒、喂食、饮水、互动和装扮。
- 在商店与背包中管理物种、皮肤、食物、复活道具、饮水器和喂食器。
- 分别管理每只宠物的饱食、饮水、精力、心情、健康、体重、亲密度、
  自动设备和在线探索。
- 可选择授权本机用量，按新增且可确认的输入与输出 Token 获取宠物币。
  宠物币不会消耗模型额度。

状态由 Host 按当前 profile、插件来源和插件身份保存。同一来源下普通重载
或兼容升级会保留状态；不同 profile 或来源不会自动共享状态。

## 重要行为

- 只有应用和插件运行时才推进照顾时间；离线不会消耗食物、饮水、精力或
  健康。
- 在线长期饥饿或缺水可能降低健康。宠物死亡后可以安葬，或使用复活图腾
  复活并保留身份和外观。
- 自动喂食器需要背包中的食物，饮水器需要手动补水；设备不会凭空生成或
  自动购买补给。
- 首次成功连接用量数据只建立基线，不会把历史用量兑换成测试余额，也不会
  估算不可用或不完整的区间。
- 减少动态效果会停用大幅动作和重复表情动画，但不会关闭核心照顾逻辑。

详细照顾规则、成长、存档、设备和目录行为见
[宠物系统说明](docs/pet-system.md)。

## 权限

Pet 请求在 Composer 主操作按钮和框架覆盖层的受控位置渲染。鼠标观察、
拖动和激活为可选权限，并且仅限这些位置。本机用量权限同样可选，只读取
当前 profile。Pet 不请求麦克风权限，也不读取 Composer 文本。

安装和源发现不会跳过 Host 权限审核。请在 Host 的插件设置中管理权限。

## 限制

- 用量奖励只覆盖本机可观察到的 Codex 输入与输出总量，不是账号账单或
  跨设备总量。
- 应用关闭、系统休眠或持久化不可用时，照顾与探索暂停。
- 状态只属于对应的 Host profile 和插件来源，不提供账号同步或跨设备迁移。
- 当前版本已完成安装包和运行图验证；本文不宣称已在所有 Host 环境中完成
  真实安装或激活测试。

## 排错

- **找不到源或插件：** 先运行 `source add`，并使用准确的 manifest id
  `plugin-composer-animal` 与 `--version 0.1.2`。
- **宠物没有显示：** 在设置中启用 Pet，保持至少一只存活伙伴处于出场状态，
  并检查 Composer 渲染权限。
- **无法拖动或互动：** 在 Host 设置中检查 Pet 的可选交互权限。
- **用量奖励不可用：** 检查当前 profile 的可选用量权限。未授权时已有宠物
  状态和宠物币仍会保留。
- **状态无法保存：** 检查 Host 诊断和本地存储空间。Pet 会拒绝不安全的写入，
  不会静默重置收藏或钱包。

Pet 采用 MIT 许可证公开发布，并通过
[CordisX Marketplace](https://github.com/cordisx/marketplace/blob/main/marketplace.json)
分发。
