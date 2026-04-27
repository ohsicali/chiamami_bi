# HANDOFF PR20 — Chiedi a Bi v1

**Status:** Ready for implementation
**Scope:** Chirurgico. Non toccare header/nav/tab bar esistenti. Solo aggiungere `/chiedi`.
**Stack:** React + Vite + Vercel + Supabase + Anthropic API
**Modello AI:** `claude-haiku-4-5-20251001`
**Costo runtime stimato:** ~€0.001/query (sostenibile, no Google API extra)
**Mockup di riferimento (HTML):**
- `docs/mockups/v4-mobile-search-redesign.html`
- `docs/mockups/v4-desktop-search-redesign.html`

---

## 0. Regola d'oro: scope chirurgico

Il sito live è in produzione e funziona bene. **NON modificare**:
- Header globale (qualunque sia)
- Tab bar mobile liquid glass
- Nav floating desktop
- City picker se esiste
- Wordmark, logo, branding generale
- Componenti home, esplora, sconti, salvati, profilo

**Modifica solo**:
1. Crea la nuova route `/chiedi` con la pagina chat
2. Cambia la destinazione della lente esistente: prima era `/list` (o equivalente browse), ora deve aprire `/chiedi`
3. Crea i 2 nuovi componenti React (vedi sezione 4)

---

## 1. Backend — già pronto (riusa)

**Endpoint:** `/api/ai-search.js` (creato in PR17)
- Già configurato per Anthropic Claude Haiku
- Già fa function calling con tool `search_restaurants`
- Già scrive su `ai_conversations` + `ai_messages`
- RLS Supabase già configurate

**Tabelle:** `ai_conversations` (id, user_id, created_at), `ai_messages` (id, conversation_id, role, content, tool_calls, created_at)

**Niente nuovi endpoint, niente nuove tabelle.** Vincolo Vercel Hobby cap 12 funzioni rispettato.

### 1.1 Function calling tool — modifica minimale

Nel system prompt di `/api/ai-search.js`, assicurati che il tool `search_restaurants` accetti questi parametri (estendi se mancano):

```js
{
  name: "search_restaurants",
  description: "Cerca tra i ristoranti validati da Bi. Usa quando l'utente chiede di andare in un posto.",
  input_schema: {
    type: "object",
    properties: {
      cucina: { type: "array", items: { type: "string" }, description: "es. ['giapponese','sushi']" },
      zona: { type: "array", items: { type: "string" }, description: "es. ['Vanchiglia','San Salvario']" },
      momento: { type: "string", enum: ["aperitivo","pranzo","cena","brunch","cocktail"] },
      aperto_adesso: { type: "boolean" },
      sconto_attivo: { type: "boolean" },
      search_text: { type: "string", description: "ricerca full-text in secondoBi + bi_consiglia (es. piatto specifico come 'lingua' o 'agnolotti')" },
      limit: { type: "number", default: 3 }
    }
  }
}
```

### 1.2 Query Supabase per il tool

Quando l'AI chiama `search_restaurants` con `search_text`, esegui in Supabase:

```sql
SELECT id, nome, cucina, zona, immagine_principale, sconto_percentuale, secondoBi, bi_consiglia, place_id
FROM ristoranti
WHERE 
  (cucina && $cucina OR $cucina IS NULL)
  AND (zona = ANY($zona) OR $zona IS NULL)
  AND (sconto_percentuale IS NOT NULL OR $sconto_attivo = false OR $sconto_attivo IS NULL)
  AND (
    $search_text IS NULL 
    OR to_tsvector('italian', coalesce(secondoBi,'') || ' ' || coalesce(bi_consiglia,''))
       @@ plainto_tsquery('italian', $search_text)
  )
ORDER BY 
  CASE WHEN $search_text IS NOT NULL THEN
    ts_rank(to_tsvector('italian', coalesce(secondoBi,'') || ' ' || coalesce(bi_consiglia,'')), 
            plainto_tsquery('italian', $search_text))
  ELSE 0 END DESC
LIMIT $limit;
```

> **Nota DB**: se non esiste già un GIN index sui due campi testuali, crearlo:
> ```sql
> CREATE INDEX IF NOT EXISTS idx_ristoranti_fts 
> ON ristoranti USING gin(to_tsvector('italian', coalesce(secondoBi,'') || ' ' || coalesce(bi_consiglia,'')));
> ```

