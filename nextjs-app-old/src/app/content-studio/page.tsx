'use client'

import { useState, useRef, useCallback } from 'react'
import {
  UploadCloud, Sparkles, Download, Check,
  ArrowRight, X, Palette, Layers, Zap, RefreshCw,
  FolderOpen, Trash2, ExternalLink, ChevronLeft, ChevronRight,
  ImageIcon, LayoutTemplate, AlertCircle, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedTemplate {
  name: string
  html: string
  preview_url: string | null
}

interface TemplateFolder {
  id: string
  name: string
  templates: ExtractedTemplate[]
  template_count: number
}

interface GeneratedSlide {
  index: number
  type: 'cover' | 'content' | 'cta'
  image_url: string
  data: {
    headline: string
    body: string
    subheadline?: string
    icon_name?: string
    cta_text?: string
  }
  template_used: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS = ['Inter', 'Plus Jakarta Sans', 'Poppins', 'Playfair Display', 'Manrope', 'Lora', 'Cormorant Garamond']

const STEP_LABELS = [
  { num: 1, label: 'Upload Referensi' },
  { num: 2, label: 'Pilih Template' },
  { num: 3, label: 'Isi Konten' },
  { num: 4, label: 'Preview & Unduh' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentStudioPage() {
  const [step, setStep] = useState(1)

  // Step 1 — Upload
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([])
  const [folderName, setFolderName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — Template selection
  const [folder, setFolder] = useState<TemplateFolder | null>(null)
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0)

  // Step 3 — Content
  const [topic, setTopic] = useState('')
  const [hook, setHook] = useState('')
  const [points, setPoints] = useState('')
  const [cta, setCta] = useState('')
  const [brandName, setBrandName] = useState('JadiSatu')
  const [brandFont, setBrandFont] = useState('Inter')
  const [brandColor, setBrandColor] = useState('#8b5cf6')
  const [slideCount, setSlideCount] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Step 4 — Result
  const [slides, setSlides] = useState<GeneratedSlide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [generationId, setGenerationId] = useState<string | null>(null)

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newImages = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - uploadedImages.length)
      .map(file => ({ file, preview: URL.createObjectURL(file) }))
    setUploadedImages(prev => [...prev, ...newImages].slice(0, 5))
  }, [uploadedImages.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const n = [...prev]
      URL.revokeObjectURL(n[index].preview)
      n.splice(index, 1)
      return n
    })
  }

  // ── Convert File to Base64 ─────────────────────────────────────────────────

  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip data URL prefix → pure base64
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── Step 1: Extract Templates ──────────────────────────────────────────────

  async function extractTemplates() {
    if (!uploadedImages.length) return
    setExtracting(true)
    setExtractProgress(10)
    setExtractError(null)

    try {
      // Encode images to base64
      const imagesB64 = await Promise.all(uploadedImages.map(i => toBase64(i.file)))
      setExtractProgress(30)

      const res = await fetch('/api/visual/extract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesB64,
          folder_name: folderName || 'My Templates',
        }),
      })

      setExtractProgress(80)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Extraction failed' }))
        throw new Error(err.detail || 'Extraction failed')
      }

      const data: TemplateFolder = await res.json()
      setExtractProgress(100)
      setFolder(data)
      setSelectedTemplateIndex(0)

      await new Promise(r => setTimeout(r, 300))
      setStep(2)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setExtractError(message)
    } finally {
      setExtracting(false)
    }
  }

  // ── Step 3: Generate Carousel ──────────────────────────────────────────────

  async function generateCarousel() {
    if (!topic.trim() || !folder) return
    setGenerating(true)
    setGenerateProgress(15)
    setGenerateError(null)

    try {
      const pointsList = points
        .split('\n')
        .map(p => p.trim())
        .filter(Boolean)

      const res = await fetch('/api/visual/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folder.id,
          topic,
          hook: hook || undefined,
          value_points: pointsList,
          cta: cta || undefined,
          brand: {
            name: brandName,
            font: brandFont,
            primary_color: brandColor,
          },
          num_slides: slideCount,
          style_assignments: Object.fromEntries(
            Array.from({ length: slideCount }, (_, i) => [String(i), selectedTemplateIndex])
          ),
        }),
      })

      setGenerateProgress(80)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Generation failed' }))
        throw new Error(err.detail || 'Generation failed')
      }

      const data: { success: boolean; generation_id: string; slides: GeneratedSlide[] } = await res.json()
      setGenerateProgress(100)
      setSlides(data.slides)
      setGenerationId(data.generation_id)
      setActiveSlide(0)

      await new Promise(r => setTimeout(r, 300))
      setStep(4)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setGenerateError(message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Download helpers ───────────────────────────────────────────────────────

  function downloadSlide(slide: GeneratedSlide) {
    const link = document.createElement('a')
    link.href = slide.image_url
    link.download = `slide-${slide.index + 1}.png`
    link.click()
  }

  async function downloadAll() {
    // Simple sequential download using anchor tags
    for (const slide of slides) {
      await new Promise(r => setTimeout(r, 300))
      downloadSlide(slide)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <LayoutTemplate className="w-6 h-6 text-violet-500" />
              Carousel Studio
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Visual Engine v2 — Upload referensi → Extract template → Generate carousel
            </p>
          </div>
          <a
            href="/dark/carousel-generator-preview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-xs font-medium text-violet-700 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Advanced Editor
          </a>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => s.num < step && setStep(s.num)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-all',
                  step === s.num
                    ? 'text-violet-600'
                    : step > s.num
                      ? 'text-emerald-600 cursor-pointer'
                      : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step === s.num
                    ? 'bg-violet-100 text-violet-600 ring-2 ring-violet-200 scale-110'
                    : step > s.num
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div className={cn(
                  'h-0.5 w-8 rounded transition-all',
                  step > s.num ? 'bg-emerald-300' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ══════════════════════════════ STEP 1 ══════════════════════════════ */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-1">Upload Desain Referensi</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Upload 1–5 screenshot desain yang kamu suka. AI akan mengekstrak style-nya menjadi template HTML/CSS.
            </p>

            {/* Upload Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[260px] transition-all cursor-pointer',
                isDragOver
                  ? 'border-violet-500 bg-violet-50 scale-[1.01]'
                  : 'border-border hover:border-violet-300 hover:bg-violet-50/30'
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8 text-violet-500" />
              </div>
              <p className="font-semibold text-foreground mb-1">Drag & drop gambar di sini</p>
              <p className="text-sm text-muted-foreground mb-4">PNG, JPG — max 5 gambar</p>
              <span className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-all shadow-sm">
                Browse Files
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {extractError && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{extractError}</span>
              </div>
            )}

            {uploadedImages.length > 0 && (
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{uploadedImages.length} gambar dipilih</span>
                  <button
                    onClick={() => { uploadedImages.forEach(i => URL.revokeObjectURL(i.preview)); setUploadedImages([]) }}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Hapus Semua
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-border aspect-square">
                      <img src={img.preview} alt={`ref-${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); removeImage(i) }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Nama Folder Template</label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={e => setFolderName(e.target.value)}
                    placeholder="e.g., Dark Minimal Style"
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  />
                </div>

                <button
                  onClick={extractTemplates}
                  disabled={extracting}
                  className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {extracting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengekstrak ({extractProgress}%)...</>
                    : <><Sparkles className="w-4 h-4" /> Extract Templates</>
                  }
                </button>

                {extracting && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${extractProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════ STEP 2 ══════════════════════════════ */}
        {step === 2 && folder && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-foreground">
                Pilih Template — {folder.name}
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {folder.template_count} template diekstrak
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Pilih 1 template sebagai base style untuk semua slide. Kamu bisa mix-and-match di step berikutnya.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {folder.templates.map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTemplateIndex(i)}
                  className={cn(
                    'rounded-2xl border-2 overflow-hidden transition-all text-left group',
                    selectedTemplateIndex === i
                      ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-lg shadow-violet-100'
                      : 'border-border hover:border-violet-300 hover:shadow-md'
                  )}
                >
                  {/* Preview */}
                  <div className="aspect-square overflow-hidden bg-muted relative">
                    {tpl.preview_url ? (
                      <img
                        src={tpl.preview_url}
                        alt={tpl.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-xs">Sedang dirender...</p>
                      </div>
                    )}
                    {selectedTemplateIndex === i && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shadow">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-border">
                    <span className="text-sm font-semibold text-foreground">{tpl.name}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              className="flex items-center justify-center gap-2 w-full max-w-sm mx-auto py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all shadow-md"
            >
              <ArrowRight className="w-4 h-4" />
              Lanjut ke Isi Konten
            </button>
          </div>
        )}

        {/* ══════════════════════════════ STEP 3 ══════════════════════════════ */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Isi Konten Carousel</h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI akan menulis copy untuk setiap slide berdasarkan topik & poin-poin yang kamu input.
              </p>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Topik Carousel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., 5 Kesalahan Terbesar Freelancer Pemula"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Hook */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Hook (opsional)</label>
              <input
                type="text"
                value={hook}
                onChange={e => setHook(e.target.value)}
                placeholder="e.g., Udah 3 tahun freelance tapi penghasilan segini-segini aja?"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Value Points */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Poin-poin Utama (1 per baris)</label>
              <textarea
                value={points}
                onChange={e => setPoints(e.target.value)}
                rows={5}
                placeholder={'Tidak punya niche jelas\nGak berani naik harga\nTerlalu bergantung 1 klien\nTidak ada sistem follow-up\nLupa bangun personal brand'}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 resize-none transition-all"
              />
            </div>

            {/* CTA */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Call to Action (opsional)</label>
              <input
                type="text"
                value={cta}
                onChange={e => setCta(e.target.value)}
                placeholder="e.g., Follow untuk tips freelance harian!"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Brand Config */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-foreground">Brand Config</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Font</label>
                  <select
                    value={brandFont}
                    onChange={e => setBrandFont(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm outline-none"
                  >
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer p-1 bg-muted"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Jumlah Slide</label>
                  <select
                    value={slideCount}
                    onChange={e => setSlideCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm outline-none"
                  >
                    {[5, 7, 9, 10, 12].map(n => <option key={n} value={n}>{n} slides</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Template reminder */}
            {folder && (
              <div className="flex items-center gap-3 py-3 px-4 bg-violet-50 border border-violet-100 rounded-xl text-sm">
                <Layers className="w-4 h-4 text-violet-500 shrink-0" />
                <span className="text-violet-700">
                  Template: <strong>{folder.templates[selectedTemplateIndex]?.name}</strong> dari folder <strong>{folder.name}</strong>
                </span>
                <button onClick={() => setStep(2)} className="ml-auto text-violet-500 hover:text-violet-700 text-xs underline">
                  Ganti
                </button>
              </div>
            )}

            {generateError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{generateError}</span>
              </div>
            )}

            <button
              onClick={generateCarousel}
              disabled={generating || !topic.trim() || !folder}
              className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Content & Rendering... ({generateProgress}%)</>
                : <><Sparkles className="w-4 h-4" /> Generate Carousel</>
              }
            </button>

            {generating && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${generateProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════ STEP 4 ══════════════════════════════ */}
        {step === 4 && slides.length > 0 && (
          <div className="max-w-6xl mx-auto">
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Carousel Siap!</h2>
                <p className="text-sm text-muted-foreground">{slides.length} slides • Klik slide untuk preview besar</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setStep(3); setSlides([]) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm text-foreground border border-border transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all shadow-md"
                >
                  <Download className="w-3.5 h-3.5" /> Download Semua
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* Main Preview */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="aspect-square relative bg-muted">
                  {slides[activeSlide]?.image_url ? (
                    <img
                      src={slides[activeSlide].image_url}
                      alt={`Slide ${activeSlide + 1}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  )}
                </div>
                {/* Nav */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <button
                    onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
                    disabled={activeSlide === 0}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <span className="text-sm font-medium text-foreground">
                      Slide {activeSlide + 1} / {slides.length}
                    </span>
                    <p className="text-xs text-muted-foreground capitalize">
                      {slides[activeSlide]?.type} • {slides[activeSlide]?.template_used}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
                    disabled={activeSlide === slides.length - 1}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Slide Strip */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Semua Slides</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {slides.map((slide, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlide(i)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left',
                        activeSlide === i
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-transparent hover:border-border hover:bg-muted'
                      )}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                        {slide.image_url ? (
                          <img src={slide.image_url} alt={`s${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground opacity-50" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{slide.data.headline}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{slide.type} • Slide {i + 1}</p>
                      </div>
                      {/* Download */}
                      <button
                        onClick={e => { e.stopPropagation(); downloadSlide(slide) }}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-violet-100 text-muted-foreground hover:text-violet-600 transition-all"
                        title="Download slide ini"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>

                {/* Content preview */}
                {slides[activeSlide] && (
                  <div className="p-4 border-t border-border space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Konten Slide {activeSlide + 1}</h4>
                    <div className="text-sm text-foreground font-medium leading-snug">
                      {slides[activeSlide].data.headline}
                    </div>
                    {slides[activeSlide].data.body && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {slides[activeSlide].data.body}
                      </p>
                    )}
                    <button
                      onClick={() => downloadSlide(slides[activeSlide])}
                      className="w-full mt-2 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Slide {activeSlide + 1}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Editor promo */}
            <div className="mt-6 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Butuh lebih banyak kontrol?</p>
                  <p className="text-xs text-muted-foreground">Gunakan Advanced Editor untuk edit pixel-level, brand colors, layout presets & export yang lebih canggih.</p>
                </div>
              </div>
              <a
                href="/dark/carousel-generator-preview.html"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Editor
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
