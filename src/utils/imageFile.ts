import { Capacitor } from '@capacitor/core'
import type { Photo } from '@capacitor/camera'
import { readRecentMedia, type RecentMediaItem } from './recentMedia.js'

const MAX_EDGE = 2048
const JPEG_QUALITY = 0.9
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const mimeFromName = (name: string): string => {
  const extension = name.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return ''
  }
}

type LoadedImage = {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

const loadImage = async (blob: Blob): Promise<LoadedImage> => {
  try {
    const bitmap = await createImageBitmap(blob)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  } catch {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      let settled = false
      let timer = 0
      const finish = (error?: Error) => {
        if (settled) {
          return
        }
        settled = true
        window.clearTimeout(timer)
        image.onload = null
        image.onerror = null
        if (error) {
          URL.revokeObjectURL(url)
          reject(error)
        } else {
          resolve()
        }
      }
      timer = window.setTimeout(() => finish(new Error('Image decode timeout')), 10_000)
      image.onload = () => finish()
      image.onerror = () => finish(new Error('Image decode failed'))
      image.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  }
}

const encodeJpeg = (image: LoadedImage): Promise<Blob> => {
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is unavailable')
  }
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('JPEG encoding failed'))
        }
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

const baseName = (name: string): string => {
  const withoutExtension = name.replace(/\.[^.]+$/, '').trim()
  return withoutExtension || 'photo'
}

/** 相机 / 相册图片统一转成最长边 2048 的 JPEG，GIF 保留原格式。 */
export const normalizeImageBlob = async (blob: Blob, name: string): Promise<File> => {
  const type = blob.type || mimeFromName(name)
  if (type === 'image/gif' || /\.gif$/i.test(name)) {
    return new File([blob], name.toLowerCase().endsWith('.gif') ? name : `${baseName(name)}.gif`, {
      type: 'image/gif',
    })
  }
  try {
    const image = await loadImage(blob)
    try {
      const jpeg = await encodeJpeg(image)
      return new File([jpeg], `${baseName(name)}.jpg`, { type: 'image/jpeg' })
    } finally {
      image.close()
    }
  } catch {
    // 已经是服务端支持的格式就保留原文件；HEIC 等无法解码的格式直接跳过。
    if (SUPPORTED_IMAGE_TYPES.has(type)) {
      return new File([blob], name, { type })
    }
    throw new Error('Unsupported image format')
  }
}

export const photoToFile = async (photo: Pick<Photo, 'webPath' | 'format'>): Promise<File> => {
  if (!photo.webPath) {
    throw new Error('Photo path is missing')
  }
  const response = await fetch(Capacitor.convertFileSrc(photo.webPath))
  const blob = await response.blob()
  const format = (photo.format || 'jpeg').toLowerCase()
  return normalizeImageBlob(blob, `photo-${Date.now()}.${format}`)
}

export const recentMediaToFile = async (item: RecentMediaItem): Promise<File> => {
  const result = await readRecentMedia(item.id)
  const response = await fetch(Capacitor.convertFileSrc(result.uri))
  const blob = await response.blob()
  return normalizeImageBlob(blob, result.name || item.name || `photo-${Date.now()}.jpg`)
}