Il check "aperto_adesso" usa la logica orari Google Places già live (PR11).

---

## 2. System prompt Bi — copy book

In `/api/ai-search.js`, sostituisci il system prompt con questo:

```
Sei Bi, la voce della guida ChiamamiBi.com. Tu (la prima persona) hai selezionato a Torino circa 200 ristoranti, bar e bistrot. Sono tutti validati da te. Quando un utente ti chiede dove andare, gli rispondi con il tuo tono: diretto, caldo, asciutto, mai formale.

REGOLE FERREE:
1. Consigli SOLO ristoranti che esistono nel database (chiamando il tool search_restaurants). Mai inventare nomi.
2. Mai usare "il migliore" o classifiche con stelle/rating. La promessa è "io ti seleziono", non "io ti classifico".
3. Mai chiedere recensioni, mai mostrare valutazioni utenti.
4. Quando il tool restituisce 0 risultati, NON dire "nessun risultato". Riconosci il limite + proponi alternativa onesta.
5. Massimo 3 ristoranti per risposta generica, 1 per richiesta specifica. Niente liste lunghe.
6. Voce: prima persona ("ho", "ti dico", "vai", "te lo metto in mano"). Niente "Ecco i risultati che ho trovato".
7. Se l'utente chiede di una città diversa da Torino, cerca lo stesso (Bi non chiede dove sei). Se non hai locali in quella città, dillo onestamente.

PATTERN DI RISPOSTA — esempi few-shot:

[Esempio 1 — happy path]
User: "Aperitivo a Vanchiglia"
Bi: "Allora a Vanchiglia ci sei nel posto giusto. Te ne dico tre che mi piacciono per l'aperitivo. Vai sul sicuro:"
[poi tool_use search_restaurants(zona=['Vanchiglia'], momento='aperitivo')]

[Esempio 2 — graceful degradation]
User: "Cinese a Vanchiglia"
Bi: [tool_use → 0 risultati]
"A Vanchiglia di cinese non ne ho, te lo dico subito. È un quartiere più da italiano e da bistrot. Però a 5 minuti di tram hai Mo Sarpi — cinese vero, di quelli buoni. Ti va se ti propongo lì?"
[poi search_restaurants(cucina=['cinese'], zona=['Aurora','Mo Sarpi'])]

[Esempio 3 — piatto specifico]
User: "Locali che fanno gli agnolotti del plin"
Bi: "Gli agnolotti li hanno parecchi, te ne dico due dove la pasta fresca la fanno bene:"
[search_restaurants(search_text='agnolotti del plin')]
"Da X li chiudono uno per uno a mano — il Bi consiglia ne parla. Da Y sono al sugo d'arrosto alla vecchia maniera."

[Esempio 4 — query ambigua]
User: "Voglio mangiare bene"
Bi: "Aiutami: hai voglia di qualcosa in particolare? Pesce, pizza, asiatico? E in che zona ti muovi?"

[Esempio 5 — fuori scope]
User: "Quanto costa la cena da X?"
Bi: "Sui prezzi al coperto vado a memoria, non ho dati precisi. Te lo lascio chiedere a loro — ti passo il numero?"

[Esempio 6 — "il migliore"]
User: "Il miglior pesce di Torino?"
Bi: "Non te lo classifico in 'migliori', non è il mio mestiere. Però tra i miei locali per pesce ti dico tre nomi. Da X la freschezza è quotidiana, dal Bi consiglia ne parlo."

VINCOLI TECNICI:
- Risposte brevi: 2-4 frasi prima del tool, 1-2 dopo per commentare i risultati
- Formato risposta: testo + tool_use → testo finale
- Niente bullet point, niente numerazioni nelle risposte
- Niente emoji eccetto in casi rari (☕ ✦ ★)

ANTI-PATTERN da evitare:
- "Posso aiutarti a trovare..." → diretto, vai
- "Sicuramente troverai..." → niente certezze inventate
- Liste con bullet → frasi piene
- "Ecco i risultati" → mai, sembra una macchina
```

---

## 3. Routing — modifica chirurgica

### 3.1 React Router setup

In `App.jsx` (o equivalente router config), aggiungi:

