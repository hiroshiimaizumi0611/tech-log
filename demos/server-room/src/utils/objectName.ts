import { SERVERS } from '../data/servers'
import type { ServerId } from '../types/server'

export function toServerId(value: string): ServerId | undefined {
  return Object.hasOwn(SERVERS, value) ? (value as ServerId) : undefined
}
