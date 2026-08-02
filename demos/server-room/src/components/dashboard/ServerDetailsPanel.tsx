import type {
  ServerId,
  ServerInfo,
  ServerStatus,
} from '../../types/server'
import { STATUS_VISUALS } from '../../utils/statusVisual'

type ServerDetailsPanelProps =
  | {
      selectedServer: null
      status?: never
      onStatusChange: (id: ServerId, status: ServerStatus) => void
    }
  | {
      selectedServer: ServerInfo
      status: ServerStatus
      onStatusChange: (id: ServerId, status: ServerStatus) => void
    }

export function ServerDetailsPanel(props: ServerDetailsPanelProps) {
  if (props.selectedServer === null) {
    return (
      <aside className="server-details-panel" aria-label="サーバー詳細">
        <p className="server-details-panel__empty">
          3D画面からサーバーを選択してください
        </p>
      </aside>
    )
  }

  const { selectedServer, status, onStatusChange } = props

  return (
    <aside className="server-details-panel" aria-label="サーバー詳細">
      <h2 className="server-details-panel__heading">
        {selectedServer.name}
      </h2>

      <dl className="server-details-panel__details">
        <div className="server-details-panel__detail">
          <dt>オブジェクトID</dt>
          <dd>{selectedServer.id}</dd>
        </div>
        <div className="server-details-panel__detail">
          <dt>ロール</dt>
          <dd>{selectedServer.role}</dd>
        </div>
        <div className="server-details-panel__detail">
          <dt>IPアドレス</dt>
          <dd>{selectedServer.ipAddress}</dd>
        </div>
        <div className="server-details-panel__detail">
          <dt>ステータス</dt>
          <dd
            className={`server-details-panel__status server-details-panel__status--${status}`}
          >
            <span role="status">{STATUS_VISUALS[status].label}</span>
          </dd>
        </div>
      </dl>

      <div className="server-details-panel__actions">
        <button
          className="server-details-panel__action server-details-panel__action--alarm"
          type="button"
          disabled={status === 'critical'}
          onClick={() => onStatusChange(selectedServer.id, 'critical')}
        >
          アラーム発生
        </button>
        <button
          className="server-details-panel__action server-details-panel__action--restore"
          type="button"
          disabled={status === 'healthy'}
          onClick={() => onStatusChange(selectedServer.id, 'healthy')}
        >
          正常に戻す
        </button>
      </div>
    </aside>
  )
}
