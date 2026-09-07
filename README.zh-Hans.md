# pet

一个住在 Composer 上的小宠物系统。使用真实 OneWorks Avatar 呈现猫、狗和兔子，原生按钮的操作、键盘和无障碍语义由 Host 保留。

## 当前开发版本

- 商店、我的宠物、背包与装扮、互动设置、收支记录。
- 免费领养猫猫，附带两套皮肤和三份比特脆脆。可以通过亲密度解锁小狗和兔兔，或使用宠物币购买。
- 多只宠物独立出场、左右拖动、拎起落下；主宠同时显示在发送按钮上。
- 滚动、跳跃、睡眠与点击回应；右键菜单提供喂食、换装、主宠切换、收起和设置入口。
- 每只宠物独立记录饱食度、精力、健康、体重和亲密度。体型随体重缓慢变化。
- **离线暂停照顾计时**。在线长期饥饿会损害健康，健康归零后可以安葬，或消耗重启核心复活，名字、外观和亲密度保留。
- 关闭待机动画或减少动态效果仍能静态休息、恢复精力。

从上方宠物的右键菜单，或设置导航中的「我的宠物」进入。外观只能装备已拥有的皮肤，未拥有的皮肤可以预览。食物是消耗品，永久商品不能重复购买。改装和选择宠物立即生效。

授权后，新增且经过确认的本机输入与输出 Token 用量可以积累宠物币。首次连接只建立起点，部分覆盖与暂不可用状态会明确显示，不生成测试余额。宠物币不扣减模型额度。详细计时、恢复和开发边界见[宠物系统说明](docs/pet-system.md)。

## 开发

```sh
npm install
npm run check
npm run dev
```

开发依赖使用相邻 `../cordisx/packages/cli` 源码目录。已验证的源码基线为正式合入的 Host `82865d8f6e8437cd3ca74cdd6fb82bfe8f38a741`（[#375](https://github.com/cordisx/cordisx/pull/375)、[#377](https://github.com/cordisx/cordisx/pull/377)），对应 Protocol `5d38948025c2ac48e0b184a9d63c5bf595c762d8`。宠物系统源码使用这组版本；下方已发布安装包仍是旧版本。

插件只使用公开 CordisX 服务，Avatar 精确版本为 1.0.0-rc.8。插件代码用 Vite HMR 更新；Host、依赖或启动配置变化才需要更换开发运行实例。Launcher 验证的本地开发视觉权限自动授权；安装的插件仍需正常权限审核，不隐含麦克风权限。

## 已发布的旧版本

[pet v0.1.1](https://github.com/cordisx/plugin-pet/releases/tag/v0.1.1) 提供 `plugin-composer-animal-0.1.1.tgz` 与 `SHA256SUMS`。**该安装包只有原先的单宠物体验，不包含上述新养成系统。** 校验、解压后，将现有 CordisX 配置的 pet 入口设为 `package/dist/runtime/module.js`，保留其他插件配置。

旧安装包使用已验证 Host `d3e28dc37a357d94b0c177111fdaae4c189d14f0`。GitHub Release 分发包含运行代码、安装清单和依赖许可，无需再次编译；未发布到 npm，也不增加商店一键安装能力。

仓库公开、MIT 许可，并已登记到 [CordisX 插件目录](https://github.com/cordisx/marketplace/blob/main/marketplace.json)。包的 `private` 标记用于防止意外发布到 npm。
