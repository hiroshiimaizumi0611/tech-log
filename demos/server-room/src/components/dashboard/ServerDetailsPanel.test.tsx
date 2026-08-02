import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SERVERS } from '../../data/servers'
import { STATUS_VISUALS } from '../../utils/statusVisual'
import { ServerDetailsPanel } from './ServerDetailsPanel'

describe('ServerDetailsPanel', () => {
  it('prompts for a server selection without inventing server details or controls', () => {
    render(
      <ServerDetailsPanel
        selectedServer={null}
        onStatusChange={vi.fn()}
      />,
    )

    const panel = screen.getByRole('complementary', { name: 'サーバー詳細' })

    expect(panel).toHaveTextContent('3D画面からサーバーを選択してください')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Server 01-01')).not.toBeInTheDocument()
  })

  it('shows the selected healthy server and the available status action', () => {
    render(
      <ServerDetailsPanel
        selectedServer={SERVERS.server_01_01}
        status="healthy"
        onStatusChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Server 01-01' }),
    ).toBeInTheDocument()
    expect(screen.getByText('server_01_01')).toBeInTheDocument()
    expect(screen.getByText('Web')).toBeInTheDocument()
    expect(screen.getByText('10.0.1.11')).toBeInTheDocument()
    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveTextContent(
      new RegExp(`^${STATUS_VISUALS.healthy.label}$`),
    )
    expect(statusElement.tagName).toBe('SPAN')
    expect(statusElement.closest('dd')).not.toHaveAttribute('role')
    expect(
      screen.getByRole('button', { name: 'アラーム発生' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: '正常に戻す' }),
    ).toBeDisabled()
  })

  it('requests only a critical status when the alarm action is clicked', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    render(
      <ServerDetailsPanel
        selectedServer={SERVERS.server_01_01}
        status="healthy"
        onStatusChange={onStatusChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'アラーム発生' }))

    expect(onStatusChange).toHaveBeenCalledOnce()
    expect(onStatusChange).toHaveBeenCalledWith('server_01_01', 'critical')
    expect(onStatusChange).not.toHaveBeenCalledWith(
      'server_01_01',
      'healthy',
    )
  })

  it('shows a critical status and requests only a healthy status when restored', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()
    render(
      <ServerDetailsPanel
        selectedServer={SERVERS.server_01_01}
        status="critical"
        onStatusChange={onStatusChange}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(`^${STATUS_VISUALS.critical.label}$`),
    )
    expect(
      screen.getByRole('button', { name: 'アラーム発生' }),
    ).toBeDisabled()
    const restoreButton = screen.getByRole('button', { name: '正常に戻す' })
    expect(restoreButton).toBeEnabled()

    await user.click(restoreButton)

    expect(onStatusChange).toHaveBeenCalledOnce()
    expect(onStatusChange).toHaveBeenCalledWith('server_01_01', 'healthy')
    expect(onStatusChange).not.toHaveBeenCalledWith(
      'server_01_01',
      'critical',
    )
  })

  it.each([
    ['healthy', '正常に戻す'],
    ['critical', 'アラーム発生'],
  ] as const)(
    'does not invoke the callback from the disabled %s-state action',
    async (status, buttonName) => {
      const user = userEvent.setup()
      const onStatusChange = vi.fn()
      render(
        <ServerDetailsPanel
          selectedServer={SERVERS.server_01_01}
          status={status}
          onStatusChange={onStatusChange}
        />,
      )

      const button = screen.getByRole('button', { name: buttonName })
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toBeDisabled()

      await user.click(button)

      expect(onStatusChange).not.toHaveBeenCalled()
    },
  )
})
