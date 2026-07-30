import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { Color, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { SERVER_IDS, type ServerId, type ServerStatus } from '../../types/server'
import { STATUS_VISUALS } from '../../utils/statusVisual'
import { ServerRoomModel } from './ServerRoomModel'

let loadedScene = new Group()

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: loadedScene }),
}))

const statuses = Object.fromEntries(
  SERVER_IDS.map((id) => [id, 'healthy']),
) as Record<ServerId, ServerStatus>

const modelProps = {
  modelUrl: '/models/server-room.glb',
  statuses,
  onSelect: vi.fn(),
}

function ThrowingSibling(): never {
  throw new Error('abort this render')
}

describe('ServerRoomModel', () => {
  it('does not prepare resources for a render that never commits', () => {
    loadedScene = new Group()
    const clone = vi.spyOn(loadedScene, 'clone')
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      expect(() =>
        render(
          <>
            <ServerRoomModel {...modelProps} onReady={vi.fn()} />
            <ThrowingSibling />
          </>,
        ),
      ).toThrow('abort this render')
      expect(clone).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('reports the same committed scene once during StrictMode effect replay', () => {
    loadedScene = new Group()
    const onReady = vi.fn()
    const { rerender } = render(
      <StrictMode>
        <ServerRoomModel {...modelProps} onReady={onReady} />
      </StrictMode>,
    )

    expect(onReady).toHaveBeenCalledTimes(1)

    rerender(
      <StrictMode>
        <ServerRoomModel {...modelProps} onReady={onReady} />
      </StrictMode>,
    )

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('cleans up the old scene and reports readiness for its replacement', () => {
    const criticalStatuses = {
      ...statuses,
      server_01_01: 'critical',
    } satisfies Record<ServerId, ServerStatus>
    const firstServer = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: 0xffffff }),
    )
    firstServer.name = 'server_01_01'
    loadedScene = new Group()
    loadedScene.add(firstServer)
    let clonedFirst: Group | undefined
    const originalFirstClone = loadedScene.clone.bind(loadedScene)
    vi.spyOn(loadedScene, 'clone').mockImplementation((recursive) => {
      clonedFirst = originalFirstClone(recursive)
      return clonedFirst
    })
    const onReady = vi.fn()

    const { rerender } = render(
      <ServerRoomModel
        {...modelProps}
        statuses={criticalStatuses}
        onReady={onReady}
      />,
    )
    const oldRoot = clonedFirst!
    const oldMaterial = (oldRoot.children[0] as Mesh)
      .material as MeshStandardMaterial
    const disposeOldMaterial = vi.spyOn(oldMaterial, 'dispose')

    expect(oldRoot.parent).not.toBeNull()
    expect(onReady).toHaveBeenCalledTimes(1)

    const replacementServer = new Mesh(
      undefined,
      new MeshStandardMaterial({ color: 0xffffff }),
    )
    replacementServer.name = 'server_01_01'
    loadedScene = new Group()
    loadedScene.add(replacementServer)
    let clonedReplacement: Group | undefined
    const originalClone = loadedScene.clone.bind(loadedScene)
    vi.spyOn(loadedScene, 'clone').mockImplementation((recursive) => {
      clonedReplacement = originalClone(recursive)
      return clonedReplacement
    })

    rerender(
      <ServerRoomModel
        {...modelProps}
        statuses={criticalStatuses}
        onReady={onReady}
      />,
    )

    expect(oldRoot.parent).toBeNull()
    expect(disposeOldMaterial).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(2)

    const replacementMaterial = (
      clonedReplacement?.children[0] as Mesh
    ).material as MeshStandardMaterial
    expect(replacementMaterial.color.getHex()).toBe(
      new Color(STATUS_VISUALS.critical.color).getHex(),
    )
  })
})
