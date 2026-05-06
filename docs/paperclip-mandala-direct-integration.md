# Paperclip <-> Mandala Direct Integration

Mandala sekarang berjalan direct via Baileys:

- `WhatsApp -> Baileys -> mandala-engine`
- bukan lagi lewat OpenClaw

Paperclip harus dihubungkan langsung ke `mandala-engine`.

## Authentication

Set `PAPERCLIP_SHARED_TOKEN` pada `mandala-engine`.

Gunakan salah satu header berikut dari Paperclip:

- `Authorization: Bearer <token>`
- `X-Paperclip-Token: <token>`

Jika `PAPERCLIP_SHARED_TOKEN` kosong, endpoint tetap terbuka untuk local testing.

## Manifest

Ambil kontrak integrasi:

```bash
curl -sS \
  -H "Authorization: Bearer $PAPERCLIP_SHARED_TOKEN" \
  "https://jadisatu.cloud/api/mandala/paperclip/manifest?tenant=mandala"
```

Response berisi:

- `health`
- `context`
- `reviews`
- `policies`
- `outreach_queue`
- `webhook`

## Read Model

Paperclip menarik state terbaru dari:

- `GET /api/paperclip/context?tenant=mandala`

Atau granular:

- `GET /api/learning/reviews?tenant=mandala`
- `GET /api/learning/policies?tenant=mandala`
- `GET /api/outreach/queue?tenant=mandala`

## Write Model

Paperclip mendorong keputusan ke:

- `POST /webhook/paperclip`

Payload `action` yang didukung:

- `resolve_review`
- `activate_policy`
- `enqueue_prospect`
- `enqueue_manual`
- `process_outreach`

## Example

Resolve review:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $PAPERCLIP_SHARED_TOKEN" \
  -H "Content-Type: application/json" \
  "https://jadisatu.cloud/webhook/paperclip" \
  -d '{
    "tenant": "mandala",
    "action": "resolve_review",
    "review_id": "REVIEW_ID",
    "decision": "approved",
    "notes": "Greeting duplication is confirmed and should stay blocked."
  }'
```

Enqueue outreach lead:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $PAPERCLIP_SHARED_TOKEN" \
  -H "Content-Type: application/json" \
  "https://jadisatu.cloud/webhook/paperclip" \
  -d '{
    "tenant": "mandala",
    "action": "enqueue_manual",
    "target_number": "6281234567890",
    "business_name": "Contoh Leads",
    "draft_message": "Halo kak, saya bantu jelaskan Mandala ya."
  }'
```

## Minimum Paperclip Flow

1. Poll `context`.
2. Review `pending_reviews`.
3. Promote or reject candidate policies.
4. Fill or process `outreach_queue`.
5. Push decisions back through `/webhook/paperclip`.
