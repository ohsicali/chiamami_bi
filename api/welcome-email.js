/**
 * Vercel Serverless Function — Send welcome email via Resend
 * Called after first Google OAuth registration
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' })

  const { email, name } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email required' })

  const firstName = (name || '').split(' ')[0] || 'there'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'ChiamamiBi <noreply@chiamamibi.com>',
        to: [email],
        subject: `Benvenuta su ChiamamiBi, ${firstName}! 🍕`,
        html: buildWelcomeHtml(firstName),
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Resend error:', err)
      return res.status(500).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Welcome email error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}

function buildWelcomeHtml(name) {
  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#FFF8F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF8F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background-color:#E8604C;padding:32px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-family:'Georgia',serif;font-size:28px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">CHIAMAMI BI</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:22px;">Ciao ${name}! 👋</h2>
          <p style="margin:0 0 16px;color:#4a4a4a;font-size:15px;line-height:1.6;">
            Benvenuta su <strong>ChiamamiBi</strong> — la tua guida ai migliori ristoranti di Torino!
          </p>
          <p style="margin:0 0 24px;color:#4a4a4a;font-size:15px;line-height:1.6;">
            Ecco cosa puoi fare:
          </p>

          <!-- Features -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">🗺️ &nbsp;Esplora i ristoranti sulla mappa interattiva</td></tr>
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">❤️ &nbsp;Salva i tuoi preferiti</td></tr>
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">🏷️ &nbsp;Riscatta sconti esclusivi con QR code</td></tr>
            <tr><td style="padding:8px 0;color:#4a4a4a;font-size:14px;">⭐ &nbsp;Lascia recensioni e aiuta la community</td></tr>
          </table>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="https://chiamamibi.com" style="display:inline-block;background-color:#E8604C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;">
                Esplora i ristoranti
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px;border-top:1px solid #f0e6e3;text-align:center;">
          <p style="margin:0 0 8px;color:#999;font-size:12px;">ChiamamiBi — Torino, Italia</p>
          <p style="margin:0;color:#999;font-size:12px;">
            <a href="https://chiamamibi.com/privacy" style="color:#E8604C;text-decoration:none;">Privacy Policy</a>
            &nbsp;·&nbsp;
            <a href="https://chiamamibi.com/terms" style="color:#E8604C;text-decoration:none;">Termini di Servizio</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
