# 键盘事件监听器清理问题修复记录

## 问题描述

在 Obsidian Home Tab 插件中发现一个严重的键盘事件泄漏问题：

- **现象**: 用户通过鼠标点击选择文件后，键盘快捷键（方向键、Enter键）仍然保持绑定状态
- **影响**: 即使 View 关闭或切换到其他文件，按键仍会触发插件的搜索功能
- **触发条件**: 任何方式打开文件后（鼠标点击、快捷键选择）

## 根本原因分析

### 1. 多重 Scope 泄漏

**问题核心**: HomeTabSearchBar 在多个位置创建新的 suggester 实例，但没有正确销毁旧实例，导致多个 Obsidian Scope 同时存在于全局 keymap 中。

**涉及的创建点**:
```typescript
// 在 homeTabSearchbar.ts 中有 4 个地方创建新实例：
1. createDefaultSuggester()     // 没有销毁旧实例
2. createSuggester()           // 没有销毁旧实例  
3. updateActiveSuggester()     // 有销毁旧实例 ✓
4. switch case 'default'       // 没有销毁旧实例
```

### 2. 事件参数类型错误

**问题**: 基类 TextInputSuggester 的构造函数中：
```typescript
this.inputEl.addEventListener('blur', this.close.bind(this));
```

当 blur 事件触发时，事件对象被作为第一个参数传递给 `close()` 方法，但我们的重写方法期望的是 boolean 类型的 force 参数。

**调试输出显示**:
```
force: FocusEvent  // 应该是 boolean！
```

### 3. 键盘事件注册层次

**Scope 层次结构**:
```
基类 Suggester (suggester.ts)
├── ArrowUp/ArrowDown 导航
├── Enter 选择
└── Escape 关闭

子类 HomeTabFileSuggester (homeTabSuggester.ts)  
├── Mod+Enter (新标签页打开)
├── Shift+Enter (创建文件)
└── Shift+Mod+Enter (新标签页创建文件)
```

所有这些事件都注册在同一个 `this.scope` 上，如果 scope 没有被正确清理，所有按键都会保持活跃状态。

## 修复方案

### 修复1: 统一 Suggester 实例管理

**位置**: `src/homeTabSearchbar.ts`

**问题**: `createDefaultSuggester()` 和 `createSuggester()` 方法没有销毁旧实例

**修复**:
```typescript
private createDefaultSuggester(): void {
    // 销毁旧的 suggester 实例
    if (this.fileSuggester) {
        this.fileSuggester.destroy();
    }
    
    if (this.plugin.settings.omnisearch && this.plugin.app.plugins.getPlugin('omnisearch')) {
        this.fileSuggester = new OmnisearchSuggester(this.app, this.plugin, this.view, this);
    } else {
        this.fileSuggester = new HomeTabFileSuggester(this.app, this.plugin, this.view, this);
    }
}

private createSuggester(query: string): void {
    // 销毁旧的 suggester 实例
    if (this.fileSuggester) {
        this.fileSuggester.destroy();
    }
    
    // ... 其余创建逻辑
}
```

### 修复2: 强制清理机制

**位置**: `src/suggester/homeTabSuggester.ts`

**问题**: useSelectedItem 后没有清理键盘事件监听器

**修复**: 在所有文件操作后强制调用 `close(true)`
```typescript
useSelectedItem(selectedItem: Fuse.FuseResult<SearchFile>, newTab?: boolean): void {
    // ... 文件操作逻辑
    
    // 所有路径都确保调用强制清理
    this.close(true); // 强制清理，忽略 hideOnBlur 设置
}
```

### 修复3: 参数类型处理

**位置**: `src/suggester/homeTabSuggester.ts`

**问题**: blur 事件传递 Event 对象而不是 boolean

**修复**: 重写 close 方法以正确处理参数类型
```typescript
close(forceOrEvent?: boolean | Event): void {
    // 处理参数：如果第一个参数是事件对象，则 force = false
    const force = typeof forceOrEvent === 'boolean' ? forceOrEvent : false;
    
    if (force) {
        super.close(); // 强制关闭，总是清理 scope
        return;
    }
    
    // 正常的 blur 事件处理逻辑
    if (document.activeElement !== this.inputEl) {
        if (!(this.plugin.settings.hideOnBlur ?? true)) {
            return; // 不关闭，但这不影响强制清理
        }
    }
    
    super.close();
}
```

### 修复4: Hide-on-Blur 功能

**位置**: `src/settings.ts`

**新增功能**: 允许用户控制失焦时是否隐藏搜索结果
```typescript
export interface HomeTabSettings {
    // ...
    hideOnBlur?: boolean // 新增：失去焦点时是否隐藏搜索结果
}

// 在设置界面添加控制开关
new Setting(containerEl)
    .setName('Hide on blur')
    .setDesc('Hide search results when the search input loses focus.')
    .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.hideOnBlur ?? true)
        .onChange((value) => {
            this.plugin.settings.hideOnBlur = value
            this.plugin.saveSettings()
            this.plugin.refreshOpenViews()
        })
    )
```

## 修复验证

### 测试场景
1. ✅ 打开搜索，选择文件后按方向键 → 无反应
2. ✅ 打开搜索，选择文件后按Enter → 无反应  
3. ✅ 多次切换搜索过滤器 → 无键盘事件泄漏
4. ✅ hideOnBlur=false 时，失焦不关闭搜索结果
5. ✅ hideOnBlur=true 时，失焦关闭搜索结果

### 调试输出确认
```
Force closing suggester, scopeActive: true
After super.close(), scopeActive: false
```

## 技术细节

### Obsidian Scope 机制
- `app.keymap.pushScope(scope)` - 激活键盘作用域
- `app.keymap.popScope(scope)` - 移除键盘作用域
- 未正确调用 `popScope` 会导致 scope 永久残留在 keymap 中

### 事件监听器生命周期
```
创建 suggester → 注册 scope → 使用文件 → 销毁 suggester → 清理 scope
                                    ↑
                            这里容易出问题！
```

### 内存泄漏防范
- 总是在创建新实例前销毁旧实例
- 确保 destroy() 方法被正确调用
- 使用强制清理机制处理用户操作

## 相关文件

- `src/suggester/homeTabSuggester.ts` - 主要 suggester 实现
- `src/homeTabSearchbar.ts` - suggester 实例管理  
- `src/suggester/suggester.ts` - 基类实现
- `src/settings.ts` - 插件设置

## 经验教训

1. **实例管理**: 任何创建新实例的地方都要考虑旧实例的清理
2. **事件类型**: 事件处理器的参数类型要与实际传入类型匹配
3. **强制清理**: 对于用户操作后的清理，不应该受设置影响
4. **调试工具**: 适当的调试输出对于诊断此类问题至关重要

---
*修复完成时间: 2025-12-12*  
*涉及分支: feature/hide-on-blur-setting*