```jsx
import ChiediPage from './pages/ChiediPage';

// nelle Routes
<Route path="/chiedi" element={<ChiediPage />} />
<Route path="/chiedi/:conversationId" element={<ChiediPage />} />
```

### 3.2 Re-routing della lente esistente

Nel componente che gestisce la lente (probabilmente in `MobileTabBar` per mobile e `DesktopFloatingNav` o simile per desktop), trova il link/handler della lente:

**PRIMA (attuale):**
```jsx
<Link to="/list">  // o navigate('/list')
  <SearchIcon />
</Link>
```

**DOPO:**
```jsx
<Link to="/chiedi">  // o navigate('/chiedi')
  <SearchIcon />
</Link>
```

**Niente cambi visivi.** L'icona resta uguale, la posizione resta uguale, solo la destinazione cambia.

### 3.3 Cosa fare di `/list`?

**Decisione 27/04 — Augusto**: `/list` NON esiste come route separata. La lista filtrata dei locali è già dentro `/esplora` (che ha mappa + lista). Niente da redirectare. La lente cambia solo destinazione → `/chiedi`.

### 3.4 Continuità con la Home — input "Chiedi a Bi" già presente

La Home ha già un input "Chiedi a Bi" (PR home redesign del 24/04). Quando l'utente scrive lì e preme invio, deve aprirsi `/chiedi` e la conversazione partire da lì col messaggio già inviato.

**Pattern d'implementazione:**

Nel componente Home, all'handler del submit dell'input "Chiedi a Bi":

```jsx
function HomeChiediInput() {
  const [text, setText] = useState('');
  const navigate = useNavigate();
  
  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    navigate('/chiedi', { state: { initialMessage: text } });
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Chiedi a Bi… ad esempio 'aperitivo a Vanchiglia'" />
      <button type="submit">→</button>
    </form>
  );
}
```

In `ChiediPage.jsx`, al mount:

```jsx
import { useLocation } from 'react-router-dom';

const location = useLocation();
const initialMessage = location.state?.initialMessage;

useEffect(() => {
  if (initialMessage) {
    sendMessage(initialMessage);
    // pulisci lo state per evitare re-send su refresh
    window.history.replaceState({}, document.title);
  }
}, []);
```

Risultato: Home → utente scrive "ramen Vanchiglia" + invio → naviga a /chiedi → la chat parte automaticamente con quel messaggio inviato come prima domanda.

---

## 4. Componente React — pagina /chiedi

Crea `src/pages/ChiediPage.jsx`. Layout responsive con CSS, una sola pagina mobile+desktop. Vedi mockup HTML per markup esatto.

### 4.1 Struttura componente

```jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './ChiediPage.css';

export default function ChiediPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);  // {role, content, tool_results?}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState(conversationId || null);
  const messagesEndRef = useRef(null);
  
  // Empty state: 6 prompt cards (vedi mockup per copy)
  const promptSuggestions = [
    { icon: '🥂', title: 'Aperitivo a Vanchiglia', sub: 'cocktail bar, locali con tagliere', query: 'Aperitivo a Vanchiglia' },
    { icon: '🍣', title: 'Giapponese aperto stasera', sub: 'solo locali con orario verificato', query: 'Giapponese aperto stasera' },
    { icon: '🍕', title: 'Pizza in centro la domenica', sub: 'quartiere + giorno + cucina', query: 'Pizza in centro la domenica' },
    { icon: '🐟', title: 'Pesce a San Salvario', sub: 'cucina + zona', query: 'Pesce a San Salvario' },
    { icon: '🥟', title: 'Locali che fanno gli agnolotti', sub: 'piatto specifico', query: 'Locali che fanno gli agnolotti del plin' },
    { icon: '🏷️', title: 'Sconti attivi stasera vicino a me', sub: 'chi ha sconto + è aperto adesso', query: 'Sconti attivi stasera' }
  ];
  
  // Load existing conversation
  useEffect(() => {
    if (conversationId) loadConversation(conversationId);
  }, [conversationId]);
  
  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);
  
  async function loadConversation(id) { /* fetch da Supabase ai_messages */ }
  
  async function sendMessage(text) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: convId })
      });
      const data = await res.json();
      
      if (!convId && data.conversationId) {
        setConvId(data.conversationId);
        navigate(`/chiedi/${data.conversationId}`, { replace: true });
      }
      
      setMessages(m => [...m, { 
        role: 'assistant', 
        content: data.response, 
        results: data.toolResults?.restaurants || [] 
      }]);
    } catch (e) {
      setMessages(m => [...m, { 
        role: 'assistant', 
        content: 'Mmh, qualcosa non gira. Riprova tra un secondo?', 
        error: true 
      }]);
    } finally {
      setLoading(false);
    }
  }
  
  const isEmpty = messages.length === 0;
  
  return (
    <div className="chiedi-page">
      <ChiediHeader />
      
      <div className="chiedi-body">
        {isEmpty ? (
          <EmptyState prompts={promptSuggestions} onPromptClick={sendMessage} />
        ) : (
          <Conversation messages={messages} loading={loading} onFollowup={sendMessage} />
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <InputBar 
        value={input} 
        onChange={setInput} 
        onSubmit={() => sendMessage(input)} 
        disabled={loading}
      />
    </div>
  );
}
```

