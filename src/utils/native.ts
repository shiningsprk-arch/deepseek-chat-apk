import { Capacitor, registerPlugin } from '@capacitor/core'

type AudioPermissionPlugin = {
  request(): Promise<void>
}

const AudioPermission = registerPlugin<AudioPermissionPlugin>('AudioPermission')

export const isNative = (): boolean => Capacitor.isNativePlatform()

/** Android 上申请麦克风运行时权限；Web 端直接放行。 */
export const requestAudioPermission = async (): Promise<void> => {
  if (!isNative()) {
    return
  }
  await AudioPermission.request()
}
