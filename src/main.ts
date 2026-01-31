import './style.css'
import { bananaService } from './services/bananaService';

console.log('App initializing...');

interface AspectRatio {
  label: string;
  value: string;
  width: number;
  height: number;
}

interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

const RATIOS: AspectRatio[] = [
  { label: '竖屏 9:16', value: '9:16', width: 9, height: 16 },
  { label: '横屏 4:3', value: '4:3', width: 4, height: 3 },
  { label: '竖屏 4:5', value: '4:5', width: 4, height: 5 },
  { label: '横屏 3:2', value: '3:2', width: 3, height: 2 },
  { label: '竖屏 3:4', value: '3:4', width: 3, height: 4 },
  { label: '宽屏 16:9', value: '16:9', width: 16, height: 9 },
  { label: '竖屏 2:3', value: '2:3', width: 2, height: 3 },
  { label: '电影 21:9', value: '21:9', width: 21, height: 9 },
];

class App {
  currentMode: 'txt2img' | 'img2img' = 'txt2img';
  selectedRatio: AspectRatio = RATIOS[0];
  uploadedImages: File[] = [];
  activeImageIndex: number = -1;
  uploadedImage: File | null = null;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  isDrawing = false;
  history: HistoryItem[] = [];

  constructor() {
    this.loadHistory();
    this.initTabs();
    this.initRatios();
    this.initUpload();
    this.initGeneration();
    this.renderHistory();
  }