### 4.2 Componenti interni (vedi mockup HTML per markup completo)

- `<ChiediHeader>`: avatar B + "Chiedi a Bi" + status "in linea" + icona cronologia (placeholder, click no-op in PR20)
- `<EmptyState>`: hero con avatar 100/120px + titolo Alfa Slab + sub Caveat + **blocco didattico "Cosa è Bi"** (NUOVO, vedi §4.4) + 6 prompt cards + tip arancione
- `<Conversation>`: bubble user/Bi + result-cards + follow-up chips + typing indicator (con streaming token-by-token, vedi §4.5)
- `<InputBar>`: textarea autosize + bottone send corallo
- `<AuthGate>`: modal di blocco quando anonimo prova a inviare (vedi §8.2)

### 4.4 Blocco didattico nell'empty state (NUOVO 27/04)

Sopra le 6 prompt cards, aggiungi un blocco esplicativo che spiega cosa è Bi e cosa risponde. Linee guida didattiche per l'utente. Stile: card morbida con bordo dashed o sfondo `--oro-soft`, NON un tooltip popup.

```jsx
<div className="bi-explainer">
  <div className="explainer-row">
    <div className="ic ic-yes">✓</div>
    <div>
      <strong>Cosa posso dirti</strong>
      <p>
        Ti consiglio dove andare tra i locali che ho selezionato io a Torino.
        Cucina, zona, momento della giornata, piatti specifici, sconti attivi, 
        chi è aperto adesso. Sono ~200 ristoranti, tutti validati da me.
      </p>
    </div>
  </div>
  <div className="explainer-row">
    <div className="ic ic-no">~</div>
    <div>
      <strong>Cosa non so</strong>
      <p>
        Prezzi precisi, recensioni utenti, disponibilità di un tavolo stasera, 
        menu in tempo reale. Per quelle cose, ti passo il numero del locale.
      </p>
    </div>
  </div>
</div>
```

CSS:
```css
.bi-explainer {
  background: var(--oro-soft);
  border: 1px dashed var(--oro);
  border-radius: 14px;
  padding: 16px;
  margin: 24px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.explainer-row { display: flex; gap: 12px; }
.explainer-row .ic {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; font-weight: 700;
  font-size: 13px;
}
.ic-yes { background: #3FB955; color: #fff; }
.ic-no { background: var(--oro); color: #fff; }
.explainer-row strong { font-size: 14px; color: var(--ink); display: block; margin-bottom: 4px; }
.explainer-row p { font-size: 13px; color: var(--ink-2); line-height: 1.5; }
```

**Visibilità**: solo nell'empty state (prima della prima domanda). Una volta che la conversazione inizia, scompare.

### 4.5 Streaming token-by-token (NUOVO 27/04)

Anthropic SDK supporta streaming nativo. In `/api/ai-search.js`:

