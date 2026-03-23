export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, context } = req.body || {}

  if (!text) {
    return res.status(400).json({ error: 'text required' })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata su Vercel' })
  }

  const contextHint = context === 'restaurant review'
    ? 'This is a restaurant review written in Italian.'
    : context === 'restaurant tip'
    ? 'This is a restaurant dining tip written in Italian.'
    : 'This is Italian text about a restaurant.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `${contextHint} Correggi SOLO errori grammaticali e ortografici. NON cambiare tono, stile, emoji, espressioni personali. Mantieni tutto il resto identico. Rispondi SOLO con il testo corretto, nient'altro.\n\nTesto originale:\n${text}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return res.status(500).json({ error: `Anthropic API error: ${response.status} - ${errBody}` })
    }

    const aiResult = await response.json()
    const corrected = aiResult.content?.[0]?.text || ''

    return res.status(200).json({
      corrected: corrected || null,
      changed: corrected.trim() !== text.trim(),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
