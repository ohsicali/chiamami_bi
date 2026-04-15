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

    // Block empty/whitespace-only user input before hitting the API
    const trimmedComment = typeof comment === 'string' ? comment.trim() : ''
    if (!trimmedComment) {
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

    // Build messages and filter empty text content blocks (Anthropic rejects
    // "text content blocks must be non-empty")
    const messages = [
      {
        role: 'user',
        content: `You are a content moderator for a restaurant review platform. Analyze this review and respond with a JSON object containing:
- "approved": boolean (true if the review is appropriate)
- "reason": string (brief explanation if not approved)
- "flags": array of strings (any concerns: "spam", "offensive", "irrelevant", "fake", "none")

Review text: "${trimmedComment}"

Respond ONLY with the JSON object.`,
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
        max_tokens: 256,
        messages,
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

    // Auto-update review status server-side so the client never needs
    // UPDATE permission on status='published'. The service-role key
    // bypasses RLS, and the client-side RLS policy blocks status updates
    // entirely (see security-hardening-2026-04.sql).
    if (review_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      if (moderation.approved) {
        await supabase
          .from('user_reviews')
          .update({ status: 'published', ai_reason: null })
          .eq('id', review_id)
      } else {
        await supabase
          .from('user_reviews')
          .update({ status: 'pending_review', ai_reason: moderation.reason || null })
          .eq('id', review_id)
      }
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
