import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Write Your Thoughts Uncaught Error]:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-surface-950 p-6 text-surface-100">
          <div className="max-w-md rounded-xl border border-surface-800 bg-surface-900 p-6 shadow-xl text-center">
            <h2 className="text-lg font-semibold text-danger-400 mb-2">Something went wrong</h2>
            <p className="text-sm text-surface-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred while rendering the application.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-surface-950 hover:bg-accent-500 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
