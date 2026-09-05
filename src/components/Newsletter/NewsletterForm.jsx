import { useState } from 'react'
import { TR_REVEAL } from '../../lib/motion'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export default function NewsletterForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error' | 'exists'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return

    setStatus('loading')

    if (!isSupabaseConfigured()) {
      // Simulate success in mock mode
      setTimeout(() => setStatus('success'), 500)
      return
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email: email.trim().toLowerCase() })

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation — already subscribed
        setStatus('exists')
      } else {
        setStatus('error')
      }
      return
    }

    setStatus('success')
    setEmail('')
  }

  return (
    <motion.div
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, #FFF0F0, #FFE8E0, #FFF5F0)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TR_REVEAL}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">📬</span>
        <h3 className="text-sm font-bold text-primary">
          {t('newsletter.title')}
        </h3>
      </div>
      <p className="text-xs text-secondary mb-3">
        {t('newsletter.subtitle')}
      </p>

      {status === 'success' ? (
        <motion.p
          className="text-sm font-semibold text-green-600 text-center py-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t('newsletter.success')}
        </motion.p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('newsletter.placeholder')}
            required
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:border-accent focus:outline-none"
          />
          <motion.button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            {status === 'loading' ? t('newsletter.subscribing') : t('newsletter.subscribe')}
          </motion.button>
        </form>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-500 mt-2">{t('newsletter.error')}</p>
      )}
      {status === 'exists' && (
        <p className="text-xs text-amber-600 mt-2">{t('newsletter.alreadySubscribed')}</p>
      )}
    </motion.div>
  )
}
