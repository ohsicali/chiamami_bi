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
    <div className="flex gap-2 justify-center">
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
          className="w-11 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 bg-white text-primary focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
        />
      ))}
    </div>
  )
}

function VerifyResult({ result }) {
  if (result.valid) {
    return (
      <motion.div
        className="flex flex-col items-center gap-4 p-6 rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <motion.div
          className="text-6xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 400 }}
        >
          ✅
        </motion.div>
        <h2 className="text-xl font-bold text-green-800">Sconto validato!</h2>
        <div className="text-center">
          <p className="text-sm text-green-700">
            <strong>{result.discount_value}</strong> — {result.discount_title}
          </p>
          <p className="text-sm text-green-600 mt-1">
            Cliente: {result.user_name}
          </p>
          <p className="text-sm text-green-600">
            Ristorante: {result.restaurant_name}
          </p>
        </div>
      </motion.div>
    )
  }

  const bgMap = {
    already_redeemed: 'linear-gradient(135deg, #fef2f2, #fecaca)',
    expired: 'linear-gradient(135deg, #fef2f2, #fecaca)',
    not_found: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
    invalid_pin: 'linear-gradient(135deg, #fffbeb, #fde68a)',
  }

  const emojiMap = {
    already_redeemed: '❌',
    expired: '⏰',
    not_found: '❓',
    invalid_pin: '⚠️',
  }

  return (
    <motion.div
      className="flex flex-col items-center gap-4 p-6 rounded-2xl"
      style={{ background: bgMap[result.error] || bgMap.not_found }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <span className="text-5xl">{emojiMap[result.error] || '❌'}</span>
      <p className="text-base font-semibold text-primary text-center">{result.message}</p>
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

  if (loading) return <div className="skeleton h-48 rounded-2xl" />
  if (!data) return <p className="text-sm text-secondary text-center">PIN non valido</p>

  const items = tab === 'active' ? data.active : data.used

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            tab === 'active' ? 'bg-accent text-white' : 'bg-gray-100 text-secondary'
          }`}
        >
          Da usare ({data.active.length})
        </button>
        <button
          onClick={() => setTab('used')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            tab === 'used' ? 'bg-accent text-white' : 'bg-gray-100 text-secondary'
          }`}
        >
          Utilizzati ({data.used.length})
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="text-sm text-secondary text-center py-6">
          {tab === 'active' ? 'Nessun QR attivo' : 'Nessuno sconto utilizzato'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(r => (
            <div key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {r.user?.full_name || r.user?.email || 'Utente'}
                  </p>
                  <p className="text-xs text-secondary">
                    {r.discount?.title} — {r.discount?.discount_value}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'generated' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.status === 'generated' ? 'Attivo' : 'Usato'}
                  </span>
                  <p className="text-xs text-secondary mt-0.5">
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
  const pinParam = searchParams.get('pin') || ''

  const [manualCode, setManualCode] = useState('')
  const code = codeFromUrl || manualCode

  const [pin, setPin] = useState(() => {
    // Try localStorage first
    return pinParam || localStorage.getItem('chiamamibi_pin') || ''
  })
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [showDashboard, setShowDashboard] = useState(!codeFromUrl && !!pinParam)

  // Fetch preview when code is present
  useEffect(() => {
    if (code) {
      fetchQRPreview(code).then(setPreview)
    }
  }, [code])

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

      // Save PIN on success
      if (res.valid || res.error === 'already_redeemed') {
        localStorage.setItem('chiamamibi_pin', pin)
      }
    } catch {
      setResult({ valid: false, error: 'not_found', message: 'Errore di connessione' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'linear-gradient(180deg, #FFF0F0 0%, #FAFAF8 40%)' }}
    >
      {/* Logo */}
      <div className="flex justify-center pt-8 pb-4">
        <LogoFull height={36} />
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-4">
        <AnimatePresence mode="wait">
          {showDashboard ? (
            <motion.div
              key="dashboard"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2
                className="text-xl font-bold text-primary text-center mb-6"
                style={{ fontFamily: "'TAN Songbird', serif" }}
              >
                Storico sconti
              </h2>
              <DashboardView pin={pin} />
              <button
                onClick={() => setShowDashboard(false)}
                className="mt-4 w-full text-sm text-secondary text-center underline"
              >
                Torna alla verifica
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="verify"
              className="w-full max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Card */}
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl p-6 shadow-lg border border-white/40">
                <h2
                  className="text-xl font-bold text-primary text-center mb-5"
                  style={{ fontFamily: "'TAN Songbird', serif" }}
                >
                  Validazione Sconto
                </h2>

                {/* Manual code input when no URL code */}
                {!codeFromUrl && !preview && !result && (
                  <div className="mb-5">
                    <p className="text-sm text-secondary text-center mb-3">
                      Inserisci il codice sconto
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Es. BiSc-abc123"
                        className="flex-1 px-3 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm text-primary focus:border-accent focus:outline-none transition-colors"
                      />
                      <motion.button
                        onClick={handleManualCodeSubmit}
                        disabled={!manualCode.trim()}
                        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
                    className="rounded-xl bg-accent-light p-4 mb-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-sm font-semibold text-primary">
                      {preview.discount?.restaurant?.name}
                    </p>
                    <p className="text-accent font-bold mt-0.5">
                      {preview.discount?.discount_value}
                    </p>
                    <p className="text-xs text-secondary mt-0.5">
                      {preview.discount?.title}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      Cliente: {preview.user?.full_name || 'Utente'}
                    </p>
                    {preview.status === 'redeemed' && (
                      <p className="text-xs text-red-500 font-medium mt-1">
                        Questo QR è già stato utilizzato
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Result */}
                {result && <VerifyResult result={result} />}

                {/* PIN input — hidden if QR already redeemed */}
                {!result && !(preview?.status === 'redeemed') && (
                  <>
                    <div className="mb-4">
                      <p className="text-sm text-secondary text-center mb-3">
                        Inserisci il PIN del ristorante
                      </p>
                      <PinInput value={pin} onChange={setPin} disabled={verifying} />
                    </div>

                    <motion.button
                      onClick={handleVerify}
                      disabled={pin.length !== 6 || verifying || !code}
                      className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                      whileTap={{ scale: 0.97 }}
                    >
                      {verifying ? 'Verifica in corso...' : '✓ Valida'}
                    </motion.button>
                  </>
                )}

                {/* Reset after result */}
                {result && (
                  <motion.button
                    onClick={() => setResult(null)}
                    className="mt-4 w-full text-sm text-secondary underline text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Verifica un altro codice
                  </motion.button>
                )}
              </div>

              {/* Dashboard link */}
              {pin.length === 6 && (
                <button
                  onClick={() => setShowDashboard(true)}
                  className="mt-4 w-full text-sm text-secondary text-center underline"
                >
                  Vedi storico sconti
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <Link to="/" className="text-xs text-secondary">
          Powered by <span className="font-semibold text-accent">ChiamamiBi</span>
        </Link>
      </div>
    </div>
  )
}
