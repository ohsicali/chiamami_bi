import { useEffect } from 'react'

function setMetaTag(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

export default function MetaTags({
  title,
  description,
  image,
  url,
  type = 'website',
}) {
  useEffect(() => {
    if (title) {
      document.title = title
      setMetaTag('property', 'og:title', title)
      setMetaTag('name', 'twitter:title', title)
    }

    if (description) {
      setMetaTag('name', 'description', description)
      setMetaTag('property', 'og:description', description)
      setMetaTag('name', 'twitter:description', description)
    }

    if (image) {
      setMetaTag('property', 'og:image', image)
      setMetaTag('name', 'twitter:image', image)
    }

    if (url) {
      setMetaTag('property', 'og:url', url)
    }

    setMetaTag('property', 'og:type', type)
    setMetaTag('name', 'twitter:card', 'summary_large_image')
  }, [title, description, image, url, type])

  return null
}