```js
const stream = await anthropic.messages.stream({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  messages: conversationHistory,
  tools: [SEARCH_RESTAURANTS_TOOL]
});

// Server-Sent Events response
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
  } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
    res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: event.content_block.name })}\n\n`);
  }
  // ... gestisci tool_use completion + risultati
}
res.write('data: [DONE]\n\n');
res.end();
```

Frontend in `ChiediPage.jsx`:

```jsx
async function sendMessage(text) {
  // ... auth check ...
  setMessages(m => [...m, { role: 'user', content: text }]);
  setMessages(m => [...m, { role: 'assistant', content: '', streaming: true }]);
  
  const eventSource = new EventSource('/api/ai-search?...');
  eventSource.onmessage = (e) => {
    if (e.data === '[DONE]') {
      eventSource.close();
      return;
    }
    const event = JSON.parse(e.data);
    if (event.type === 'text') {
      setMessages(m => {
        const last = m[m.length - 1];
        return [...m.slice(0, -1), { ...last, content: last.content + event.text }];
      });
    }
    if (event.type === 'results') {
      setMessages(m => {
        const last = m[m.length - 1];
        return [...m.slice(0, -1), { ...last, results: event.restaurants, streaming: false }];
      });
    }
  };
}
```

Visualizzazione: il bubble Bi cresce in tempo reale, il cursor lampeggiante (`▋`) appare alla fine del testo finché `streaming: true`.

### 4.3 Result card — riusa il pattern mini-card del live

```jsx
function ResultCard({ restaurant }) {
  return (
    <Link to={`/r/${restaurant.slug}`} className="r-card">
      <div className="ph"><img src={restaurant.immagine_principale} alt="" /></div>
      <div className="info">
        <h4>
          {restaurant.nome}
          {restaurant.sconto_percentuale && (
            <span className="badge-mini">−{restaurant.sconto_percentuale}%</span>
          )}
        </h4>
        <div className="meta">
          {restaurant.cucina} · {restaurant.zona} · {restaurant.orario_oggi}
        </div>
        {restaurant.bi_consiglia && (
          <div className="why">"{restaurant.bi_consiglia_short}"</div>
        )}
      </div>
    </Link>
  );
}
```

`bi_consiglia_short` = primo elemento del campo `bi_consiglia` o prima frase, troncato a ~60 char. Il "why" deve essere in font Caveat corallo (vedi tokens v4).

---

## 5. Design tokens da rispettare

Già nel `tokens.css` v4 esistente:
- `--corallo: #E8453C` / `--corallo-ink: #B92E26`
- `--ink: #22181C` / `--ink-2: #5C4F54` / `--ink-3: #9A8E94`
- `--page: #FAF7F2` / `--paper: #FFFFFF`
- `--line: #EFE7DD`
- `--ff-ui: 'Poppins'`
- `--ff-mark: 'Alfa Slab One'` (avatar B, titolone hero)
- `--ff-hand: 'Caveat'` (sub hero, "perché te lo dico" nel result-card)

---

## 6. Animations

```css
/* Avatar iconic — sparkle pulsante */
@keyframes tw {
  0%, 100% { transform: scale(1); opacity: 1 }
  50% { transform: scale(1.15); opacity: .7 }
}
.av-iconic .sp { animation: tw 2.4s infinite }

/* Avatar iconic — ring rotation */
@keyframes rot { to { transform: rotate(360deg) } }
.av-iconic .ring { animation: rot 30s linear infinite }

/* Bubble fade-in al new message */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px) }
  to { opacity: 1; transform: translateY(0) }
}
.bubble { animation: fadeIn .3s ease both }

/* Typing dots */
@keyframes pulse {
  0%, 80%, 100% { transform: scale(.5); opacity: .4 }
  40% { transform: scale(1); opacity: 1 }
}
.typing .dot { animation: pulse 1.2s infinite }
.typing .dot:nth-child(2) { animation-delay: .15s }
.typing .dot:nth-child(3) { animation-delay: .3s }
```

---

## 7. URL params & condivisione

- `/chiedi` → nuova chat (empty state)
- `/chiedi/:conversationId` → chat esistente, condivisibile
- Quando l'utente manda il primo messaggio, l'API restituisce conversationId e si fa `navigate('/chiedi/[id]', { replace: true })`
- Cronologia chat futura accessibile da pulsante in header (link a `/chiedi/cronologia` o lista in modal — fuori scope PR20, placeholder OK)

---

## 8. RLS Supabase + auth gating

### 8.1 Policy

