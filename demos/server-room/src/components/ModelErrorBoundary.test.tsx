import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ModelErrorBoundary } from './ModelErrorBoundary'

function ThrowingChild(): ReactNode {
  throw new Error('GLB failed to load')
}

describe('ModelErrorBoundary', () => {
  it('shows the failed model URL and reports the error once', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const onError = vi.fn()
    const modelUrl =
      '/demos/server-room/models/server-room.glb'

    try {
      render(
        <ModelErrorBoundary
          modelUrl={modelUrl}
          onError={onError}
        >
          <ThrowingChild />
        </ModelErrorBoundary>,
      )

      const alert = screen.getByRole('alert')
      expect(
        screen.getByRole('heading', {
          name: '3Dモデルを読み込めませんでした',
        }),
      ).toBeInTheDocument()
      expect(alert.querySelector('code')).toHaveTextContent(modelUrl)
      expect(alert).toHaveTextContent('配置')
      expect(screen.queryByText('GLB failed to load')).not.toBeInTheDocument()
      expect(onError).toHaveBeenCalledTimes(1)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('renders its child while no error occurs', () => {
    render(
      <ModelErrorBoundary
        modelUrl="/models/server-room.glb"
        onError={() => undefined}
      >
        <p>3D scene content</p>
      </ModelErrorBoundary>,
    )

    expect(screen.getByText('3D scene content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
