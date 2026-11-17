import clsx from 'clsx'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCameraOutline20,
  IconCheckOutline16,
  IconGalleryOutline20,
  IconPaperclipOutline16,
} from '../base/icons.js'
import { showToast } from '../base/toastState.js'
import { photoToFile, recentMediaToFile } from '../../utils/imageFile.js'
import {
  listRecentMedia,
  recentMediaSupported,
  requestRecentMediaAccess,
  type RecentMediaItem,
} from '../../utils/recentMedia.js'
import styles from './AttachmentSheet.module.css'

const isCancel = (error: unknown): boolean =>
  /cancel/i.test(error instanceof Error ? error.message : String(error))

/**
 * 附件弹层：最近图片多选 + 拍照 / 相册 / 文件。
 * 最近图片只在打开时读取，选中后才读取原图并加入草稿。
 */
export const AttachmentSheet = ({
  open,
  remaining,
  onClose,
  onFiles,
  onPickFiles,
}: {
  open: boolean
  remaining: number
  onClose: () => void
  onFiles: (files: File[]) => void
  onPickFiles: () => void
}) => {
  const t = useTranslate()
  const [recent, setRecent] = useState<RecentMediaItem[]>([])
  const [granted, setGranted] = useState(true)
  const [denied, setDenied] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const loadRecent = useCallback(async () => {
    if (!recentMediaSupported()) {
      setGranted(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const result = await listRecentMedia(12)
      setGranted(result.granted)
      setRecent(result.items)
      setLoadError(Boolean(result.error && result.error !== 'permission'))
    } catch {
      setGranted(false)
      setRecent([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    setSelected(new Set())
    void loadRecent()
  }, [open, loadRecent])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const addFiles = (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, remaining))
    if (accepted.length === 0) {
      showToast({ key: 'attachmentLimitReached', type: 'error' })
      return
    }
    if (accepted.length < files.length) {
      showToast({ key: 'attachmentLimitReached', type: 'error' })
    }
    onFiles(accepted)
    onClose()
  }

  const takePhoto = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 90,
        width: 2048,
        saveToGallery: false,
      })
      addFiles([await photoToFile(photo)])
    } catch (error) {
      if (!isCancel(error)) {
        showToast({ key: 'attachmentPickFailed', type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  const pickGallery = async () => {
    if (busy || remaining <= 0) {
      if (remaining <= 0) {
        showToast({ key: 'attachmentLimitReached', type: 'error' })
      }
      return
    }
    setBusy(true)
    try {
      const result = await Camera.pickImages({
        limit: Math.max(1, Math.min(remaining, 9)),
        quality: 90,
        width: 2048,
        height: 2048,
      })
      const files: File[] = []
      for (const photo of result.photos.slice(0, Math.max(1, Math.min(remaining, 9)))) {
        try {
          files.push(await photoToFile(photo))
        } catch {
          // 单张读取失败时跳过，保留其余成功项。
        }
      }
      if (files.length === 0) {
        showToast({ key: 'attachmentPickFailed', type: 'error' })
        return
      }
      addFiles(files)
    } catch (error) {
      if (!isCancel(error)) {
        showToast({ key: 'attachmentPickFailed', type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  const pickFiles = () => {
    if (remaining <= 0) {
      showToast({ key: 'attachmentLimitReached', type: 'error' })
      return
    }
    // 同步触发文件选择，保留用户手势；随后关闭弹层。
    onPickFiles()
    onClose()
  }

  const allowAccess = async () => {
    try {
      await requestRecentMediaAccess()
      setDenied(false)
      await loadRecent()
    } catch {
      setDenied(true)
      showToast({ key: 'attachmentPickFailed', type: 'error' })
    }
  }

  const toggle = (id: string) => {
    if (!selected.has(id) && selected.size >= remaining) {
      showToast({ key: 'attachmentLimitReached', type: 'error' })
      return
    }
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const confirmRecent = async () => {
    if (busy || selected.size === 0) {
      return
    }
    setBusy(true)
    try {
      const items = recent
        .filter((item) => selected.has(item.id))
        .slice(0, Math.max(1, remaining))
      const files: File[] = []
      for (const item of items) {
        try {
          files.push(await recentMediaToFile(item))
        } catch {
          // 单张读取失败时跳过，保留其余成功项。
        }
      }
      if (files.length === 0) {
        showToast({ key: 'attachmentPickFailed', type: 'error' })
        return
      }
      addFiles(files)
    } catch {
      showToast({ key: 'attachmentPickFailed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('attachmentSheetTitle')}>
        <div className={styles.handle} />
        {recentMediaSupported() ? (
          <section className={styles.recentSection}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>{t('attachmentRecent')}</span>
              {selected.size > 0 ? (
                <button
                  type="button"
                  className={styles.done}
                  disabled={busy}
                  onClick={() => void confirmRecent()}
                >
                  {busy
                    ? t('attachmentReading')
                    : `${t('attachmentDone')} (${selected.size})`}
                </button>
              ) : null}
            </div>
            {loading ? (
              <div className={styles.skeleton} aria-hidden>
                {Array.from({ length: 8 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            ) : loadError ? (
              <div className={styles.empty}>{t('attachmentPickFailed')}</div>
            ) : granted ? (
              recent.length > 0 ? (
                <div className={styles.grid}>
                  {recent.map((item) => {
                    const active = selected.has(item.id)
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={clsx(styles.thumb, active && styles.thumbSelected)}
                        aria-pressed={active}
                        aria-label={item.name}
                        onClick={() => toggle(item.id)}
                      >
                        <img src={item.thumbnail} alt="" loading="lazy" />
                        <span className={clsx(styles.check, active && styles.checkActive)}>
                          {active ? <IconCheckOutline16 /> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className={styles.empty}>{t('attachmentNoPhotos')}</div>
              )
            ) : denied ? (
              <div className={styles.empty}>{t('attachmentPhotoSettingsHint')}</div>
            ) : (
              <button type="button" className={styles.permission} onClick={() => void allowAccess()}>
                {t('attachmentAllowPhotos')}
              </button>
            )}
          </section>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.action} disabled={busy} onClick={() => void takePhoto()}>
            <span className={styles.actionIcon}>
              <IconCameraOutline20 />
            </span>
            <span>{t('attachmentCamera')}</span>
          </button>
          <button type="button" className={styles.action} disabled={busy} onClick={() => void pickGallery()}>
            <span className={styles.actionIcon}>
              <IconGalleryOutline20 />
            </span>
            <span>{t('attachmentGallery')}</span>
          </button>
          <button type="button" className={styles.action} disabled={busy} onClick={pickFiles}>
            <span className={styles.actionIcon}>
              <IconPaperclipOutline16 />
            </span>
            <span>{t('attachmentFiles')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