Le policy `ai_conversations` e `ai_messages` devono permettere all'utente loggato di leggere/scrivere SOLO le proprie conversazioni. Già configurato in PR17, ma verifica:

```sql
CREATE POLICY "users read own conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stesso per ai_messages via JOIN su conversation_id
```

### 8.2 Gating login — DECISIONE 27/04

**Login obbligatorio per chattare con Bi.** Utenti anonimi possono visitare `/chiedi` (vedono empty state, leggono cosa è Bi, possono cliccare i prompt suggeriti per "anteprima"), ma al primo tentativo di invio messaggio appare un modale/banner di blocco.

**Implementazione lato frontend** in `ChiediPage.jsx`:

```jsx
import { useAuth } from '../lib/auth';

const { user } = useAuth();

async function sendMessage(text) {
  if (!text.trim()) return;
  
  // Auth gate
  if (!user) {
    setShowAuthGate(true);
    setPendingMessage(text);  // memorizza per ri-inviare dopo login
    return;
  }
  
  // ... resto invariato
}
```

**Componente AuthGate** (modal che blocca):

```jsx
function AuthGate({ pendingMessage, onClose }) {
  return (
    <div className="auth-gate-modal">
      <div className="auth-gate-content">
        <div className="av-iconic">B<span className="sp">✦</span></div>
        <h3>Accedi per chattare con me</h3>
        <p>
          Per ricordarmi le tue domande e darti consigli più precisi nel tempo, 
          ho bisogno che tu acceda. Ci metti 30 secondi.
        </p>
        <Link 
          to="/login" 
          state={{ returnTo: '/chiedi', pendingMessage }}
          className="btn-primary"
        >
          Accedi
        </Link>
        <Link 
          to="/registrati" 
          state={{ returnTo: '/chiedi', pendingMessage }}
          className="btn-secondary"
        >
          Registrati gratis
        </Link>
        <button onClick={onClose} className="btn-link">Annulla</button>
      </div>
    </div>
  );
}
```

**Login/Register flow** deve gestire `state.returnTo + state.pendingMessage`: dopo login success, redirect a `returnTo` con `state: { initialMessage: pendingMessage }`. ChiediPage al mount lo invia automaticamente (stesso meccanismo già usato per Home → ChiediPage).

### 8.3 Backend — anche `/api/ai-search` deve auth gate

In `/api/ai-search.js`, all'inizio:

```js
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) {
  return res.status(401).json({ error: 'auth_required', message: 'Accedi per chattare con Bi' });
}
```

Frontend gestisce 401 mostrando AuthGate.

---

## 9. Accessibility

- `<textarea aria-label="Scrivi a Bi">`
- Bottoni icona con `aria-label` ("Invia", "Nuova chat", "Indietro")
- Tab order: prompt cards → input → send button
- Enter sull'input invia (Shift+Enter per nuova riga)
- Focus ring visibile su tutti gli elementi interattivi (già nei tokens v4)
- `prefers-reduced-motion` → disabilita ring rotation e sparkle pulse

---

## 10. Test plan

### 10.1 Smoke
- [ ] `/chiedi` apre l'empty state, hero visibile, 6 prompt cliccabili
- [ ] Click su prompt manda il messaggio, appare bubble user, "Bi sta scrivendo", risposta + result cards
- [ ] Click su result card naviga a `/r/[slug]` (scheda ristorante esistente)
- [ ] Lente nel tab bar mobile → porta a `/chiedi` (non più a /list)
- [ ] Lente nella nav desktop → porta a `/chiedi` (non più a /list)
- [ ] URL diventa `/chiedi/[id]` dopo il primo messaggio
- [ ] Refresh della pagina con `/chiedi/[id]` ricarica la conversazione

### 10.2 Edge cases
- [ ] Tool restituisce 0 risultati → Bi propone alternativa onesta (non "nessun risultato")
- [ ] User chiede "miglior X" → Bi rifiuta la classifica, propone selezione
- [ ] User chiede di una città fuori Torino → Bi cerca lo stesso, dice se non ha
- [ ] User scrive query molto vaga ("voglio mangiare") → Bi chiede chiarimento
- [ ] Errore 500 dall'API → bubble di fallback "qualcosa non gira"
- [ ] Anonymous user (no auth) → la chat funziona, conversazione persistita per sessione
- [ ] Lunga conversazione (10+ messaggi) → scroll funziona, last message sempre visibile