  loadHistory() {
    const saved = localStorage.getItem('img_history');
    if (saved) {
      try {
        this.history = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }

  saveHistory() {
    localStorage.setItem('img_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  addToHistory(url: string, prompt: string) {
    const item: HistoryItem = {
      id: Date.now().toString(),
      url,
      prompt,
      timestamp: Date.now()
    };
    this.history.unshift(item);
    this.saveHistory();
  }

  renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = '<div class="history-empty">你的生成历史将显示在这里</div>';
      return;
    }

    container.innerHTML = this.history.map(item => `
      <div class="history-item" data-id="${item.id}">
        <img src="${item.url}" alt="${item.prompt}" title="${item.prompt}">
      </div>
    `).join('');

    container.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.id;
        const item = this.history.find(i => i.id === id);
        if (item) this.showPreview(item.url);
      });
    });
  }

  showPreview(url: string) {
    const container = document.getElementById('preview-container');
    if (container) {
      container.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">`;
    }
  }

  initTabs() {
    const btnTxt = document.getElementById('btn-txt2img');
    const btnImg = document.getElementById('btn-img2img');
    const groupImage = document.getElementById('group-image');

    const setMode = (mode: 'txt2img' | 'img2img') => {
      this.currentMode = mode;
      if (mode === 'txt2img') {
        btnTxt?.classList.add('active');
        btnImg?.classList.remove('active');
        groupImage?.classList.add('hidden');
      } else {
        btnImg?.classList.add('active');
        btnTxt?.classList.remove('active');
        groupImage?.classList.remove('hidden');
      }
    };

    btnTxt?.addEventListener('click', () => setMode('txt2img'));
    btnImg?.addEventListener('click', () => setMode('img2img'));
  }

  initRatios() {
    const container = document.getElementById('ratio-grid');
    if (!container) return;

    container.innerHTML = RATIOS.map(ratio => `
      <button class="ratio-btn ${ratio.value === this.selectedRatio.value ? 'active' : ''}" data-value="${ratio.value}">
        <div class="ratio-preview" style="width: ${ratio.width * 3}px; height: ${ratio.height * 3}px"></div>
        <span>${ratio.label.split(' ')[1]}</span>
      </button>
    `).join('');

    container.querySelectorAll('.ratio-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement);
        const val = target.dataset.value;
        this.selectedRatio = RATIOS.find(r => r.value === val) || RATIOS[0];

        container.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
      });
    });
  }

  initUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input') as HTMLInputElement;
    const clearBtn = document.getElementById('clear-upload-btn');
    this.canvas = document.getElementById('mask-canvas') as HTMLCanvasElement;

    if (!zone || !input || !this.canvas) return;

    this.ctx = this.canvas.getContext('2d');

    // Clear Button Logic
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeActiveImage();
    });

    // Drawing Logic
    const startDraw = (e: MouseEvent | TouchEvent) => {
      if (!this.uploadedImage) return;
      this.isDrawing = true;
      draw(e);
    };

    const stopDraw = () => {
      this.isDrawing = false;
      this.ctx?.beginPath();
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!this.isDrawing || !this.ctx || !this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      this.ctx.lineWidth = 20 * scaleX;
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.globalCompositeOperation = 'source-over';

      this.ctx.lineTo(x * scaleX, y * scaleY);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x * scaleX, y * scaleY);
    };

    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', draw);
    this.canvas.addEventListener('mouseup', stopDraw);
    this.canvas.addEventListener('mouseout', stopDraw);

    // File Handling
    zone.addEventListener('click', (e) => {
      if (e.target === this.canvas || e.target === clearBtn) return;
      input.click();
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--primary)';
    });

    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = 'var(--border)';
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--border)';
      if (e.dataTransfer?.files) {
        this.handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    input.addEventListener('change', () => {
      if (input.files) {
        this.handleFiles(Array.from(input.files));
      }
    });

    document.addEventListener('paste', (e) => {
      if (this.currentMode !== 'img2img') return;
      if (e.clipboardData?.files) {
        this.handleFiles(Array.from(e.clipboardData.files));
      }
    });
  }

  handleFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    this.uploadedImages = [...this.uploadedImages, ...validFiles];
    this.setActiveImage(this.uploadedImages.length - 1);
  }

  setActiveImage(index: number) {
    if (index < 0 || index >= this.uploadedImages.length) return;

    this.activeImageIndex = index;
    this.uploadedImage = this.uploadedImages[index];
    this.displayImage(this.uploadedImage);
    this.renderGallery();
  }

  removeActiveImage() {
    if (this.activeImageIndex === -1) return;

    this.uploadedImages.splice(this.activeImageIndex, 1);

    if (this.uploadedImages.length > 0) {
      const newIndex = Math.max(0, this.activeImageIndex - 1);
      this.setActiveImage(newIndex);
    } else {
      this.resetUploadZone();
    }
    this.renderGallery();
  }

  resetUploadZone() {
    this.activeImageIndex = -1;
    this.uploadedImage = null;
    const zone = document.getElementById('upload-zone');
    const clearBtn = document.getElementById('clear-upload-btn');

    if (zone) {
      zone.classList.remove('has-image');
      zone.style.backgroundImage = '';
      const content = zone.querySelector('.upload-content') as HTMLElement;
      if (content) content.style.display = 'block';
    }

    if (this.canvas && this.ctx) {
      this.canvas.style.display = 'none';
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (clearBtn) clearBtn.classList.add('hidden');
  }

  displayImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const zone = document.getElementById('upload-zone');
        const clearBtn = document.getElementById('clear-upload-btn');
        if (!zone || !this.canvas) return;

        zone.classList.add('has-image');
        zone.style.backgroundImage = `url(${e.target?.result})`;
        zone.style.backgroundSize = 'contain';
        zone.style.backgroundRepeat = 'no-repeat';
        zone.style.backgroundPosition = 'center';

        const content = zone.querySelector('.upload-content') as HTMLElement;
        if (content) content.style.display = 'none';

        const rect = zone.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.display = 'block';
        this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (clearBtn) clearBtn.classList.remove('hidden');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  renderGallery() {
    const gallery = document.getElementById('upload-gallery');
    if (!gallery) return;

    if (this.uploadedImages.length === 0) {
      gallery.classList.add('hidden');
      return;
    }

    gallery.classList.remove('hidden');
    gallery.innerHTML = '';

    this.uploadedImages.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = `gallery-item ${index === this.activeImageIndex ? 'active' : ''}`;
        div.innerHTML = `<img src="${e.target?.result}" alt="upload">`;
        div.onclick = (ev) => {
          ev.stopPropagation();
          this.setActiveImage(index);
        };
        gallery.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  }

  initGeneration() {
    const btn = document.getElementById('generate-btn') as HTMLButtonElement;
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;

    if (!btn || !promptInput) return;

    btn.addEventListener('click', async () => {
      const prompt = promptInput.value;
      if (!prompt && this.currentMode === 'txt2img') {
        alert('请输入提示词');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="icon">⏳</span> 生成中...';

      try {
        let maskBlob: Blob | undefined;
        if (this.currentMode === 'img2img' && this.canvas) {
          maskBlob = await new Promise(r => this.canvas?.toBlob(b => r(b || undefined)));
        }

        const imageUrl = await bananaService.generateImage({
          prompt,
          ratio: this.selectedRatio.value,
          image: this.currentMode === 'img2img' ? this.uploadedImage || undefined : undefined,
          mask: maskBlob
        });

        this.showPreview(imageUrl);
        this.addToHistory(imageUrl, prompt || 'Generated Image');

      } catch (error) {
        console.error(error);
        alert('生成失败，请重试');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="icon">✨</span> 应用编辑';
      }
    });
  }
}

new App();
