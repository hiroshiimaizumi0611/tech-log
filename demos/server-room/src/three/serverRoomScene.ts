import { Mesh, MeshStandardMaterial, Object3D } from 'three'

import {
  SERVER_IDS,
  type ServerId,
  type ServerStatus,
} from '../types/server'
import { toServerId } from '../utils/objectName'
import {
  SELECTED_EMISSIVE,
  SELECTED_EMISSIVE_INTENSITY,
  STATUS_VISUALS,
} from '../utils/statusVisual'

export interface PreparedServerRoom {
  root: Object3D
  materials: Partial<Record<ServerId, MeshStandardMaterial[]>>
}

const disposedScenes = new WeakSet<PreparedServerRoom>()

export function prepareServerRoomScene(source: Object3D): PreparedServerRoom {
  const root = source.clone(true)
  const materials: PreparedServerRoom['materials'] = {}
  const clonedMaterials: MeshStandardMaterial[] = []

  try {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return
      }

      const serverId = toServerId(object.name)
      if (!serverId) {
        return
      }
      if (materials[serverId]) {
        throw new Error(`Duplicate server ID: ${serverId}`)
      }

      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material]
      for (const material of sourceMaterials) {
        if (!(material instanceof MeshStandardMaterial)) {
          throw new Error(
            `Unsupported material on ${object.name}: ${material.type}`,
          )
        }
      }

      const serverMaterials = sourceMaterials.map((material) => {
        const cloned = material.clone()
        clonedMaterials.push(cloned)
        return cloned
      })
      object.material = Array.isArray(object.material)
        ? serverMaterials
        : serverMaterials[0]!
      materials[serverId] = serverMaterials
    })
  } catch (error) {
    for (const material of clonedMaterials) {
      material.dispose()
    }
    throw error
  }

  return { root, materials }
}

export function applyServerVisuals(
  materials: PreparedServerRoom['materials'],
  statuses: Record<ServerId, ServerStatus>,
  selectedId?: ServerId,
): void {
  for (const id of SERVER_IDS) {
    const serverMaterials = materials[id]
    if (!serverMaterials) {
      continue
    }

    const selected = id === selectedId
    for (const material of serverMaterials) {
      material.color.set(STATUS_VISUALS[statuses[id]].color)
      material.emissive.set(selected ? SELECTED_EMISSIVE : 0x000000)
      material.emissiveIntensity = selected
        ? SELECTED_EMISSIVE_INTENSITY
        : 0
    }
  }
}

export function disposePreparedScene(prepared: PreparedServerRoom): void {
  if (disposedScenes.has(prepared)) {
    return
  }
  disposedScenes.add(prepared)

  const disposedMaterials = new Set<MeshStandardMaterial>()
  for (const id of SERVER_IDS) {
    const serverMaterials = prepared.materials[id]
    if (!serverMaterials) {
      continue
    }
    for (const material of serverMaterials) {
      if (!disposedMaterials.has(material)) {
        disposedMaterials.add(material)
        material.dispose()
      }
    }
  }
}
