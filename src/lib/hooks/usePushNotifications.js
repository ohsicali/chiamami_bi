import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  const isSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported || !userId) return

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    })
  }, [isSupported, userId])

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId || !VAPID_PUBLIC_KEY) return false

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setLoading(false)
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save subscription to Supabase
      if (isSupabaseConfigured()) {
        const keys = subscription.toJSON().keys
        await supabase
          .from('push_subscriptions')
          .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
          }, { onConflict: 'endpoint' })
      }

      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch {
      setLoading(false)
      return false
    }
  }, [isSupported, userId])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return

    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()

        if (isSupabaseConfigured()) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      }
      setIsSubscribed(false)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [isSupported])

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
  }
}
