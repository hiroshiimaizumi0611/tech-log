import { Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'

import type { ServerId, ServerStatus } from '../../types/server'
import { ServerRoomModel } from './ServerRoomModel'

interface ServerRoomCanvasProps {
  modelUrl: string
  statuses: Record<ServerId, ServerStatus>
  selectedId?: ServerId
  onSelect: (id: ServerId) => void
  onReady: () => void
}

export function ServerRoomCanvas(props: ServerRoomCanvasProps) {
  const sectionRef = useRef<HTMLElement>(null)

  function handleCameraChange() {
    const section = sectionRef.current
    if (!section) {
      return
    }

    const currentCount = Number.parseInt(
      section.dataset.cameraChangeCount ?? '0',
      10,
    )
    section.dataset.cameraChangeCount = String(currentCount + 1)
  }

  return (
    <section
      ref={sectionRef}
      className="server-room-canvas"
      aria-label="3Dサーバールーム"
      data-camera-change-count="0"
    >
      <Canvas camera={{ position: [4.8, 4.5, 4.2], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 7, 5]} intensity={1.4} />
        <Suspense
          fallback={
            <Html center>
              <span aria-hidden="true">3Dモデルを読み込んでいます</span>
            </Html>
          }
        >
          <ServerRoomModel {...props} />
        </Suspense>
        <OrbitControls
          enableRotate
          enableZoom
          enablePan
          target={[0, 1.2, 0]}
          minDistance={2.5}
          maxDistance={12}
          onChange={handleCameraChange}
        />
      </Canvas>
    </section>
  )
}
