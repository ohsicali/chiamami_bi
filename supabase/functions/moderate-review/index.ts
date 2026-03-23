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
    const { review_id, comment } = await req.json()

    if (!comment) {
      return new Response(JSON.stringify({ error: 'comment required' }), {
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `You are a content moderator for a restaurant review platform. Analyze this review and respond with a JSON object containing:
- "approved": boolean (true if the review is appropriate)
- "reason": string (brief explanation if not approved)
- "flags": array of strings (any concerns: "spam", "offensive", "irrelevant", "fake", "none")

Review text: "${comment}"

Respond ONLY with the JSON object.`,
          },
        ],
      }),
    })

    const aiResult = await response.json()
    const text = aiResult.content?.[0]?.text || '{}'

    let moderation
    try {
      moderation = JSON.parse(text)
    } catch {
      moderation = { approved: true, reason: '', flags: ['parse_error'] }
    }

    // Auto-update review status if review_id provided
    if (review_id && !moderation.approved) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('user_reviews')
        .update({ status: 'pending_review', ai_reason: moderation.reason || null })
        .eq('id', review_id)
    }

    return new Response(JSON.stringify(moderation), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
