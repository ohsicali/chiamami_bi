import { useEffect } from 'react'

const SITE_URL = 'https://chiamamibi.com'
const DEFAULT_TITLE =
  'Dove mangiare a Torino — I migliori ristoranti consigliati da ChiamamiBi'
const DEFAULT_DESCRIPTION =
  'Scopri dove mangiare a Torino: i migliori ristoranti, bar e locali consigliati da Bi. Mappa interattiva, recensioni curate, sconti esclusivi.'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

function setMetaTag(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function absoluteUrl(value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`
}

export default function MetaTags({
  title,
  description,
  image,
  url,
  type = 'website',
  canonical,
  noindex = false,
}) {
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE
    const resolvedDescription = description || DEFAULT_DESCRIPTION
    const resolvedImage = absoluteUrl(image) || DEFAULT_IMAGE
    const currentPath =
      typeof window !== 'undefined' ? window.location.pathname : '/'
    const resolvedUrl =
      absoluteUrl(url || canonical) || `${SITE_URL}${currentPath}`
    const resolvedCanonical =
      absoluteUrl(canonical || url) || resolvedUrl

    document.title = resolvedTitle

    setMetaTag('name', 'description', resolvedDescription)

    setMetaTag('property', 'og:type', type)
    setMetaTag('property', 'og:title', resolvedTitle)
    setMetaTag('property', 'og:description', resolvedDescription)
    setMetaTag('property', 'og:image', resolvedImage)
    setMetaTag('property', 'og:url', resolvedUrl)
    setMetaTag('property', 'og:site_name', 'ChiamamiBi')
    setMetaTag('property', 'og:locale', 'it_IT')

    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', resolvedTitle)
    setMetaTag('name', 'twitter:description', resolvedDescription)
    setMetaTag('name', 'twitter:image', resolvedImage)

    setCanonical(resolvedCanonical)

    if (noindex) {
      setMetaTag('name', 'robots', 'noindex, nofollow')
    } else {
      setMetaTag(
        'name',
        'robots',
        'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      )
    }
  }, [title, description, image, url, type, canonical, noindex])

  return null
}
