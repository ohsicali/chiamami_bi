/**
 * Conversione in WebP prima dell'upload — un solo posto.
 *
 * Nasce dalla galleria del ristorante (`FotoGalleriaTab`), che è stata per
 * mesi l'unico punto che caricava foto. Da quando anche i prodotti dello
 * sconto hanno le loro foto i punti sono due, e due copie della stessa
 * conversione divergono al primo ritocco di qualità: una galleria a 0.82 e
 * una a 0.7 sullo stesso bucket si vedono.
 *
 * Ogni foto diventa due file: la piena (per l'hero e le tessere grandi) e la
 * thumb da 400px (per le liste). Il lavoro sta sul client apposta — una foto
 * da 4MB scattata col telefono non deve mai partire per la rete così com'è.
 */

/**
 * @param {File} file        l'originale scelto dall'utente
 * @param {number} maxWidth  larghezza massima della variante piena
 * @param {number} quality   qualità WebP della variante piena (0–1)
 * @returns {Promise<{full: Blob, thumb: Blob}>}
 */
export function convertToWebP(file, maxWidth = 2400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const resize = (targetWidth, q) =>
        new Promise((res, rej) => {
          // Mai ingrandire: una foto da 800px richiesta a 2400 resta a 800,
          // altrimenti si pagherebbe banda per pixel inventati.
          const scale = Math.min(1, targetWidth / img.width)
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob((blob) => (blob ? res(blob) : rej(new Error('WebP conversion failed'))), 'image/webp', q)
        })
      Promise.all([resize(maxWidth, quality), resize(400, 0.7)])
        .then(([full, thumb]) => {
          URL.revokeObjectURL(img.src)
          resolve({ full, thumb })
        })
        .catch(reject)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
