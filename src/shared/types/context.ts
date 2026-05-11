export interface ProjectFingerprint {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  tsConfig?: {
    target?: string
    module?: string
    strict?: boolean
    lib?: string[]
  }
  directoryStructure: {
    hasTests: boolean
    hasDocs: boolean
    framework?: 'react' | 'vue' | 'angular' | 'express' | 'nest' | 'next' | 'unknown'
  }
}

export interface RelatedFile {
  path: string
  reason: 'imported-by' | 'imports' | 'referenced-in'
  distance: number  // 0 = direct, 1 = one hop, etc.
}

export interface ReviewerConfig {
  ignore?: string[]  // glob patterns to ignore
  focus?: string[]   // areas to focus on
  customPrompts?: {
    security?: string
    performance?: string
    architecture?: string
  }
  rules?: {
    maxFunctionLength?: number
    maxFileLength?: number
    requireTests?: boolean
  }
}

export interface ProjectContext {
  fingerprint: ProjectFingerprint
  relatedFiles: RelatedFile[]
  config?: ReviewerConfig
}
