import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { LogoFull } from '../../components/UI/Logo'
import { verifyQRCode, fetchQRPreview, fetchRestaurantRedemptions } from '../../lib/hooks/useDiscounts'

function PinInput({ value, onChange, disabled }) {
  const inputsRef = useRef([])

  const handleChange = (index, digit) => {
    if (!/^\d*$/.test(digit)) return
    const newPin = value.split('')
    newPin[index] = digit
    const joined = newPin.join('')
    onChange(joined)

    // Auto-focus next
    if (digit && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    if (pasted.length === 6) {
      inputsRef.current[5]?.focus()
    }
  }

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          style={{
            width: 48,
            height: 56,
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 700,
            borderRadius: 12,
            border: '2px solid #444',
            background: '#2a2a2a',
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.2s',
            opacity: disabled ? 0.5 : 1,
          }}
          onFocus={e => { e.target.style.borderColor = '#FF5757' }}
          onBlur={e => { e.target.style.borderColor = '#444' }}
        />
      ))}
    </div>
  )
}

function VerifyResult({ result }) {
  if (result.valid) {
    return (
      <motion.div
        className="flex flex-col items-center gap-5 p-6 rounded-2xl"
        style={{ background: '#242424', border: '1px solid #333' }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {/* Green checkmark circle */}
        <motion.div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 400 }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', margin: 0 }}>
          Sconto validato!
        </h2>

        {/* Details table */}
        <div style={{ width: '100%' }}>
          {[
            { label: 'Sconto', value: `${result.discount_value} — ${result.discount_title}` },
            { label: 'Cliente', value: result.user_name },
            { label: 'Ristorante', value: result.restaurant_name },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 2 ? '1px solid #333' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', textAlign: 'right', maxWidth: '65%' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  const iconMap = {
    already_redeemed: { bg: '#dc2626', icon: '✕' },
    expired: { bg: '#f59e0b', icon: '⏱' },
    not_found: { bg: '#6b7280', icon: '?' },
    invalid_pin: { bg: '#f59e0b', icon: '!' },
  }
  const iconData = iconMap[result.error] || iconMap.not_found

  return (
    <motion.div
      className="flex flex-col items-center gap-4 p-6 rounded-2xl"
      style={{ background: '#242424', border: '1px solid #333' }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: iconData.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {iconData.icon}
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', textAlign: 'center', margin: 0 }}>
        {result.message}
      </p>
    </motion.div>
  )
}

function DashboardView({ pin }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')

  useEffect(() => {
    fetchRestaurantRedemptions(pin).then(result => {
      setData(result)
      setLoading(false)
    })
  }, [pin])

  if (loading) return <div style={{ height: 192, borderRadius: 16, background: '#2a2a2a', animation: 'pulse 2s infinite' }} />
  if (!data) return <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>PIN non valido</p>

  const items = tab === 'active' ? data.active : data.used

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div
          style={{
            flex: 1,
            background: '#2a2a2a',
            borderRadius: 16,
            padding: '16px 12px',
            textAlign: 'center',
            border: '1px solid #333',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: '#FF5757' }}>
            {data.active.length}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            da usare
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: '#2a2a2a',
            borderRadius: 16,
            padding: '16px 12px',
            textAlign: 'center',
            border: '1px solid #333',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
            {data.used.length}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            utilizzati
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setTab('active')}
          style={{
            flex: 1,
            borderRadius: 12,
            padding: '10px 0',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: tab === 'active' ? '#FF5757' : '#2a2a2a',
            color: tab === 'active' ? '#fff' : 'rgba(255,255,255,0.5)',
          }}
        >
          Da usare ({data.active.length})
        </button>
        <button
          onClick={() => setTab('used')}
          style={{
            flex: 1,
            borderRadius: 12,
            padding: '10px 0',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: tab === 'used' ? '#FF5757' : '#2a2a2a',
            color: tab === 'used' ? '#fff' : 'rgba(255,255,255,0.5)',
          }}
        >
          Utilizzati ({data.used.length})
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '24px 0' }}>
          {tab === 'active' ? 'Nessun QR attivo' : 'Nessuno sconto utilizzato'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(r => (
            <div
              key={r.id}
              style={{
                borderRadius: 14,
                background: '#242424',
                padding: 14,
                border: '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
                    {r.user?.full_name || 'Utente'}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                    {r.discount?.title} — {r.discount?.discount_value}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      borderRadius: 20,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      background: r.status === 'generated' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                      color: r.status === 'generated' ? '#22c55e' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {r.status === 'generated' ? 'Attivo' : 'Usato'}
                  </span>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                    {new Date(r.status === 'redeemed' ? r.redeemed_at : r.generated_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VerifyPage() {
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code') || ''

  const [pin, setPin] = useState(() => {
    return localStorage.getItem('chiamamibi_pin') || ''
  })
  const [authenticated, setAuthenticated] = useState(() => {
    // Auto-authenticate if PIN was saved
    return !!(localStorage.getItem('chiamamibi_pin'))
  })
  const [pinError, setPinError] = useState(false)

  // QR validation state
  const [showVerify, setShowVerify] = useState(!!codeFromUrl)
  const [manualCode, setManualCode] = useState('')
  const code = codeFromUrl || manualCode
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  // Fetch preview when code is present
  useEffect(() => {
    if (code) {
      fetchQRPreview(code).then(setPreview)
    }
  }, [code])

  const handlePinLogin = async () => {
    if (pin.length !== 6) return
    setPinError(false)
    // Validate PIN by trying to fetch redemptions
    const data = await fetchRestaurantRedemptions(pin)
    if (data) {
      localStorage.setItem('chiamamibi_pin', pin)
      setAuthenticated(true)
    } else {
      setPinError(true)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('chiamamibi_pin')
    setAuthenticated(false)
    setPin('')
    setShowVerify(false)
  }

  const handleManualCodeSubmit = () => {
    if (manualCode.trim()) {
      fetchQRPreview(manualCode.trim()).then(setPreview)
    }
  }

  const handleVerify = async () => {
    if (pin.length !== 6 || !code) return
    setVerifying(true)
    setResult(null)

    try {
      const res = await verifyQRCode(code, pin)
      setResult(res)
    } catch {
      setResult({ valid: false, error: 'not_found', message: 'Errore di connessione' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: '#1a1a1a' }}
    >
      {/* Logo + subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 8 }}>
        <LogoFull height={36} variant="light" />
        <p
          style={{
            fontWeight: 700,
            color: '#fff',
            fontSize: 14,
            marginTop: 8,
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          Area ristoratori
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-4">
        <AnimatePresence mode="wait">
          {!authenticated ? (
            /* -- PIN Login -- */
            <motion.div
              key="login"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div
                style={{
                  borderRadius: 24,
                  background: '#242424',
                  padding: 24,
                  border: '1px solid #333',
                }}
              >
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, marginTop: 0 }}>
                  Inserisci il PIN del tuo ristorante per accedere
                </p>

                <div style={{ marginBottom: 16 }}>
                  <PinInput value={pin} onChange={setPin} disabled={false} />
                </div>

                {pinError && (
                  <p style={{ fontSize: 12, color: '#FF5757', textAlign: 'center', marginBottom: 12 }}>PIN non riconosciuto</p>
                )}

                <motion.button
                  onClick={handlePinLogin}
                  disabled={pin.length !== 6}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#FF5757',
                    padding: '14px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: pin.length !== 6 ? 0.5 : 1,
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Accedi
                </motion.button>
              </div>
            </motion.div>

          ) : showVerify ? (
            /* -- QR Validation -- */
            <motion.div
              key="verify"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div
                style={{
                  borderRadius: 24,
                  background: '#242424',
                  padding: 24,
                  border: '1px solid #333',
                }}
              >
                <h2
                  style={{
                    fontWeight: 700,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#fff',
                    textAlign: 'center',
                    marginBottom: 20,
                    marginTop: 0,
                  }}
                >
                  Validazione Sconto
                </h2>

                {/* Manual code input when no URL code */}
                {!codeFromUrl && !preview && !result && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 12 }}>
                      Inserisci il codice sconto del cliente
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Es. BiSc-abc123"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: '2px solid #444',
                          background: '#2a2a2a',
                          fontSize: 14,
                          color: '#fff',
                          outline: 'none',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#FF5757' }}
                        onBlur={e => { e.target.style.borderColor = '#444' }}
                      />
                      <motion.button
                        onClick={handleManualCodeSubmit}
                        disabled={!manualCode.trim()}
                        style={{
                          borderRadius: 12,
                          background: '#FF5757',
                          padding: '10px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: !manualCode.trim() ? 0.5 : 1,
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Cerca
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {preview && !result && (
                  <motion.div
                    style={{
                      borderRadius: 14,
                      background: '#2a2a2a',
                      padding: 16,
                      marginBottom: 20,
                      border: '1px solid #333',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
                      {preview.discount?.restaurant?.name}
                    </p>
                    <p style={{ color: '#FF5757', fontWeight: 700, marginTop: 4, marginBottom: 0, fontSize: 16 }}>
                      {preview.discount?.discount_value}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 0 }}>
                      {preview.discount?.title}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6, marginBottom: 0 }}>
                      Cliente: {preview.user?.full_name || 'Utente'}
                    </p>
                    {preview.status === 'redeemed' && (
                      <p style={{ fontSize: 12, color: '#FF5757', fontWeight: 600, marginTop: 6, marginBottom: 0 }}>
                        Questo QR è già stato utilizzato
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Result */}
                {result && <VerifyResult result={result} />}

                {/* Validate button -- hidden if QR already redeemed */}
                {!result && preview && !(preview?.status === 'redeemed') && (
                  <motion.button
                    onClick={handleVerify}
                    disabled={verifying || !code}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      background: '#FF5757',
                      padding: '14px 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: verifying || !code ? 0.5 : 1,
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {verifying ? 'Verifica in corso...' : 'Valida sconto'}
                  </motion.button>
                )}

                {/* "Ready for next client" button after successful validation */}
                {result && result.valid && (
                  <motion.button
                    onClick={() => { setResult(null); setPreview(null); setManualCode('') }}
                    style={{
                      marginTop: 16,
                      width: '100%',
                      borderRadius: 12,
                      background: '#FF5757',
                      padding: '14px 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Pronto per il prossimo cliente
                  </motion.button>
                )}

                {/* Reset after error result */}
                {result && !result.valid && (
                  <motion.button
                    onClick={() => { setResult(null); setPreview(null); setManualCode('') }}
                    style={{
                      marginTop: 16,
                      width: '100%',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.5)',
                      textDecoration: 'underline',
                      textAlign: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Verifica un altro codice
                  </motion.button>
                )}
              </div>

              <button
                onClick={() => { setShowVerify(false); setResult(null); setPreview(null); setManualCode('') }}
                style={{
                  marginTop: 16,
                  width: '100%',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Torna alla dashboard
              </button>
            </motion.div>

          ) : (
            /* -- Restaurant Dashboard -- */
            <motion.div
              key="dashboard"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <motion.button
                  onClick={() => setShowVerify(true)}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    background: '#FF5757',
                    padding: '12px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Valida codice
                </motion.button>
                <button
                  onClick={handleLogout}
                  style={{
                    borderRadius: 12,
                    background: '#2a2a2a',
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.5)',
                    border: '1px solid #333',
                    cursor: 'pointer',
                  }}
                >
                  Esci
                </button>
              </div>

              <DashboardView pin={pin} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
          Powered by La Guida di Bi
        </Link>
      </div>
    </div>
  )
}
