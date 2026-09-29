import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import MetaTags from '../../components/SEO/MetaTags'
import RedemptionFeedback from '../../components/Feedback/RedemptionFeedback'
import BiCharacter from '../../components/Feedback/BiCharacter'
import { getFeedback, rateFeedback } from '../../lib/feedbackApi'
import { parseFeedbackToken, parseStars } from '../../lib/redemptionFeedback'
import { track } from '../../lib/posthog'

/**
 * /feedback?t=<token>[&stelle=N] — dove portano le email "com'è andata?".
 *
 * Il token è l'autorizzazione (come in /preferenze-email): chi apre la posta
 * sul telefono dove non è entrato lascia il feedback senza accedere. Le
 * stelle nell'email sono cinque link: `stelle=N` salva subito il voto e si
 * parte dal modulo, così il tocco nella posta conta anche se poi la pagina
 * si chiude.
 */
export default function FeedbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = parseFeedbackToken(params.get('t'))
  const stars = parseStars(params.get('stelle'))
  const [state, setState] = useState(() => (token ? { status: 'loading' } : { status: 'notfound' }))
  const tracked = useRef(false)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    ;(async () => {
      const info = await getFeedback(token)
      if (cancelled) return
      if (!info || info.error) {
        setState({ status: info?.error === 'expired' ? 'expired' : 'notfound' })
        return
      }
      if (info.completed) {
        setState({ status: 'done', info })
        return
      }
      let rating = info.rating ?? null
      if (stars) {
        const r = await rateFeedback(token, stars, 'email')
        if (cancelled) return
        if (!r?.error) rating = stars
      }
      setState({ status: 'ready', info: { ...info, token, rating }, rating })
      if (!tracked.current) {
        tracked.current = true
        track('feedback_shown', { source: 'email', from_stars: !!stars })
      }
    })()
    return () => { cancelled = true }
  }, [token, stars])

  const handleClose = ({ completed }) => navigate(completed ? '/sconti' : '/')

  return (
    <>
      <MetaTags title="Com’è andata? — ChiamamiBi" noindex />
      {state.status === 'loading' && <div className="rf-page" aria-busy="true" />}

      {state.status === 'ready' && (
        <RedemptionFeedback
          data={state.info}
          source="email"
          variant="page"
          initialRating={state.rating}
          startAt={state.rating ? 'form' : 'stars'}
          onClose={handleClose}
        />
      )}

      {(state.status === 'done' || state.status === 'expired' || state.status === 'notfound') && (
        <Message status={state.status} info={state.info} />
      )}
    </>
  )
}

function Message({ status, info }) {
  const copy = {
    done: {
      title: info?.first_name ? `Grazie, ${info.first_name}!` : 'Grazie!',
      text: `Mi hai già raccontato com’è andata${info?.restaurant?.name ? ` da ${info.restaurant.name}` : ''}. L’ho letto tutto.`,
      mood: 'love',
    },
    expired: {
      title: 'Questo link è scaduto',
      text: 'Vale un mese dalla cena. Se vuoi dirmi qualcosa, scrivimi a info@chiamamibi.com.',
      mood: 'ok',
    },
    notfound: {
      title: 'Link non valido',
      text: 'Forse è stato copiato a metà. Riaprilo dall’email, o scrivimi a info@chiamamibi.com.',
      mood: 'meh',
    },
  }[status]

  return (
    <div className="rf-root rf-page">
      <div className="rf-panel">
        <div className="rf-step rf-thanks-step" style={{ justifyContent: 'center' }}>
          <div className="rf-bi-stage">
            <span className="rf-bi-halo" aria-hidden="true" />
            <BiCharacter className="rf-bi" mood={copy.mood} hearts={status === 'done'} />
          </div>
          <h1 className="rf-title">{copy.title}</h1>
          <p className="rf-sub">{copy.text}</p>
          <div className="rf-actions">
            <Link to="/sconti" className="rf-btn rf-btn-primary" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
              Vai al Bi Club
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
