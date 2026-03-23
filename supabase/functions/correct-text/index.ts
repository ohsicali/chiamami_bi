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

    if (!text) {
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
        messages: [
          {
            role: 'user',
            content: `${contextHint} Please correct any grammar, spelling, and punctuation errors. Improve the writing style to be more engaging and professional while keeping the original meaning and tone. Only return the corrected text, nothing else.\n\nOriginal text:\n${text}`,
          },
        ],
      }),
    })

    const aiResult = await response.json()
    const corrected = aiResult.content?.[0]?.text || ''

    return new Response(JSON.stringify({
      corrected: corrected || null,
      changed: corrected !== text,
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
