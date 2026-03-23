import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../supabase'
import { useTranslation as useI18n } from 'react-i18next'

/**
 * Fetch cached translations for a restaurant's text fields.
 * Falls back to original text if no translation is cached.
 * Triggers Edge Function for missing translations.
 */
export function useRestaurantTranslation(restaurant) {
  const { i18n } = useI18n()
  const lang = i18n.language
  const [translations, setTranslations] = useState({})
  const [loading, setLoading] = useState(false)

  const fields = ['our_review', 'our_tip']

  const fetchTranslations = useCallback(async () => {
    if (!restaurant?.id || lang === 'it' || !isSupabaseConfigured()) return

    setLoading(true)

    // Check cache first
    const { data: cached } = await supabase
      .from('translations')
      .select('source_field, translated_text')
      .eq('source_table', 'restaurants')
      .eq('source_id', restaurant.id)
      .eq('language', lang)

    const result = {}
    const missing = []

    for (const field of fields) {
      const found = cached?.find((t) => t.source_field === field)
      if (found) {
        result[field] = found.translated_text
      } else if (restaurant[field]) {
        missing.push(field)
      }
    }

    setTranslations(result)

    // Request translations for missing fields via Edge Function
    for (const field of missing) {
      try {
        const { data } = await supabase.functions.invoke('translate-content', {
          body: {
            source_table: 'restaurants',
            source_id: restaurant.id,
            source_field: field,
            text: restaurant[field],
            target_language: lang,
          },
        })
        if (data?.translated) {
          result[field] = data.translated
          setTranslations((prev) => ({ ...prev, [field]: data.translated }))
        }
      } catch {
        // Silently fail — use original text
      }
    }

    setLoading(false)
  }, [restaurant?.id, lang])

  useEffect(() => {
    fetchTranslations()
  }, [fetchTranslations])

  // Return translated text or fallback to original
  const t = (field) => {
    if (lang === 'it') return restaurant?.[field] || ''
    return translations[field] || restaurant?.[field] || ''
  }

  return { t, loading }
}
