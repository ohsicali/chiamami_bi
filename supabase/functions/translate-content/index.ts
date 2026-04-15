import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { source_table, source_id, source_field, text, target_language } = await req.json()

    // Block empty/whitespace-only user input before hitting the API
    const trimmedText = typeof text === 'string' ? text.trim() : ''
    if (!trimmedText || !target_language) {
      return new Response(JSON.stringify({ error: 'text and target_language required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const langNames: Record<string, string> = {
      it: 'Italian',
      en: 'English',
      fr: 'French',
      es: 'Spanish',
      de: 'German',
    }

    // Build messages and filter empty text content blocks (Anthropic rejects
    // "text content blocks must be non-empty")
    const messages = [
      {
        role: 'user',
        content: `Translate the following restaurant-related text to ${langNames[target_language] || target_language}. Keep the tone casual and friendly. Only return the translated text, nothing else.\n\n${trimmedText}`,
      },
    ].filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'empty message content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages,
      }),
    })

    const aiResult = await response.json()
    const translated = aiResult.content?.[0]?.text || ''

    if (!translated) {
      return new Response(JSON.stringify({ error: 'Translation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cache the translation in DB if source info provided
    if (source_table && source_id && source_field) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase.from('translations').upsert(
        {
          source_table,
          source_id,
          source_field,
          language: target_language,
          translated_text: translated,
        },
        { onConflict: 'source_table,source_id,source_field,language' }
      )
    }

    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
