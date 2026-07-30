import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three'
import { describe, expect, test, vi } from 'vitest'

import { SERVER_IDS, type ServerId, type ServerStatus } from '../types/server'
import {
  SELECTED_EMISSIVE,
  SELECTED_EMISSIVE_INTENSITY,
  STATUS_VISUALS,
} from '../utils/statusVisual'
import {
  applyServerVisuals,
  disposePreparedScene,
  prepareServerRoomScene,
  type PreparedServerRoom,
} from './serverRoomScene'

function statuses(
  overrides: Partial<Record<ServerId, ServerStatus>> = {},
): Record<ServerId, ServerStatus> {
  return Object.fromEntries(
    SERVER_IDS.map((id) => [id, overrides[id] ?? 'healthy']),
  ) as Record<ServerId, ServerStatus>
}

function serverMaterials(
  prepared: PreparedServerRoom,
  id: ServerId,
): MeshStandardMaterial[] {
  const materials = prepared.materials[id]
  if (!materials) {
    throw new Error(`Missing prepared materials for ${id}`)
  }
  return materials
}

function meshNamed(root: Object3D, name: string): Mesh {
  const object = root.getObjectByName(name)
  if (!(object instanceof Mesh)) {
    throw new Error(`Missing mesh ${name}`)
  }
  return object
}

describe('prepareServerRoomScene', () => {
  test('clones a shared source material separately for each server without mutating the source', () => {
    const source = new Object3D()
    const sourceMaterial = new MeshStandardMaterial({ color: '#123456' })
    const first = new Mesh(new PlaneGeometry(), sourceMaterial)
    const second = new Mesh(new PlaneGeometry(), sourceMaterial)
    first.name = 'server_01_01'
    second.name = 'server_01_02'
    source.add(first, second)

    const prepared = prepareServerRoomScene(source)
    const firstClone = meshNamed(prepared.root, first.name)
    const secondClone = meshNamed(prepared.root, second.name)
    const firstMaterial = serverMaterials(prepared, 'server_01_01')[0]
    const secondMaterial = serverMaterials(prepared, 'server_01_02')[0]

    expect(prepared.root).not.toBe(source)
    expect(firstClone.material).toBe(firstMaterial)
    expect(secondClone.material).toBe(secondMaterial)
    expect(firstMaterial).not.toBe(sourceMaterial)
    expect(secondMaterial).not.toBe(sourceMaterial)
    expect(firstMaterial).not.toBe(secondMaterial)
    expect(first.material).toBe(sourceMaterial)
    expect(second.material).toBe(sourceMaterial)
    expect(sourceMaterial.color.getHexString()).toBe('123456')
  })

  test('keeps non-server mesh material references unchanged', () => {
    const source = new Object3D()
    const rackMaterial = new MeshStandardMaterial({ color: '#777777' })
    const rack = new Mesh(new PlaneGeometry(), rackMaterial)
    rack.name = 'rack_01'
    source.add(rack)

    const prepared = prepareServerRoomScene(source)

    expect(meshNamed(prepared.root, rack.name).material).toBe(rackMaterial)
  })

  test('clones and tracks every material in a server material array', () => {
    const source = new Object3D()
    const sourceMaterials = [
      new MeshStandardMaterial({ color: '#111111' }),
      new MeshStandardMaterial({ color: '#222222' }),
    ]
    const server = new Mesh(new PlaneGeometry(), sourceMaterials)
    server.name = 'server_01_01'
    source.add(server)

    const prepared = prepareServerRoomScene(source)
    const clonedMaterials = serverMaterials(prepared, 'server_01_01')

    expect(clonedMaterials).toHaveLength(2)
    expect(clonedMaterials[0]).not.toBe(sourceMaterials[0])
    expect(clonedMaterials[1]).not.toBe(sourceMaterials[1])
    expect(meshNamed(prepared.root, server.name).material).toEqual(
      clonedMaterials,
    )
    expect(server.material).toBe(sourceMaterials)
  })

  test('rejects unsupported server materials and disposes earlier clones', () => {
    const source = new Object3D()
    const validSourceMaterial = new MeshStandardMaterial()
    const invalidSourceMaterial = new MeshBasicMaterial()
    const valid = new Mesh(new PlaneGeometry(), validSourceMaterial)
    const invalid = new Mesh(new PlaneGeometry(), invalidSourceMaterial)
    valid.name = 'server_01_01'
    invalid.name = 'server_01_02'
    source.add(valid, invalid)
    const disposeSpy = vi.spyOn(
      MeshStandardMaterial.prototype,
      'dispose',
    )

    expect(() => prepareServerRoomScene(source)).toThrow(
      /server_01_02.*MeshBasicMaterial/,
    )
    expect(disposeSpy).toHaveBeenCalledTimes(1)
    expect(valid.material).toBe(validSourceMaterial)
    expect(invalid.material).toBe(invalidSourceMaterial)

    disposeSpy.mockRestore()
  })

  test('rejects duplicate registered server IDs', () => {
    const source = new Object3D()
    const first = new Mesh(new PlaneGeometry(), new MeshStandardMaterial())
    const second = new Mesh(new PlaneGeometry(), new MeshStandardMaterial())
    first.name = 'server_01_01'
    second.name = 'server_01_01'
    source.add(first, second)

    expect(() => prepareServerRoomScene(source)).toThrow(
      /Duplicate server ID: server_01_01/,
    )
  })
})

