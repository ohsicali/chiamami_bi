import { useEffect } from 'react'

const SCRIPT_ID = 'json-ld-structured-data'

export default function JsonLd({
  name,
  address,
  telephone,
  url,
  priceRange,
  servesCuisine,
  image,
}) {
  useEffect(() => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
    }

    if (name) data.name = name
    if (address) {
      data.address = {
        '@type': 'PostalAddress',
        streetAddress: address,
      }
    }
    if (telephone) data.telephone = telephone
    if (url) data.url = url
    if (priceRange) data.priceRange = priceRange
    if (servesCuisine) data.servesCuisine = servesCuisine
    if (image) data.image = image

    let script = document.getElementById(SCRIPT_ID)
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(data)

    return () => {
      const existing = document.getElementById(SCRIPT_ID)
      if (existing) {
        existing.remove()
      }
    }
  }, [name, address, telephone, url, priceRange, servesCuisine, image])

  return null
}
