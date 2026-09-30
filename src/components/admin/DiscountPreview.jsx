import { useEffect, useState } from 'react'
import { formatDiscountBadge, pickPerk, formatDiscountValue } from '../../lib/utils/discountFormat'
import { conventionValidity } from '../../../api/_email/content.js'
import { proxyImg } from '../../lib/supabase'

/**
 * L'anteprima dello sconto nell'editor admin: come lo vedrà chi apre il sito,
 * mentre lo si scrive.
 *
 * Segue la regola del colore (CLAUDE.md → Email): il **drop** è corallo
 * pieno, con il countdown e la barra dei posti; la **convenzione** è crema
 * con il filetto d'oro e il chip che dice quando vale ("Valido solo a
 * cena"), senza barra né countdown. Il badge è verde e col segno meno,
 * sempre da `formatDiscountBadge`. Il chip viene da `conventionValidity`,
 * la stessa frase delle email: se lì cambia, qui cambia con lei.
 *
 * `form` è lo stato dell'editor (DiscountManager), non una riga del DB.
 */
export default function DiscountPreview({ form, restaurant }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const isDrop = form.kind === 'drop'
  const deal = {
    title: form.title,
    discount_type: form.discount_type,
    discount_value: form.discount_value,
    description: form.description,
  }
  const badge = formatDiscountBadge(deal) || '−?'
  const perk = pickPerk(deal, formatDiscountValue(deal)) || 'Scrivi il vantaggio…'
  const name = restaurant?.name || 'Il tuo locale'
  const photo = restaurant?.photo ? proxyImg(restaurant.photo, { w: 200 }) : null
  const firstRule = String(form.conditions || '').split('\n').map((s) => s.trim()).find(Boolean)
  const endIso = form.no_end_date || !form.ends_at ? null : new Date(form.ends_at).toISOString()
  const validity = conventionValidity({
    days: form.valid_days,
    slots: form.valid_meal_slots,
    until: endIso,
    conditions: form.conditions,
  }, now)
  const seats = parseInt(form.max_uses, 10) || 0

  return (
    <div className="adm-preview">
      <div className="adm-preview__label">
        <span>Anteprima</span>
        {form.is_test && <span className="adm-pill adm-pill--test">Prova</span>}
      </div>

      {isDrop ? (
        <div className="adm-pv-drop">
          <div className="adm-pv-drop__head">
            <span className="adm-pv-drop__tag"><i aria-hidden /> DROP LIVE</span>
            <span className="adm-pv-drop__timer">{countdown(endIso, now)}</span>
          </div>
          <div className="adm-pv-row">
            {photo && <img className="adm-pv-photo" src={photo} alt="" />}
            <span className="adm-pv-badge">{badge}</span>
            <div className="adm-pv-text">
              <strong>{name}</strong>
              <span>{perk}</span>
            </div>
          </div>
          {validity.limited && <div className="adm-pv-drop__when">{validity.when}</div>}
          {seats > 0 ? (
            <>
              <div className="adm-pv-drop__bar" aria-hidden><i style={{ width: '0%' }} /></div>
              <div className="adm-pv-drop__left">Restano {seats} posti su {seats}</div>
            </>
          ) : (
            <div className="adm-pv-drop__left">Posti senza limite: la barra non si vede.</div>
          )}
          <div className="adm-pv-cta adm-pv-cta--drop">🔓 Sblocca sconto</div>
        </div>
      ) : (
        <div className="adm-pv-conv">
          {form.kind === 'featured' && <span className="adm-pv-conv__featured">⭐ In evidenza</span>}
          <div className="adm-pv-row">
            {photo && <img className="adm-pv-photo" src={photo} alt="" />}
            <span className="adm-pv-badge">{badge}</span>
            <div className="adm-pv-text">
              <strong>{name}</strong>
              <span>{perk}</span>
            </div>
          </div>
          <div className="adm-pv-conv__chips">
            <span className="adm-pv-conv__chip">{validity.when}</span>
            {validity.until && <span className="adm-pv-conv__until">{validity.until}</span>}
          </div>
          <div className="adm-pv-cta">🔓 Sblocca sconto</div>
        </div>
      )}

      {firstRule && <p className="adm-preview__rule">📌 {firstRule}</p>}
    </div>
  )
}

function countdown(endIso, now) {
  if (!endIso) return '∞'
  const diff = new Date(endIso).getTime() - now.getTime()
  if (diff <= 0) return 'scaduto'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}G ${h}H`
  return `${h}H ${String(m).padStart(2, '0')}M`
}
