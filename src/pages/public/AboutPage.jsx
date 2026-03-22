import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.8a8.25 8.25 0 0 0 4.76 1.5V6.86a4.84 4.84 0 0 1-1-.17z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg">
      {/* Back button - fixed */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-50 glass flex h-10 w-10 items-center justify-center rounded-full shadow-md text-gray-700 hover:text-accent transition-colors"
        aria-label="Torna alla home"
      >
        <BackIcon />
      </motion.button>

      {/* Hero section */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        {/* Decorative background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #FF5757 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col items-center"
        >
          {/* Photo placeholder */}
          <motion.div
            variants={fadeUp}
            className="mb-8 relative"
          >
            <div
              className="w-36 h-36 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center shadow-lg"
              style={{
                border: '3px solid rgba(232, 93, 58, 0.2)',
              }}
            >
              <span className="text-5xl select-none">Bi</span>
            </div>
            {/* Decorative ring */}
            <div
              className="absolute -inset-3 rounded-full"
              style={{
                border: '1px dashed rgba(232, 93, 58, 0.2)',
              }}
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold text-primary mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Chiamami
            <span className="text-accent">Bi</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-secondary font-medium italic max-w-sm"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            "I posti che amo davvero"
          </motion.p>
        </motion.div>
      </section>

      {/* Story section */}
      <section className="px-6 py-12 max-w-2xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="flex flex-col gap-6"
        >
          <motion.h2
            variants={fadeUp}
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            La mia storia
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-base leading-relaxed text-secondary"
          >
            Torino è una città che si scopre a tavola. Dietro ogni portone del centro,
            nelle vie strette del Quadrilatero, tra i palazzi liberty di San Salvario,
            si nascondono trattorie, osterie e ristoranti che raccontano storie di
            passione e tradizione.
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="text-base leading-relaxed text-secondary"
          >
            Ho iniziato a esplorare la scena gastronomica torinese per pura curiosità,
            provando un posto nuovo ogni settimana. Dalle piole storiche dove il vino
            si beve sfuso ai ramen bar più autentici, dalla pizza napoletana verace
            al fine dining stellato — ho assaggiato tutto quello che questa città ha da offrire.
          </motion.p>

          <motion.p
            variants={fadeUp}
            className="text-base leading-relaxed text-secondary"
          >
            Gli amici hanno iniziato a chiedermi: "Dove mangiamo stasera?" E così è
            nata l'idea di ChiamamiBi: una guida personale, sincera, fatta di posti
            che ho provato davvero e dove tornerei ad occhi chiusi.
          </motion.p>
        </motion.div>
      </section>

      {/* Philosophy section */}
      <section className="px-6 py-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-2xl mx-auto"
        >
          <motion.div
            variants={fadeUp}
            className="rounded-3xl bg-gradient-to-br from-accent/5 to-accent/10 p-8 sm:p-10 relative overflow-hidden"
          >
            {/* Decorative quote mark */}
            <div
              className="absolute top-4 right-6 text-accent/10 select-none pointer-events-none"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '120px',
                lineHeight: 1,
              }}
            >
              &ldquo;
            </div>

            <h2
              className="text-2xl font-bold text-primary mb-4 relative z-10"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              La mia filosofia
            </h2>

            <p
              className="text-xl sm:text-2xl font-semibold text-accent leading-snug relative z-10"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Consiglio solo posti dove tornerei
            </p>

            <p className="mt-4 text-base text-secondary leading-relaxed relative z-10">
              Ogni ristorante su ChiamamiBi è un posto dove sono stata almeno due volte.
              Niente collaborazioni a pagamento, niente recensioni di cortesia. Solo
              consigli genuini, come quelli che daresti alla tua migliore amica.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Social links section */}
      <section className="px-6 py-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.h2
            variants={fadeUp}
            className="text-2xl font-bold text-primary mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Seguimi
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-base text-secondary mb-8"
          >
            Nuove scoperte ogni settimana
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center gap-4"
          >
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white shadow-sm border border-gray-100 text-gray-700 hover:text-accent hover:border-accent/20 transition-colors"
            >
              <InstagramIcon />
              <span className="text-sm font-semibold">Instagram</span>
            </a>

            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white shadow-sm border border-gray-100 text-gray-700 hover:text-accent hover:border-accent/20 transition-colors"
            >
              <TikTokIcon />
              <span className="text-sm font-semibold">TikTok</span>
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* Contact / Suggest section */}
      <section className="px-6 pt-12 pb-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="max-w-2xl mx-auto"
        >
          <motion.div
            variants={fadeUp}
            className="rounded-3xl bg-white shadow-sm border border-gray-100 p-8 sm:p-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <MailIcon />
              </span>
              <h2
                className="text-2xl font-bold text-primary"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Suggerisci un posto
              </h2>
            </div>

            <motion.p
              variants={fadeUp}
              className="text-base text-secondary mb-6"
            >
              Conosci un ristorante che dovrei provare? Scrivimi!
            </motion.p>

            <motion.form
              variants={fadeUp}
              className="flex flex-col gap-4"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="text"
                placeholder="Il tuo nome"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-primary placeholder:text-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />

              <input
                type="text"
                placeholder="Nome del ristorante"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-primary placeholder:text-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />

              <textarea
                placeholder="Perché lo consigli?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-primary placeholder:text-gray-400 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
              />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-sm shadow-sm hover:bg-accent/90 transition-colors"
              >
                Invia suggerimento
              </motion.button>
            </motion.form>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
