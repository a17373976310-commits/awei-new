console.log('App initializing...');

const RATIOS = [
    { label: '方图 1:1', value: '1:1', width: 1, height: 1 },
    { label: '横屏 4:3', value: '4:3', width: 4, height: 3 },
    { label: '竖屏 3:4', value: '3:4', width: 3, height: 4 },
    { label: '宽屏 16:9', value: '16:9', width: 16, height: 9 },
    { label: '竖屏 9:16', value: '9:16', width: 9, height: 16 },
];

class APIProviderManager {
    constructor(app) {
        this.app = app;
        this.providers = [];
        this.activeProviderId = null;

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
            try {
                this.providers = JSON.parse(saved);
                this.activeProviderId = localStorage.getItem('active_provider_id');
                if (!this.activeProviderId && this.providers.length > 0) {
                    this.activeProviderId = this.providers[0].id;
                }
            } catch (e) {
                console.error('Failed to load providers', e);
                this.providers = [];
            }
        }

        // Default provider if none exists
        if (this.providers.length === 0) {
            const defaultProvider = {
                id: 'default-' + Date.now(),
                name: 'bltcy',
                url: 'https://api.bltcy.ai/v1',
                key: '',
                format: 'openai',
                models: '所有',
                imgModels: 'nano-banana-2, nano-banana-2-2k, nano-banana-2-4k',
                isDefault: true
            };
            this.providers.push(defaultProvider);
            this.activeProviderId = defaultProvider.id;
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
        document.getElementById('finish-api-settings')?.addEventListener('click', () => this.hideSettings());
        document.getElementById('add-provider-btn')?.addEventListener('click', () => this.showEdit());
        document.getElementById('close-api-edit')?.addEventListener('click', () => this.hideEdit());
        document.getElementById('cancel-api-edit')?.addEventListener('click', () => this.hideEdit());

        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });
    }

    showSettings() {
        this.renderList();
        this.settingsModal.classList.remove('hidden');
    }

    hideSettings() {
        this.settingsModal.classList.add('hidden');
    }

    showEdit(providerId = null) {
        const title = document.getElementById('edit-modal-title');
        const idInput = document.getElementById('edit-provider-id');
        const nameInput = document.getElementById('provider-name');
        const urlInput = document.getElementById('provider-url');
        const keyInput = document.getElementById('provider-key');
        const modelsInput = document.getElementById('provider-models');
        const imgModelsInput = document.getElementById('provider-img-models');
        const formatInput = document.getElementById('provider-format');
        const defaultCheck = document.getElementById('provider-default');

        if (providerId) {
            const p = this.providers.find(x => x.id === providerId);
            title.textContent = '编辑提供商';
            idInput.value = p.id;
            nameInput.value = p.name;
            urlInput.value = p.url;
            keyInput.value = p.key;
            modelsInput.value = p.models;
            imgModelsInput.value = p.imgModels;
            if (formatInput) formatInput.value = p.format || 'openai';
            defaultCheck.checked = p.isDefault;
        } else {
            title.textContent = '添加提供商';
            idInput.value = '';
            this.form.reset();
        }

        this.editModal.classList.remove('hidden');
    }

    hideEdit() {
        this.editModal.classList.add('hidden');
    }

    handleSave() {
        const id = document.getElementById('edit-provider-id').value;
        const provider = {
            id: id || 'p-' + Date.now(),
            name: document.getElementById('provider-name').value,
            url: document.getElementById('provider-url').value,
            key: document.getElementById('provider-key').value,
            format: document.getElementById('provider-format').value,
            models: document.getElementById('provider-models').value,
            imgModels: document.getElementById('provider-img-models').value,
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
            if (this.providers.length === 1) this.activeProviderId = provider.id;
        }

        this.save();
        this.renderList();
        this.hideEdit();
    }

    deleteProvider(id) {
        if (confirm('确定要删除该提供商吗？')) {
            this.providers = this.providers.filter(p => p.id !== id);
            if (this.activeProviderId === id) {
                this.activeProviderId = this.providers.length > 0 ? this.providers[0].id : null;
            }
            this.save();
            this.renderList();
        }
    }

    selectProvider(id) {
        this.activeProviderId = id;
        this.save();
        this.renderList();
    }

    getActiveProvider() {
        return this.providers.find(p => p.id === this.activeProviderId) || this.providers[0];
    }

    renderList() {
        if (!this.providerListEl) return;
        this.providerListEl.innerHTML = this.providers.map(p => `
            <div class="api-provider-item ${p.id === this.activeProviderId ? 'active' : ''}" onclick="app.apiManager.selectProvider('${p.id}')">
                <div class="provider-radio"></div>
                <div class="provider-info">
                    <div class="provider-name">
                        ${p.name} 
                        ${p.isDefault ? '<span class="provider-badge">默认</span>' : ''}
                    </div>
                    <div class="provider-url">${p.url}</div>
                </div>
                <div class="provider-actions">
                    <button class="provider-action-btn" onclick="event.stopPropagation(); app.apiManager.showEdit('${p.id}')">✏️</button>
                    <button class="provider-action-btn" onclick="event.stopPropagation(); app.apiManager.deleteProvider('${p.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    }
}

class AIChatSidebar {
    constructor(app) {
        this.app = app;
        this.messages = [];
        this.visualDNA = localStorage.getItem('visual_dna_v2') || null;
        this.productIdentity = localStorage.getItem('product_identity_en') || null;
        this.thoughtSignature = null; // Store Gemini's thought signature for multi-turn
        this.isCollapsed = false;
        this.selectedImages = [];
        this.trackAImages = []; // Track A: Product appearance/angles
        this.trackBImages = []; // Track B: Functional/Logic/Environment
        this.lockedImages = []; // Array of { url, id }
        this.isTyping = false;
        this.mode = 'detail_page'; // Default to detail_page
        this.lastUploadContext = null;

        this.sidebarEl = document.getElementById('ai-sidebar');
        this.messagesEl = document.getElementById('chat-messages');
        this.inputEl = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-chat-btn');
        this.modelSelect = document.getElementById('reasoning-model-select');
        this.imageModelSelect = document.getElementById('image-model-select');
        this.groundingToggle = document.getElementById('grounding-toggle');
        this.groundingToggleParent = document.getElementById('grounding-toggle-parent');
        this.resetBtn = document.getElementById('reset-session-btn');
        
        // DNA Badge
        this.dnaBadgeContainer = document.getElementById('dna-badge-container');
        this.toggleBtn = document.getElementById('toggle-sidebar');
        this.floatToggleBtn = document.getElementById('open-sidebar-float-btn');

        // Chat Image Upload
        this.uploadBtn = document.getElementById('chat-upload-btn');
        this.fileInput = document.getElementById('chat-file-input');
        this.previewContainer = document.getElementById('image-preview-container');

        // Asset Vault (Dual Track)
        this.assetVaultEl = document.getElementById('asset-vault');
        this.trackAInput = document.getElementById('track-a-input');
        this.trackBInput = document.getElementById('track-b-input');
        this.trackAScroll = document.getElementById('track-a-scroll');
        this.trackBScroll = document.getElementById('track-b-scroll');
        this.addTrackABtn = document.getElementById('add-track-a');
        this.addTrackBBtn = document.getElementById('add-track-b');
        
        // Reference Library (Legacy - keeping for compatibility)
        this.referenceLibraryEl = document.getElementById('reference-library');
        this.refScrollEl = document.getElementById('ref-scroll');
        this.refCountEl = document.getElementById('ref-count');

        // Resizer
        this.resizerEl = document.getElementById('sidebar-resizer');
        this.isResizing = false;

        this.init();
        this.loadState(); // Load saved state
        this.initResizer();
        this.renderDNABadge();
    }

    loadState() {
        try {
            // Load Chat History
            const savedMessages = localStorage.getItem('sidebar_messages');
            if (savedMessages) {
                this.messages = JSON.parse(savedMessages);
                // Re-render messages
                this.messagesEl.innerHTML = ''; // Clear default welcome
                this.messages.forEach(msg => {
                   // We need to re-render the HTML for each message. 
                   // Since we store raw content in this.messages, we can reconstruct the UI.
                   // However, addMessage() expects new content. 
                   // Simpler approach: Store the HTML? No, unsafe.
                   // Better: Iterate and call addMessage logic, but we need to handle the "user" vs "ai" roles.
                   // Note: this.messages only stores {role, content}, not the images or proposals attached visually.
                   // To fully restore, we might need a more complex structure.
                   // For now, let's restore the text context for the AI, and try to restore visual elements if possible.
                   // Actually, let's look at how addMessage works. It appends to DOM and pushes to this.messages.
                   // If we reload, we want to see the chat history.
                   // Let's store a separate 'sidebar_ui_state' array with {role, content, images, timestamp, id}.
                });
                
                const uiState = JSON.parse(localStorage.getItem('sidebar_ui_state') || '[]');
                if (uiState.length > 0) {
                     this.messagesEl.innerHTML = '';
                     uiState.forEach(item => {
                         this.restoreMessageUI(item);
                     });
                     this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
                }
            }

            // Load Asset Vault
            const savedTrackA = localStorage.getItem('sidebar_track_a');
            if (savedTrackA) {
                this.trackAImages = JSON.parse(savedTrackA);
                this.renderTrackPreviews('A');
            }
            
            const savedTrackB = localStorage.getItem('sidebar_track_b');
            if (savedTrackB) {
                this.trackBImages = JSON.parse(savedTrackB);
                this.renderTrackPreviews('B');
            }

            // Load Thought Signature
            this.thoughtSignature = localStorage.getItem('sidebar_thought_signature');

        } catch (e) {
            console.error('Failed to load sidebar state', e);
        }
    }

    saveState() {
        try {
            // Save core context for AI
            localStorage.setItem('sidebar_messages', JSON.stringify(this.messages));
            
            // Save UI state
            const uiSnapshot = Array.from(this.messagesEl.children).map(div => {
                return {
                    id: div.id,
                    role: div.classList.contains('user') ? 'user' : (div.classList.contains('ai') ? 'ai' : 'system'),
                    html: div.innerHTML
                };
            });
            // Limit UI snapshot to last 20 messages to prevent quota issues
            const limitedSnapshot = uiSnapshot.slice(-20);
            localStorage.setItem('sidebar_ui_state', JSON.stringify(limitedSnapshot));
            
            localStorage.setItem('sidebar_track_a', JSON.stringify(this.trackAImages));
            localStorage.setItem('sidebar_track_b', JSON.stringify(this.trackBImages));
            if (this.thoughtSignature) localStorage.setItem('sidebar_thought_signature', this.thoughtSignature);
        } catch (e) {
            console.warn('Storage quota exceeded for sidebar state');
        }
    }
    
    restoreMessageUI(item) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${item.role}`;
        msgDiv.id = item.id;
        msgDiv.innerHTML = item.html; // This restores visual content
        this.messagesEl.appendChild(msgDiv);
        
        // Re-attach listeners
        // Lock buttons
        msgDiv.querySelectorAll('.lock-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => this.toggleImageLock(btn.dataset.url, btn.dataset.msgId));
        });
        
        // Proposal buttons
        msgDiv.querySelector('.confirm-btn')?.addEventListener('click', (e) => {
             const card = e.target.closest('.proposal-card');
             if (!card) return;
             const ratio = card.querySelector('.proposal-ratio').value;
             const prompt = decodeURIComponent(card.dataset.promptEnc || '');
             const thinkingLevel = card.dataset.thinkingLevel || 'medium';
             const identityRef = parseInt(card.dataset.identityRef || '0', 10);
             const logicRef = parseInt(card.dataset.logicRef || '0', 10);
             this.handleProposalConfirm(prompt, ratio, e.target, identityRef, logicRef, thinkingLevel);
        });

        // Sync Prompt buttons
        msgDiv.querySelector('.sync-prompt-btn')?.addEventListener('click', (e) => {
            const card = e.target.closest('.proposal-card');
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) {
                promptInput.value = decodeURIComponent(card.dataset.promptEnc || '');
                promptInput.dispatchEvent(new Event('input'));
                this.app.addLog('info', '📥 提示词已同步到指令区');
            }
        });

        // Ref selectors
        msgDiv.querySelector('.proposal-identity-ref')?.addEventListener('change', (e) => {
             const card = e.target.closest('.proposal-card');
             card.dataset.identityRef = e.target.value;
             // Update preview if possible (requires context, might be lost, but basic functionality remains)
        });
        msgDiv.querySelector('.proposal-logic-ref')?.addEventListener('change', (e) => {
             const card = e.target.closest('.proposal-card');
             card.dataset.logicRef = e.target.value;
        });
        
        // Toggle details
        msgDiv.querySelector('.toggle-prompt-btn')?.addEventListener('click', (e) => {
            const container = e.target.closest('.proposal-prompt-container');
            const promptEl = container.querySelector('.proposal-prompt');
            const isHidden = promptEl.classList.toggle('hidden');
            e.target.textContent = isHidden ? '显示详情' : '隐藏详情';
        });
    }

    init() {
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.inputEl.addEventListener('input', () => {
                this.inputEl.style.height = 'auto';
                this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
            });
        }

        // Mode Toggles
        this.modeChatBtn?.addEventListener('click', () => this.setMode('chat'));
        this.modeDetailBtn?.addEventListener('click', () => this.setMode('detail_page'));
        this.toggleBtn?.addEventListener('click', () => this.toggleSidebar());
        this.floatToggleBtn?.addEventListener('click', () => this.toggleSidebar());

        // Chat Image Upload Listeners
        this.uploadBtn?.addEventListener('click', () => this.fileInput.click());
        this.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));

        // Dual Track Uploads
        this.addTrackABtn?.addEventListener('click', () => this.trackAInput.click());
        this.trackAInput?.addEventListener('change', (e) => this.handleTrackUpload('A', e));
        this.addTrackBBtn?.addEventListener('click', () => this.trackBInput.click());
        this.trackBInput?.addEventListener('change', (e) => this.handleTrackUpload('B', e));

        this.resetBtn?.addEventListener('click', () => {
            if (confirm('确定要重置吗？这将清除对话历史、视觉 DNA 和所有生成痕迹，让 AI 彻底重置。')) {
                this.resetSession();
            }
        });

        // Paste Support
        this.inputEl?.addEventListener('paste', (e) => this.handlePaste(e));
    }

    setMode(mode) {
        this.mode = mode;
        this.modeChatBtn?.classList.toggle('active', mode === 'chat');
        this.modeDetailBtn?.classList.toggle('active', mode === 'detail_page');
        
        if (mode === 'detail_page') {
            this.addMessage('system', '✨ 已切换到 **详情页生成模式**。请输入产品信息，我将为您构建视觉 DNA。');
        }
    }

    renderDNABadge() {
        if (!this.dnaBadgeContainer) return;
        if (this.visualDNA) {
            this.dnaBadgeContainer.innerHTML = `
                <div class="dna-badge" id="dna-badge-trigger" title="点击查看视觉基因详情">
                    <div class="dot"></div>
                    <span>DNA V2</span>
                </div>
            `;
            document.getElementById('dna-badge-trigger')?.addEventListener('click', () => this.showDNADetails());
        } else {
            this.dnaBadgeContainer.innerHTML = '';
        }
    }

    showDNADetails() {
        const modalId = 'dna-details-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // V2 Formatter
        let formattedDNA = '';
        if (this.visualDNA) {
            const lines = this.visualDNA.split('\n');
            lines.forEach(line => {
                const match = line.match(/^\s*-\s*([^:]+):\s*(.*)/);
                if (match) {
                    const [_, key, value] = match;
                    const iconMap = {
                        'visual_concept': '🎨',
                        'product_identity': '📦',
                        'palette_main': '🔴',
                        'palette_accent': '✨',
                        'palette_background': '🖼️',
                        'typography': '🔠',
                        'lighting': '💡',
                        'tone': '🎭',
                        'slogan': '📢',
                        'text_layout': '📐',
                        'ui_elements': '📎'
                    };
                    const icon = iconMap[key.trim()] || '🔹';
                    const keyName = key.trim().replace(/_/g, ' ').toUpperCase();
                    formattedDNA += `
                        <div class="dna-item-v2">
                            <div class="dna-key-v2">${icon} ${keyName}</div>
                            <div class="dna-value-v2">${value.trim()}</div>
                        </div>
                    `;
                }
            });
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px; height: auto; max-height: 85vh;">
                <span class="close-modal">&times;</span>
                <div class="api-modal-header">
                    <h2>🧬 全局视觉基因锁 (Visual DNA V2)</h2>
                    <p>当前品牌视觉系统规范</p>
                </div>
                <div class="custom-scrollbar dna-v2-container">
                    ${formattedDNA || '<p style="text-align:center; padding: 2rem; opacity: 0.5;">暂无锁定 DNA V2</p>'}
                </div>
                <div class="form-actions" style="margin-top: 1.5rem; gap: 1rem; display: flex;">
                    <button class="save-btn" id="clear-session-btn" style="background: #ef4444; flex: 1;">清空并重置 DNA</button>
                    <button class="cancel-btn-alt" id="close-dna-modal" style="flex: 1;">关闭</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        
        const close = () => modal.classList.add('hidden');
        modal.querySelector('.close-modal').onclick = close;
        document.getElementById('close-dna-modal').onclick = close;
        document.getElementById('clear-session-btn').onclick = () => {
            if (confirm('确定要重置吗？这将清除对话历史、视觉 DNA 和所有生成痕迹。')) {
                this.resetSession();
                close();
            }
        };
    }

    resetSession() {
        this.messages = [];
        this.visualDNA = null;
        this.productIdentity = null;
        this.thoughtSignature = null;
        this.lastUploadContext = null;
        this.selectedImages = [];
        this.trackAImages = [];
        this.trackBImages = [];
        
        localStorage.removeItem('visual_dna_v2');
        localStorage.removeItem('product_identity_en');
        localStorage.removeItem('sidebar_messages');
        localStorage.removeItem('sidebar_ui_state');
        localStorage.removeItem('sidebar_track_a');
        localStorage.removeItem('sidebar_track_b');
        localStorage.removeItem('sidebar_thought_signature');
        
        this.messagesEl.innerHTML = '';
        this.renderDNABadge();
        this.renderTrackPreviews('A');
        this.renderTrackPreviews('B');
        this.renderImagePreviews();
        this.addMessage('system', '🧹 **会话已完全重置**。您可以重新开始对话了。');
        this.app.addLog('warning', '🔄 AI 上下文已手动重置');
    }

    async handleTrackUpload(track, e) {
        const files = Array.from(e.target.files);
        const targetList = track === 'A' ? this.trackAImages : this.trackBImages;
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const resized = await this.resizeImage(file);
                targetList.push(resized);
            }
        }
        this.renderTrackPreviews(track);
        this.saveState();
        if (track === 'A') this.trackAInput.value = '';
        else this.trackBInput.value = '';
    }

    renderTrackPreviews(track) {
        const targetScroll = track === 'A' ? this.trackAScroll : this.trackBScroll;
        const targetList = track === 'A' ? this.trackAImages : this.trackBImages;
        
        if (!targetScroll) return;
        
        targetScroll.innerHTML = targetList.map((img, index) => `
            <div class="track-item">
                <img src="${img.url}" alt="Track ${track}">
                <button class="remove-btn" onclick="app.aiChat.removeTrackImage('${track}', ${index})">&times;</button>
            </div>
        `).join('');
    }

    removeTrackImage(track, index) {
        const targetList = track === 'A' ? this.trackAImages : this.trackBImages;
        targetList.splice(index, 1);
        this.renderTrackPreviews(track);
    }

    initResizer() {
        if (!this.resizerEl || !this.sidebarEl) return;

        let savedWidth = parseInt(localStorage.getItem('sidebar_width')) || 400;
        this.sidebarEl.style.width = `${savedWidth}px`;
        document.documentElement.style.setProperty('--sidebar-width', `${savedWidth}px`);

        this.resizerEl.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.resizerEl.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 300) newWidth = 300;
            if (newWidth > 700) newWidth = 700;
            this.sidebarEl.style.width = `${newWidth}px`;
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
            localStorage.setItem('sidebar_width', newWidth);
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                this.resizerEl.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    async resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
                        resolve({ file: resizedFile, url: canvas.toDataURL('image/jpeg', quality) });
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async handleFileSelect(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const resized = await this.resizeImage(file);
                this.selectedImages.push(resized);
                this.renderImagePreviews();
            }
        }
        this.fileInput.value = '';
    }

    renderImagePreviews() {
        if (this.selectedImages.length === 0) {
            this.previewContainer.classList.add('hidden');
            this.previewContainer.innerHTML = '';
            return;
        }
        this.previewContainer.classList.remove('hidden');
        this.previewContainer.innerHTML = this.selectedImages.map((img, index) => `
            <div class="chat-preview-item">
                <img src="${img.url}" alt="Preview">
                <button class="remove-preview" onclick="app.aiChat.removeImage(${index})">&times;</button>
            </div>
        `).join('');
    }

    removeImage(index) {
        this.selectedImages.splice(index, 1);
        this.renderImagePreviews();
    }

    toggleImageLock(url, id) {
        const index = this.lockedImages.findIndex(img => img.url === url && img.id === id);
        if (index > -1) {
            this.lockedImages.splice(index, 1);
        } else {
            this.lockedImages.push({ url, id });
        }
        this.updateReferenceLibrary();
        this.updateLockedVisuals();
    }

    updateReferenceLibrary() {
        if (!this.referenceLibraryEl || !this.refScrollEl) return;
        
        const count = this.lockedImages.length;
        this.refCountEl.textContent = count;
        this.referenceLibraryEl.classList.toggle('active', count > 0);
        
        this.refScrollEl.innerHTML = this.lockedImages.map((img, i) => `
            <div class="ref-item locked" data-id="${img.id}">
                <img src="${img.url}" loading="lazy" />
                <div class="ref-popover"><img src="${img.url}" loading="lazy" /></div>
                <div class="lock-tag">REF</div>
                <button class="remove-btn" onclick="app.aiChat.removeRef(${i})">×</button>
            </div>
        `).join('');
    }

    removeRef(index) {
        this.lockedImages.splice(index, 1);
        this.updateReferenceLibrary();
        this.updateLockedVisuals();
    }

    updateLockedVisuals() {
        const allImages = this.messagesEl.querySelectorAll('.chat-history-image');
        allImages.forEach(img => {
            const id = img.dataset.msgId;
            const url = img.src;
            const isLocked = this.lockedImages.some(li => li.url === url && li.id === id);
            img.classList.toggle('locked', isLocked);
            
            const btn = img.parentElement.querySelector('.lock-toggle-btn');
            if (btn) {
                btn.classList.toggle('active', isLocked);
                btn.textContent = isLocked ? '🔒' : '🔓';
            }
        });
    }

    async handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                const resized = await this.resizeImage(file);
                this.selectedImages.push(resized);
                this.renderImagePreviews();
            }
        }
    }

    async sendMessage() {
        const text = this.inputEl.value.trim();
        if (!text && this.selectedImages.length === 0 && this.trackAImages.length === 0 && this.trackBImages.length === 0) return;

        this.inputEl.value = '';
        this.inputEl.style.height = 'auto';
        
        // Combine all images for display in the chat bubble
        const allImagesForDisplay = [...this.selectedImages, ...this.trackAImages, ...this.trackBImages];
        const userMsgId = this.addMessage('user', text, false, allImagesForDisplay);
        
        this.lastUploadContext = { 
            userMsgId, 
            urls: allImagesForDisplay.map(i => i.url),
            trackA: this.trackAImages.map(i => i.url),
            trackB: this.trackBImages.map(i => i.url)
        };
        this.messages.push({ role: 'user', content: text });

        const typingId = this.addMessage('ai', '正在思考...', true);

        // Auto-lock user images (general ones)
        this.selectedImages.forEach(imgData => {
            this.toggleImageLock(imgData.url, userMsgId);
        });

        try {
            const activeProvider = this.app.apiManager.getActiveProvider();
            const formData = new FormData();
            formData.append('messages', JSON.stringify(this.messages));
            formData.append('mode', this.mode);
            if (this.visualDNA) formData.append('visual_dna', this.visualDNA);
            if (this.productIdentity) formData.append('product_identity', this.productIdentity);
            if (this.modelSelect) formData.append('model', this.modelSelect.value);
            if (this.imageModelSelect) formData.append('image_model', this.imageModelSelect.value);
            if (this.thoughtSignature) formData.append('thought_signature', this.thoughtSignature);
            if (this.groundingToggle?.checked) formData.append('grounding', 'true');

            // Append images by category
            this.selectedImages.forEach(img => formData.append('image', img.file));
            this.trackAImages.forEach(img => formData.append('track_a', img.file));
            this.trackBImages.forEach(img => formData.append('track_b', img.file));
            
            // Reference Images Logic
            let refImagesToSend = [];
            const selectedUrls = new Set(allImagesForDisplay.map(img => img.url));

            if (this.lockedImages.length > 0) {
                refImagesToSend = this.lockedImages.filter(img => !selectedUrls.has(img.url)).map(img => img.url);
            } else {
                const allHistoryImages = Array.from(this.messagesEl.querySelectorAll('.chat-history-image')).map(img => img.src);
                refImagesToSend = [...new Set(allHistoryImages)].filter(url => !selectedUrls.has(url));
                if (refImagesToSend.length > 0) {
                    this.updateAutoRefFeedback(refImagesToSend);
                }
            }

            if (refImagesToSend.length > 0) {
                formData.append('reference_images', JSON.stringify(refImagesToSend));
            }

            if (activeProvider) {
                formData.append('api_key', activeProvider.key);
                formData.append('api_url', activeProvider.url);
            }

            const controller = new AbortController();
            // Increase timeout to 300s (5 minutes) to handle slow AI responses/network issues
            const timeoutId = setTimeout(() => controller.abort(), 300000);
            const response = await fetch('/api/chat', { method: 'POST', body: formData, signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                // Try to parse error text as JSON if possible
                try {
                    const errJson = JSON.parse(errText);
                    if (errJson.detail) throw new Error(errJson.detail);
                } catch (e) {
                    // Ignore JSON parse error
                }
                throw new Error(errText || `API Error (${response.status})`);
            }

            const data = await response.json();
            this.removeMessage(typingId);
            this.thoughtSignature = data.thought_signature || null;
            this.processAIResponse(data.response);
            this.messages.push({ role: 'assistant', content: data.response });
            
            // Clear all temp images
            this.selectedImages = [];
            this.trackAImages = [];
            this.trackBImages = [];
            this.renderImagePreviews();
            this.renderTrackPreviews('A');
            this.renderTrackPreviews('B');

        } catch (error) {
            this.removeMessage(typingId);
            const msg = error?.name === 'AbortError'
                ? '请求超时（65秒）。请检查网络或稍后重试。'
                : (error?.message ? `请求失败：${error.message}` : '抱歉，服务暂时不可用。');
            this.addMessage('system', msg);
        }
    }

    addMessage(role, content, isTyping = false, images = []) {
        const id = 'msg-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.id = id;

        let renderedContent = content;
        if (role === 'assistant') {
            renderedContent = content
                .replace(/\[VISUAL_DNA_V2\][\s\S]*?\[\/VISUAL_DNA_V2\]/g, '')
                .replace(/\[GENERATE_IMAGE\][\s\S]*?\[\/GENERATE_IMAGE\]/g, '')
                .replace(/\[PROPOSAL\][\s\S]*?\[\/PROPOSAL\]/g, '');
            if (typeof marked !== 'undefined') renderedContent = marked.parse(renderedContent);
        }

        let imagesHtml = images.map(img => `
            <div class="image-wrapper">
                <img src="${img.url}" class="chat-history-image" data-msg-id="${id}" loading="lazy" />
                <button class="lock-toggle-btn" data-url="${img.url}" data-msg-id="${id}">🔓</button>
            </div>
        `).join('');

        // Parse Proposals (New JSON Format)
        let proposalHtml = '';
        
        // Try to parse JSON output from Director Agent
        try {
            // Find JSON block in content if mixed with text
            const jsonMatch = content.match(/\{[\s\S]*"proposal"[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.proposal) {
                    const p = data.proposal;

                    // Priority Assessment Logic
                    const priority = data.analysis?.priority_assessment;
                    let priorityHtml = '';
                    if (priority) {
                        const modeLabel = priority.mode === 'quality_first' ? '✨ 质量优先' : '⚡ 速度优先';
                        const focusLabel = priority.focus === 'visual_fidelity' ? '视觉还原' : '创意探索';
                        const modeClass = priority.mode === 'quality_first' ? 'quality' : 'speed';
                        priorityHtml = `
                            <div class="priority-badge-container">
                                <span class="priority-badge ${modeClass}">${modeLabel}</span>
                                <span class="priority-badge focus">${focusLabel}</span>
                            </div>
                        `;
                    }

                    if (data.analysis?.visual_dna_v2) {
                        this.visualDNA = String(data.analysis.visual_dna_v2 || '').trim() || null;
                        if (this.visualDNA) localStorage.setItem('visual_dna_v2', this.visualDNA);
                        this.renderDNABadge();
                    }
                    if (data.analysis?.product_identity_en) {
                        this.productIdentity = String(data.analysis.product_identity_en || '').trim() || null;
                        if (this.productIdentity) localStorage.setItem('product_identity_en', this.productIdentity);
                    }
                    
                    // Asset Preview
                    let assetHtml = '';
                    if (this.lastUploadContext) {
                        const idIdx = Number.isInteger(p.identity_ref) ? p.identity_ref : (Number.isInteger(p.selected_asset_index) ? p.selected_asset_index : 0);
                        const lgIdx = Number.isInteger(p.logic_ref) ? p.logic_ref : 0;
                        
                        const idUrl = this.lastUploadContext.trackA?.[idIdx] || '';
                        const lgUrl = this.lastUploadContext.trackB?.[lgIdx] || '';
                        
                        assetHtml = `
                            <div class="proposal-asset-refs">
                                <div class="proposal-asset-tag" title="外观参考 (Track A)">
                                    <span>📸 外观: #${idIdx + 1}</span>
                                    ${idUrl ? `<img class="proposal-subject-thumb" src="${idUrl}" loading="lazy" />` : ''}
                                </div>
                                <div class="proposal-asset-tag logic" title="逻辑参考 (Track B)">
                                    <span>💡 逻辑: #${lgIdx + 1}</span>
                                    ${lgUrl ? `<img class="proposal-subject-thumb" src="${lgUrl}" loading="lazy" />` : ''}
                                </div>
                            </div>
                        `;
                    }

                    const trackAUrls = this.lastUploadContext?.trackA || [];
                    const trackBUrls = this.lastUploadContext?.trackB || [];
                    
                    const idSelectHtml = trackAUrls.length > 0
                        ? `
                            <select class="proposal-identity-ref mini-selector" title="选择外观参考图 (Track A)">
                                ${trackAUrls.map((_, idx) => `<option value="${idx}" ${ (Number.isInteger(p.identity_ref) ? p.identity_ref : p.selected_asset_index) === idx ? 'selected' : ''}>外观: #${idx + 1}</option>`).join('')}
                            </select>
                        `
                        : '';
                    
                    const lgSelectHtml = trackBUrls.length > 0
                        ? `
                            <select class="proposal-logic-ref mini-selector" title="选择逻辑参考图 (Track B)">
                                ${trackBUrls.map((_, idx) => `<option value="${idx}" ${p.logic_ref === idx ? 'selected' : ''}>逻辑: #${idx + 1}</option>`).join('')}
                            </select>
                        `
                        : '';

                    const copyL3 = Array.isArray(p.copywriting?.L3)
                        ? p.copywriting.L3
                        : (typeof p.copywriting?.L3 === 'string' ? p.copywriting.L3.split('|').map(s => s.trim()).filter(Boolean) : []);
                    const copyTagsHtml = copyL3.length > 0
                        ? `<div class="copy-tags">${copyL3.map(t => `<span class="copy-tag">${t}</span>`).join('')}</div>`
                        : '';
                    const copyL1 = typeof p.copywriting?.L1 === 'string' ? p.copywriting.L1 : '';
                    const copyL2 = typeof p.copywriting?.L2 === 'string' ? p.copywriting.L2 : '';

                    const finalPrompt = this.buildFinalPrompt(p);
                    const promptEnc = encodeURIComponent(finalPrompt);
                    const thinkingLevel = p.thinking_level || data.analysis?.thinking_level || 'medium';

                    proposalHtml = `
                        <div class="proposal-card" 
                             data-prompt-enc="${promptEnc}" 
                             data-ratio="${p.ratio}" 
                             data-thinking-level="${thinkingLevel}" 
                             data-identity-ref="${Number.isInteger(p.identity_ref) ? p.identity_ref : (Number.isInteger(p.selected_asset_index) ? p.selected_asset_index : 0)}"
                             data-logic-ref="${Number.isInteger(p.logic_ref) ? p.logic_ref : 0}">
                            <div class="proposal-header-row">
                                <div class="proposal-title">
                                    <span>🎨 ${p.module_name}</span>
                                </div>
                                ${priorityHtml}
                            </div>
                            
                            ${assetHtml}
                            
                            <div class="proposal-prompt-container">
                                <div class="proposal-prompt-header">
                                    <span>⚙️ 技术提示词 (Technical Details)</span>
                                    <button class="toggle-prompt-btn">显示详情</button>
                                </div>
                                <div class="proposal-prompt hidden">${finalPrompt}</div>
                                <button class="sync-prompt-btn" title="同步到指令区">📥</button>
                            </div>

                            <div class="proposal-copy-preview">
                                <div class="copy-line l1">${copyL1}</div>
                                <div class="copy-line l2">${copyL2}</div>
                                ${copyTagsHtml}
                            </div>

                            <div class="proposal-actions">
                                <div class="ref-selectors">
                                    ${idSelectHtml}
                                    ${lgSelectHtml}
                                </div>
                                <div class="main-actions">
                                    <select class="proposal-ratio mini-selector">
                                        <option value="3:4" ${p.ratio === '3:4' ? 'selected' : ''}>3:4 竖屏</option>
                                        <option value="4:3" ${p.ratio === '4:3' ? 'selected' : ''}>4:3 横屏</option>
                                        <option value="1:1" ${p.ratio === '1:1' ? 'selected' : ''}>1:1 正方形</option>
                                    </select>
                                    <button class="confirm-btn amber">确认并生成</button>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Hide the raw JSON from user view
                    renderedContent = renderedContent.replace(jsonMatch[0], '');
                }
            }
        } catch (e) {
            console.warn('Failed to parse Director JSON:', e);
            // Fallback to old regex parsing
        }

        // Fallback: Old Regex Parsing
        if (!proposalHtml) {
            const genMatch = content.match(/\[GENERATE_IMAGE\]([\s\S]*?)\[\/GENERATE_IMAGE\]/);
            if (genMatch) {
                const block = genMatch[1];
                const params = {};
                const keys = ['prompt', 'module', 'ratio', 'copy', 'userImage'];
                keys.forEach(key => {
                    const regex = new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n\\w+:|$)`, 'i');
                    const match = block.match(regex);
                    if (match) params[key] = match[1].trim();
                });
                
                const finalPrompt = params.prompt || '';
                const promptEnc = encodeURIComponent(finalPrompt);

                proposalHtml = `
                    <div class="proposal-card" data-prompt-enc="${promptEnc}" data-ratio="${params.ratio || '3:4'}" data-thinking-level="medium">
                        <div class="proposal-title">🎨 设计提案: ${params.module || '新模块'}</div>
                        <div class="proposal-prompt-container">
                            <div class="proposal-prompt">${finalPrompt.substring(0, 100)}${finalPrompt.length > 100 ? '...' : ''}</div>
                            <button class="sync-prompt-btn" title="同步到指令区">📥</button>
                        </div>
                        <div class="proposal-actions">
                            <select class="proposal-ratio mini-selector">
                                <option value="3:4" ${params.ratio === '3:4' ? 'selected' : ''}>3:4 竖屏</option>
                                <option value="4:3" ${params.ratio === '4:3' ? 'selected' : ''}>4:3 横屏</option>
                                <option value="1:1" ${params.ratio === '1:1' ? 'selected' : ''}>1:1 正方形</option>
                            </select>
                            <button class="confirm-btn amber">确认并生成</button>
                        </div>
                    </div>
                `;
            }
        }

        msgDiv.innerHTML = `
            <div class="message-content markdown-body">
                ${renderedContent}
                ${imagesHtml}
                ${proposalHtml}
            </div>
        `;
        this.messagesEl.appendChild(msgDiv);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // Listeners
        msgDiv.querySelectorAll('.lock-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => this.toggleImageLock(btn.dataset.url, btn.dataset.msgId));
        });
        msgDiv.querySelector('.confirm-btn')?.addEventListener('click', (e) => {
            const card = e.target.closest('.proposal-card');
            const ratio = card.querySelector('.proposal-ratio').value;
            const prompt = decodeURIComponent(card.dataset.promptEnc || '');
            const thinkingLevel = card.dataset.thinkingLevel || 'medium';
            const identityRef = parseInt(card.dataset.identityRef || '0', 10);
            const logicRef = parseInt(card.dataset.logicRef || '0', 10);
            
            this.handleProposalConfirm(prompt, ratio, e.target, identityRef, logicRef, thinkingLevel);
        });
        msgDiv.querySelector('.sync-prompt-btn')?.addEventListener('click', (e) => {
            const card = e.target.closest('.proposal-card');
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) {
                promptInput.value = decodeURIComponent(card.dataset.promptEnc || '');
                promptInput.dispatchEvent(new Event('input'));
                this.app.addLog('info', '📥 提示词已同步到指令区', '您可以继续修改或点击“应用编辑”生成');
            }
        });
        msgDiv.querySelector('.proposal-identity-ref')?.addEventListener('change', (e) => {
            const card = e.target.closest('.proposal-card');
            const idx = parseInt(e.target.value || '0', 10);
            card.dataset.identityRef = String(idx);
            const thumb = card.querySelector('.proposal-asset-tag:not(.logic) .proposal-subject-thumb');
            const label = card.querySelector('.proposal-asset-tag:not(.logic) span');
            if (label) label.textContent = `📸 外观: #${idx + 1}`;
            if (thumb && this.lastUploadContext?.trackA?.[idx]) {
                thumb.src = this.lastUploadContext.trackA[idx];
            }
        });
        msgDiv.querySelector('.proposal-logic-ref')?.addEventListener('change', (e) => {
            const card = e.target.closest('.proposal-card');
            const idx = parseInt(e.target.value || '0', 10);
            card.dataset.logicRef = String(idx);
            const thumb = card.querySelector('.proposal-asset-tag.logic .proposal-subject-thumb');
            const label = card.querySelector('.proposal-asset-tag.logic span');
            if (label) label.textContent = `� 逻辑: #${idx + 1}`;
            if (thumb && this.lastUploadContext?.trackB?.[idx]) {
                thumb.src = this.lastUploadContext.trackB[idx];
            }
        });

        msgDiv.querySelector('.toggle-prompt-btn')?.addEventListener('click', (e) => {
            const container = e.target.closest('.proposal-prompt-container');
            const promptEl = container.querySelector('.proposal-prompt');
            const isHidden = promptEl.classList.toggle('hidden');
            e.target.textContent = isHidden ? '显示详情' : '隐藏详情';
        });

        return id;
    }

    buildFinalPrompt(p) {
        const base = typeof p?.prompt === 'string' ? p.prompt.trim() : '';
        const copy = p?.copywriting || {};
        const l1 = typeof copy?.L1 === 'string' ? copy.L1.trim() : '';
        const l2 = typeof copy?.L2 === 'string' ? copy.L2.trim() : '';
        const l3 = Array.isArray(copy?.L3)
            ? copy.L3.map(s => String(s).trim()).filter(Boolean)
            : (typeof copy?.L3 === 'string' ? copy.L3.split('|').map(s => s.trim()).filter(Boolean) : []);

        const parts = [];
        if (base) parts.push(base);

        if (l1 || l2 || l3.length > 0) {
            const l3Text = l3.length > 0 ? l3.join(' | ') : '';
            parts.push(
                [
                    '[Text & Layout Content]',
                    `L1(Main Title): ${l1}`,
                    `L2(Sub Title): ${l2}`,
                    `L3(Feature Tags): ${l3Text}`
                ].join('\n')
            );
        }

        // DNA V2 Brand System Injection
        if (this.visualDNA) {
            const dna = String(this.visualDNA);
            const extract = (key) => {
                const regex = new RegExp(`^\\s*-\\s*${key}:\\s*(.*)`, 'm');
                return dna.match(regex)?.[1]?.trim() || '';
            };

            const brandSpecs = [
                '[BRAND VISUAL SYSTEM V2]',
                `Visual Concept: ${extract('visual_concept')}`,
                `Palette: Main=${extract('palette_main')}, Accent=${extract('palette_accent')}, Background=${extract('palette_background')}`,
                `Typography System: ${extract('typography')}`,
                `Text Layout Logic: ${extract('text_layout')}`,
                `UI & Decorative Elements: ${extract('ui_elements')}`,
                `Lighting & Tone: ${extract('lighting')} | ${extract('tone')}`
            ].filter(s => !s.endsWith('=') && !s.endsWith(': '));

            if (brandSpecs.length > 1) parts.push(brandSpecs.join('\n'));
        }

        return parts.join('\n\n').trim();
    }

    async handleProposalConfirm(prompt, ratio, btn, identityRef = 0, logicRef = 0, thinkingLevel = 'medium') {
        btn.disabled = true;
        btn.textContent = '正在生成...';
        try {
            // 1. Sync Prompt
            const promptInput = document.getElementById('prompt-input');
            if (promptInput) {
                promptInput.value = prompt;
                promptInput.dispatchEvent(new Event('input')); 
            }

            // 2. Sync Ratio
            const ratioBtn = Array.from(document.querySelectorAll('.ratio-btn')).find(b => b.dataset.value === ratio);
            if (ratioBtn) ratioBtn.click();

            // 3. Collect images for workspace (Strategic Reordering)
            const trackA = this.lastUploadContext?.trackA || [];
            const trackB = this.lastUploadContext?.trackB || [];
            
            // Strategy: ALL Track A (for consistency) + SELECTED Track B (for logic)
            const finalImages = [];
            
            // Add all Track A images first
            trackA.forEach(u => { if (u) finalImages.push(u); });
            
            // Add the SPECIFIC logic image from Track B
            const selectedLogicImg = trackB[logicRef];
            if (selectedLogicImg) finalImages.push(selectedLogicImg);
            
            // Calculate new indices for the generation request
            // Identity starts at 0, Logic is now at the end of Track A
            // FIX: Use the selected identityRef if valid, otherwise default to 0
            const newIdentityRef = (Number.isInteger(identityRef) && identityRef >= 0 && identityRef < trackA.length) 
                ? identityRef 
                : 0;
            const newLogicRef = trackA.length;

            if (finalImages.length > 0) {
                this.app.uploadedImages = [...new Set(finalImages)];
                this.app.renderGallery();
                // Select the best identity shot (the one AI originally picked)
                this.app.selectImage(newIdentityRef);
                this.app.addLog('info', '📌 工作区已就绪', `同步外观图: ${trackA.length}张, 逻辑图: #${logicRef+1}`);
            }

            // 4. Trigger Generation with precise multi-image context
            await this.app.handleGeneration({ 
                thinking_level: thinkingLevel, 
                thought_signature: this.thoughtSignature,
                identity_ref: newIdentityRef,
                logic_ref: newLogicRef
            });
            btn.textContent = '已生成 ✅';
        } catch (e) {
            console.error('Proposal confirmation failed:', e);
            btn.disabled = false;
            btn.textContent = '重试';
        }
    }

    processAIResponse(content) {
        const dnaMatch = content.match(/\[VISUAL_DNA_V2\]([\s\S]*?)\[\/VISUAL_DNA_V2\]/);
        if (dnaMatch) {
            this.visualDNA = dnaMatch[1].trim();
            localStorage.setItem('visual_dna_v2', this.visualDNA);
            this.renderDNABadge();
            this.addMessage('system', '🧬 **视觉 DNA 已锁定**。后续生成将严格遵循此风格规范。');
        }
        this.addMessage('ai', content);
    }

    updateAutoRefFeedback(urls) {
        if (!this.referenceLibraryEl || !this.refScrollEl) return;
        
        // Only show auto-refs if no manual locks exist
        if (this.lockedImages.length > 0) return;

        this.refCountEl.textContent = `${urls.length} (自动)`;
        this.referenceLibraryEl.classList.add('active');
        this.referenceLibraryEl.style.borderTopColor = 'rgba(99, 102, 241, 0.3)';
        
        this.refScrollEl.innerHTML = urls.map((url, i) => `
            <div class="ref-item" style="opacity: 0.7; border-style: dashed; border-color: var(--text-muted);">
                <img src="${url}" loading="lazy" />
                <div class="ref-popover"><img src="${url}" loading="lazy" /></div>
                <div class="lock-tag" style="background: var(--text-muted);">AUTO</div>
            </div>
        `).join('');
    }

    removeMessage(id) {
        document.getElementById(id)?.remove();
    }

    toggleSidebar() {
        this.isCollapsed = !this.isCollapsed;
        this.sidebarEl.classList.toggle('collapsed', this.isCollapsed);
        const icon = this.toggleBtn.querySelector('.icon');
        if (icon) icon.textContent = this.isCollapsed ? '➡️' : '⬅️';
        
        // Also hide/show the resizer
        const resizer = document.getElementById('sidebar-resizer');
        if (resizer) resizer.style.display = this.isCollapsed ? 'none' : 'block';

        // Toggle Floating Button
        if (this.floatToggleBtn) {
            if (this.isCollapsed) {
                this.floatToggleBtn.classList.remove('hidden');
            } else {
                this.floatToggleBtn.classList.add('hidden');
            }
        }
    }
}

class App {
    constructor() {
        this.currentMode = 'txt2img';
        this.selectedRatio = RATIOS[1]; // Default to 4:3 (Horizontal)
        this.selectedScenario = 'free_mode';
        this.uploadedImages = [];
        this.activeImageIndex = -1;
        this.uploadedImage = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.history = [];
        this.logs = [];
        this.currentController = null;  // 添加: 跟踪当前任务的AbortController
        this.currentTimerInterval = null;  // 添加: 跟踪当前计时器

        this.loadHistory();
        this.initTabs();
        this.initRatios();
        this.initScenario();
        this.initUpload();
        this.initGeneration();
        this.initCancelButton();  // 添加: 初始化取消按钮
        this.initHistory();
        this.renderHistory();
        this.initLogPanel();
        console.log('Initializing APIProviderManager...');
        this.apiManager = new APIProviderManager(this);
        console.log('Initializing AIChatSidebar...');
        this.aiChat = new AIChatSidebar(this);
        console.log('AIChatSidebar initialized:', this.aiChat);
    }

    loadHistory() {
        const saved = localStorage.getItem('banana_history');
        if (saved) {
            try {
                this.history = JSON.parse(saved).slice(0, 4);
            } catch (e) {
                console.error('Failed to load history', e);
                this.history = [];
            }
        }
    }

    addToHistory(item) {
        if (!item) return;

        // Ensure item has an ID
        if (!item.id) {
            item.id = item.timestamp || Date.now().toString();
        }

        // Avoid duplicates
        if (this.history.find(h => h.id === item.id)) return;

        this.history.unshift(item);
        // Limit history to 4 items
        if (this.history.length > 4) this.history = this.history.slice(0, 4);

        this.saveHistory();
        this.renderHistory();
    }

    saveHistory() {
        try {
            localStorage.setItem('banana_history', JSON.stringify(this.history));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                console.warn('LocalStorage quota exceeded. Trimming history...');
                while (this.history.length > 0) {
                    this.history.pop();
                    try {
                        localStorage.setItem('banana_history', JSON.stringify(this.history));
                        break;
                    } catch (e2) { }
                }
            } else {
                console.error('Failed to save history', e);
            }
        }
    }

    renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) {
            console.warn('History container not found');
            return;
        }

        if (this.history.length === 0) {
            container.innerHTML = '<div class="history-empty">你的生成历史将显示在这里</div>';
            return;
        }

        console.log('Rendering history with', this.history.length, 'items');
        container.innerHTML = this.history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <img src="${item.url}" alt="Generated Image" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%23333%22/><text x=%2250%%22 y=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2212%22>加载失败</text></svg>'">
            </div>
        `).join('');

        const historyItems = container.querySelectorAll('.history-item');
        console.log('Found', historyItems.length, 'history items to attach listeners to');

        historyItems.forEach((el, index) => {
            el.addEventListener('click', () => {
                console.log('History item clicked:', el.dataset.id);
                const id = el.dataset.id;
                const item = this.history.find(i => String(i.id) === String(id));
                console.log('Found item:', item);
                if (item) {
                    this.openModal(item);
                } else {
                    console.error('Item not found in history for id:', id);
                }
            });
            console.log(`Attached click listener to history item ${index}:`, el.dataset.id);
        });
    }

    openModal(item) {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-image');
        const modalPrompt = document.getElementById('modal-prompt');
        const modalOptimized = document.getElementById('modal-optimized-prompt');
        const modalOriginalGroup = document.getElementById('modal-original-image-group');
        // Use querySelector within the modal to get the correct close button
        const closeBtn = modal?.querySelector('.close-modal');

        if (!modal) {
            console.error('Image modal not found');
            return;
        }

        console.log('Opening modal for item:', item);
        modalImg.src = item.url;
        modalPrompt.textContent = item.original_prompt || item.prompt || '无';

        const optimizedGroup = document.getElementById('modal-optimized-group');
        if (item.optimized_prompt || item.optimizedPrompt) {
            optimizedGroup.classList.remove('hidden');
            modalOptimized.textContent = item.optimized_prompt || item.optimizedPrompt;
        } else {
            optimizedGroup.classList.add('hidden');
        }

        if (item.original_images && item.original_images.length > 0) {
            modalOriginalGroup.classList.remove('hidden');

            let gallery = modalOriginalGroup.querySelector('.modal-original-gallery');
            if (!gallery) {
                gallery = document.createElement('div');
                gallery.className = 'modal-original-gallery';
                modalOriginalGroup.appendChild(gallery);
            }

            gallery.innerHTML = item.original_images.map(src => `
                <img src="${src}" class="modal-gallery-thumb" onclick="window.open('${src}', '_blank')">
            `).join('');
        } else {
            modalOriginalGroup.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        console.log('Modal opened successfully');
        this.enableZoomPan(modalImg, document.querySelector('.modal-image-container'));

        const close = () => {
            modal.classList.add('hidden');
            modalImg.style.transform = 'translate(0px, 0px) scale(1)';
            console.log('Modal closed');
        };

        if (closeBtn) {
            closeBtn.onclick = close;
        } else {
            console.warn('Close button not found in modal');
        }
        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }

    enableZoomPan(imgElement, containerElement) {
        if (!imgElement || !containerElement) return;

        let scale = 1;
        let panning = false;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;

        imgElement.style.transform = 'translate(0px, 0px) scale(1)';

        const setTransform = () => {
            imgElement.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        };

        containerElement.onwheel = (e) => {
            e.preventDefault();
            const delta = -e.deltaY;
            (delta > 0) ? (scale *= 1.1) : (scale /= 1.1);
            scale = Math.min(Math.max(0.5, scale), 5);
            setTransform();
        };

        imgElement.onmousedown = (e) => {
            e.preventDefault();
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            panning = true;
        };

        document.onmouseup = () => {
            panning = false;
        };

        document.onmousemove = (e) => {
            if (!panning) return;
            e.preventDefault();
            pointX = e.clientX - startX;
            pointY = e.clientY - startY;
            setTransform();
        };
    }

    showPreview(url) {
        const container = document.getElementById('preview-container');
        if (container) {
            if (!url) {
                container.innerHTML = '<div style="color: #ff4d4d; padding: 20px;">未找到图像 URL</div>';
                return;
            }
            container.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\'color: #ff4d4d; padding: 20px;\'>图像加载失败，请检查网络或刷新页面</div>';">`;
            const img = container.querySelector('img');
            if (img) {
                this.enableZoomPan(img, container);
            }
        }
    }

    initTabs() {
        const btnImg = document.getElementById('btn-img2img');
        const groupImage = document.getElementById('group-image');
        const groupScenario = document.getElementById('group-scenario');

        // Default to img2img mode since other tabs are removed
        this.currentMode = 'img2img';
        btnImg?.classList.add('active');
        groupImage?.classList.remove('hidden');
        groupScenario?.classList.remove('hidden');
    }

    initRatios() {
        const grid = document.getElementById('ratio-grid');
        if (!grid) return;
        grid.innerHTML = RATIOS.map(r => `
            <div class="ratio-btn ${r.value === this.selectedRatio.value ? 'active' : ''}" data-value="${r.value}">
                <div class="ratio-preview" style="width: ${r.width * 4}px; height: ${r.height * 4}px"></div>
                <span>${r.label}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                grid.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedRatio = RATIOS.find(r => r.value === btn.dataset.value);
            });
        });
    }

    initScenario() {
        const mainBtns = document.querySelectorAll('.scenario-selector > .scenario-btn:not(.sub-btn)');
        const subContainer = document.getElementById('sub-scenario-container');
        const subBtns = subContainer?.querySelectorAll('.sub-btn');

        this.selectedScenario = 'free_mode';

        mainBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const val = target.dataset.value;

                mainBtns.forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                if (val === 'ecommerce') {
                    subContainer?.classList.remove('hidden');
                    const activeSub = subContainer?.querySelector('.sub-btn.active') || subBtns?.[0];
                    if (activeSub) {
                        this.selectedScenario = activeSub.dataset.value;
                        subBtns?.forEach(b => b.classList.remove('active'));
                        activeSub.classList.add('active');
                    }
                } else {
                    subContainer?.classList.add('hidden');
                    this.selectedScenario = val;
                }
            });
        });

        subBtns?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                subBtns.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                this.selectedScenario = target.dataset.value;
            });
        });
    }

    initUpload() {
        const dropZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border)';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border)';
            const files = e.dataTransfer.files;
            if (files.length) this.handleFiles(files);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.handleFiles(e.target.files);
        });
    }

    handleFiles(files) {
        const gallery = document.getElementById('upload-gallery');
        gallery?.classList.remove('hidden');

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.uploadedImages.push(e.target.result);
                this.renderGallery();
                this.selectImage(this.uploadedImages.length - 1);
            };
            reader.readAsDataURL(file);
        });
    }

    renderGallery() {
        const gallery = document.getElementById('upload-gallery');
        if (!gallery) return;

        if (this.uploadedImages.length === 0) {
            gallery.classList.add('hidden');
            gallery.innerHTML = '';
            return;
        }

        gallery.classList.remove('hidden');
        gallery.innerHTML = this.uploadedImages.map((src, idx) => `
            <div class="gallery-item ${idx === this.activeImageIndex ? 'active' : ''}" onclick="app.selectImage(${idx})">
                <img src="${src}">
                <div class="delete-btn" onclick="event.stopPropagation(); app.deleteImage(${idx})">×</div>
            </div>
        `).join('');
    }

    deleteImage(index) {
        this.uploadedImages.splice(index, 1);
        if (this.uploadedImages.length === 0) {
            this.activeImageIndex = -1;
            this.uploadedImage = null;
            const dropZone = document.getElementById('upload-zone');
            if (dropZone) {
                dropZone.classList.remove('has-image');
                dropZone.style.backgroundImage = '';
            }
        } else {
            // Adjust active index if needed
            if (this.activeImageIndex >= this.uploadedImages.length) {
                this.selectImage(this.uploadedImages.length - 1);
            } else if (this.activeImageIndex === index) {
                this.selectImage(Math.max(0, index - 1));
            }
        }
        this.renderGallery();
    }

    selectImage(index) {
        if (index < 0 || index >= this.uploadedImages.length) return;
        this.activeImageIndex = index;
        this.uploadedImage = this.uploadedImages[index];
        this.renderGallery();
        const dropZone = document.getElementById('upload-zone');
        if (dropZone) {
            dropZone.classList.add('has-image');
            dropZone.style.backgroundImage = `url(${this.uploadedImage})`;
            dropZone.style.backgroundSize = 'contain';
            dropZone.style.backgroundRepeat = 'no-repeat';
            dropZone.style.backgroundPosition = 'center';
        }
    }

    async base64ToBlob(base64, type = 'image/png') {
        const response = await fetch(base64);
        return await response.blob();
    }

    initGeneration() {
        const btn = document.getElementById('generate-btn');
        if (!btn) return;

        btn.addEventListener('click', () => this.handleGeneration());
    }

    async handleGeneration(options = {}) {
        const btn = document.getElementById('generate-btn');
        const promptInput = document.getElementById('prompt-input');
        if (!btn || !promptInput) return;

        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('请输入指令');
            return;
        }

        const modelSelect = document.getElementById('model-select');
        const modelName = modelSelect ? modelSelect.options[modelSelect.selectedIndex].text : '未知模型';
        const scenarioMap = {
            'free_mode': '通用模式',
            'taobao_main': '淘宝主图',
            'taobao_detail': '淘宝详情页',
            'taobao_detail_suite': '整套详情页',
            'brand_story': '品牌故事',
            'creative_poster': '创意海报',
            'amazon_white': '亚马逊白底',
            'amazon_detail': '亚马逊A+',
            'image_modify': '图像修改'
        };
        const scenarioName = scenarioMap[this.selectedScenario] || this.selectedScenario;
        this.addLog('info', '🚀 开始生成任务', {
            '模型': modelName,
            '场景': scenarioName,
            '尺寸': this.selectedRatio.value,
            '图片数量': this.uploadedImages.length > 0 ? `${this.uploadedImages.length} 张` : '无',
            '思考深度': options.thinking_level || '默认'
        });

        btn.disabled = true;
        let elapsedSeconds = 0;
        const updateButton = () => {
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            btn.innerHTML = `<span class="icon">⏳</span> 生成中... (${timeStr})`;
        };
        updateButton();
        const timerInterval = setInterval(() => {
            elapsedSeconds++;
            updateButton();
        }, 1000);
        this.currentTimerInterval = timerInterval;

        const controller = new AbortController();
        this.currentController = controller;
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

        // 显示取消按钮
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.classList.remove('hidden');

        try {
            const activeProvider = this.apiManager.getActiveProvider();
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('ratio', this.selectedRatio.value);
            formData.append('scenario', this.selectedScenario);
            if (modelSelect) formData.append('model', modelSelect.value);
            
            // Add new Gemini 3 options
            if (options.thinking_level) formData.append('thinking_level', options.thinking_level);
            if (options.thought_signature) formData.append('thought_signature', options.thought_signature);
            if (Number.isInteger(options.identity_ref)) formData.append('identity_ref', options.identity_ref);
            if (Number.isInteger(options.logic_ref)) formData.append('logic_ref', options.logic_ref);

            if (activeProvider) {
                formData.append('api_key', activeProvider.key);
                formData.append('api_url', activeProvider.url);
            }

            if (this.uploadedImages.length > 0) {
                for (let i = 0; i < this.uploadedImages.length; i++) {
                    const blob = await this.base64ToBlob(this.uploadedImages[i]);
                    formData.append('image', blob, `image_${i}.png`);
                }
            }

            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Submission failed: ${errorText}`);
            }

            const submitData = await response.json();
            const result = await this.pollTaskStatus(submitData.task_id, controller.signal);

            // Update AIChatSidebar's thought signature with the one from the generated image
            if (result.thought_signature && this.aiChat) {
                this.aiChat.thoughtSignature = result.thought_signature;
                console.log('Updated active thought signature from generated image:', result.thought_signature);
            }

            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            this.addLog('success', '✨ 图像生成成功', {
                '耗时': timeStr,
                '图片URL': result.url ? '已生成' : '无'
            });
            this.showPreview(result.url);
            this.addToHistory(result);

        } catch (error) {
            console.error(error);
            const msg = error.name === 'AbortError' ? '⏱️ 生成超时 (10分钟)' : error.message;
            this.addLog('error', '❌ 生成失败', {
                '原因': msg,
                '建议': error.name === 'AbortError' ? '图片生成时间较长,请稍后重试' : '请检查网络连接或联系管理员'
            });
            alert(`生成失败: ${msg}`);
        } finally {
            clearInterval(timerInterval);
            clearTimeout(timeoutId);
            btn.disabled = false;
            btn.innerHTML = '<span class="icon">✨</span> 应用编辑';

            // 隐藏取消按钮并清空controller
            const cancelBtn = document.getElementById('cancel-btn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
            this.currentController = null;
            this.currentTimerInterval = null;
        }
    }

    async pollTaskStatus(taskId, signal) {
        let retryCount = 0;
        const maxRetries = 3;

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const response = await fetch(`/api/tasks/${taskId}`, { signal });
                    if (!response.ok) throw new Error(`服务器响应异常: ${response.status}`);

                    const task = await response.json();
                    retryCount = 0;

                    if (task.status === 'succeed') {
                        resolve(task.result);
                    } else if (task.status === 'failed') {
                        reject(new Error(task.error || '生成失败'));
                    } else {
                        // 显示实时进度消息
                        if (task.progress_message) {
                            this.addLog('info', task.progress_message, { '进度': `${task.progress}%` });
                        }
                        setTimeout(poll, 2000);
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        reject(new Error('生成超时(10分钟)，请检查网络或尝试简化提示词'));
                        return;
                    }
                    retryCount++;
                    if (retryCount <= maxRetries) {
                        setTimeout(poll, 3000);
                    } else {
                        reject(new Error(`查询进度失败: ${err.message}`));
                    }
                }
            };
            poll();
        });
    }

    initLogPanel() {
        const clearBtn = document.getElementById('clear-log-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearLogs());
        this.addLog('info', '系统已启动', '准备接收生成请求');
    }
    initCancelButton() {
        const cancelBtn = document.getElementById('cancel-btn');
        if (!cancelBtn) return;

        cancelBtn.addEventListener('click', () => {
            if (this.currentController) {
                // 取消当前任务
                this.currentController.abort();

                // 清除计时器
                if (this.currentTimerInterval) {
                    clearInterval(this.currentTimerInterval);
                    this.currentTimerInterval = null;
                }

                // 重置按钮状态
                const generateBtn = document.getElementById('generate-btn');
                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = '<span class="icon">✨</span> 应用编辑';
                }

                // 隐藏取消按钮
                cancelBtn.classList.add('hidden');

                // 添加日志
                this.addLog('warning', '⏸️ 任务已取消', '用户手动取消了生成任务');

                // 清空controller
                this.currentController = null;
            }
        });
    }
    addLog(type, message, details = null) {
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const log = { id: Date.now(), type, message, details, timestamp };
        this.logs.unshift(log);
        if (this.logs.length > 50) this.logs = this.logs.slice(0, 50);
        this.renderLogs();

        // Dispatch event for AI Sidebar
        window.dispatchEvent(new CustomEvent('ai-log-added', { detail: log }));
    }

    renderLogs() {
        const container = document.getElementById('log-list');
        if (!container) return;
        if (this.logs.length === 0) {
            container.innerHTML = '<div class="log-empty">📋 工作日志将显示在这里</div>';
            return;
        }

        const iconMap = {
            'info': '📘',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'progress': '⏳'
        };

        container.innerHTML = this.logs.map(log => {
            const icon = iconMap[log.type] || '📌';
            const detailsHtml = log.details ? `
                <div class="log-details">
                    ${typeof log.details === 'object' ?
                    Object.entries(log.details).map(([k, v]) => `<div>• <strong>${k}:</strong> ${v}</div>`).join('') :
                    log.details
                }
                </div>` : '';

            return `
                <div class="log-item log-${log.type}">
                    <div class="log-icon">${icon}</div>
                    <div class="log-body">
                        <div class="log-header">
                            <span class="log-message">${log.message}</span>
                            <span class="log-timestamp">${log.timestamp}</span>
                        </div>
                        ${detailsHtml}
                    </div>
                </div>
            `;
        }).join('');
        container.scrollTop = 0;
    }

    clearLogs() {
        if (this.logs.length === 0) return;
        if (confirm('确定要清空所有日志吗？')) {
            this.logs = [];
            this.renderLogs();
            this.addLog('info', '日志已清空', null);
        }
    }

    initHistory() {
        const clearBtn = document.getElementById('clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.history.length === 0) return;
                if (confirm('确定要清空所有历史记录吗？')) {
                    this.history = [];
                    this.saveHistory();
                    this.renderHistory();
                    this.addLog('info', '历史记录已清空', null);
                }
            });
        }
    }
}

window.app = new App();
