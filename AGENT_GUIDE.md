# Jadisatu Agent System - Panduan Operasional

## Cara Kerja Sistem

```
┌─────────────────────────────────────────────────────────┐
│                    FLOW HARIAN KAMU                      │
│                                                          │
│  1. Tulis GitHub Issue (dari HP/laptop)                 │
│     ↓                                                    │
│  2. Label: "agent-task"                                 │
│     ↓                                                    │
│  3. GitHub Actions trigger Claude Code Agent            │
│     ↓                                                    │
│  4. Agent: buat branch → code → test → PR              │
│     ↓                                                    │
│  5. Kamu dapat notif di Telegram via OpenClaw           │
│     ↓                                                    │
│  6. Review PR di GitHub (approve/request changes)       │
│     ↓                                                    │
│  7. Merge → auto-deploy ke jadisatu.cloud               │
│     ↓                                                    │
│  8. Notif deploy sukses di Telegram                     │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Buat Task (30 detik)
Buka GitHub → Issues → New Issue → tulis:

```
Title: [Phase 1] Fix ideas_status_check constraint

## Context
Creative Hub error saat create idea baru karena status constraint.

## Acceptance Criteria
- [ ] Constraint di-update untuk support: active, archived, idea, draft, script, ready, published
- [ ] Migration SQL dibuat di /sql/
- [ ] Creative Hub bisa create idea tanpa error
- [ ] Build sukses

## Agent Instructions
1. Baca /sql/ untuk schema yang ada
2. Buat migration baru: /sql/fix-ideas-status-constraint.sql
3. Update frontend jika perlu
4. Validate: npx tsc --noEmit && npm run build
```

Label: `agent-task`

### 2. Tunggu Agent Kerja
Agent akan:
- Comment "🤖 Agent picked up this task"
- Buat branch `agent/issue-{number}`
- Code sesuai instructions
- Jalankan TypeScript check & build
- Buat PR

### 3. Review PR (2-5 menit)
Buka PR di GitHub → review changes → approve atau request changes.

### 4. Merge & Deploy (otomatis)
Merge PR → GitHub Actions auto-deploy ke VPS → notif di Telegram.

---

## Menulis Issue yang Baik

### Template Standar
```markdown
Title: [Phase X] Deskripsi singkat

## Context
Kenapa ini perlu dikerjakan.

## Acceptance Criteria
- [ ] Requirement spesifik 1
- [ ] Requirement spesifik 2
- [ ] TypeScript compiles
- [ ] Build succeeds

## Technical Notes
- Files: src/app/ideas/page.tsx, src/lib/supabase.ts
- DB changes: yes/no
- Depends on: #issue_number

## Agent Instructions
Instruksi spesifik untuk agent.
```

### Tips
- **Spesifik** > generik. "Add dark mode toggle to header" lebih baik dari "implement theme system"
- **Satu scope per issue**. Jangan campur frontend + backend + database dalam satu issue
- **Include file paths** yang kemungkinan perlu diubah
- **Acceptance criteria harus testable** - agent bisa verify sendiri

---

## Agent Roles

### Kapan pakai agent mana?

| Task Type | Agent | Contoh |
|---|---|---|
| UI/halaman baru | `frontend-dev` | Build kanban board, add settings page |
| API/database | `backend-architect` | New API route, schema migration |
| Deploy/infra | `devops` | Fix nginx config, update PM2 |
| Planning/breakdown | `sprint-lead` | Break Phase 2 into 5 issues |

### Cara Activate Agent di Claude Code (manual session)
```
Kamu: "Load agent frontend-dev dan kerjakan issue #15"
Claude: *reads .claude/agents/frontend-dev.md → applies context → works*
```

---

## GitHub Secrets yang Perlu Di-setup

Buka: GitHub → Settings → Secrets and variables → Actions

| Secret | Value | Keterangan |
|---|---|---|
| `VPS_HOST` | `76.13.190.196` | IP VPS Hostinger |
| `VPS_USER` | `root` | SSH user |
| `VPS_PORT` | `2222` | SSH port |
| `VPS_SSH_KEY` | *(private key)* | SSH key untuk akses VPS |
| `ANTHROPIC_API_KEY` | *(API key)* | Untuk Claude Code SDK (nanti) |

---

## Monitoring

### Dari Telegram (via OpenClaw)
- Deploy sukses/gagal → notif otomatis
- Agent task selesai/gagal → notif otomatis

### Dari GitHub
- Issues: lihat status semua task
- Pull Requests: lihat semua agent output
- Actions: lihat CI/CD logs

### Dari VPS (jika perlu debug)
```bash
ssh -p 2222 root@76.13.190.196
bash /root/jadisatu.cloud/deploy/check-status.sh
pm2 logs --lines 50
```

---

## Troubleshooting

### Agent PR gagal build
1. Buka PR → lihat GitHub Actions log
2. Comment di PR: "Fix the TypeScript error on line X"
3. Agent akan push fix (jika menggunakan Claude Code website)
4. Atau: checkout branch lokal, fix manual, push

### Deploy gagal
1. Cek Telegram notif untuk error message
2. SSH ke VPS: `bash deploy/check-status.sh`
3. Cek logs: `pm2 logs --lines 100`
4. Fix dan re-deploy: `bash deploy/deploy.sh`

### OpenClaw notif tidak sampai
1. SSH ke VPS
2. Cek OpenClaw: `curl http://localhost:18789/health`
3. Jika down: restart gateway service
4. Cek token di environment

---

## Fase Adopsi

### Minggu 1 (sekarang)
- [x] GitHub Actions CI/CD
- [x] Agent prompts
- [x] Notification pipeline
- [x] CLAUDE.md upgraded
- [ ] Setup GitHub Secrets
- [ ] Test first agent task (Phase 1 bug fix)

### Minggu 2
- [ ] Integrate Claude Code SDK di agent-task.yml
- [ ] Tune prompts berdasarkan hasil minggu 1
- [ ] Mulai Phase 2-3 via agent tasks

### Minggu 3+
- [ ] Full autonomous: kamu cuma review & approve
- [ ] Multiple issues paralel
- [ ] Agent belajar dari pattern sebelumnya
