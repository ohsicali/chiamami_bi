import { useEffect } from 'react'

const SCRIPT_ID = 'json-ld-bi-club-sconti'

function dealName(deal) {
  return deal?.restaurant?.name || deal?.title || 'Sconto'
}

function dealDescription(deal) {
  if (!deal) return ''
  const parts = []
  if (deal.title) parts.push(deal.title)
  if (deal.description) parts.push(deal.description)
  return parts.join(' — ')
}

function dealCategory(deal) {
  if (deal?.is_drop) return 'drop'
  if (deal?.discount_type === 'freebie') return 'convenzione'
  if (deal?.discount_type === 'special_price') return 'offerta'
  return 'sconto'
}

export default function SconteSchemaOrg({ drops = [], conv = [] }) {
  useEffect(() => {
    const items = [...drops, ...conv]
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Sconti e vantaggi nei ristoranti di Torino',
      description: 'Drop a tempo, convenzioni e promozioni riservate ai membri del Bi Club',
      itemListElement: items.map((d, i) => {
        const offer = {
          '@type': 'Offer',
          position: i + 1,
          name: dealName(d),
          description: dealDescription(d),
          category: dealCategory(d),
          areaServed: { '@type': 'City', name: 'Torino' },
        }
        if (d.created_at) offer.validFrom = d.created_at
        const validThrough = d.drop_ends_at || d.valid_until
        if (validThrough) offer.validThrough = validThrough
        return offer
      }),
    }

    let script = document.getElementById(SCRIPT_ID)
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(data)

    return () => {
      const el = document.getElementById(SCRIPT_ID)
      if (el) el.remove()
    }
  }, [drops, conv])

  return null
}