describe('applyServerVisuals', () => {
  test('applies status colors from a full server status record', () => {
    const source = new Object3D()
    for (const id of ['server_01_01', 'server_01_02'] as const) {
      const server = new Mesh(
        new PlaneGeometry(),
        new MeshStandardMaterial(),
      )
      server.name = id
      source.add(server)
    }
    const prepared = prepareServerRoomScene(source)
    const allStatuses = statuses({ server_01_01: 'critical' })

    expect(Object.keys(allStatuses)).toEqual([...SERVER_IDS])

    applyServerVisuals(prepared.materials, allStatuses)

    expect(
      serverMaterials(prepared, 'server_01_01')[0]?.color.getHexString(),
    ).toBe(STATUS_VISUALS.critical.color.slice(1).toLowerCase())
    expect(
      serverMaterials(prepared, 'server_01_02')[0]?.color.getHexString(),
    ).toBe(STATUS_VISUALS.healthy.color.slice(1).toLowerCase())
    expect(
      serverMaterials(prepared, 'server_01_01')[0]?.color.getHexString(),
    ).toBe('ef4444')
    expect(
      serverMaterials(prepared, 'server_01_02')[0]?.color.getHexString(),
    ).toBe('22c55e')
  })

  test('moves the selected emissive highlight and clears the previous one', () => {
    const source = new Object3D()
    for (const id of ['server_01_01', 'server_01_02'] as const) {
      const server = new Mesh(
        new PlaneGeometry(),
        new MeshStandardMaterial(),
      )
      server.name = id
      source.add(server)
    }
    const prepared = prepareServerRoomScene(source)
    const first = serverMaterials(prepared, 'server_01_01')[0]
    const second = serverMaterials(prepared, 'server_01_02')[0]
    if (!first || !second) {
      throw new Error('Expected one material for each prepared server')
    }

    applyServerVisuals(
      prepared.materials,
      statuses(),
      'server_01_01',
    )

    expect(first.emissive.getHexString()).toBe(
      SELECTED_EMISSIVE.slice(1).toLowerCase(),
    )
    expect(first.emissive.getHexString()).toBe('38bdf8')
    expect(first.emissiveIntensity).toBe(SELECTED_EMISSIVE_INTENSITY)
    expect(second.emissive.getHexString()).toBe('000000')
    expect(second.emissiveIntensity).toBe(0)

    applyServerVisuals(
      prepared.materials,
      statuses(),
      'server_01_02',
    )

    expect(first.emissive.getHexString()).toBe('000000')
    expect(first.emissiveIntensity).toBe(0)
    expect(second.emissive.getHexString()).toBe('38bdf8')
    expect(second.emissiveIntensity).toBe(0.45)
  })
})

describe('disposePreparedScene', () => {
  test('disposes cloned server materials once but never source or non-server materials', () => {
    const source = new Object3D()
    const sourceServerMaterial = new MeshStandardMaterial()
    const rackMaterial = new MeshStandardMaterial()
    const server = new Mesh(new PlaneGeometry(), sourceServerMaterial)
    const rack = new Mesh(new PlaneGeometry(), rackMaterial)
    server.name = 'server_01_01'
    rack.name = 'rack_01'
    source.add(server, rack)
    const sourceDispose = vi.spyOn(sourceServerMaterial, 'dispose')
    const rackDispose = vi.spyOn(rackMaterial, 'dispose')
    const prepared = prepareServerRoomScene(source)
    const clonedDispose = vi.spyOn(
      serverMaterials(prepared, 'server_01_01')[0]!,
      'dispose',
    )

    disposePreparedScene(prepared)
    disposePreparedScene(prepared)

    expect(clonedDispose).toHaveBeenCalledTimes(1)
    expect(sourceDispose).not.toHaveBeenCalled()
    expect(rackDispose).not.toHaveBeenCalled()
  })
})
