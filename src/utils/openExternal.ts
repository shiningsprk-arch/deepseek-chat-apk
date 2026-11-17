import { Browser } from '@capacitor/browser'
import { isNative } from './native.js'

/** 外部链接：Android 交给系统浏览器 / Custom Tabs，Web 保持新标签打开。 */
export const openExternal = async (url: string): Promise<void> => {
  if (isNative()) {
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
