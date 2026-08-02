import { describe, expect, it } from 'vitest'

import { toServerId } from './objectName'

describe('toServerId', () => {
  it.each(['server_01_01', 'server_02_08'] as const)(
    'accepts the registered server ID %s',
    (id) => {
      expect(toServerId(id)).toBe(id)
    },
  )

  it.each([
    'rack_01',
    'server_01_07',
    'server_02_09',
    'server_01_01.001',
    '',
    'toString',
    '__proto__',
  ])('rejects the non-server object name %j', (objectName) => {
    expect(toServerId(objectName)).toBeUndefined()
  })
})
