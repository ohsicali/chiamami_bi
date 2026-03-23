import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, isSupabaseConfigured } from '../supabase'

/**
 * Hook to get translated dynamic content (reviews, tips, etc.)
 * Returns the original text if language is 'it' or no translation is cached.
 * Translations are cached in the 'translations' table.
 */
export function useTranslatedContent(sourceTable, sourceId, sourceField, originalText) {
  const { i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2)
  const [text, setText] = useState(originalText)

  useEffect(() => {
    // No translation needed for Italian (default)
    if (!lang || lang === 'it' || !sourceId || !originalText || !isSupabaseConfigured()) {
      setText(originalText)
      return
    }

    // Try to fetch cached translation
    supabase
      .from('translations')
      .select('translated_text')
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
      .eq('source_field', sourceField)
      .eq('language', lang)
      .single()
      .then(({ data }) => {
        if (data?.translated_text) {
          setText(data.translated_text)
        } else {
          // No cached translation — show original
          setText(originalText)
        }
      })
  }, [sourceTable, sourceId, sourceField, lang, originalText])

  return text
}
