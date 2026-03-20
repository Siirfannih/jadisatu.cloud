# Skill: Notion Operations

Operasi baca/tulis ke Notion workspace Jadisatu.
Hanya tersedia di CEO Mode.

## API Config

- Token: load dari environment variable NOTION_TOKEN
- Version: 2022-06-28
- Base URL: https://api.notion.com/v1

## Database IDs

| Database | ID | Fungsi |
|---|---|---|
| Mission Board | a479d259-b23d-43ec-b0a2-2ea5e350dd37 | Task management |
| Agent Sessions | f87bdec5-3277-4837-819a-4bafa44b5b8a | Log aktivitas |
| Status Agent | eec5140d-2eb0-4d2f-8e4c-e90938c2379f | Health tracking |
| Context Source | 8bdb68b9-d5b0-4ef0-a69b-2a08dc062a14 | Context pointers |

## Page IDs

| Page | ID | Fungsi |
|---|---|---|
| Agent Context Map | b7848d5d-dd92-4816-b73e-d649366f9c1f | Keputusan aktif |
| Jadisatu Works | a1f22683-d449-453b-b11f-5b0622edefc2 | Progress tracking |

## Operations

### Read Context Map
Baca keputusan terbaru dan strategi aktif.

### Check Missions
Query Mission Board untuk misi baru (status: "Not started") atau yang assigned.

### Log Session
Catat ringkasan kerja, keputusan, dan next steps ke Agent Sessions.

### Update Mission Status
Update progress misi (In Progress, Done, Blocked).

### Update Agent Status
Heartbeat: set online/idle/busy di Status Agent DB.
