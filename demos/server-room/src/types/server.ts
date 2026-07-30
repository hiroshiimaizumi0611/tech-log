export const SERVER_IDS = [
  'server_01_01',
  'server_01_02',
  'server_01_03',
  'server_01_04',
  'server_01_05',
  'server_01_06',
  'server_02_01',
  'server_02_02',
  'server_02_03',
  'server_02_04',
  'server_02_05',
  'server_02_06',
  'server_02_07',
  'server_02_08',
] as const

export type ServerId = (typeof SERVER_IDS)[number]
export type ServerStatus = 'healthy' | 'critical'

export interface ServerInfo {
  id: ServerId
  name: string
  role:
    | 'Web'
    | 'Application'
    | 'Worker'
    | 'Database'
    | 'Cache'
    | 'Monitoring'
    | 'Backup'
  ipAddress: string
}
