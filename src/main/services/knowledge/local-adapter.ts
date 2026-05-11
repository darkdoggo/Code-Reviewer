import fs from 'fs/promises'
import path from 'path'
import type { KnowledgeItem } from '@shared/types/knowledge'
import { nanoid } from 'nanoid'

interface MarkdownFrontmatter {
  title: string
  category: string
  description: string
  tags?: string[]
}

export class LocalMarkdownAdapter {
  private knowledgeDir: string

  constructor(projectRoot: string) {
    this.knowledgeDir = path.join(projectRoot, 'docs', 'knowledge-base')
  }

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = []

    try {
      await fs.access(this.knowledgeDir)
    } catch {
      // Directory doesn't exist yet
      return items
    }

    const files = await fs.readdir(this.knowledgeDir)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    for (const file of mdFiles) {
      try {
        const filePath = path.join(this.knowledgeDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const item = this.parseMarkdown(content, file)
        if (item) items.push(item)
      } catch (err) {
        console.error(`Failed to parse ${file}:`, err)
      }
    }

    return items
  }

  private parseMarkdown(content: string, filename: string): KnowledgeItem | null {
    // Simple frontmatter parser (assumes YAML-like format)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!frontmatterMatch) return null

    const [, frontmatterText, body] = frontmatterMatch
    const frontmatter: any = {}

    // Parse frontmatter
    frontmatterText.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':')
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim()
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    })

    // Extract fullstack tip from body (support both English and Chinese section titles)
    const tipMatch = body.match(/##\s*(?:Full-stack Tip|全栈(?:工程师)?建议|全栈提示)\s*\n([\s\S]*?)(?=\n##|$)/i)
    const fullstackTip = tipMatch ? tipMatch[1].trim() : ''

    return {
      id: `local-${nanoid(8)}`,
      title: frontmatter.title || filename.replace('.md', ''),
      category: frontmatter.category || 'code-quality',
      description: frontmatter.description || 'Local knowledge base article',
      fullstackTip,
      source: 'local',
      filePath: filename,
      tags: frontmatter.tags ? frontmatter.tags.split(',').map((t: string) => t.trim()) : [],
      createdAt: Date.now()
    }
  }
}
