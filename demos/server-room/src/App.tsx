import { useState } from 'react'

import { ModelErrorBoundary } from './components/ModelErrorBoundary'
import { ServerDetailsPanel } from './components/dashboard/ServerDetailsPanel'
import { ServerRoomCanvas } from './components/three/ServerRoomCanvas'
import { SERVERS } from './data/servers'
import {
  SERVER_IDS,
  type ServerId,
  type ServerStatus,
} from './types/server'
import { serverRoomModelUrl } from './utils/modelUrl'
import { toServerId } from './utils/objectName'

const MODEL_URL = serverRoomModelUrl(import.meta.env.BASE_URL)

type ModelState = 'loading' | 'ready' | 'error'

function createInitialStatuses(): Record<ServerId, ServerStatus> {
  return Object.fromEntries(
    SERVER_IDS.map((id) => [id, 'healthy']),
  ) as Record<ServerId, ServerStatus>
}

function App() {
  const [statuses, setStatuses] = useState(createInitialStatuses)
  const [selectedServerId, setSelectedServerId] = useState<ServerId>()
  const [modelState, setModelState] = useState<ModelState>('loading')

  function handleStatusChange(id: ServerId, status: ServerStatus) {
    setStatuses((current) => ({ ...current, [id]: status }))
  }

  return (
    <main className="app">
      <h1 id="page-title">3D Server Room Dashboard</h1>
      <div className="dashboard" aria-labelledby="page-title">
        <section className="dashboard__scene" aria-label="サーバールーム">
          <ModelErrorBoundary
            modelUrl={MODEL_URL}
            onError={() => setModelState('error')}
          >
            <ServerRoomCanvas
              modelUrl={MODEL_URL}
              statuses={statuses}
              selectedId={selectedServerId}
              onSelect={setSelectedServerId}
              onReady={() =>
                setModelState((current) =>
                  current === 'error' ? current : 'ready',
                )
              }
            />
          </ModelErrorBoundary>
          {modelState !== 'error' && (
            <p role="status" aria-live="polite">
              {modelState === 'loading'
                ? '3Dモデルを読み込んでいます'
                : '3Dモデルを読み込みました'}
            </p>
          )}
        </section>
        <div className="server-selector">
          <label htmlFor="server-selector">サーバーを選択</label>
          <select
            id="server-selector"
            value={selectedServerId ?? ''}
            onChange={(event) => {
              setSelectedServerId(toServerId(event.currentTarget.value))
            }}
          >
            <option value="">3D画面から選択してください</option>
            {SERVER_IDS.map((id) => (
              <option key={id} value={id}>
                {SERVERS[id].name} ({id})
              </option>
            ))}
          </select>
        </div>
        {selectedServerId ? (
          <ServerDetailsPanel
            selectedServer={SERVERS[selectedServerId]}
            status={statuses[selectedServerId]}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <ServerDetailsPanel
            selectedServer={null}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </main>
  )
}

export default App
