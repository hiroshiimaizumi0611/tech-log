import { useGLTF } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import {
  type ServerId,
  type ServerStatus,
} from '../../types/server'
import {
  applyServerVisuals,
  disposePreparedScene,
  type PreparedServerRoom,
  prepareServerRoomScene,
} from '../../three/serverRoomScene'
import { toServerId } from '../../utils/objectName'

interface ServerRoomModelProps {
  modelUrl: string
  statuses: Record<ServerId, ServerStatus>
  selectedId?: ServerId
  onSelect: (id: ServerId) => void
  onReady: () => void
}

export function ServerRoomModel({
  modelUrl,
  statuses,
  selectedId,
  onSelect,
  onReady,
}: ServerRoomModelProps) {
  const { scene } = useGLTF(modelUrl)
  const container = useMemo(() => new Group(), [])
  const preparedRef = useRef<PreparedServerRoom | null>(null)
  const reportedReadyScene = useRef<typeof scene | null>(null)
  const currentVisuals = useRef({ statuses, selectedId })

  useLayoutEffect(() => {
    currentVisuals.current = { statuses, selectedId }
  }, [selectedId, statuses])

  useLayoutEffect(() => {
    const nextPrepared = prepareServerRoomScene(scene)
    preparedRef.current = nextPrepared
    container.add(nextPrepared.root)
    applyServerVisuals(
      nextPrepared.materials,
      currentVisuals.current.statuses,
      currentVisuals.current.selectedId,
    )

    return () => {
      container.remove(nextPrepared.root)
      if (preparedRef.current === nextPrepared) {
        preparedRef.current = null
      }
      disposePreparedScene(nextPrepared)
    }
  }, [container, scene])

  useEffect(() => {
    const prepared = preparedRef.current
    if (!prepared) {
      return
    }

    applyServerVisuals(prepared.materials, statuses, selectedId)
  }, [selectedId, statuses])

  useEffect(() => {
    if (
      !preparedRef.current ||
      reportedReadyScene.current === scene
    ) {
      return
    }

    reportedReadyScene.current = scene
    onReady()
  }, [onReady, scene])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    const serverId = toServerId(event.object.name)
    if (!serverId) {
      return
    }

    event.stopPropagation()
    onSelect(serverId)
  }

  return <primitive object={container} onClick={handleClick} />
}
