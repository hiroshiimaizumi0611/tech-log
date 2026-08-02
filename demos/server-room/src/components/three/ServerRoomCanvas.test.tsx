import { act, render, screen } from '@testing-library/react'
import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServerId, ServerStatus } from '../../types/server'
import { ServerRoomCanvas } from './ServerRoomCanvas'

let orbitControlsOnChange: (() => void) | undefined
let modelOnReady: (() => void) | undefined

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <>
      {Children.toArray(children).filter(
        (child) => !isValidElement(child) || typeof child.type !== 'string',
      )}
    </>
  ),
}))

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <>{children}</>,
  OrbitControls: ({ onChange }: { onChange: () => void }) => {
    orbitControlsOnChange = onChange
    return null
  },
}))

vi.mock('./ServerRoomModel', () => ({
  ServerRoomModel: ({ onReady }: { onReady: () => void }) => {
    modelOnReady = onReady
    return null
  },
}))

const statuses = {
  server_01_01: 'healthy',
  server_01_02: 'healthy',
  server_01_03: 'healthy',
  server_01_04: 'healthy',
  server_01_05: 'healthy',
  server_01_06: 'healthy',
  server_02_01: 'healthy',
  server_02_02: 'healthy',
  server_02_03: 'healthy',
  server_02_04: 'healthy',
  server_02_05: 'healthy',
  server_02_06: 'healthy',
  server_02_07: 'healthy',
  server_02_08: 'healthy',
} satisfies Record<ServerId, ServerStatus>

describe('ServerRoomCanvas', () => {
  beforeEach(() => {
    orbitControlsOnChange = undefined
    modelOnReady = undefined
  })

  it('reports model readiness only when the model reports it', () => {
    const onReady = vi.fn()

    render(
      <ServerRoomCanvas
        modelUrl="/models/server-room.glb"
        statuses={statuses}
        onSelect={vi.fn()}
        onReady={onReady}
      />,
    )

    expect(onReady).not.toHaveBeenCalled()
    expect(modelOnReady).toBeTypeOf('function')

    act(() => {
      modelOnReady?.()
    })

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('increments the camera change count without rerendering', () => {
    render(
      <ServerRoomCanvas
        modelUrl="/models/server-room.glb"
        statuses={statuses}
        onSelect={vi.fn()}
        onReady={vi.fn()}
      />,
    )

    const canvasSection = screen.getByRole('region', {
      name: '3Dサーバールーム',
    })
    expect(canvasSection).toHaveAttribute('data-camera-change-count', '0')
    expect(orbitControlsOnChange).toBeTypeOf('function')

    act(() => {
      orbitControlsOnChange?.()
      orbitControlsOnChange?.()
    })

    expect(canvasSection).toHaveAttribute('data-camera-change-count', '2')
  })
})
