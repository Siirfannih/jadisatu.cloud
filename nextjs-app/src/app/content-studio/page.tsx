'use client'

import { useState, useRef, useCallback } from 'react'
import {
  UploadCloud, Image, Sparkles, Download, Check,
  ArrowRight, X, Palette, Layers, Zap, RefreshCw,
  ChevronLeft, ChevronRight, FolderOpen, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateCard {
  id: string
  name: string
  previewHtml: string
  selected: boolean
}

interface SlideData {
  headline: string
  body: string
  style: string
}

const FONTS = ['Inter', 'Plus Jakarta Sans', 'Poppins', 'Playfair Display', 'Manrope']

export default function ContentStudioPage() {
  const [step, setStep] = useState(1)
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([])
  const [folderName, setFolderName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)

  // Step 2 - Templates
  const [templates, setTemplates] = useState<TemplateCard[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Step 3 - Generate
  const [topic, setTopic] = useState('')
  const [hook, setHook] = useState('')
  const [points, setPoints] = useState('')
  const [cta, setCta] = useState('')
  const [brandName, setBrandName] = useState('JadiSatu')
  const [brandFont, setBrandFont] = useState('Inter')
  const [slideCount, setSlideCount] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)

  // Step 4 - Preview
  const [slides, setSlides] = useState<SlideData[]>([])
  const [editingSlide, setEditingSlide] = useState<number | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Step indicator ──────────────────────────────────
  const steps = [
    { num: 1, label: 'Upload Referensi' },
    { num: 2, label: 'Pilih Template' },
    { num: 3, label: 'Generate Carousel' },
    { num: 4, label: 'Preview & Download' },
  ]

  // ── File Upload ─────────────────────────────────────
  const handleFiles = useCallback((files: FileList | File[]) => {
    const newImages = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - uploadedImages.length)
      .map(file => ({
        file,
        preview: URL.createObjectURL(file),
      }))
    setUploadedImages(prev => [...prev, ...newImages].slice(0, 5))
  }, [uploadedImages.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const newList = [...prev]
      URL.revokeObjectURL(newList[index].preview)
      newList.splice(index, 1)
      return newList
    })
  }

  // ── Extract Templates (simulated) ──────────────────
  async function extractTemplates() {
    setExtracting(true)
    setExtractProgress(10)

    // Simulate extraction progress
    for (let i = 20; i <= 90; i += 15) {
      await new Promise(r => setTimeout(r, 600))
      setExtractProgress(i)
    }

    // Generate mock templates based on uploaded images
    const mockTemplates: TemplateCard[] = uploadedImages.map((img, i) => ({
      id: `tpl-${i}`,
      name: `Style ${String.fromCharCode(65 + i)}`,
      previewHtml: `<div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;border-radius:16px;color:white;font-family:Inter;min-height:200px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><h2 style="font-size:24px;font-weight:700;margin-bottom:8px">Headline Here</h2><p style="font-size:14px;opacity:0.8">Body text for slide content</p></div>`,
      selected: false,
    }))

    // Add a few default templates
    mockTemplates.push(
      {
        id: 'tpl-dark',
        name: 'Dark Minimal',
        previewHtml: `<div style="background:#1a1a2e;padding:32px;border-radius:16px;color:white;font-family:Inter;min-height:200px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><h2 style="font-size:24px;font-weight:700;margin-bottom:8px">Headline</h2><p style="font-size:14px;opacity:0.7">Minimal dark style</p></div>`,
        selected: false,
      },
      {
        id: 'tpl-gradient',
        name: 'Gradient Pop',
        previewHtml: `<div style="background:linear-gradient(135deg,#f093fb,#f5576c);padding:32px;border-radius:16px;color:white;font-family:Inter;min-height:200px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"><h2 style="font-size:24px;font-weight:700;margin-bottom:8px">Headline</h2><p style="font-size:14px;opacity:0.8">Vibrant gradient style</p></div>`,
        selected: false,
      },
    )

    setTemplates(mockTemplates)
    setExtractProgress(100)
    await new Promise(r => setTimeout(r, 300))
    setExtracting(false)
    setStep(2)
  }

  // ── Generate Carousel (simulated) ──────────────────
  async function generateCarousel() {
    if (!topic.trim()) return
    setGenerating(true)
    setGenerateProgress(10)

    const pointsList = points.split('\n').filter(p => p.trim())

    for (let i = 20; i <= 90; i += 20) {
      await new Promise(r => setTimeout(r, 500))
      setGenerateProgress(i)
    }

    // Generate slides
    const generatedSlides: SlideData[] = []

    // Cover slide
    generatedSlides.push({
      headline: hook || topic,
      body: `oleh ${brandName}`,
      style: selectedTemplate || 'tpl-dark',
    })

    // Content slides
    for (let i = 0; i < Math.min(slideCount - 2, pointsList.length || slideCount - 2); i++) {
      generatedSlides.push({
        headline: pointsList[i] || `Poin ${i + 1}`,
        body: `Penjelasan detail tentang ${pointsList[i] || `poin ${i + 1}`}`,
        style: selectedTemplate || 'tpl-dark',
      })
    }

    // Fill remaining slides if needed
    while (generatedSlides.length < slideCount - 1) {
      generatedSlides.push({
        headline: `Poin ${generatedSlides.length}`,
        body: 'Tambahkan konten di sini',
        style: selectedTemplate || 'tpl-dark',
      })
    }

    // CTA slide
    generatedSlides.push({
      headline: cta || 'Follow untuk tips lainnya!',
      body: brandName,
      style: selectedTemplate || 'tpl-dark',
    })

    setSlides(generatedSlides)
    setGenerateProgress(100)
    await new Promise(r => setTimeout(r, 300))
    setGenerating(false)
    setStep(4)
  }

  // ── Download slide as image ────────────────────────
  function downloadSlide(index: number) {
    // In a real implementation, this would use html2canvas
    alert(`Download slide ${index + 1} - Fitur ini memerlukan Visual Engine API`)
  }

  function downloadAll() {
    alert(`Download semua ${slides.length} slides - Fitur ini memerlukan Visual Engine API`)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Image className="w-6 h-6 text-violet-500" />
              Content Studio
            </h1>
            <p className="text-muted-foreground text-sm">Visual Engine v2 — Buat carousel dari referensi desain</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-all">
            <FolderOpen className="w-3.5 h-3.5" />
            My Templates
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => s.num < step && setStep(s.num)}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-all',
                  step === s.num
                    ? 'text-violet-600 dark:text-violet-400'
                    : step > s.num
                      ? 'text-emerald-600 dark:text-emerald-400 cursor-pointer'
                      : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step === s.num
                    ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 scale-110'
                    : step > s.num
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                )}>
                  {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={cn(
                  'h-0.5 w-8 rounded transition-all',
                  step > s.num ? 'bg-emerald-400' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ═══ STEP 1: Upload Reference ═══ */}
        {step === 1 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-2">Upload Desain Referensi</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Upload 1-5 screenshot desain yang kamu suka. Setiap gambar akan dikonversi menjadi template HTML/CSS terpisah.
            </p>

            {/* Upload Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[280px] transition-all cursor-pointer',
                isDragOver
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/5 scale-[1.01]'
                  : 'border-border hover:border-violet-300 dark:hover:border-violet-500/30'
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-4">
                <UploadCloud className="w-8 h-8 text-violet-500" />
              </div>
              <p className="font-medium text-foreground mb-1">Drag & drop gambar di sini</p>
              <p className="text-sm text-muted-foreground mb-4">atau klik untuk browse (PNG, JPG - max 5 gambar)</p>
              <span className="px-4 py-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-medium">
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

            {/* Preview Uploaded Images */}
            {uploadedImages.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">{uploadedImages.length} gambar dipilih</span>
                  <button
                    onClick={() => {
                      uploadedImages.forEach(img => URL.revokeObjectURL(img.preview))
                      setUploadedImages([])
                    }}
                    className="text-xs text-red-500 hover:text-red-400 transition-all"
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-border aspect-square">
                      <img src={img.preview} alt={`ref-${i}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Folder Name */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-foreground mb-2">Nama Folder Template</label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={e => setFolderName(e.target.value)}
                    placeholder="e.g., Style Carousel Gelap"
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
                  />
                </div>

                {/* Extract Button */}
                <button
                  onClick={extractTemplates}
                  disabled={extracting}
                  className="mt-6 w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {extracting ? 'Mengekstrak...' : 'Extract Templates dari Referensi'}
                </button>

                {/* Extraction Progress */}
                {extracting && (
                  <div className="mt-4 bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-500/20 flex items-center justify-center animate-pulse">
                        <Zap className="w-4 h-4 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Mengekstrak template...</p>
                        <p className="text-xs text-muted-foreground">Mengirim gambar ke AI Vision</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-500"
                        style={{ width: `${extractProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 2: Template Selection ═══ */}
        {step === 2 && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-bold text-foreground mb-2">Template yang Diekstrak</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Berikut template HTML/CSS yang dihasilkan dari desain referensi. Klik untuk memilih.
            </p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={cn(
                    'rounded-2xl border-2 overflow-hidden transition-all text-left',
                    selectedTemplate === tpl.id
                      ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-lg'
                      : 'border-border hover:border-violet-300 hover:shadow-md'
                  )}
                >
                  <div
                    className="aspect-square"
                    dangerouslySetInnerHTML={{ __html: tpl.previewHtml }}
                  />
                  <div className="p-3 border-t border-border flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                    {selectedTemplate === tpl.id && (
                      <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!selectedTemplate}
              className="w-full max-w-md mx-auto py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              Lanjut ke Generate Carousel
            </button>
          </div>
        )}

        {/* ═══ STEP 3: Generate Carousel ═══ */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto space-y-5">
            <h2 className="text-xl font-bold text-foreground mb-2">Generate Carousel</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Isi konten carousel dan pilih style untuk setiap slide.
            </p>

            {/* Topic */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Topik Carousel</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., 5 Cara Meningkatkan Produktivitas"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Hook */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Hook (opsional)</label>
              <input
                type="text"
                value={hook}
                onChange={e => setHook(e.target.value)}
                placeholder="e.g., Kamu masih kerja 12 jam sehari?"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Value Points */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Poin-poin Utama (1 per baris)</label>
              <textarea
                value={points}
                onChange={e => setPoints(e.target.value)}
                rows={4}
                placeholder={"Pomodoro technique\nDeep work blocks\nEliminate distractions"}
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
              />
            </div>

            {/* CTA */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Call to Action (opsional)</label>
              <input
                type="text"
                value={cta}
                onChange={e => setCta(e.target.value)}
                placeholder="e.g., Follow untuk tips harian"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Brand Config */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Palette className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-foreground">Brand Config</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Font</label>
                  <select
                    value={brandFont}
                    onChange={e => setBrandFont(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  >
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Slide Count */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium text-foreground">Slide & Style</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Jumlah Slide:</label>
                  <select
                    value={slideCount}
                    onChange={e => setSlideCount(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-muted border border-border text-foreground text-sm outline-none"
                  >
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                    <option value={10}>10</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Template yang dipilih: {templates.find(t => t.id === selectedTemplate)?.name || 'Default'}
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateCarousel}
              disabled={generating || !topic.trim()}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate Carousel'}
            </button>

            {/* Generation Progress */}
            {generating && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-500/20 flex items-center justify-center animate-pulse">
                    <Zap className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Generating carousel...</p>
                    <p className="text-xs text-muted-foreground">Membuat konten slide dengan AI</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${generateProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 4: Preview & Download ═══ */}
        {step === 4 && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Carousel Preview</h2>
                <p className="text-sm text-muted-foreground">Klik slide untuk edit. Download semua atau per-slide.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(3); setSlides([]) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm text-foreground transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download Semua
                </button>
              </div>
            </div>

            {/* Slide Strip */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {slides.map((slide, i) => (
                <button
                  key={i}
                  onClick={() => setEditingSlide(editingSlide === i ? null : i)}
                  className={cn(
                    'shrink-0 w-[200px] rounded-2xl border-2 overflow-hidden transition-all',
                    editingSlide === i
                      ? 'border-violet-500 ring-2 ring-violet-500/20'
                      : 'border-border hover:border-violet-300'
                  )}
                >
                  <div className="aspect-square bg-gradient-to-br from-violet-600 to-purple-700 p-6 flex flex-col justify-center items-center text-center text-white">
                    <h3 className="text-sm font-bold mb-2 line-clamp-3">{slide.headline}</h3>
                    <p className="text-[11px] opacity-70 line-clamp-2">{slide.body}</p>
                  </div>
                  <div className="p-2 border-t border-border flex items-center justify-between bg-card">
                    <span className="text-[10px] text-muted-foreground">Slide {i + 1}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSlide(i) }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <Download className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </button>
              ))}
            </div>

            {/* Slide Editor */}
            {editingSlide !== null && slides[editingSlide] && (
              <div className="mt-6 bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Edit Slide {editingSlide + 1}</h3>
                  <button onClick={() => setEditingSlide(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Headline</label>
                    <input
                      type="text"
                      value={slides[editingSlide].headline}
                      onChange={e => {
                        const updated = [...slides]
                        updated[editingSlide] = { ...updated[editingSlide], headline: e.target.value }
                        setSlides(updated)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Style</label>
                    <select
                      value={slides[editingSlide].style}
                      onChange={e => {
                        const updated = [...slides]
                        updated[editingSlide] = { ...updated[editingSlide], style: e.target.value }
                        setSlides(updated)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm outline-none"
                    >
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Body</label>
                    <textarea
                      value={slides[editingSlide].body}
                      onChange={e => {
                        const updated = [...slides]
                        updated[editingSlide] = { ...updated[editingSlide], body: e.target.value }
                        setSlides(updated)
                      }}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
