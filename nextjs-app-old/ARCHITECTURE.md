# Arsitektur Jadisatu.cloud — Dashboard OS & Integrasi Agent

## 1. Rekomendasi: Jadisatu.cloud vs Notion

**Rekomendasi: Bangun Jadisatu.cloud.**

| Aspek | Notion | Jadisatu.cloud |
|-------|--------|----------------|
| Tampilan | Sangat fleksibel, bisa kompleks | Bisa didesain sederhana, fokus produktivitas |
| Integrasi agent | Perlu API Notion + mapping logic | Native: satu database (Supabase), agent baca/tulis langsung |
| Konteks bersama | Agent A dan B harus sync manual ke Notion | Satu sumber kebenaran, semua agent baca yang sama |
| Masa depan produk | Notion untuk diri sendiri | Bisa dijual ke pelajar / solopreneur (produk Anda) |

Notion tetap bisa dipakai untuk hal yang sudah nyaman (misalnya content planning), tapi **pusat tugas, fokus hari ini, dan "otak bersama" agent sebaiknya di Jadisatu.cloud** agar lebih sederhana dan siap jadi produk.

---

## 2. Akses Agent: API Key vs Service Account

**Rekomendasi: Satu service account.**

- **Satu identitas** untuk semua agent (OpenClaw, Antigravity): satu credential, satu tempat rotate, lebih hemat biaya.
- **Scoped access**: service account hanya akses Supabase (atau API jadisatu.cloud), tidak perlu akses lain.
- Banyak API key = banyak billing dimension dan lebih rumit aman.

**Praktik:** Buat satu Supabase "service role" atau satu API key khusus agent; OpenClaw dan Antigravity pakai yang sama.

---

## 3. Sync Dashboard ↔ Agent: Efisien & Hemat Token

Ide awal: webhook dari dashboard ke agent tiap ada perubahan. Itu bisa boros (banyak panggilan, banyak token).

**Arsitektur yang diusulkan: Pull + Push Selektif**

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Jadisatu.cloud │         │  Supabase         │         │  OpenClaw /      │
│  (Dashboard)    │ ──write─▶  (DB + Realtime)  │ ◀─read──│  Antigravity     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
         │                              │
         │                              │ 1. GET /api/context-digest
         │                              │    (hash + last_updated)
         │                              │ 2. Jika berubah → GET hanya delta
         │                              │ 3. Webhook hanya untuk "event penting"
         └──────────────────────────────┘
```

### 3.1 Yang agent lakukan (hemat token)

1. **Context digest (ringan)**  
   Agent memanggil **satu endpoint**: `GET https://jadisatu.cloud/api/context-digest`.  
   Response kecil, contoh:
   ```json
   {
     "version": "digest-...",
     "updated_at": "2026-02-20T10:00:00Z",
     "focus": ["Prioritas 1"],
     "tasks_in_progress": 2,
     "context_updated": true
   }
   ```
   - Cukup untuk memutuskan: "perlu baca konteks lengkap atau tidak."
   - Agent simpan `version` terakhir; jika `version` sama, **tidak perlu fetch lagi** → hemat token.

2. **Fetch delta hanya saat perlu**  
   Jika `context_updated` atau version berubah, agent panggil endpoint khusus (mis. `GET /api/context-for-agent`) yang mengembalikan **hanya**:
   - Today's focus
   - Task in progress (judul + status)
   - Ringkasan Context Hub (profile, decision log terbaru, shared memory)
   - Bukan full history, supaya payload kecil.

3. **Tanpa webhook untuk setiap edit**  
   Dashboard tidak kirim webhook tiap kali user mengubah satu task.  
   Webhook dipakai hanya untuk **event penting**, misalnya:
   - "Context Hub baru saja di-update" → agent di-notify agar sekali lagi cek digest.
   - (Opsional) "Task prioritas tinggi baru ditugaskan ke kamu" → notifikasi ke OpenClaw/WA.

Dengan begitu:
- Token hemat: agent hanya baca saat perlu dan hanya delta.
- Server tidak overload: tidak ada webhook per keystroke.
- Konteks tetap sama: semua agent baca dari sumber yang sama (Supabase).

### 3.2 Alur singkat

| Pihak | Aksi |
|-------|------|
| User | Edit task / Context Hub di dashboard |
| Dashboard | Simpan ke Supabase |
| Agent | Secara periodik (atau saat user tanya): GET digest → jika berubah, GET delta → update konteks internal |
| (Opsional) | Pada "event penting", dashboard panggil webhook agent → agent sekali cek digest |

---

## 4. Tech Stack

- **Frontend:** Next.js (repo: jadisatu-os)
- **DB & Auth:** Supabase (Postgres + Realtime)
- **Backend API:** Next.js API routes + Supabase
- **Agent:** Satu service account ke Supabase + endpoint context-digest / context-for-agent

---

## 5. Endpoint untuk Agent

- **GET /api/context-digest** — Response ringan (version, focus, tasks_in_progress). Dipanggil periodik; jika version sama, agent tidak perlu fetch konteks lengkap.
- **GET /api/context-for-agent** (rencana) — Delta konteks lengkap untuk agent setelah digest berubah.
