# API Provider Configuration Module

This module provides a complete, standalone implementation for managing multiple API providers (Base URL, API Key, Model lists) with local storage persistence.

## 1. HTML Structure
Place this at the end of your `<body>` tag. It includes two modals: one for the provider list and one for editing/adding a provider.

```html
<!-- API Provider Settings Modal -->
<div id="api-settings-modal" class="modal hidden">
    <div class="modal-content api-modal">
        <span class="close-modal" id="close-api-settings">&times;</span>
        <div class="api-modal-header">
            <h2>API 提供商设置</h2>
            <p>配置您的自定义 API 节点与密钥</p>
        </div>
        <div class="api-provider-list" id="api-provider-list">
            <!-- Providers will be injected here -->
        </div>
        <div class="api-modal-actions">
            <button id="add-provider-btn" class="add-new-btn">
                <span class="icon">+</span> 添加新提供商
            </button>
            <button id="finish-api-settings" class="finish-btn">完成</button>
        </div>
    </div>
</div>

<!-- API Provider Edit Modal -->
<div id="api-edit-modal" class="modal hidden">
    <div class="modal-content api-edit-modal">
        <span class="close-modal" id="close-api-edit">&times;</span>
        <div class="api-modal-header">
            <h2 id="edit-modal-title">添加提供商</h2>
        </div>
        <form id="api-provider-form" class="api-form">
            <input type="hidden" id="edit-provider-id">
            <div class="form-row">
                <div class="form-group">
                    <label>提供商名称</label>
                    <input type="text" id="provider-name" placeholder="例如: comfly测试" required>
                </div>
                <div class="form-group">
                    <label>API 格式</label>
                    <select id="provider-format">
                        <option value="openai">OpenAI 兼容</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>API 基础地址 (BASE URL)</label>
                <input type="text" id="provider-url" placeholder="https://api.example.com/v1" required>
            </div>
            <div class="form-group">
                <label>API 密钥 (KEY)</label>
                <input type="password" id="provider-key" placeholder="sk-..." required>
            </div>
            <div class="form-group">
                <label>支持的模型 (常规 - 逗号分隔)</label>
                <textarea id="provider-models" placeholder="所有" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>图像模型 (逗号分隔)</label>
                <textarea id="provider-img-models" placeholder="model-1, model-2..." rows="2"></textarea>
            </div>
            <div class="form-check">
                <input type="checkbox" id="provider-default">
                <label for="provider-default">设为默认提供商</label>
            </div>
            <div class="form-actions">
                <button type="submit" class="save-btn">保存配置</button>
                <button type="button" id="cancel-api-edit" class="cancel-btn-alt">取消</button>
            </div>
        </form>
    </div>
</div>
```

---

## 2. CSS Styles
Add these to your stylesheet. It uses CSS variables for easy theme matching.

```css
:root {
    --bg-panel: #1a1d24;
    --bg-input: #242832;
    --primary: #6366f1;
    --text-main: #ffffff;
    --text-muted: #9ca3af;
    --border: #2e323b;
    --transition: all 0.2s ease;
}

.modal {
    position: fixed;
    z-index: 1000;
    left: 0; top: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(5px);
}

.modal.hidden { display: none !important; }

.modal-content.api-modal {
    max-width: 600px; padding: 2rem; border-radius: 16px;
    background: var(--bg-panel); border: 1px solid var(--border);
}

.api-provider-list {
    display: flex; flex-direction: column; gap: 1rem;
    margin-bottom: 2rem; max-height: 400px; overflow-y: auto;
}

.api-provider-item {
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.25rem; display: flex;
    align-items: center; gap: 1rem; cursor: pointer; transition: var(--transition);
}

.api-provider-item.active {
    border-color: var(--primary); background: rgba(99, 102, 241, 0.05);
}

.provider-radio {
    width: 20px; height: 20px; border: 2px solid var(--border);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
}

.api-provider-item.active .provider-radio { border-color: var(--primary); }
.api-provider-item.active .provider-radio::after {
    content: ''; width: 10px; height: 10px; background: var(--primary); border-radius: 50%;
}

.provider-info { flex: 1; }
.provider-name { font-weight: 600; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
.provider-url { font-size: 0.75rem; color: var(--text-muted); }
.provider-badge { font-size: 0.65rem; background: var(--primary); color: white; padding: 1px 6px; border-radius: 4px; }

.provider-actions { display: flex; gap: 0.5rem; opacity: 0; }
.api-provider-item:hover .provider-actions { opacity: 1; }

.api-form { display: flex; flex-direction: column; gap: 1.25rem; }
.form-row { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-size: 0.8rem; color: var(--text-muted); }
.form-group input, .form-group textarea, .form-group select {
    background: var(--bg-input); border: 1px solid var(--border);
    color: var(--text-main); padding: 0.75rem; border-radius: 8px;
}

.save-btn { background: var(--primary); color: white; border: none; padding: 0.75rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
```

