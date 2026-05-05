import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isMandalaOwner } from '@/lib/mandala-auth'
import { readFile } from 'fs/promises'
import path from 'path'

const MANDALA_DIR = path.resolve(process.cwd(), '..', 'mandala')

async function safeReadFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isMandalaOwner(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [rules, identity, salesShadow, ceoAssistant] = await Promise.all([
    safeReadFile(path.join(MANDALA_DIR, 'core', 'rules.md')),
    safeReadFile(path.join(MANDALA_DIR, 'core', 'identity.md')),
    safeReadFile(path.join(MANDALA_DIR, 'modes', 'sales-shadow.md')),
    safeReadFile(path.join(MANDALA_DIR, 'modes', 'ceo-assistant.md')),
  ])

  return NextResponse.json({
    data: {
      rules,
      identity,
      modes: {
        sales_shadow: salesShadow,
        ceo_assistant: ceoAssistant,
      },
    },
  })
}
