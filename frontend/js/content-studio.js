/**
 * Content Studio — Frontend Logic
 * Manages the 4-step flow:
 *   1. Upload reference designs
 *   2. View extracted templates
 *   3. Generate carousel with per-slide style selection
 *   4. Preview & download
 *
 * Connects to Visual Engine API (port 8100).
 */

// ── Config ──────────────────────────────────────────────────────────────
// In production, nginx proxies /api/visual/* → localhost:8100
// So we use '' (empty = same origin) for production, or override via window.VISUAL_ENGINE_URL
const VISUAL_ENGINE_URL = window.VISUAL_ENGINE_URL || '';

// ── Utility: Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = { info: 'bg-white/10 text-white', success: 'bg-success/20 text-success', error: 'bg-danger/20 text-red-300' };
    const el = document.createElement('div');
    el.className = `toast-msg px-4 py-2.5 rounded-lg text-sm ${colors[type] || colors.info} backdrop-blur-sm border border-white/10 mb-2`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── Utility: File to Base64 ─────────────────────────────────────────────
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Strip data URL prefix to get raw base64
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── Main Class ──────────────────────────────────────────────────────────
class ContentStudio {
    constructor() {
        // State
        this.uploadedFiles = [];      // File objects
        this.uploadedBase64 = [];     // Base64 strings
        this.currentFolder = null;    // { folder_id, folder_name, templates: [...] }
        this.generatedSlides = [];    // Generated carousel slides
        this.styleAssignments = {};   // { slideIndex: templateIndex }
        this.generationId = null;
    }

    init() {
        this._bindUploadEvents();
        this._bindNavigationEvents();
        this._bindGenerateEvents();
        this._bindPreviewEvents();
        this._bindTemplatePanel();
        this._loadTemplateFolders();
        console.log('[Content Studio] initialized');
    }

    // ====================================================================
    // STEP 1: Upload
    // ====================================================================

