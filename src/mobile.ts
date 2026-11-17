import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { openMobileSider, closeMobileSider, useMobileSider } from './components/sider/mobileSiderState.js'
import { applySafeAreaInsets } from './utils/safeArea.js'

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

  syncStatusBar()
  new MutationObserver(syncStatusBar).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  })

  const refreshInsets = () => {
    void applySafeAreaInsets()
  }
  refreshInsets()
  window.addEventListener('resize', refreshInsets)
  window.addEventListener('orientationchange', refreshInsets)
  window.visualViewport?.addEventListener('resize', refreshInsets)

  // 屏幕中部右滑打开历史，左滑关闭历史；左右边缘留给系统返回手势。
  let tracking = false
  let startX = 0
  let startY = 0
  const MIN_DISTANCE = 80
  const MAX_VERTICAL = 30

  const isHorizontallyScrollable = (target: EventTarget | null): boolean => {
    for (
      let element = target instanceof Element ? target : null;
      element && element !== document.body;
      element = element.parentElement
    ) {
      const style = getComputedStyle(element)
      if (/auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth) {
        return true
      }
    }
    return false
  }

  document.addEventListener(
    'touchstart',
    (event) => {
      tracking = false
      if (event.touches.length !== 1) {
        return
      }
      if (document.querySelector('[role="dialog"]')) {
        return
      }
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
      ) {
        return
      }
      if (isHorizontallyScrollable(target)) {
        return
      }
      const touch = event.touches[0]
      const width = window.innerWidth
      // 只从中部开始，避开左右两侧的系统手势区域。
      if (touch.clientX < width * 0.2 || touch.clientX > width * 0.8) {
        return
      }
      tracking = true
      startX = touch.clientX
      startY = touch.clientY
    },
    { passive: true }
  )

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!tracking || event.touches.length !== 1) {
        return
      }
      // 长按选词或拖动选择手柄时不误触发侧滑。
      if (window.getSelection()?.toString()) {
        tracking = false
        return
      }
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dy) >= MAX_VERTICAL) {
        return
      }
      const open = useMobileSider.getState().open
      if (!open && dx > MIN_DISTANCE) {
        tracking = false
        openMobileSider()
      } else if (open && dx < -MIN_DISTANCE) {
        tracking = false
        closeMobileSider()
      }
    },
    { passive: true }
  )

  const stopTracking = () => {
    tracking = false
  }
  document.addEventListener('touchend', stopTracking, { passive: true })
  document.addEventListener('touchcancel', stopTracking, { passive: true })

  void App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return
    }
    if (useMobileSider.getState().open) {
      closeMobileSider()
      return
    }
    if (canGoBack) {
      window.history.back()
      return
    }
    void App.minimizeApp()
  })
}
