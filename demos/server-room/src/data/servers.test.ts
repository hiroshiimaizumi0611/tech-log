import { describe, expect, it } from 'vitest'

import { SERVERS } from './servers'
import { SERVER_IDS } from '../types/server'

describe('server inventory', () => {
  it('contains 14 unique server IDs', () => {
    expect(SERVER_IDS).toHaveLength(14)
    expect(new Set(SERVER_IDS).size).toBe(SERVER_IDS.length)
  })

  it('contains exactly one record for every registered server ID', () => {
    expect(Object.keys(SERVERS)).toEqual([...SERVER_IDS])
  })

  it('contains the expected first and last records', () => {
    expect(SERVERS.server_01_01).toEqual({
      id: 'server_01_01',
      name: 'Server 01-01',
      role: 'Web',
      ipAddress: '10.0.1.11',
    })
    expect(SERVERS.server_02_08).toEqual({
      id: 'server_02_08',
      name: 'Server 02-08',
      role: 'Backup',
      ipAddress: '10.0.2.18',
    })
  })

  it.each([
    ['server_01_02', 'Web'],
    ['server_01_03', 'Application'],
    ['server_01_04', 'Application'],
    ['server_01_05', 'Worker'],
    ['server_01_06', 'Worker'],
    ['server_02_02', 'Database'],
    ['server_02_03', 'Cache'],
    ['server_02_04', 'Cache'],
    ['server_02_05', 'Monitoring'],
    ['server_02_06', 'Monitoring'],
    ['server_02_07', 'Backup'],
  ] as const)('assigns %s the %s role', (id, role) => {
    expect(SERVERS[id].role).toBe(role)
  })

  it('derives every display name and IP address from its ID', () => {
    for (const id of SERVER_IDS) {
      const [, rack, server] = id.split('_')
      const expectedName = `Server ${rack}-${server}`
      const expectedIp = `10.0.${Number(rack)}.${Number(server) + 10}`

      expect(SERVERS[id].name).toBe(expectedName)
      expect(SERVERS[id].ipAddress).toBe(expectedIp)
    }
  })

  it('assigns a unique IP address to every server', () => {
    const ipAddresses = Object.values(SERVERS).map(
      (server) => server.ipAddress,
    )

    expect(new Set(ipAddresses).size).toBe(ipAddresses.length)
  })
})
