import { Browser } from '@capacitor/browser'
import { isNative } from './native.js'
import { saveBlob } from './saveFile.js'

/**
 * 打开外部链接：Android 交给系统浏览器 / Custom Tabs，Web 保持新标签打开。
 * 本地附件是 blob: 地址，系统浏览器无法访问，改为调起系统分享。
 */
export const openExternal = async (url: string, filename = 'attachment'): Promise<void> => {
  if (isNative()) {
    if (url.startsWith('blob:')) {
      const response = await fetch(url)
      await saveBlob(await response.blob(), filename)
      return
    }
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