### 10.3 Performance
- [ ] First response < 3s (tool call + Haiku)
- [ ] Streaming opzionale (se possibile, mostra il testo Bi token by token)
- [ ] Result card images con lazy loading
- [ ] No layout shift quando arriva la risposta

### 10.4 Mobile
- [ ] Input bar fissa in fondo, sopra il tab bar
- [ ] Tastiera mobile non copre l'input (`scroll-padding-bottom`)
- [ ] Bubble user a destra, Bi a sinistra
- [ ] Result card 96px image + body, come live

### 10.5 Desktop
- [ ] Pagina centrata max-width 760px
- [ ] Empty state hero centrato
- [ ] Result card in griglia 3 colonne con foto top
- [ ] Input bar centrata, larghezza 760px

---

## 11. Out of scope per PR20

**OUT (non da fare in PR20):**
- UI cronologia con lista conversazioni precedenti (icona placeholder OK, click no-op)
- Multi-lingua (solo IT)
- Voice input
- Multi-modal (no immagini upload)
- Modifica messaggi inviati
- Reazioni alle risposte di Bi
- Integrazione con Google Places live (NO, solo dati DB)
- Scraping siti ristoranti (NO)
- Campo `piatti_signature` nuovo nel CMS (NO, già coperto da `bi_consiglia`)
- Drop city picker dall'header (NO, scope chirurgico — il sito non si tocca)
- Restyling nav floating desktop (NO, resta com'è)
- Restyling tab bar mobile (NO, resta com'è)

**IN scope (da fare in PR20):**
- Streaming token-by-token (decisione Augusto 27/04 — Bi scrive lettera per lettera)
- Auth gate con modal "fai login per chattare"
- Continuità Home → /chiedi via `state.initialMessage`
- Persistenza messaggi per-user (cronologia c'è nei dati anche se UI placeholder)
- Blocco didattico esplicativo nell'empty state (cosa è Bi + cosa puoi chiedere + cosa non risponde)

---

## 12. Definizione di "done"

PR20 è done quando:
1. ✅ Route `/chiedi` esiste e renderizza empty state correttamente
2. ✅ Lente esistente (mobile tab bar + desktop nav) punta a `/chiedi`
3. ✅ User può mandare messaggi, ricevere risposte streaming/non-streaming
4. ✅ Result cards cliccabili → scheda ristorante
5. ✅ Conversazioni persistite in `ai_conversations`/`ai_messages`
6. ✅ `/chiedi/[id]` ricarica conversazione esistente
7. ✅ Smoke test della sezione 10.1 verde
8. ✅ Edge case 10.2: graceful degradation funziona ("a Vanchiglia non ho cinese, ma…")
9. ✅ Mobile + desktop layout testati su iPhone SE, iPhone 15, iPad, MacBook 13"
10. ✅ Live in prod su `chiamamibi.com/chiedi` senza errori sentry/console

---

## 13. Domande Augusto — TUTTE RISOLTE 27/04

1. ~~/list rimane o redirect~~ → **non esiste come route separata, è dentro /esplora. Niente da fare.**
2. ~~Anonymous user~~ → **login obbligatorio. AuthGate modal al primo invio (vedi §8.2).**
3. ~~Cronologia~~ → **UI placeholder, dati persistiti per-user da subito.**
4. ~~Streaming~~ → **SÌ, token-by-token (vedi §4.5).**
5. ~~Tooltip onboarding~~ → **NO tooltip, blocco didattico inline nell'empty state (vedi §4.4).**
6. **NUOVO: continuità Home → /chiedi** → input "Chiedi a Bi" della Home naviga a /chiedi con state.initialMessage (vedi §3.4).

---

## 14. Risorse

- Mockup HTML mobile: `docs/mockups/v4-mobile-search-redesign.html`
- Mockup HTML desktop: `docs/mockups/v4-desktop-search-redesign.html`
- Memoria architettura: `project_pr20_chiedi_a_bi.md` (auto-memory)
- Memoria voce/tono: `feedback_no_reviews.md`, `feedback_bi_voice_naming.md`
- API esistente: `api/ai-search.js`
- Supabase: tabelle `ai_conversations`, `ai_messages`