    _bindUploadEvents() {
        const zone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('btn-browse-files');
        const clearBtn = document.getElementById('btn-clear-uploads');
        const extractBtn = document.getElementById('btn-extract');

        if (browseBtn) browseBtn.addEventListener('click', () => fileInput.click());
        if (zone) {
            zone.addEventListener('click', (e) => {
                if (e.target === zone || e.target.closest('.upload-zone')) fileInput.click();
            });
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                this._handleFiles(e.dataTransfer.files);
            });
        }
        if (fileInput) fileInput.addEventListener('change', (e) => this._handleFiles(e.target.files));
        if (clearBtn) clearBtn.addEventListener('click', () => this._clearUploads());
        if (extractBtn) extractBtn.addEventListener('click', () => this._extractTemplates());
    }

    _handleFiles(fileList) {
        const validFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (validFiles.length === 0) { toast('Pilih file gambar (PNG/JPG)', 'error'); return; }

        const total = this.uploadedFiles.length + validFiles.length;
        if (total > 5) {
            toast('Maksimal 5 gambar', 'error');
            return;
        }

        this.uploadedFiles.push(...validFiles);
        this._renderUploadPreviews();
    }

    _renderUploadPreviews() {
        const preview = document.getElementById('upload-preview');
        const thumbnails = document.getElementById('upload-thumbnails');
        const count = document.getElementById('upload-count');
        const folderSection = document.getElementById('folder-name-section');
        const extractSection = document.getElementById('extract-section');

        if (!this.uploadedFiles.length) {
            preview.classList.add('hidden');
            folderSection.classList.add('hidden');
            extractSection.classList.add('hidden');
            return;
        }

        preview.classList.remove('hidden');
        folderSection.classList.remove('hidden');
        extractSection.classList.remove('hidden');
        count.textContent = this.uploadedFiles.length;

        thumbnails.innerHTML = this.uploadedFiles.map((file, i) => {
            const url = URL.createObjectURL(file);
            return `
                <div class="relative group rounded-xl overflow-hidden border border-white/10 aspect-square">
                    <img src="${url}" class="w-full h-full object-cover" alt="ref ${i + 1}">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onclick="window.contentStudio._removeFile(${i})" class="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-all">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="absolute bottom-1 left-1 bg-black/60 text-[10px] text-white px-1.5 py-0.5 rounded">#${i + 1}</div>
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    _removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this._renderUploadPreviews();
    }

    _clearUploads() {
        this.uploadedFiles = [];
        this.uploadedBase64 = [];
        this._renderUploadPreviews();
    }

    async _extractTemplates() {
        if (!this.uploadedFiles.length) { toast('Upload minimal 1 gambar', 'error'); return; }

        const folderName = document.getElementById('input-folder-name').value.trim() || 'My Templates';
        const progress = document.getElementById('extract-progress');
        const bar = document.getElementById('extract-progress-bar');
        const text = document.getElementById('extract-progress-text');
        const extractBtn = document.getElementById('btn-extract');

        // Show progress
        progress.classList.remove('hidden');
        extractBtn.disabled = true;
        extractBtn.classList.add('opacity-50');
        bar.style.width = '15%';
        text.textContent = 'Mengkonversi gambar ke base64...';

        try {
            // Convert files to base64
            this.uploadedBase64 = [];
            for (const file of this.uploadedFiles) {
                const b64 = await fileToBase64(file);
                this.uploadedBase64.push(b64);
            }
            bar.style.width = '30%';
            text.textContent = `Mengirim ${this.uploadedFiles.length} gambar ke AI...`;

            // Call API
            const userId = window.currentUser ? window.currentUser.id : null;
            const resp = await fetch(`${VISUAL_ENGINE_URL}/api/visual/extract-templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: this.uploadedBase64,
                    folder_name: folderName,
                    user_id: userId,
                }),
            });

            bar.style.width = '80%';
            text.textContent = 'Mengekstrak template dari desain...';

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            bar.style.width = '100%';
            text.textContent = `${data.template_count} template berhasil diekstrak!`;

            this.currentFolder = {
                folder_id: data.folder_id,
                folder_name: data.folder_name,
                templates: data.templates,
            };

            toast(`${data.template_count} template diekstrak!`, 'success');

            // Save to Supabase for persistence
            this._saveTemplateToSupabase(this.currentFolder);

            // Move to Step 2 after brief delay
            setTimeout(() => this._showStep('templates'), 800);

        } catch (e) {
            console.error('[Content Studio] extract error:', e);
            toast(`Gagal ekstrak: ${e.message}`, 'error');
            bar.style.width = '0%';
            text.textContent = 'Gagal. Coba lagi.';
        } finally {
            extractBtn.disabled = false;
            extractBtn.classList.remove('opacity-50');
        }
    }

    // ====================================================================
    // STEP 2: Template Selection
    // ====================================================================

    _renderTemplateCards() {
        const container = document.getElementById('template-cards');
        if (!this.currentFolder || !container) return;

        container.innerHTML = this.currentFolder.templates.map((t, i) => `
            <div class="template-card glass rounded-2xl overflow-hidden" data-index="${i}">
                <div class="aspect-square bg-gray-900 relative overflow-hidden">
                    ${t.preview_url
                        ? `<img src="${VISUAL_ENGINE_URL}${t.preview_url}" class="w-full h-full object-cover" alt="${t.name}">`
                        : `<div class="w-full h-full shimmer flex items-center justify-center"><i data-lucide="image" class="w-12 h-12 text-gray-600"></i></div>`
                    }
                    <div class="absolute top-3 left-3 bg-black/60 text-[10px] text-white px-2 py-1 rounded-lg font-medium uppercase tracking-wider">
                        Style ${i + 1}
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="text-sm font-semibold text-white mb-1">${this._esc(t.name)}</h3>
                    <p class="text-xs text-gray-400 mb-3">${this._esc(t.description || '')}</p>
                    <div class="flex gap-1.5 flex-wrap">
                        ${Object.entries(t.colors || {}).slice(0, 5).map(([k, v]) =>
                            `<div class="w-5 h-5 rounded-full border border-white/10" style="background:${v}" title="${k}: ${v}"></div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ====================================================================
    // STEP 3: Generate
    // ====================================================================

    _bindGenerateEvents() {
        const generateBtn = document.getElementById('btn-generate');
        const slideCountSelect = document.getElementById('input-slide-count');

        if (generateBtn) generateBtn.addEventListener('click', () => this._generateCarousel());
        if (slideCountSelect) slideCountSelect.addEventListener('change', () => this._renderSlideAssignments());
    }

    _renderSlideAssignments() {
        const container = document.getElementById('slide-style-assignments');
        const count = parseInt(document.getElementById('input-slide-count').value) || 7;
        if (!container || !this.currentFolder) return;

        const templates = this.currentFolder.templates;

        container.innerHTML = Array.from({ length: count }, (_, i) => {
            const type = i === 0 ? 'Cover' : i === count - 1 ? 'CTA' : `Content ${i}`;
            const assignedIdx = this.styleAssignments[i] ?? 0;

            return `
                <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <span class="text-xs text-gray-500 w-20 shrink-0">Slide ${i + 1} <span class="text-gray-600">(${type})</span></span>
                    <div class="flex gap-1.5 flex-1 flex-wrap">
                        ${templates.map((t, ti) => `
                            <button class="style-pill text-[11px] px-2.5 py-1 rounded-full border border-white/10 ${ti === assignedIdx ? 'active' : 'text-gray-400'}"
                                    onclick="window.contentStudio._assignStyle(${i}, ${ti})">
                                ${this._esc(t.name)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    _assignStyle(slideIndex, templateIndex) {
        this.styleAssignments[slideIndex] = templateIndex;
        this._renderSlideAssignments();
    }

    async _generateCarousel() {
        const topic = document.getElementById('input-topic').value.trim();
        if (!topic) { toast('Isi topik carousel dulu', 'error'); return; }
        if (!this.currentFolder) { toast('Pilih template folder dulu', 'error'); return; }

        const hook = document.getElementById('input-hook').value.trim();
        const pointsRaw = document.getElementById('input-points').value.trim();
        const cta = document.getElementById('input-cta').value.trim();
        const brandName = document.getElementById('input-brand-name').value.trim() || 'Brand';
        const brandFont = document.getElementById('input-brand-font').value;
        const numSlides = parseInt(document.getElementById('input-slide-count').value) || 7;

        const valuePoints = pointsRaw ? pointsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];

        const progress = document.getElementById('generate-progress');
        const bar = document.getElementById('generate-progress-bar');
        const text = document.getElementById('generate-progress-text');
        const genBtn = document.getElementById('btn-generate');

        progress.classList.remove('hidden');
        genBtn.disabled = true;
        genBtn.classList.add('opacity-50');
        bar.style.width = '15%';
        text.textContent = 'Membuat konten slide dengan AI...';

        try {
            // Build style assignments map (string keys for JSON)
            const assignments = {};
            for (let i = 0; i < numSlides; i++) {
                assignments[String(i)] = this.styleAssignments[i] ?? 0;
            }

            bar.style.width = '30%';
            text.textContent = 'Generating slides...';

            const resp = await fetch(`${VISUAL_ENGINE_URL}/api/visual/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_id: this.currentFolder.folder_id,
                    topic,
                    hook: hook || null,
                    value_points: valuePoints,
                    cta: cta || null,
                    brand: {
                        name: brandName,
                        font: brandFont,
                        colors: {},
                    },
                    num_slides: numSlides,
                    style_assignments: assignments,
                }),
            });

            bar.style.width = '80%';
            text.textContent = 'Rendering slides...';

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            bar.style.width = '100%';
            text.textContent = `${data.slides.length} slide berhasil dibuat!`;

            this.generatedSlides = data.slides;
            this.generationId = data.generation_id;

            toast(`Carousel ${data.slides.length} slide berhasil!`, 'success');
            setTimeout(() => this._showStep('preview'), 800);

        } catch (e) {
            console.error('[Content Studio] generate error:', e);
            toast(`Gagal generate: ${e.message}`, 'error');
            bar.style.width = '0%';
            text.textContent = 'Gagal. Coba lagi.';
        } finally {
            genBtn.disabled = false;
            genBtn.classList.remove('opacity-50');
        }
    }

    // ====================================================================
    // STEP 4: Preview & Download
    // ====================================================================

    _bindPreviewEvents() {
        const closeEditor = document.getElementById('btn-close-editor');
        const rerenderBtn = document.getElementById('btn-rerender-slide');
        const downloadAll = document.getElementById('btn-download-all');
        const regenerate = document.getElementById('btn-regenerate');

        if (closeEditor) closeEditor.addEventListener('click', () => {
            document.getElementById('slide-editor').classList.add('hidden');
        });
        if (rerenderBtn) rerenderBtn.addEventListener('click', () => this._rerenderCurrentSlide());
        if (downloadAll) downloadAll.addEventListener('click', () => this._downloadAll());
        if (regenerate) regenerate.addEventListener('click', () => this._showStep('generate'));
    }

    _renderSlideStrip() {
        const strip = document.getElementById('slide-strip');
        if (!strip) return;

        strip.innerHTML = this.generatedSlides.map((slide, i) => `
            <div class="slide-card shrink-0 w-[240px] glass rounded-xl overflow-hidden cursor-pointer" onclick="window.contentStudio._openSlideEditor(${i})">
                <div class="aspect-square bg-gray-900 relative">
                    ${slide.image_url
                        ? `<img src="${VISUAL_ENGINE_URL}${slide.image_url}" class="w-full h-full object-cover" alt="Slide ${i + 1}">`
                        : `<div class="w-full h-full shimmer flex items-center justify-center"><span class="text-gray-600 text-sm">Rendering...</span></div>`
                    }
                    <div class="absolute top-2 left-2 bg-black/60 text-[10px] text-white px-2 py-0.5 rounded font-medium">
                        ${slide.type || 'content'}
                    </div>
                    <div class="absolute top-2 right-2 bg-black/60 text-[10px] text-gray-300 px-2 py-0.5 rounded">
                        ${slide.template_used || ''}
                    </div>
                </div>
                <div class="p-3">
                    <p class="text-xs font-medium text-white truncate">${this._esc(slide.data?.headline || '')}</p>
                    <p class="text-[10px] text-gray-500 truncate mt-0.5">${this._esc(slide.data?.body || '')}</p>
                </div>
            </div>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    _openSlideEditor(index) {
        const slide = this.generatedSlides[index];
        if (!slide) return;

        this._editingSlideIndex = index;

        document.getElementById('editor-slide-num').textContent = `#${index + 1}`;
        document.getElementById('editor-headline').value = slide.data?.headline || '';
        document.getElementById('editor-body').value = slide.data?.body || '';
        document.getElementById('editor-icon').value = slide.data?.icon_name || '';

        // Render style pills
        const pillsContainer = document.getElementById('editor-style-pills');
        if (pillsContainer && this.currentFolder) {
            const currentStyle = slide.template_used || '';
            pillsContainer.innerHTML = this.currentFolder.templates.map((t, ti) => `
                <button class="style-pill text-[11px] px-2.5 py-1 rounded-full border border-white/10 ${t.name === currentStyle ? 'active' : 'text-gray-400'}"
                        onclick="window.contentStudio._changeSlideStyle(${index}, ${ti})">
                    ${this._esc(t.name)}
                </button>
            `).join('');
        }

        document.getElementById('slide-editor').classList.remove('hidden');
    }

    _changeSlideStyle(slideIndex, templateIndex) {
        this.styleAssignments[slideIndex] = templateIndex;
        const template = this.currentFolder.templates[templateIndex];
        if (template && this.generatedSlides[slideIndex]) {
            this.generatedSlides[slideIndex].template_used = template.name;
        }
        this._openSlideEditor(slideIndex); // Re-render pills
    }

    async _rerenderCurrentSlide() {
        const index = this._editingSlideIndex;
        if (index === undefined || index === null) return;

        const slide = this.generatedSlides[index];
        if (!slide) return;

        // Update slide data from editor
        slide.data.headline = document.getElementById('editor-headline').value;
        slide.data.body = document.getElementById('editor-body').value;
        slide.data.icon_name = document.getElementById('editor-icon').value;

        const templateIdx = this.styleAssignments[index] ?? 0;

        toast('Re-rendering slide...', 'info');

        try {
            const resp = await fetch(`${VISUAL_ENGINE_URL}/api/visual/render-slide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_id: this.currentFolder.folder_id,
                    template_index: templateIdx,
                    slide_data: slide.data,
                    brand: {
                        name: document.getElementById('input-brand-name').value.trim() || 'Brand',
                        font: document.getElementById('input-brand-font').value,
                        colors: {},
                    },
                }),
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            // Update slide image
            slide.image_url = data.image_url;
            this._renderSlideStrip();
            toast('Slide updated!', 'success');

        } catch (e) {
            console.error('[Content Studio] rerender error:', e);
            toast(`Gagal re-render: ${e.message}`, 'error');
        }
    }

    async _downloadAll() {
        if (!this.generatedSlides.length) { toast('Belum ada slide', 'error'); return; }

        toast('Downloading slides...', 'info');

        for (let i = 0; i < this.generatedSlides.length; i++) {
            const slide = this.generatedSlides[i];
            if (!slide.image_url) continue;

            try {
                const resp = await fetch(`${VISUAL_ENGINE_URL}${slide.image_url}`);
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `slide_${i + 1}_${slide.type || 'content'}.png`;
                a.click();
                URL.revokeObjectURL(url);
                // Small delay between downloads
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {
                console.error(`Failed to download slide ${i + 1}:`, e);
            }
        }

        toast('Download selesai!', 'success');
    }

    // ====================================================================
    // Navigation
    // ====================================================================

    _bindNavigationEvents() {
        const toGenerateBtn = document.getElementById('btn-to-generate');
        if (toGenerateBtn) toGenerateBtn.addEventListener('click', () => this._showStep('generate'));
    }

    _showStep(step) {
        // Hide all steps
        ['step-upload', 'step-templates', 'step-generate', 'step-preview'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });

        switch (step) {
            case 'upload':
                document.getElementById('step-upload')?.classList.remove('hidden');
                break;
            case 'templates':
                document.getElementById('step-templates')?.classList.remove('hidden');
                this._renderTemplateCards();
                break;
            case 'generate':
                document.getElementById('step-generate')?.classList.remove('hidden');
                this._renderSlideAssignments();
                break;
            case 'preview':
                document.getElementById('step-preview')?.classList.remove('hidden');
                this._renderSlideStrip();
                break;
        }

        // Scroll to top
        document.getElementById('studio-content')?.scrollTo(0, 0);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ====================================================================
    // My Templates Panel
    // ====================================================================

    _bindTemplatePanel() {
        const openBtn = document.getElementById('btn-my-templates');
        const closeBtn = document.getElementById('btn-close-templates');
        const backdrop = document.getElementById('templates-panel-backdrop');
        const panel = document.getElementById('templates-panel');

        if (openBtn) openBtn.addEventListener('click', () => {
            panel?.classList.remove('hidden');
            this._loadTemplateFolders();
        });
        if (closeBtn) closeBtn.addEventListener('click', () => panel?.classList.add('hidden'));
        if (backdrop) backdrop.addEventListener('click', () => panel?.classList.add('hidden'));
    }

    async _loadTemplateFolders() {
        const list = document.getElementById('templates-list');
        const count = document.getElementById('template-folder-count');
        if (!list) return;

        try {
            const userId = window.currentUser ? window.currentUser.id : null;
            let folders = [];

            // Try Visual Engine API first
            try {
                const resp = await fetch(`${VISUAL_ENGINE_URL}/api/visual/templates?user_id=${userId || ''}`);
                if (resp.ok) {
                    const data = await resp.json();
                    folders = data.folders || [];
                }
            } catch (e) {
                console.warn('[Content Studio] Visual Engine API unavailable, trying Supabase...');
            }

            // Also load from Supabase (user_template_folders)
            if (window.supabaseClient && userId) {
                try {
                    const { data: sbFolders, error } = await window.supabaseClient
                        .from('user_template_folders')
                        .select('*')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false });
                    if (!error && sbFolders) {
                        const existingIds = new Set(folders.map(f => f.id));
                        for (const sf of sbFolders) {
                            if (!existingIds.has(sf.id)) {
                                folders.push({
                                    id: sf.id,
                                    name: sf.name,
                                    template_count: (sf.styles || []).length,
                                    source: 'supabase',
                                    created_at: sf.created_at,
                                });
                            }
                        }
                    }
                } catch (e) { console.warn('[Content Studio] Supabase template load:', e); }
            }

            if (count) count.textContent = folders.length;

            if (!folders.length) {
                list.innerHTML = '<div class="text-sm text-gray-500 text-center py-12">Belum ada template tersimpan</div>';
                return;
            }

            list.innerHTML = folders.map(f => `
                <div class="glass rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-all" onclick="window.contentStudio._loadFolder('${f.id}')">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-semibold text-white">${this._esc(f.name)}</h3>
                        <button onclick="event.stopPropagation(); window.contentStudio._deleteFolder('${f.id}')" class="text-gray-500 hover:text-red-400 transition-all">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <span>${f.template_count || '?'} templates</span>
                        <span>${f.source || ''}</span>
                        <span>${f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : ''}</span>
                    </div>
                </div>
            `).join('');

            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (e) {
            console.error('[Content Studio] loadFolders error:', e);
        }
    }

    async _loadFolder(folderId) {
        try {
            const resp = await fetch(`${VISUAL_ENGINE_URL}/api/visual/templates/${folderId}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            this.currentFolder = {
                folder_id: data.id,
                folder_name: data.name,
                templates: data.templates || [],
            };

            // Close panel and go to templates step
            document.getElementById('templates-panel')?.classList.add('hidden');
            this._showStep('templates');
            toast(`Folder "${data.name}" dimuat`, 'success');

        } catch (e) {
            console.error('[Content Studio] loadFolder error:', e);
            toast('Gagal memuat folder', 'error');
        }
    }

    async _deleteFolder(folderId) {
        if (!confirm('Hapus folder template ini?')) return;
        try {
            await fetch(`${VISUAL_ENGINE_URL}/api/visual/templates/${folderId}`, { method: 'DELETE' });
            toast('Folder dihapus', 'success');
            this._loadTemplateFolders();
        } catch (e) {
            toast('Gagal menghapus', 'error');
        }
    }

    // ====================================================================
    // Creative Hub Import
    // ====================================================================

    async importFromCreativeHub(contentId) {
        const svc = window.creativeHubService;
        if (!svc) { console.warn('[Content Studio] CreativeHubService not available'); return; }

        try {
            const item = await Promise.resolve(svc.getItem(contentId));
            if (!item) { toast('Konten tidak ditemukan', 'error'); return; }

            this._sourceContent = item;

            // Show banner
            const banner = document.getElementById('source-content-banner');
            const titleEl = document.getElementById('source-content-title');
            const statusEl = document.getElementById('source-content-status');
            const dismissBtn = document.getElementById('btn-dismiss-source');

            if (banner) banner.classList.remove('hidden');
            if (titleEl) titleEl.textContent = item.title || item.hook_text || 'Untitled';
            if (statusEl) statusEl.textContent = item.status || 'ready';
            if (dismissBtn) dismissBtn.addEventListener('click', () => banner.classList.add('hidden'));

            // Pre-fill generate form
            const topicInput = document.getElementById('input-topic');
            const hookInput = document.getElementById('input-hook');
            const pointsInput = document.getElementById('input-points');
            const ctaInput = document.getElementById('input-cta');

            if (topicInput) topicInput.value = item.title || '';
            if (hookInput) hookInput.value = item.hook_text || '';
            if (ctaInput) ctaInput.value = item.cta_text || '';

            // Parse value_text or full_script into points
            if (pointsInput) {
                let points = '';
                if (item.full_script) {
                    // Extract key points from full script
                    points = item.full_script
                        .split('\n')
                        .filter(line => line.trim() && !line.startsWith('#'))
                        .map(line => line.replace(/^[\-\*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
                        .filter(line => line.length > 5 && line.length < 200)
                        .join('\n');
                } else if (item.value_text) {
                    points = item.value_text;
                }
                pointsInput.value = points;
            }

            toast(`Script "${item.title || 'content'}" dimuat dari Creative Hub`, 'success');
            console.log('[Content Studio] imported content:', contentId, item.title);

            if (typeof lucide !== 'undefined') lucide.createIcons();

        } catch (e) {
            console.error('[Content Studio] import error:', e);
            toast('Gagal mengimpor konten', 'error');
        }
    }

    // ====================================================================
    // Supabase Template Save
    // ====================================================================

    async _saveTemplateToSupabase(folder) {
        const client = window.supabaseClient;
        const userId = window.currentUser?.id;
        if (!client || !userId) return;

        try {
            const { error } = await client.from('user_template_folders').insert({
                id: folder.folder_id,
                user_id: userId,
                name: folder.folder_name,
                styles: folder.templates.map(t => ({
                    name: t.name,
                    description: t.description || '',
                    colors: t.colors || {},
                    html: t.html || '',
                    preview_url: t.preview_url || null,
                })),
                created_at: new Date().toISOString(),
            });

            if (error) {
                console.warn('[Content Studio] save template to Supabase:', error);
            } else {
                console.log('[Content Studio] template folder saved to Supabase:', folder.folder_id);
            }
        } catch (e) {
            console.warn('[Content Studio] save template error:', e);
        }
    }

    // ====================================================================
    // Helpers
    // ====================================================================

    _esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Export
window.ContentStudio = ContentStudio;
