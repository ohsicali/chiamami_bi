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
    const { subject, template, variables } = await req.json()

    if (!subject || !template) {
      return new Response(JSON.stringify({ error: 'subject and template required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fromEmail = Deno.env.get('NEWSLETTER_FROM_EMAIL') || 'ChiamamiBi <noreply@chiamamibi.it>'

    // Fetch subscribed emails
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .eq('subscribed', true)

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email templates
    const templates: Record<string, (vars: Record<string, string>) => string> = {
      'new-restaurant': (vars) => `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #FF5757; font-size: 28px; margin: 0;">ChiamamiBi</h1>
          </div>
          <h2 style="color: #1a1a1a; font-size: 20px;">Nuovo ristorante su ChiamamiBi!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Abbiamo appena aggiunto <strong>${vars.restaurant_name || 'un nuovo ristorante'}</strong> alla nostra selezione a Torino.
          </p>
          ${vars.discount ? `<p style="color: #FF5757; font-size: 18px; font-weight: 600;">🏷️ Sconto attivo: ${vars.discount}</p>` : ''}
          <a href="https://chiamamibi.it/restaurant/${vars.slug || ''}" style="display: inline-block; background: #FF5757; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Scopri il ristorante
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Ricevi questa email perché sei iscritto alla newsletter di ChiamamiBi.<br/>
            <a href="https://chiamamibi.it/profile" style="color: #999;">Cancella iscrizione</a>
          </p>
        </div>
      `,
      'weekly-digest': (vars) => `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #FF5757; font-size: 28px; margin: 0;">ChiamamiBi</h1>
            <p style="color: #666;">Il meglio della settimana a Torino</p>
          </div>
          ${vars.content || '<p>Scopri i nuovi ristoranti della settimana!</p>'}
          <a href="https://chiamamibi.it" style="display: inline-block; background: #FF5757; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Esplora ChiamamiBi
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            <a href="https://chiamamibi.it/profile" style="color: #999;">Cancella iscrizione</a>
          </p>
        </div>
      `,
    }

    const htmlGenerator = templates[template]
    if (!htmlGenerator) {
      return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = htmlGenerator(variables || {})
    const emails = subscribers.map((s) => s.email)

    // Send via Resend (batch)
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(
        emails.map((email) => ({
          from: fromEmail,
          to: email,
          subject,
          html,
        }))
      ),
    })

    const result = await res.json()

    return new Response(JSON.stringify({ sent: emails.length, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
