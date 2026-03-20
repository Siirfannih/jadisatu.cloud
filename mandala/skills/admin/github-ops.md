# Skill: GitHub Operations

Operasi GitHub via `gh` CLI. Hanya tersedia di CEO Mode.

## Config

- Username pemilik: Siirfannih
- Repos utama:
  - Siirfannih/jadisatu.cloud — Product utama
  - Siirfannih/agent-config — Delegation hub
  - Siirfannih/mandala-platform — Platform AI Agent (repo ini)

## Delegasi ke PC Server

Buat GitHub Issue di Siirfannih/agent-config:

```
Title: [TASK] Deskripsi singkat
Labels: mandala-task, priority-{high|medium|low}
Body:
## Objective
[Apa yang harus dicapai]

## Context
[File, repo, branch yang relevan]

## Acceptance Criteria
- [ ] Kriteria 1
- [ ] Kriteria 2

## Constraints
[Batasan yang harus dipatuhi]
```

## Monitoring

- Cek workflow runs: `gh run list --repo Siirfannih/agent-config`
- Cek issue comments: `gh issue view <number> --repo Siirfannih/agent-config --comments`
- Recent commits: `gh api repos/Siirfannih/<repo>/commits?per_page=5`

## Rules

- JANGAN push langsung ke main
- JANGAN delete branch tanpa konfirmasi Owner
- Monitor delegated task setiap 30 menit
- Lapor hasil ke Owner setelah task selesai
