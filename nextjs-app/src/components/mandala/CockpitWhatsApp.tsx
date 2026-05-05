'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import {
 Smartphone, Wifi, WifiOff, Loader2, QrCode,
 RefreshCw, Power, PowerOff, AlertCircle, ShieldCheck, Zap, Activity,
 MessageSquare, CheckCircle2, Store, Save,
} from 'lucide-react'

const BUSINESS_CATEGORIES = [
 'Skincare & Kecantikan', 'Fashion & Pakaian', 'F&B / Kuliner', 'Jasa & Layanan',
 'Properti', 'Otomotif', 'Kesehatan & Wellness', 'Pendidikan', 'Teknologi', 'Lainnya',
]

const COMMUNICATION_STYLES = [
 { value: 'casual', label: 'Casual', desc: 'Santai, pakai emoji, seperti teman' },
 { value: 'formal', label: 'Formal', desc: 'Sopan, profesional, baku' },
 { value: 'ramah', label: 'Ramah', desc: 'Hangat, personal, perhatian' },
]

interface WASession {
 tenant_id: string
 status: 'disconnected' | 'qr_pending' | 'connecting' | 'connected' | 'logged_out'
 qr_code?: string | null
 phone_number?: string | null
 connected_at?: string | null
 disconnected_at?: string | null
 last_qr_at?: string | null
 error_message?: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Wifi }> = {
 connected: { label: 'Terhubung', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Wifi },
 qr_pending: { label: 'Scan Kode QR', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: QrCode },
 connecting: { label: 'Menghubungkan...', color: 'text-[#0060E1]', bg: 'bg-[#0060E1]/10', icon: Loader2 },
 disconnected: { label: 'Terputus', color: 'text-slate-400', bg: 'bg-slate-100', icon: WifiOff },
 logged_out: { label: 'Sesi Berakhir', color: 'text-red-500', bg: 'bg-red-500/10', icon: PowerOff },
}

