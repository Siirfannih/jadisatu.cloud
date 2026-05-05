import { NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase-server'
import { isMandalaOwner } from '@/lib/mandala-auth'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const MANDALA_DIR = path.resolve(process.cwd(), '..', 'mandala')

async function readMarkdownFiles(dir: string, category: string) {
  const files: { name: string; category: string; content: string }[] = []
  try {
    const entries = await readdir(dir)
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const content = await readFile(path.join(dir, entry), 'utf-8')
        files.push({
          name: entry.replace('.md', '').replace(/-/g, ' '),
          category,
          content,
        })
      }
    }
  } catch {
    // Directory may not exist in all environments
  }
  return files
}

export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isMandalaOwner(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [knowledge, skills] = await Promise.all([
    readMarkdownFiles(path.join(MANDALA_DIR, 'knowledge'), 'knowledge'),
    readSkillFiles(),
  ])

  return NextResponse.json({ data: [...knowledge, ...skills] })
}

async function readSkillFiles() {
  const skillsDir = path.join(MANDALA_DIR, 'skills')
  const files: { name: string; category: string; content: string }[] = []

  try {
    const categories = await readdir(skillsDir)
    for (const cat of categories) {
      const catPath = path.join(skillsDir, cat)
      const catFiles = await readMarkdownFiles(catPath, `skill/${cat}`)
      files.push(...catFiles)
    }
  } catch {
    // Skills directory may not exist
  }

  return files
}
