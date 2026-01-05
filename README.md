# WoT Semaphore & Counter — Template di progetto

**Breve descrizione** ✅

Questo repository è un template per un'applicazione Web of Things (WoT) che implementa due *Things* di esempio: un `CounterThing` e un `SemaphoreThing`. Il progetto è organizzato in TypeScript e predisposto per essere compilato nella cartella `build/` (JS + tipi). Fornisce una semplice runtime (`wotRuntime`) e alcuni modelli TD (Thing Description) in `models/` per mostrare l'architettura di base.

---

## 🔧 Requisiti

- Node.js (>= 16 consigliato)
- npm
- TypeScript (installato come dipendenza di sviluppo nel progetto)

---

## 💡 Installazione e comandi utili

- Installare dipendenze:

```bash
npm install
```

- Compilare (TypeScript -> JavaScript):

```bash
npm run build
```

- Avviare l'app compilata:

```bash
npm start
```

- Modalità sviluppo:

```bash
npm run dev:build      # tsc -w (ricompila automaticamente)
npm run dev:run        # avvia nodemon su build/main con opzioni (usa ./resources/gregnet.jsap)
npm run start:dev      # esegue in parallelo gli script dev
```

- Build + run (singolo comando):

```bash
npm run start:build
```

---

## 🗂️ Struttura del progetto (sommaria)

- `src/` - sorgenti TypeScript
  - `things/` - implementazioni dei Things: `CounterThing.ts`, `SemaphoreThing.ts`, `ThingBase.ts`
  - `utils/` - utilità runtime (`wotRuntime.ts`)
  - `main.ts` - punto d'ingresso

- `models/` - Thing Descriptions (es. `counter.tm.json`, `semaphore.tm.json`)
- `build/` - output compilato (JS + .d.ts)
- `www/` - risorse web statiche (es. `main.js`, `style.css`)
- `package.json`, `tsconfig.json` - configurazione progetto

---

## 📋 Note rapide

- Lo script `dev:run` menziona `./resources/gregnet.jsap` — assicurati che il file sia presente se vuoi usare quella modalità.
- Il template è pensato per essere personalizzato: aggiungi altri Things, TD o binding secondo le tue esigenze.

---

## 🤝 Contribuire

Aggiunte e miglioramenti sono benvenuti: crea una branch, implementa la modifica e apri una pull request.

---

## 🧾 Licenza

Questo progetto usa la licenza **MIT** (vedi `package.json`).

---

Se vuoi, posso aggiungere esempi d'uso, screenshot o una sezione dedicata all'API/TD. Vuoi che la versione venga anche tradotta in inglese? ✨
