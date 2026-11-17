import { Capacitor, registerPlugin } from '@capacitor/core'

export type RecentMediaItem = {
  id: string
  name: string
  mimeType: string
  width: number
  height: number
  size: number
  thumbnail: string
}

type RecentMediaList = {
  granted: boolean
  items: RecentMediaItem[]
  error?: string
}

type RecentMediaFile = {
  name: string
  mimeType: string
  uri: string
}

const RecentMedia = registerPlugin<{
  requestAccess(): Promise<void>
  list(options: { limit: number }): Promise<RecentMediaList>
  read(options: { id: string }): Promise<RecentMediaFile>
}>('RecentMedia')

export const recentMediaSupported = (): boolean => Capacitor.isNativePlatform()

export const requestRecentMediaAccess = (): Promise<void> => RecentMedia.requestAccess()

export const listRecentMedia = (limit = 12): Promise<RecentMediaList> =>
  RecentMedia.list({ limit })

export const readRecentMedia = (id: string): Promise<RecentMediaFile> =>
  RecentMedia.read({ id })
