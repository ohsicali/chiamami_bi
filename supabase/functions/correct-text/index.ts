import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, context } = await req.json()

    // Block empty/whitespace-only user input before hitting the API
    const trimmedText = typeof text === 'string' ? text.trim() : ''
    if (!trimmedText) {
      return new Response(JSON.stringify({ error: 'text required' }), {
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

    const contextHint = context === 'restaurant review'
      ? 'This is a restaurant review written in Italian.'
      : context === 'restaurant tip'
      ? 'This is a restaurant dining tip written in Italian.'
      : 'This is Italian text about a restaurant.'

    // Build messages and filter empty text content blocks (Anthropic rejects
    // "text content blocks must be non-empty")
    const messages = [
      {
        role: 'user',
        content: `${contextHint} Correggi SOLO errori grammaticali e ortografici. NON cambiare tono, stile, emoji, espressioni personali. Mantieni tutto il resto identico. Rispondi SOLO con il testo corretto, nient'altro.\n\nTesto originale:\n${trimmedText}`,
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
    const corrected = aiResult.content?.[0]?.text || ''

    return new Response(JSON.stringify({
      corrected: corrected || null,
      changed: corrected !== trimmedText,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
