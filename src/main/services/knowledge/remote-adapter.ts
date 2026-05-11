import type { KnowledgeItem } from '@shared/types/knowledge'

export class RemoteAdapter {
  private remoteUrl: string

  constructor(remoteUrl?: string) {
    // Default to a GitHub repo or API endpoint
    this.remoteUrl = remoteUrl || 'https://raw.githubusercontent.com/example/knowledge-base/main/articles.json'
  }

  async getKnowledgeItems(): Promise<KnowledgeItem[]> {
    // TODO: Implement remote fetching
    // For now, return empty array
    // In the future, this could fetch from:
    // - GitHub repo (raw JSON or Markdown files)
    // - Notion API
    // - Custom backend API
    return []
  }
}