export default function CockpitWhatsApp() {
 const [session, setSession] = useState<WASession | null>(null)
 const [loading, setLoading] = useState(true)
 const [actionLoading, setActionLoading] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null)
 const [onboardingStep, setOnboardingStep] = useState(0)
 const [ownerVerified, setOwnerVerified] = useState(false)
 const [ownerPhone, setOwnerPhone] = useState('')
 const [verifyCode, setVerifyCode] = useState('')
 const [verifyStep, setVerifyStep] = useState<'input' | 'code' | 'done'>('input')
 const [verifyLoading, setVerifyLoading] = useState(false)
 const [verifyError, setVerifyError] = useState<string | null>(null)
 const [businessForm, setBusinessForm] = useState({
   business_name: '', category: '', products: '', price_range: '', communication_style: 'ramah',
 })
 const [businessFormSaved, setBusinessFormSaved] = useState(false)
 const [businessFormLoading, setBusinessFormLoading] = useState(false)
 const [businessFormError, setBusinessFormError] = useState<string | null>(null)

 const handleSaveBusinessProfile = async () => {
   if (!businessForm.business_name.trim() || !businessForm.category || !businessForm.products.trim()) {
     setBusinessFormError('Nama bisnis, kategori, dan produk utama wajib diisi')
     return
   }
   setBusinessFormLoading(true)
   setBusinessFormError(null)
   try {
     const res = await fetch('/api/mandala/whatsapp/onboarding', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'save_business_profile', ...businessForm }),
     })
     const data = await res.json()
     if (!res.ok) { setBusinessFormError(data.error || 'Gagal menyimpan'); return }
     setBusinessFormSaved(true)
   } catch { setBusinessFormError('Network error') }
   finally { setBusinessFormLoading(false) }
 }

 const fetchStatus = useCallback(async () => {
 try {
 const res = await fetch('/api/mandala/whatsapp', {
 redirect: 'error',
 })
 if (!res.ok) {
 if (res.status === 403) return
 throw new Error('Gagal mengambil status')
 }
 const ct = res.headers.get('content-type') || ''
 if (!ct.includes('application/json')) {
 throw new Error('Respon server tidak valid')
 }
 const data = await res.json()
 setSession(data)
 setError(null)

 // Also fetch onboarding + owner verification status
 try {
 const obRes = await fetch('/api/mandala/whatsapp/onboarding')
 if (obRes.ok) {
 const ob = await obRes.json()
 setOnboardingStatus(ob.status || null)
 setOnboardingStep(ob.step || 0)
 setOwnerVerified(ob.owner_verified || false)
 if (ob.owner_verified) setVerifyStep('done')
 }
 } catch { /* silent */ }
 } catch (err) {
 console.error('WhatsApp status fetch error:', err)
 }
 }, [])

 const handleSendCode = async () => {
   if (!ownerPhone.trim()) return
   setVerifyLoading(true)
   setVerifyError(null)
   try {
     const res = await fetch('/api/mandala/whatsapp/verify', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'send_code', phone_number: ownerPhone }),
     })
     const data = await res.json()
     if (!res.ok) { setVerifyError(data.error); return }
     setVerifyStep('code')
   } catch { setVerifyError('Gagal mengirim kode') }
   finally { setVerifyLoading(false) }
 }

 const handleVerifyCode = async () => {
   if (!verifyCode.trim()) return
   setVerifyLoading(true)
   setVerifyError(null)
   try {
     const res = await fetch('/api/mandala/whatsapp/verify', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'verify_code', code: verifyCode }),
     })
     const data = await res.json()
     if (!res.ok) { setVerifyError(data.error); return }
     setVerifyStep('done')
     setOwnerVerified(true)
     fetchStatus()
   } catch { setVerifyError('Gagal verifikasi') }
   finally { setVerifyLoading(false) }
 }

 useEffect(() => {
 setLoading(true)
 fetchStatus().finally(() => setLoading(false))

 // Poll: 3s during QR scan, 10s otherwise
 const interval = setInterval(() => {
 fetchStatus()
 }, session?.status === 'qr_pending' || session?.status === 'connecting' ? 3000 : 10000)

 return () => clearInterval(interval)
 }, [fetchStatus, session?.status])

 const handleAction = async (action: 'connect' | 'disconnect') => {
 setActionLoading(true)
 setError(null)

 try {
 const res = await fetch('/api/mandala/whatsapp', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action }),
 redirect: 'error',
 })

 const ct = res.headers.get('content-type') || ''
 if (!ct.includes('application/json')) {
 throw new Error('Respon server tidak valid')
 }
 const data = await res.json()
 if (!data.success && data.error) {
 setError(data.error)
 }

 await fetchStatus()
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Tindakan gagal')
 } finally {
 setActionLoading(false)
 }
 }

 if (loading) {
 return (
 <div className="space-y-4">
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-12 flex flex-col items-center justify-center animate-pulse gap-6">
 <div className="w-20 h-20 rounded-2xl bg-slate-50 " />
 <div className="h-4 bg-slate-50 rounded w-1/3" />
 </div>
 </div>
 )
 }

 const status = session?.status || 'disconnected'
 const config = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected
 const StatusIcon = config.icon

 return (
 <div className="space-y-5 pb-20">
 {/* Primary Status Architecture Card */}
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 shadow-sm space-y-6 relative overflow-hidden group">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
 <div className="flex items-center gap-6">
 <div className={cn(
 "w-20 h-20 rounded-[2rem] flex items-center justify-center border transition-all duration-700 shadow-sm",
 status === 'connected' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10' : 'bg-slate-50 border-slate-200 text-slate-300'
 )}>
 <Smartphone size={40} className={cn("transition-transform duration-700", status === 'connected' && "scale-110")} />
 </div>
 <div className="space-y-2">
 <h3 className="text-xl font-bold text-slate-900">Koneksi WhatsApp</h3>
 <div className="flex items-center gap-3">
 <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full border border-current bg-current/5", config.color)}>
 <StatusIcon size={14} className={cn(status === 'connecting' && "animate-spin")} />
 <span className="text-[11px] font-bold uppercase tracking-wider leading-none">
 {config.label}
 </span>
 </div>
 {session?.phone_number && status === 'connected' && (
 <span className="text-[10px] font-mono text-slate-400 font-black uppercase tracking-widest pl-3 border-l border-slate-200">
 +{session.phone_number}
 </span>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3 w-full sm:w-auto">
 <button
 onClick={() => fetchStatus()}
 disabled={actionLoading}
 className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:text-[#0060E1] hover:border-[#0060E1]/50 transition-all disabled:opacity-30"
 title="Perbarui status"
 >
 <RefreshCw size={20} className={cn(actionLoading && "animate-spin")} />
 </button>

 {status === 'connected' ? (
 <button
 onClick={() => handleAction('disconnect')}
 disabled={actionLoading}
 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-all text-xs font-black uppercase tracking-widest shadow-sm shadow-red-500/10 disabled:opacity-50"
 >
 {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <PowerOff size={18} />}
 Putuskan Koneksi
 </button>
 ) : (
 <button
 onClick={() => handleAction('connect')}
 disabled={actionLoading || status === 'connecting' || status === 'qr_pending'}
 className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[#0060E1] text-white hover:bg-[#004FC0] transition-all text-xs font-black uppercase tracking-widest shadow-sm shadow-blue-500/10 disabled:opacity-50"
 >
 {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
 Sambungkan
 </button>
 )}
 </div>
 </div>

 {/* Dynamic Display Logic */}
 <div className="relative z-10">
 {/* QR Code Scan Area */}
 {status === 'qr_pending' && session?.qr_code && (
 <div className="flex flex-col items-center py-10 border-t border-slate-200/30 space-y-6 animate-in fade-in zoom-in duration-700">
 <div className="space-y-2 text-center">
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Hubungkan Perangkat</p>
 <p className="text-[13px] text-slate-400 font-light max-w-md mx-auto leading-relaxed">
 Buka WhatsApp di HP Anda, lalu scan kode QR ini untuk menghubungkan Mandala.
 </p>
 </div>
 
 <div className="relative group">
 <div className="absolute -inset-4 bg-[#0060E1]/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
 <div className="bg-white p-6 rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.05)] relative transform transition-transform hover:scale-[1.02]">
 <QRCodeSVG
 value={session.qr_code}
 size={280}
 level="H"
 includeMargin={false}
 />
 </div>
 </div>

 <div className="bg-slate-50 px-6 py-4 rounded-full flex items-center gap-3">
 <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
 Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat
 </p>
 </div>
 </div>
 )}

 {/* Connected Metrics Overview */}
 {status === 'connected' && (
 <div className="border-t border-slate-200/30 pt-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-5 duration-700">
 <div className="bg-slate-50 p-6 rounded-2xl group/meta">
 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Nomor Terhubung</span>
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-[#0060E1]/5 border border-[#0060E1]/10 flex items-center justify-center text-[#0060E1]">
 <Smartphone size={20} />
 </div>
 <p className="text-xl font-bold text-slate-900">+{session?.phone_number || '-'}</p>
 </div>
 </div>
 <div className="bg-slate-50 p-6 rounded-2xl group/meta">
 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Terhubung Sejak</span>
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500">
 <Zap size={20} />
 </div>
 <p className="text-xl font-bold text-slate-900">
 {session?.connected_at
 ? new Date(session.connected_at).toLocaleString('id-ID', {
 dateStyle: 'medium',
 timeStyle: 'short',
 })
 : '-'}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Owner Verification */}
 {status === 'connected' && verifyStep !== 'done' && (
 <div className="mt-6 p-6 rounded-2xl bg-amber-50 border border-amber-100 animate-in slide-in-from-bottom-5 duration-700">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
 <Smartphone size={16} />
 </div>
 <div>
 <p className="text-sm font-bold text-slate-800">Verifikasi Nomor Pribadi</p>
 <p className="text-[11px] text-slate-500">Masukkan nomor WA pribadi kamu (bukan nomor bisnis) agar Mandala bisa mengirim notifikasi ke kamu.</p>
 </div>
 </div>

 {verifyStep === 'input' && (
 <div className="space-y-3">
 <div className="flex gap-2">
 <input
 type="text"
 value={ownerPhone}
 onChange={(e) => setOwnerPhone(e.target.value)}
 placeholder="628xxxxxxxxxx"
 className="flex-1 px-4 py-3 rounded-xl bg-white text-sm border border-amber-200 focus:outline-none focus:border-amber-400"
 />
 <button
 onClick={handleSendCode}
 disabled={verifyLoading || !ownerPhone.trim()}
 className="px-6 py-3 rounded-xl bg-amber-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-all disabled:opacity-50"
 >
 {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : 'Kirim Kode'}
 </button>
 </div>
 <p className="text-[10px] text-amber-600">Kode verifikasi akan dikirim via WhatsApp ke nomor ini</p>
 </div>
 )}

 {verifyStep === 'code' && (
 <div className="space-y-3">
 <p className="text-xs text-slate-600">Kode verifikasi dikirim ke <span className="font-bold">{ownerPhone}</span>. Cek WhatsApp kamu.</p>
 <div className="flex gap-2">
 <input
 type="text"
 value={verifyCode}
 onChange={(e) => setVerifyCode(e.target.value)}
 placeholder="Masukkan 6 digit kode"
 maxLength={6}
 className="flex-1 px-4 py-3 rounded-xl bg-white text-sm border border-amber-200 focus:outline-none focus:border-amber-400 text-center font-mono text-lg tracking-widest"
 onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
 />
 <button
 onClick={handleVerifyCode}
 disabled={verifyLoading || verifyCode.length < 6}
 className="px-6 py-3 rounded-xl bg-amber-500 text-white text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-all disabled:opacity-50"
 >
 {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : 'Verifikasi'}
 </button>
 </div>
 <button onClick={() => { setVerifyStep('input'); setVerifyCode('') }} className="text-[10px] text-amber-600 hover:underline">
 ← Ganti nomor
 </button>
 </div>
 )}

 {verifyError && (
 <div className="mt-2 text-xs text-red-500 font-medium">{verifyError}</div>
 )}
 </div>
 )}

 {status === 'connected' && verifyStep === 'done' && (
 <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
 <ShieldCheck size={16} />
 </div>
 <div>
 <p className="text-sm font-bold text-emerald-700">Nomor owner terverifikasi ✅</p>
 <p className="text-[11px] text-emerald-600">Mandala akan mengirim notifikasi penting ke nomor pribadi kamu.</p>
 </div>
 </div>
 )}

 {/* Business Profile Form — Hybrid Onboarding Step 1 */}
 {status === 'connected' && verifyStep === 'done' && !businessFormSaved && onboardingStatus !== 'completed' && (
 <div className="mt-6 p-6 rounded-2xl bg-white border border-[#0060E1]/10 shadow-sm space-y-5 animate-in slide-in-from-bottom-5 duration-700">
   <div className="flex items-center gap-3">
     <div className="w-10 h-10 rounded-xl bg-[#0060E1]/10 flex items-center justify-center text-[#0060E1]"><Store size={20} /></div>
     <div>
       <p className="text-sm font-bold text-slate-800">Kenalkan Bisnis Kamu</p>
       <p className="text-[11px] text-slate-400">Isi data bisnis agar Mandala bisa handle customer dengan tepat</p>
     </div>
   </div>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     <div className="space-y-1.5">
       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Bisnis *</label>
       <input type="text" value={businessForm.business_name} onChange={(e) => setBusinessForm(f => ({ ...f, business_name: e.target.value }))} placeholder="e.g. Skincare by Sarah" className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm border border-slate-100 focus:outline-none focus:border-[#0060E1]" />
     </div>
     <div className="space-y-1.5">
       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori Bisnis *</label>
       <select value={businessForm.category} onChange={(e) => setBusinessForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm border border-slate-100 focus:outline-none focus:border-[#0060E1]">
         <option value="">Pilih kategori...</option>
         {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
       </select>
     </div>
   </div>
   <div className="space-y-1.5">
     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Produk / Jasa Utama * (2-3 item)</label>
     <textarea value={businessForm.products} onChange={(e) => setBusinessForm(f => ({ ...f, products: e.target.value }))} placeholder="e.g. Serum vitamin C, Moisturizer, Facial treatment" rows={2} className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm border border-slate-100 focus:outline-none focus:border-[#0060E1] resize-none" />
   </div>
   <div className="space-y-1.5">
     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kisaran Harga</label>
     <input type="text" value={businessForm.price_range} onChange={(e) => setBusinessForm(f => ({ ...f, price_range: e.target.value }))} placeholder="e.g. Rp50.000 - Rp500.000" className="w-full px-4 py-3 rounded-xl bg-slate-50 text-sm border border-slate-100 focus:outline-none focus:border-[#0060E1]" />
   </div>
   <div className="space-y-2">
     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gaya Komunikasi Mandala</label>
     <div className="grid grid-cols-3 gap-3">
       {COMMUNICATION_STYLES.map(s => (
         <button key={s.value} onClick={() => setBusinessForm(f => ({ ...f, communication_style: s.value }))} className={cn("p-3 rounded-xl border text-left transition-all", businessForm.communication_style === s.value ? "border-[#0060E1] bg-[#0060E1]/5" : "border-slate-100 hover:border-slate-200")}>
           <p className="text-xs font-bold text-slate-700">{s.label}</p>
           <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
         </button>
       ))}
     </div>
   </div>
   {businessFormError && <p className="text-xs text-red-500 font-medium">{businessFormError}</p>}
   <button onClick={handleSaveBusinessProfile} disabled={businessFormLoading} className="w-full py-3.5 rounded-xl bg-[#0060E1] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#004FC0] disabled:opacity-50 flex items-center justify-center gap-2">
     {businessFormLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
     Simpan & Lanjutkan
   </button>
   <p className="text-[10px] text-slate-400 text-center">Setelah disimpan, Mandala akan mengirim pertanyaan lanjutan via WhatsApp</p>
 </div>
 )}

 {/* Onboarding Progress */}
 {status === 'connected' && ownerVerified && onboardingStatus && onboardingStatus !== 'completed' && (
 <div className="mt-6 p-6 rounded-2xl bg-blue-50 border border-blue-100 animate-in slide-in-from-bottom-5 duration-700">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
 <MessageSquare size={16} />
 </div>
 <div>
 <p className="text-sm font-bold text-slate-800">
 {onboardingStatus === 'wa_connected' ? 'Cek WhatsApp kamu!' : 'Mandala sedang kenalan...'}
 </p>
 <p className="text-[11px] text-slate-500">
 {onboardingStatus === 'wa_connected'
 ? 'Mandala sudah kirim pesan. Reply "oke" untuk mulai.'
 : `Pertanyaan ${onboardingStep}/7 dijawab`}
 </p>
 </div>
 </div>
 {onboardingStatus === 'interviewing' && (
 <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
 <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(onboardingStep / 7) * 100}%` }} />
 </div>
 )}
 </div>
 )}

 {status === 'connected' && ownerVerified && onboardingStatus === 'completed' && (
 <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
 <CheckCircle2 size={16} />
 </div>
 <div>
 <p className="text-sm font-bold text-emerald-700">Mandala sudah siap!</p>
 <p className="text-[11px] text-emerald-600">Bisnis kamu sudah dikenali. Mandala siap handle customer 24/7.</p>
 </div>
 </div>
 )}

 {/* Error Handler */}
 {(error || session?.error_message) && (
 <div className="mt-8 flex items-start gap-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-500 animate-in shake duration-500">
 <AlertCircle size={20} className="shrink-0 mt-0.5" />
 <div className="space-y-1">
 <p className="text-[11px] font-bold uppercase tracking-wider">Kesalahan Koneksi</p>
 <p className="text-sm font-light leading-relaxed">{error || session?.error_message}</p>
 </div>
 </div>
 )}

 {/* Connecting State */}
 {status === 'connecting' && (
 <div className="border-t border-slate-200/30 pt-10 text-center space-y-6 animate-in fade-in duration-500">
 <div className="relative inline-block">
 <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
 <Loader2 size={48} className="animate-spin text-[#0060E1] mx-auto relative" />
 </div>
 <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Sedang menyambungkan...</p>
 </div>
 )}

 {/* Logged Out Strategy */}
 {status === 'logged_out' && (
 <div className="border-t border-slate-200/30 pt-10 text-center space-y-6">
 <div className="w-20 h-20 rounded-full bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500 mx-auto">
 <PowerOff size={32} />
 </div>
 <div className="space-y-4">
 <p className="text-[13px] text-slate-400 font-light max-w-xs mx-auto">
 Sesi WhatsApp sudah berakhir. Klik sambungkan untuk menghubungkan ulang.
 </p>
 <button 
 onClick={() => handleAction('connect')}
 className="px-8 py-3 rounded-2xl bg-slate-50 text-[11px] font-bold uppercase tracking-wider hover:border-red-500/50 transition-all"
 >
 Sambungkan Ulang
 </button>
 </div>
 </div>
 )}
 </div>

 <Activity size={200} className="absolute -bottom-20 -right-20 text-[#0060E1]/[0.02] group-hover:text-[#0060E1]/[0.03] transition-all duration-1000" />
 </div>

 {/* Strategic Information Panel */}
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 relative overflow-hidden">
 <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
 <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
 <ShieldCheck size={28} />
 </div>
 <div className="space-y-4">
 <h4 className="font-bold text-lg tracking-tight">Keamanan & Privasi</h4>
 <ul className="space-y-4">
 <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl hover:border-[#0060E1]/30 transition-all">
 <div className="w-1.5 h-1.5 bg-[#0060E1] rounded-full mt-2 shrink-0" />
 <p className="text-[13px] text-slate-400 leading-relaxed">Mandala membantu otomatisasi chat tanpa menghilangkan kendali penuh Anda.</p>
 </li>
 <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl hover:border-[#0060E1]/30 transition-all">
 <div className="w-1.5 h-1.5 bg-[#0060E1] rounded-full mt-2 shrink-0" />
 <p className="text-[13px] text-slate-400 leading-relaxed">Semua data percakapan tetap terenkripsi sesuai standar keamanan WhatsApp.</p>
 </li>
 <li className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl hover:border-[#0060E1]/30 transition-all">
 <div className="w-1.5 h-1.5 bg-[#0060E1] rounded-full mt-2 shrink-0" />
 <p className="text-[13px] text-slate-400 leading-relaxed">Anda bisa memutuskan koneksi kapan saja dari halaman ini atau langsung dari HP.</p>
 </li>
 </ul>
 </div>
 </div>
 </div>
 </div>
 )
}
