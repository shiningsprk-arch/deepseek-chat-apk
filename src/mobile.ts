import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const syncStatusBar = () => {
  const dark = document.body.classList.contains('dark')
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
  void StatusBar.setBackgroundColor({ color: dark ? '#0f1115' : '#ffffff' }).catch(() => {})
}

/**
 * 只在原生壳里生效的移动端适配：
 * - 状态栏样式跟随应用主题
 * - Android 返回键：先关弹窗，再回退历史，最后最小化
 */
export const setupMobile = () => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  syncStatusBar()
  new MutationObserver(syncStatusBar).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  })

  void App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return
    }
    if (canGoBack) {
      window.history.back()
      return
    }
    void App.minimizeApp()
  })
}
