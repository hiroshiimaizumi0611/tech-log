import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import {
  SERVER_IDS,
  type ServerId,
  type ServerStatus,
} from './types/server'

const ALL_HEALTHY_STATUSES = {
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

const SERVER_01_01_CRITICAL_STATUSES = {
  ...ALL_HEALTHY_STATUSES,
  server_01_01: 'critical',
} satisfies Record<ServerId, ServerStatus>

let canvasOnReady: (() => void) | undefined
let canvasError: Error | undefined

vi.mock('./components/three/ServerRoomCanvas', () => ({
  ServerRoomCanvas: ({
    modelUrl,
    statuses,
    selectedId,
    onSelect,
    onReady,
  }: {
    modelUrl: string
    statuses: Record<ServerId, ServerStatus>
    selectedId?: ServerId
    onSelect: (id: ServerId) => void
    onReady: () => void
  }) => {
    if (canvasError) {
      throw canvasError
    }
    canvasOnReady = onReady

    return (
      <section aria-label="mock 3D server room">
        <button type="button" onClick={() => onSelect('server_01_01')}>
          server_01_01を選択
        </button>
        <div data-testid="canvas-statuses">
          {JSON.stringify(statuses)}
        </div>
        <div data-testid="canvas-selected">
          {selectedId ?? '未選択'}
        </div>
        <div data-testid="canvas-model-url">{modelUrl}</div>
      </section>
    )
  },
}))

function canvasStatuses(): Record<ServerId, ServerStatus> {
  const serialized = screen.getByTestId('canvas-statuses').textContent
  if (!serialized) {
    throw new Error('Canvas statuses were not rendered')
  }
  return JSON.parse(serialized) as Record<ServerId, ServerStatus>
}

describe('App', () => {
  beforeEach(() => {
    canvasOnReady = undefined
    canvasError = undefined
  })

  it('announces model loading initially and readiness after the canvas reports it', () => {
    render(<App />)

    const loadingStatus = screen.getByRole('status')
    expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
    expect(loadingStatus).toHaveTextContent('3Dモデルを読み込んでいます')
    expect(canvasOnReady).toBeTypeOf('function')

    act(() => {
      canvasOnReady?.()
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      '3Dモデルを読み込みました',
    )
  })

  it('removes model status and keeps the base-aware alert after a model error', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      const { rerender } = render(<App />)

      act(() => {
        canvasOnReady?.()
      })
      expect(
        screen.getByText('3Dモデルを読み込みました'),
      ).toBeInTheDocument()

      canvasError = new Error('GLB failed to load')
      rerender(<App />)

      expect(
        screen.queryByText('3Dモデルを読み込んでいます'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('3Dモデルを読み込みました'),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('alert').querySelector('code')).toHaveTextContent(
        `${import.meta.env.BASE_URL}models/server-room.glb`,
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('passes the base-aware model URL to the canvas', () => {
    render(<App />)

    const expectedModelUrl = `${import.meta.env.BASE_URL}models/server-room.glb`

    expect(screen.getByTestId('canvas-model-url')).toHaveTextContent(
      expectedModelUrl,
    )
  })

  it('offers every server in a native selector and selects one accessibly', async () => {
    const user = userEvent.setup()
    render(<App />)

    const selector = screen.getByRole('combobox', {
      name: 'サーバーを選択',
    })
    const options = screen.getAllByRole('option')

    expect(selector).toHaveValue('')
    expect(options).toHaveLength(15)
    expect(options.map((option) => option.getAttribute('value'))).toEqual([
      '',
      ...SERVER_IDS,
    ])
    expect(options[0]).toHaveTextContent('3D画面から選択してください')
    expect(options[14]).toHaveTextContent('Server 02-08')

    await user.selectOptions(selector, 'server_02_08')

    expect(selector).toHaveValue('server_02_08')
    expect(screen.getByTestId('canvas-selected')).toHaveTextContent(
      'server_02_08',
    )
    expect(
      screen.getByRole('heading', { name: 'Server 02-08' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('complementary', { name: 'サーバー詳細' }))
        .getByRole('status'),
    ).toHaveTextContent('正常')
  })

  it('connects server selection and immutable alarm status changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByText('3D画面からサーバーを選択してください'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('canvas-selected')).toHaveTextContent('未選択')

    expect(canvasStatuses()).toEqual(ALL_HEALTHY_STATUSES)

    await user.click(
      screen.getByRole('button', { name: 'server_01_01を選択' }),
    )

    expect(
      screen.getByRole('heading', { name: 'Server 01-01' }),
    ).toBeInTheDocument()
    const details = screen.getByRole('complementary', {
      name: 'サーバー詳細',
    })
    expect(within(details).getByRole('status')).toHaveTextContent('正常')
    expect(screen.getByTestId('canvas-selected')).toHaveTextContent(
      'server_01_01',
    )
    expect(
      screen.getByRole('combobox', { name: 'サーバーを選択' }),
    ).toHaveValue('server_01_01')

    const disabledRestore = screen.getByRole('button', {
      name: '正常に戻す',
    })
    expect(disabledRestore).toBeDisabled()
    await user.click(disabledRestore)
    expect(canvasStatuses()).toEqual(ALL_HEALTHY_STATUSES)

    await user.click(screen.getByRole('button', { name: 'アラーム発生' }))

    expect(within(details).getByRole('status')).toHaveTextContent('障害')
    expect(canvasStatuses()).toEqual(SERVER_01_01_CRITICAL_STATUSES)

    const disabledAlarm = screen.getByRole('button', {
      name: 'アラーム発生',
    })
    expect(disabledAlarm).toBeDisabled()
    await user.click(disabledAlarm)
    expect(canvasStatuses()).toEqual(SERVER_01_01_CRITICAL_STATUSES)

    await user.click(screen.getByRole('button', { name: '正常に戻す' }))

    expect(within(details).getByRole('status')).toHaveTextContent('正常')
    expect(canvasStatuses()).toEqual(ALL_HEALTHY_STATUSES)
  })
})
