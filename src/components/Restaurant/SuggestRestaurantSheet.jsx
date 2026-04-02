// Placeholder — full implementation in Step 3
export default function SuggestRestaurantSheet({ userId, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
        borderRadius: '24px 24px 0 0', padding: 24, textAlign: 'center',
      }}>
        <p>Coming soon...</p>
        <button onClick={onClose} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, background: 'var(--color-bg)', border: 'none', cursor: 'pointer' }}>Chiudi</button>
      </div>
    </div>
  )
}
