/**
 * Il benvenuto al ristoratore col suo PIN e il link che fa entrare in
 * /verify senza ridigitarlo.
 *
 * Lo manda l'admin alla prima pubblicazione (api/send-email.js,
 * type=partner) e, dal 29/09, il giro delle uscite programmate
 * (api/_scheduled-publish.js) quando il locale va online da solo.
 */
import { randomUUID } from 'node:crypto'
import { partnerWelcomeEmail } from './templates.js'
import { sendEmail } from './send.js'
import { SITE_URL } from './theme.js'

/**
 * @param {object} admin  client Supabase con service role
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendPartnerWelcome(admin, { to, nomeLocale, pin, restaurantId }) {
  // Il gettone usa e getta (24h) che fa entrare senza ridigitare il PIN.
  const magicToken = randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const { error: tokenError } = await admin
    .from('restaurants')
    .update({
      magic_token: magicToken,
      magic_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', restaurantId)

  if (tokenError) {
    console.error('Failed to store magic token:', tokenError)
  }

  const verifyUrl = !tokenError
    ? `${SITE_URL}/verify?token=${magicToken}&pin=${encodeURIComponent(pin)}`
    : `${SITE_URL}/verify?pin=${encodeURIComponent(pin)}`

  const mail = partnerWelcomeEmail({ nomeLocale, pin, verifyUrl })
  return sendEmail({ to, ...mail })
}
