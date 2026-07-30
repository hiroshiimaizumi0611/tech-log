import {
  SERVER_IDS,
  type ServerId,
  type ServerInfo,
} from '../types/server'

function roleFor(rackNumber: number, serverNumber: number): ServerInfo['role'] {
  if (rackNumber === 1) {
    if (serverNumber <= 2) return 'Web'
    if (serverNumber <= 4) return 'Application'
    return 'Worker'
  }

  if (serverNumber <= 2) return 'Database'
  if (serverNumber <= 4) return 'Cache'
  if (serverNumber <= 6) return 'Monitoring'
  return 'Backup'
}

function createServer(id: ServerId): ServerInfo {
  const [, rack, server] = id.split('_')
  const rackNumber = Number(rack)
  const serverNumber = Number(server)

  return {
    id,
    name: `Server ${rack}-${server}`,
    role: roleFor(rackNumber, serverNumber),
    ipAddress: `10.0.${rackNumber}.${serverNumber + 10}`,
  }
}

export const SERVERS = Object.fromEntries(
  SERVER_IDS.map((id) => [id, createServer(id)]),
) as Record<ServerId, ServerInfo>
