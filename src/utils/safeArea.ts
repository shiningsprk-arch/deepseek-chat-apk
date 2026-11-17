import { registerPlugin } from '@capacitor/core'
import { isNative } from './native.js'

type SafeAreaInsets = {
  top: number
  bottom: number
}

const SafeArea = registerPlugin<{ getInsets(): Promise<SafeAreaInsets> }>('SafeArea')

/** 把原生系统栏尺寸写入 CSS 变量，供移动端 frame / 抽屉使用。 */
export const applySafeAreaInsets = async (): Promise<void> => {
  if (!isNative()) {
    return
  }
  try {
    const insets = await SafeArea.getInsets()
    const root = document.documentElement
    root.style.setProperty('--safe-area-top', `${Math.max(0, insets.top)}px`)
    root.style.setProperty('--safe-area-bottom', `${Math.max(0, insets.bottom)}px`)
  } catch {
    // 保留 CSS env() 的兜底值。
  }
}
