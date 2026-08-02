const MODEL_PATH = 'models/server-room.glb'

export function serverRoomModelUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/')
    ? baseUrl
    : `${baseUrl}/`
  return `${normalizedBase}${MODEL_PATH}`
}
