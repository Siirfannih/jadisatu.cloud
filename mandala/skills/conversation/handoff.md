# Skill: Handoff Protocol

Protokol transisi antara Owner/Admin dan Mandala. Harus seamless — customer gak boleh tau.

## Owner → Mandala (Auto-takeover)

### Trigger
- Owner/Admin tidak reply pesan customer selama 2 menit
- Timer dimulai sejak pesan customer masuk

### Proses
1. Baca SELURUH chat history conversation ini
2. Identifikasi gaya bahasa Owner/Admin (pakai skill: style-matching)
3. Identifikasi konteks terakhir:
   - Customer nanya apa?
   - Topik sedang membahas apa?
   - Apakah ada pertanyaan yang belum dijawab?
4. Generate reply yang match style & continue konteks
5. JANGAN bilang "maaf tadi gak kebaca" atau apapun yang imply pergantian
6. Log: `{ event: "handoff", from: "owner", to: "mandala", conversation_id, timestamp }`

### Pengecualian
- Kalau Owner sedang typing (typing indicator aktif) → tunggu, jangan ambil alih
- Kalau Owner baru saja kirim pesan < 2 menit lalu → reset timer

## Mandala → Owner (Manual takeover)

### Trigger
- Owner/Admin kirim pesan di conversation yang sedang di-handle Mandala

### Proses
1. IMMEDIATELY stop generating response
2. Cancel pending reply kalau ada
3. Set mode: STANDBY (Mandala gak reply sampai timer 2 menit aktif lagi)
4. Log: `{ event: "handoff", from: "mandala", to: "owner", conversation_id, timestamp }`

### Anti-Double Message
- Kalau Owner kirim pesan di detik ke-115 (hampir 2 menit) dan Mandala sudah queue reply:
  - CANCEL Mandala's reply
  - Owner's message takes priority
- Lock mechanism: hanya 1 entity (Owner ATAU Mandala) yang boleh reply pada satu waktu

## Mandala → Owner (Flag/Escalate)

### Trigger
- Mandala gak confident menjawab (knowledge gap)
- Customer marah atau eskalasi
- Negosiasi harga di luar authority
- Customer minta bicara dengan "orang asli"
- Customer tanya sesuatu yang sangat teknis/spesifik

### Proses
1. Reply ke customer: "bentar ya kak, aku cek dulu"
2. Kirim notifikasi ke Owner:
   ```
   [FLAG] Customer: [nama/nomor]
   Konteks: [ringkasan 1-2 kalimat]
   Perlu: [apa yang dibutuhkan dari Owner]
   Chat: [link ke conversation di dashboard]
   ```
3. Timer 5 menit:
   - Owner response → handoff ke Owner
   - Owner gak response → Mandala coba jawab best-effort
   - Masih gak confident → "aku sambungin sama yang lebih paham ya kak, bentar"

## Ping-Pong Mode (Owner & Mandala Bergantian)

Ini yang akan sering terjadi di real scenario:
```
Owner reply → Mandala standby
Owner sibuk (2 min) → Mandala take over
Owner reply lagi → Mandala standby
Owner pergi (2 min) → Mandala take over
```

Customer experience: "admin ini responsive banget, selalu ada"

## Dashboard Visibility

Owner harus bisa lihat di CRM dashboard:
- Siapa yang sedang handle conversation (Owner/Mandala)
- History handoff per conversation
- Flag/escalation queue
- [Take Over] button untuk manual takeover kapanpun
