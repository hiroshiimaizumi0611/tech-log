import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ModelErrorBoundaryProps {
  children: ReactNode
  modelUrl: string
  onError: () => void
}

interface ModelErrorBoundaryState {
  hasError: boolean
}

export class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Failed to render the 3D server room model', error, info)
    this.props.onError()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <h2>3Dモデルを読み込めませんでした</h2>
          <p>
            モデルファイルを <code>{this.props.modelUrl}</code>{' '}
            に配置してください。
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
