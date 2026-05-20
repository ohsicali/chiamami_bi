import { useEffect } from 'react'

const SITE_URL = 'https://chiamamibi.com'
const SCRIPT_ID_PREFIX = 'json-ld-'

function inferScriptId(props) {
  if (props.id) return `${SCRIPT_ID_PREFIX}${props.id}`
  if (props.type === 'breadcrumb') return `${SCRIPT_ID_PREFIX}breadcrumb`
  if (props.type === 'faq') return `${SCRIPT_ID_PREFIX}faq`
  if (props.type === 'itemList') return `${SCRIPT_ID_PREFIX}itemlist`
  if (props.type === 'collection') return `${SCRIPT_ID_PREFIX}collection`
  return `${SCRIPT_ID_PREFIX}restaurant`
}

const DAY_NAME_TO_SCHEMA = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const DAYS_ENUM = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function absoluteUrl(value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function normalizeTime(t) {
  if (!t && t !== 0) return null
  if (typeof t === 'object' && 'hour' in t) {
    return `${pad(t.hour)}:${pad(t.minute || 0)}`
  }
  if (typeof t === 'string') {
    const m = t.match(/^(\d{1,2}):?(\d{2})?$/)
    if (m) return `${pad(m[1])}:${pad(m[2] || 0)}`
    return t
  }
  return null
}

function buildOpeningHoursSpec(hoursCache) {
  if (!hoursCache) return null
  // Google Places format: { periods: [{ open: { day, hour, minute }, close: {...} }] }
  const periods = hoursCache.periods || hoursCache.regularOpeningHours?.periods
  if (Array.isArray(periods) && periods.length) {
    return periods
      .filter(p => p?.open)
      .map(p => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAYS_ENUM[p.open.day] || DAYS_ENUM[0],
        opens: normalizeTime(p.open) || '00:00',
        closes: normalizeTime(p.close) || '23:59',
      }))
  }
  // Formato alternativo { monday: [{ open, close }], ... }
  const specs = []
  for (const [day, ranges] of Object.entries(hoursCache)) {
    const dayName = DAY_NAME_TO_SCHEMA[day.toLowerCase()]
    if (!dayName || !Array.isArray(ranges)) continue
    for (const range of ranges) {
      if (!range?.open || !range?.close) continue
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dayName,
        opens: normalizeTime(range.open) || '00:00',
        closes: normalizeTime(range.close) || '23:59',
      })
    }
  }
  return specs.length ? specs : null
}

function buildSchema(props) {
  if (props.type === 'breadcrumb' && Array.isArray(props.items)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: props.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: absoluteUrl(item.url),
      })),
    }
  }

  if (props.type === 'faq' && Array.isArray(props.questions)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: props.questions.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    }
  }

  if (props.type === 'itemList' && Array.isArray(props.items)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: props.items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: absoluteUrl(item.url),
        name: item.name,
      })),
    }
  }

  if (props.type === 'collection' && props.name) {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: props.name,
      description: props.description,
      url: absoluteUrl(props.url),
    }
  }

  // Default: Restaurant
  const {
    name,
    address,
    city,
    country = 'IT',
    telephone,
    url,
    priceRange,
    servesCuisine,
    image,
    description,
    latitude,
    longitude,
    sameAs,
    hoursCache,
    rating,
    ratingCount,
  } = props

  if (!name) return null

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name,
  }
  if (url) data.url = absoluteUrl(url)
  if (description) data.description = description

  if (image) {
    const images = Array.isArray(image) ? image : [image]
    data.image = images.map(absoluteUrl).filter(Boolean)
  }

  if (address) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: city || 'Torino',
      addressCountry: country,
    }
  }

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude,
      longitude,
    }
  }

  if (telephone) data.telephone = telephone
  if (priceRange) data.priceRange = priceRange
  if (servesCuisine) data.servesCuisine = servesCuisine
  if (Array.isArray(sameAs)) {
    const filtered = sameAs.filter(Boolean)
    if (filtered.length) data.sameAs = filtered
  }

  const openingHours = buildOpeningHoursSpec(hoursCache)
  if (openingHours) data.openingHoursSpecification = openingHours

  if (typeof rating === 'number' && rating > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating,
      bestRating: 5,
      ratingCount: ratingCount || 1,
    }
  }

  return data
}

export default function JsonLd(props) {
  const key = JSON.stringify(props)
  useEffect(() => {
    const data = buildSchema(props)
    if (!data) return
    const scriptId = inferScriptId(props)

    let script = document.getElementById(scriptId)
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(data)

    return () => {
      const existing = document.getElementById(scriptId)
      if (existing) existing.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}
