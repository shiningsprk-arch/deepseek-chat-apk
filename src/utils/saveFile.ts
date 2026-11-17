import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from './native.js'

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })

/**
 * 保存一个 Blob：Web 端走浏览器下载；Android 端写入缓存目录后调起系统分享，
 * 由用户选择保存到文件或发送到其他应用（WebView 不支持 <a download> 落盘）。
 */
export const saveBlob = async (blob: Blob, filename: string): Promise<void> => {
  if (!isNative()) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return
  }

  const data = await blobToBase64(blob)
  const result = await Filesystem.writeFile({
    path: `exports/${filename}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  })
  await Share.share({
    title: filename,
    dialogTitle: filename,
    url: result.uri,
  })
}
