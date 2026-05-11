import React from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <AlertCircle size={48} className="text-red-500" />
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">出错了</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
              页面渲染时发生错误
            </p>
            {this.state.error && (
              <details className="text-xs text-left bg-[hsl(var(--secondary))] p-3 rounded-md max-w-2xl">
                <summary className="cursor-pointer font-medium mb-2">错误详情</summary>
                <pre className="whitespace-pre-wrap break-words">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-md hover:opacity-90 transition-opacity"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
