import SconteAuthGate from '../Discount/SconteAuthGate'

/**
 * La porta a vetri del cuore: compare quando chi non ha un account prova a
 * salvare un locale.
 *
 * È lo stesso riquadro del gate sugli sconti, con la promessa riscritta per
 * quello che si sta chiedendo davvero — se no si vende il QR a chi voleva
 * solo mettere da parte un posto. Sta in un componente suo, e non copiato
 * in ogni pagina, perché il testo del gate è una promessa: due versioni
 * diverse della stessa promessa sono una promessa in meno.
 *
 * `returnTo` si può omettere: SconteAuthGate torna da dove si è partiti.
 */
export default function SaveAuthGate({ returnTo, onClose }) {
  return (
    <SconteAuthGate
      pendingDiscountId={null}
      returnTo={returnTo}
      title="Serve un account per salvare"
      subtitle={'Gratis · poi ritrovi i tuoi posti in “Salvati”, da qualsiasi telefono.'}
      onClose={onClose}
    />
  )
}
