import { describe, expect, it } from 'vitest'

import { serverRoomModelUrl } from './modelUrl'

describe('serverRoomModelUrl', () => {
  it.each([
    ['/', '/models/server-room.glb'],
    [
      '/demos/server-room/',
      '/demos/server-room/models/server-room.glb',
    ],
    [
      '/demos/server-room',
      '/demos/server-room/models/server-room.glb',
    ],
  ])('resolves the model from base %s', (baseUrl, expected) => {
    expect(serverRoomModelUrl(baseUrl)).toBe(expected)
  })
})