---

## 3. JavaScript Logic
This class manages the lifecycle of API providers, including saving to `localStorage`.

```javascript
class APIProviderManager {
    constructor() {
        this.providers = [];
        this.activeProviderId = null;

        // UI Elements
        this.settingsModal = document.getElementById('api-settings-modal');
        this.editModal = document.getElementById('api-edit-modal');
        this.providerListEl = document.getElementById('api-provider-list');
        this.form = document.getElementById('api-provider-form');

        this.load();
        this.init();
    }

    load() {
        const saved = localStorage.getItem('api_providers');
        if (saved) {
            this.providers = JSON.parse(saved);
            this.activeProviderId = localStorage.getItem('active_provider_id');
        }
        
        // Default if empty
        if (this.providers.length === 0) {
            const defaultP = { id: 'p1', name: 'Default', url: 'https://api.example.com/v1', key: '', format: 'openai', isDefault: true };
            this.providers.push(defaultP);
            this.activeProviderId = defaultP.id;
            this.save();
        }
    }

    save() {
        localStorage.setItem('api_providers', JSON.stringify(this.providers));
        localStorage.setItem('active_provider_id', this.activeProviderId);
    }

    init() {
        document.getElementById('open-api-settings')?.addEventListener('click', () => this.showSettings());
        document.getElementById('close-api-settings')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('add-provider-btn')?.addEventListener('click', () => this.showEdit());
        this.form?.addEventListener('submit', (e) => { e.preventDefault(); this.handleSave(); });
    }

    showSettings() { this.renderList(); this.settingsModal.classList.remove('hidden'); }
    hideSettings() { this.settingsModal.classList.add('hidden'); }

    showEdit(id = null) {
        if (id) {
            const p = this.providers.find(x => x.id === id);
            document.getElementById('edit-provider-id').value = p.id;
            document.getElementById('provider-name').value = p.name;
            document.getElementById('provider-url').value = p.url;
            document.getElementById('provider-key').value = p.key;
            document.getElementById('provider-default').checked = p.isDefault;
        } else {
            this.form.reset();
            document.getElementById('edit-provider-id').value = '';
        }
        this.editModal.classList.remove('hidden');
    }

    handleSave() {
        const id = document.getElementById('edit-provider-id').value;
        const provider = {
            id: id || 'p-' + Date.now(),
            name: document.getElementById('provider-name').value,
            url: document.getElementById('provider-url').value,
            key: document.getElementById('provider-key').value,
            format: document.getElementById('provider-format').value,
            isDefault: document.getElementById('provider-default').checked
        };

        if (provider.isDefault) {
            this.providers.forEach(p => p.isDefault = false);
            this.activeProviderId = provider.id;
        }

        if (id) {
            const idx = this.providers.findIndex(p => p.id === id);
            this.providers[idx] = provider;
        } else {
            this.providers.push(provider);
        }

        this.save();
        this.renderList();
        this.editModal.classList.add('hidden');
    }

    renderList() {
        this.providerListEl.innerHTML = this.providers.map(p => `
            <div class="api-provider-item ${p.id === this.activeProviderId ? 'active' : ''}" onclick="apiManager.selectProvider('${p.id}')">
                <div class="provider-radio"></div>
                <div class="provider-info">
                    <div class="provider-name">${p.name} ${p.isDefault ? '<span class="provider-badge">默认</span>' : ''}</div>
                    <div class="provider-url">${p.url}</div>
                </div>
                <div class="provider-actions">
                    <button onclick="event.stopPropagation(); apiManager.showEdit('${p.id}')">✏️</button>
                    <button onclick="event.stopPropagation(); apiManager.deleteProvider('${p.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    selectProvider(id) { this.activeProviderId = id; this.save(); this.renderList(); }
    
    deleteProvider(id) {
        this.providers = this.providers.filter(p => p.id !== id);
        this.save(); this.renderList();
    }
}

// Initialize
const apiManager = new APIProviderManager();
```
