# Presentazione Progetto - Aquarium Monitor

## 📋 Overview del Progetto

**Aquarium Monitor** è un sistema intelligente di monitoraggio e controllo per acquari basato su **Web of Things (WoT)** con simulazione realistica dell'ambiente acquatico. Il sistema garantisce il mantenimento automatico dei parametri ottimali dell'acqua attraverso l'integrazione di molteplici dispositivi IoT che comunicano utilizzando diversi protocolli di rete.

### Obiettivo Principale
Monitorare continuamente i parametri chimici e fisici dell'acqua (pH, temperatura, ossigeno disciolto) e controllare automaticamente la pompa filtro per mantenere condizioni ideali per la fauna acquatica, gestendo un ciclo realistico di degradazione e correzione.

### Caratteristiche Principali
- **Monitoraggio in tempo reale** dei parametri dell'acqua
- **Simulazione realistica** della degradazione qualitativa dell'acqua
- **Controllo automatico** della pompa filtro basato su condizioni rilevate
- **Orchestrazione intelligente** tra dispositivi eterogenei
- **Alert e notifiche** quando i parametri escono dai range ottimali
- **Cicli automatici di pulizia** del filtro
- **Modalità Demo vs Produzione** - configurabile per scopi didattici o reali
- **Campionamento parametrizzato** dei sensori (3 sec demo - 3 a 30 min reale)
---

## 🏗️ Architettura del Sistema

### Componenti Principali

#### 1. **Water Digital Twin** (Rappresentazione Digitale dell'Acqua)
- **Protocollo**: HTTP
- **Ruolo**: Fonte di verità per lo stato dell'acqua
- **Locazione**: Esposto su `http://localhost:8080/water`
- **Simulazione**: Modella degradazione/miglioramento qualitativo dell'acqua
- **Cicli**: Alternanza UP/DOWN con parametro accelerato ciclico
  - **Ciclo UP**: Parametri aumentano di 0.2/sec base + 0.4/sec parametro accelerato
  - **Ciclo DOWN**: Parametri diminuiscono di 0.2/sec base + 0.4/sec parametro accelerato
  - **Rotazione**: Ogni ciclo completo, il parametro accelerato cambia (pH → Temperature → Oxygen)

#### 2. **Water Quality Sensor** (Sensore di Qualità dell'Acqua)
- **Protocollo**: HTTP
- **Tipo**: Sensore intelligente (basato su ontologia SAREF)
- **Ruolo**: Monitoraggio continuo dei parametri dell'acqua
- **Locazione**: Esposto su `http://localhost:8080/waterqualitysensor`
- **Campionamento**: Ogni 3 secondi (demo) - configurabile da 3 sec a 30 min (produzione)
- **Subscribe**: Legge dal Water Digital Twin tramite event subscription

#### 3. **Filter Pump** (Pompa Filtro Controllata)
- **Protocollo**: HTTP (proxy) ↔ Modbus (simulazione in-memory)
- **Ruolo**: Controllo della velocità di filtrazione e cicli di pulizia
- **Locazione**: Esposto su `http://localhost:8080/filterpump`
- **Caratteristica**: Agisce come proxy tra l'HTTP (client WoT) e il Modbus (simulazione)
- **Correzione Attiva**: Quando attiva, applica correzioni di ±0.8/sec per riportare i parametri ai valori ottimali
  - Sottrae fino a 0.8 quando il valore è sopra l'ottimale
  - Aggiunge fino a 0.8 quando il valore è sotto l'ottimale
  - Spegne automaticamente quando tutti i parametri rientrano nei range ottimali

#### 4. **Orchestrator** (Logica Centrale di Automazione)
- Implementato in `src/app.ts`
- Consuma tutti i Things via HTTP
- Implementa la logica di automazione e reazione agli alert
- Gestisce gli alert e le transizioni pompa ON/OFF
- Coordina i cicli di simulazione degradazione/correzione

---

## 🧬 Ontologie Utilizzate

### 1. **WoT Thing Description (TD)** - W3C Standard
Ogni Thing è descritto mediante un **Thing Description** conforme allo standard W3C, che definisce:
- Metadati del dispositivo
- Properties (proprietà leggibili/scrivibili)
- Actions (azioni eseguibili)
- Events (eventi emessi)
- Binding Protocol (HTTP, Modbus, ecc.)

**File TD nel progetto:**
- `models/water-quality-sensor.tm.json` - TD del sensore acqua
- `models/filter-pump.tm.json` - TD della pompa filtro (proxy HTTP)
- `models/filter-pump-modbus.td.json` - TD del dispositivo Modbus

### 2. **SAREF (Smart Appliances REFerence Ontology)** - ETSI Standard
Ontologia semantica per la rappresentazione di dispositivi intelligenti.

**Utilizzo nel progetto:**
```json
{
  "@context": [
    "https://www.w3.org/2022/wot/td/v1.1",
    {
      "saref": "https://saref.etsi.org/core/"
    }
  ],
  "@type": ["saref:Sensor"]
}
```

- **Water Quality Sensor**: Classificato come `saref:Sensor`
- Fornisce proprietà standardizzate per sensori intelligenti
- Consente interoperabilità con altri sistemi SAREF-compliant

### 3. **JSON Schema** per Validazione
Utilizzato per definire il tipo e le caratteristiche delle proprietà:
- Type: `number`, `string`, `object`
- Constraints: `minimum`, `maximum`, `enum`
- Metadata: `unit`, `description`, `observable`

---

## 🔧 Logiche Applicate

### 1. **Monitoraggio dei Parametri Ottimali**

Ogni parametro ha range ottimali e range di warning definiti:

```typescript
const OPTIMAL_RANGES = {
  pH: { 
    min: 6.5, max: 7.5,              // Range ottimale
    warningMin: 6.0, warningMax: 8.0 // Range warning
  },
  temperature: { 
    min: 24, max: 26,                // Range ottimale
    warningMin: 22, warningMax: 28   // Range warning
  },
  oxygenLevel: { 
    min: 6, max: 8,                  // Range ottimale (mg/L)
    warningMin: 5, warningMax: 10    // Range warning
  }
};
```

**Livelli di Alert:**
- ✅ **OK**: Dentro il range ottimale
- ⚠️ **WARNING**: Entro il range di warning
- 🚨 **ALERT**: Fuori dal range di warning (critico)

### 2. **Reazione agli Alert - Controllo Pompa**

L'orchestrator reagisce agli alert emessi dal sensore applicando logiche specifiche:

#### Logica pH Critico
```
IF pH < 6.5 OR pH > 7.5 (ALERT) THEN
  → Aumenta velocità pompa di +20%
  → Massimo circolare l'acqua per equilibrare il pH
```

#### Logica Temperatura Critica
```
IF temperature > 26°C (ALERT) THEN
  → Emette notifica critica
  → Avvisa di controllare il sistema di raffreddamento
```

#### Logica Ossigeno Basso
```
IF oxygenLevel < 6 mg/L (ALERT) THEN
  → Aumenta velocità pompa di +25%
  → Migliora l'aerazione dell'acqua
```

### 3. **Cooldown degli Alert**
Implementato un sistema di cooldown per evitare eccessive reazioni:
```typescript
alertCooldown: 10000 // 10 secondi tra un alert e il successivo
```
Previene azioni ripetute durante l'intervallo di cooldown.

### 4. **Cicli Automatici di Pulizia del Filtro**

**Logica Daily Cleaning:**
```
OGNI 30 secondi:
  IF filterHealth < 50% OR è un nuovo giorno THEN
    → Avvia ciclo di pulizia
    → Salva la data dell'ultimo ciclo
```

Questo assicura che il filtro sia sempre mantenuto in buone condizioni.

### 5. **Simulazione Realistica della Degradazione dell'Acqua**

Quando la pompa è spenta, il Water Digital Twin simula il deterioramento naturale dei parametri:

```typescript
// Degradazione ogni 1 secondo
currentTestCycle === 0 ? AUMENTO : DIMINUZIONE

Per ogni parametro:
  - Cambio base: ±0.2 al secondo
  - Parametro accelerato: ±0.4 al secondo (aggiuntivo)
  
Esempio Ciclo UP con pH accelerato:
  - pH: +0.2 + 0.4 = +0.6/sec
  - Temperature: +0.2/sec
  - Oxygen: +0.2/sec
```

La simulazione alterna cicli UP e DOWN, con rotazione del parametro accelerato:
1. UP (↑) con **pH** accelerato
2. DOWN (↓) con **Temperature** accelerato
3. UP (↑) con **Oxygen** accelerato
4. DOWN (↓) con **pH** accelerato (ricomincia ciclo)

### 6. **Correzione Attiva mediante Pompa Filtro**

Quando la pompa è in funzione, applica correzioni ai parametri dell'acqua:

```typescript
// Correzione ogni 1 secondo
Per ogni parametro:
  delta = valoreLetto - valoreOttimale
  
  IF delta > 0:           // Sopra l'ottimale
    correzione = -min(0.8, delta)  // Sottrai fino a 0.8
  ELSE IF delta < 0:      // Sotto l'ottimale
    correzione = +min(0.8, |delta|) // Aggiungi fino a 0.8
  ELSE:
    correzione = 0        // Già ottimale
```

**Comportamento automatico:**
1. Pompa accesa: applica correzioni ogni secondo
2. Tutti i parametri ottimali: pompa si spegne automaticamente
3. Pompa spenta: riprende simulazione degradazione con ciclo successivo

### 7. **Campionamento Parametrizzato dei Sensori**

Il sensore di qualità legge i valori dal Water Digital Twin ad intervalli configurabili:

```typescript
// Modalità DEMO (default)
samplingInterval = 3000; // 3 secondi

// Modalità PRODUZIONE (configurabile)
samplingInterval = 300000; // 5 minuti (esempio)
// Range valido: 3000 ms (3 sec) - 1800000 ms (30 min)
```

Nel file `src/app.ts`, riga di inizializzazione:
```typescript
const waterSensor = new WaterQualitySensorThing(
  wotRuntime, 
  waterSensorTD, 
  3000  // ← Modificare questo valore per produzione
);
```

---

## � Ciclo di Funzionamento Completo

### **Fase 1: Avvio - Pompa OFF, Degradazione Attiva**
```
┌─────────────────────────────────────┐
│ Water Digital Twin                  │
│ Inizio Ciclo UP                     │
│ pH accelerato (+0.6/sec)            │
│ Temp normale (+0.2/sec)             │
│ O₂ normale (+0.2/sec)               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Water Quality Sensor                │
│ Legge ogni 3 secondi                │
│ Emette alert se fuori range         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Orchestrator                        │
│ Monitora gli alert                  │
│ AZIONI: Nessuna (pompa spenta)      │
└─────────────────────────────────────┘
```

### **Fase 2: Threshold Raggiunto - Pompa Accesa**
```
Condizione: Un parametro esce dai range ottimali
↓
Orchestrator rileva alert
↓
AZIONE: Aumenta velocità pompa
  - pH critico → pump speed +20%
  - Temp critica → alert notifica
  - O₂ basso → pump speed +25%
↓
Water Digital Twin: STOP degradazione
Water Digital Twin: START correzione con pompa
```

### **Fase 3: Correzione Attiva - Pompa ON**
```
┌─────────────────────────────────────┐
│ Filter Pump (velocità attiva)       │
│ Ogni 1 secondo applica:             │
│                                     │
│ pH: da 8.0 a 7.0 = -0.8/sec        │
│ Temp: da 27°C a 25°C = -0.2/sec    │
│ O₂: da 5.5 a 7.0 = +0.8/sec        │
└──────────────┬──────────────────────┘
               │
               ▼
Water Digital Twin: Riceve correzioni
Water Quality Sensor: Legge e monitora
Orchestrator: Verifica convergenza
```

### **Fase 4: Parametri Ottimali - Pompa OFF**
```
Condizione: pH ∈ [6.5, 7.5] 
         AND Temp ∈ [24, 26]
         AND O₂ ∈ [6, 8]
↓
Orchestrator: "All water parameters optimal! Turning off pump"
↓
Pompa: STOP correzione
↓
Water Digital Twin: START nuovo ciclo degradazione
  - Ciclo cambia: da UP a DOWN (o viceversa)
  - Parametro accelerato ruota: pH → Temp → O₂
↓
Ritorna a FASE 1 (nuovo ciclo)
```

### **Logging dello Stato**

Ogni 10 secondi, il sistema registra lo stato completo:
```
📊 === AQUARIUM STATUS ===
   pH: 7.23
   Temperature: 25.1°C
   Oxygen: 7.2 mg/L
   Pump Speed: 0% (idle) / 20% (running)
   Filter Health: 78%
========================
```

---

## 🎯 Modalità Demo vs Produzione

### **Modalità DEMO** (Attuale - Default)
La modalità demo è stata implementata per scopi didattici e di demostrazione. L'applicazione simula l'intero comportamento dell'acquario in modo accelerato:

| Parametro | Demo | Produzione | Scopo |
|-----------|------|-----------|-------|
| **Campionamento Sensor** | 3 secondi | 5-30 minuti | Vedere variazioni in tempo rapido |
| **Ciclo Degradazione** | 1 sec/step | Minuti/ore | Simulare il decadimento naturale |
| **Ciclo Correzione Pompa** | 1 sec/step | Secondi/minuti | Osservare l'effetto della pompa |
| **Avanzamento Tempo** | 1 mese in ~2 min | Tempo reale | Coprire scenari complessi |

### **Transizione a Produzione**

L'applicazione può essere facilmente adattata a un ambiente di **produzione reale** con le seguenti modifiche:

#### **1. Campionamento Sensori Reali**
```typescript
// DEMO (attuale)
const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD, 3000);

// PRODUZIONE - Sensore fisico ogni 5 minuti
const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD, 300000);

// O meglio: leggere dalla configurazione
const SAMPLING_INTERVAL = process.env.SAMPLING_INTERVAL_MS || 3000; // default demo
const waterSensor = new WaterQualitySensorThing(wotRuntime, waterSensorTD, SAMPLING_INTERVAL);
```

#### **2. Disabilitare Water Digital Twin Simulation**
```typescript
// DEMO (attuale)
water.startDegradationSimulation(); // Simula degradazione

// PRODUZIONE
// Commentare o condizionare: water.startDegradationSimulation();
// I dati verranno letti dai sensori reali, non simulati
```

#### **3. Collegare a Modbus Reale**
```typescript
// DEMO (attuale)
// FilterPumpThing simula il comportamento della pompa in memory

// PRODUZIONE
// Modificare FilterPumpThing per:
// - Leggere/scrivere register Modbus reali
// - Applicare le correzioni all'hardware fisico
// - Monitorare feedback reali dalla pompa
```

#### **4. Aggiungere Persistenza Dati**
```typescript
// DEMO
// Tutti i dati rimangono in memoria

// PRODUZIONE
// Aggiungere:
// - Database (PostgreSQL, MongoDB) per storing storico
// - Time-series DB (InfluxDB, Prometheus) per metriche
// - Message queue (RabbitMQ, Kafka) per event streaming
```

#### **5. Configurazione Ambiente**
Aggiungere `.env` per parametri di produzione:
```bash
# .env (esempio)
NODE_ENV=production
SAMPLING_INTERVAL_MS=300000          # 5 minuti
PUMP_MAX_SPEED=100
PUMP_CORRECTION_RATE=0.5             # ridotto per stabilità
LOG_LEVEL=info
DATABASE_URL=postgresql://...
ALERT_WEBHOOK=https://alerts.example.com/
```

### **Note Implementative Versioni Future**

La gestione della modalità demo/produzione verrà **semplificata e migliorata** in versioni successive dell'applicazione, con:
- ✅ File di configurazione centralizzato per easy switching
- ✅ Profili di deployment predefiniti (demo, staging, production)
- ✅ Disattivazione/attivazione selettiva della simulazione
- ✅ Documentazione di migrazione passo-passo
- ✅ Suite di test per validare comportamenti in entrambe le modalità

---

## 🚀 Stack Tecnologico

### Framework e Librerie
- **node-wot** (v0.8-0.9): Runtime WoT compliant W3C
  - `@node-wot/core`: Core WoT runtime
  - `@node-wot/binding-http`: Binding HTTP
  - `@node-wot/binding-modbus`: Binding Modbus

- **TypeScript**: Linguaggio di programmazione
- **modbus-serial**: Comunicazione Modbus
- **Node.js**: Runtime JavaScript

### Protocolli
- **HTTP**: Comunicazione con i Things WoT
- **Modbus RTU/TCP**: Comunicazione con dispositivi reali (legacy)

---

## 🎯 Flusso di Esecuzione

1. **Avvio Sistema**
   - Crea servient con HTTP server sulla porta 8080
   - Registra factory per HTTP client e Modbus client
   - Carica i Thing Description dai file JSON

2. **Esposizione dei Things**
   - Water Quality Sensor: produce simulazione sensore
   - Filter Pump: espone proxy HTTP al dispositivo Modbus

3. **Orchestrazione**
   - Crea client servient per consumare i Things via HTTP
   - Subscribe all'evento `parameterAlert` del sensore
   - Avvia ciclo di monitoring e controllo automatico

4. **Runtime Continuo**
   - Sensore simula letture ogni 5 secondi
   - Orchestrator applica logiche di reazione agli alert
   - Sistema registra status ogni 10 secondi
   - Cicli di pulizia schedulati ogni 30 secondi

---

## 📊 Estensibilità e Manutenzione

### Punti di Estensione
1. **Aggiungere nuovi Things**: Creare nuove classi in `src/things/` e TD in `models/`
2. **Modificare logiche di orchestrazione**: Editare le funzioni di reazione in `src/app.ts`
3. **Aggiungere nuovi sensori**: Estendere `OPTIMAL_RANGES` e logiche di alert
4. **Integrare nuovi protocolli**: Aggiungere binding node-wot (Zigbee, CoAP, ecc.)

### Best Practices Applicate
- ✅ Separazione di responsabilità (Things e Orchestrator)
- ✅ Conformità agli standard W3C WoT
- ✅ Uso di ontologie semantiche (SAREF)
- ✅ Type safety con TypeScript
- ✅ Configurazione centralizzata
- ✅ Logging dettagliato per debugging

---

## 🔐 Considerazioni di Sicurezza

Per un ambiente di produzione:
- Implementare autenticazione OAuth2/JWT nei binding HTTP
- Usare HTTPS invece di HTTP
- Validare rigorosamente gli input delle azioni
- Implementare access control per le proprietà
- Aggiungere rate limiting sui servizi esposti
- Cifrare i dati sensibili in tranzito (Modbus)

---

## Note per Filter Pump

### Mappa dei Modbus Registers (diver)

| Register | Indirizzo | Tipo | Descrizione | Range | Accesso |
|----------|-----------|------|-------------|-------|---------|
| **0** | `/holding/0` | integer | **pumpSpeed** - Velocità della pompa | 0-100% | R/W |
| **1** | `/holding/1` | integer | **filterStatus** - Stato (0=idle, 1=running, 2=cleaning, 3=error) | 0-3 | R |
| **2** | `/holding/2` | integer | **filterHealth** - Salute del filtro | 0-100% | R |
| **3** | `/holding/3` | integer | **cleaningCommand** - Comando pulizia (scrivi 1) | 0-1 | W |


Architettura **proxy** a 3 livelli:

### 1 **Appl: Orchestrator**
- **Componente**: `app.ts` (Orchestrator)
- **Protocollo**: HTTP REST
- **Azione**: Consuma il FilterPumpThing come un Thing WoT qualsiasi
- **Endpoint**: `http://localhost:8080/filterpump`

### 2 **Link/Proxy: FilterPumpThing**
- **Componente**: `src/things/FilterPumpThing.ts`
- **Protocollo**: HTTP ↔ Modbus (traduttore)
- **Ruolo**: Espone il Thing Model `filter-pump.tm.json` via HTTP
- **Server**: HTTP su `localhost:8080`
- **Gestione**: Properties (read), Actions (invoke)
- **Interfaccia Standard**: W3C WoT compliant

### 3 **Hardware: Modbus Device**
- **Componente**: Modbus Mock Server
- **Protocollo**: Modbus TCP
- **Porta**: `502` (localhost)
- **Descrizione**: `models/filter-pump-modbus.td.json`
- **Holding Registers**:
  - Register 0: `pumpSpeed` (0-100%)
  - Register 1: `filterStatus` (0-3)
  - Register 2: `filterHealth` (0-100%)
  - Register 3: `cleaningCommand` (0-1)


## Simulazione Server TCP ModBus 
 - Mantenere lo stato dei 4 register Modbus in memoria
 - Simulare la degradazione della salute del filtro
 - Gestiree i comandi di pulizia
 - Non dipendere da librerie Modbus server
 - Usare solo per testing WoT

---

## 🚀 Avvio dell'Applicazione

### **Prerequisiti**
- Node.js 16+ installato
- npm o yarn per gestione dipendenze

### **Step di Startup**

#### **1. Installa Dipendenze**
```bash
cd c:\Temp\WoT\project\lab-piattaforme-automazione-progetto-esame
npm install
```

#### **2. Compila TypeScript**
```bash
npm run build
```

#### **3. Avvia l'Applicazione**
```bash
npm start
```

### **Output Atteso all'Avvio**
```
🐠 Starting Aquarium Monitor System...

📡 Static file server listening on http://localhost:3000
   Open: http://localhost:3000

💧 Water Digital Twin started! Go to: http://localhost:8080/water
✅ Water Digital Twin exposed (HTTP)

WaterQualitySensor thing started! Go to: http://localhost:8080/waterqualitysensor
✅ Water Quality Sensor exposed (HTTP)

FilterPump thing started! Go to: http://localhost:8080/filterpump
✅ Filter Pump exposed (HTTP Proxy → Modbus)

[Water DT] 🌊 Starting degradation simulation (Cycle UP)
🌊 Water degradation simulation started

[Sensor] 🔗 Connecting to Water Digital Twin...
[Sensor] ✅ Connected to Water Digital Twin
[Sensor] 📡 Subscribed to Water Digital Twin events
[Sensor] 📡 Starting periodic sampling every 3000ms

🎮 Aquarium Monitor running. Press Ctrl+C to stop.
```

### **Accesso all'Interfaccia**

- **Dashboard Web**: http://localhost:3000
- **Water Thing**: http://localhost:8080/water
- **Sensor Thing**: http://localhost:8080/waterqualitysensor
- **Pump Thing**: http://localhost:8080/filterpump

### **Cosa Aspettarsi in Console**

Durante l'esecuzione vedrai:
- ✅ Log dei parametri aggiornati ogni ciclo
- 🌊 Simulazione degradazione/correzione acqua
- ⚠️ Alert quando parametri escono dai range
- 🔄 Transizioni pompa ON/OFF
- 📊 Status periodico dell'acquario (ogni 10 sec)

---

## 📊 Struttura File Progetto

```
lab-piattaforme-automazione-progetto-esame/
├── src/
│   ├── app.ts                           # Entry point + Orchestrator
│   ├── things/
│   │   ├── WaterThing.ts                # Digital Twin dell'acqua
│   │   ├── WaterQualitySensorThing.ts   # Sensore qualità
│   │   ├── FilterPumpThing.ts           # Pompa controllata
│   │   └── WaterThing.ts
│   ├── types/
│   │   └── WaterTypes.ts                # Type definitions
│   ├── utils/
│   │   └── wotRuntime.ts                # WoT runtime utilities
│   └── mock/
│       └── ModbusFilterPumpMockServer.ts # Simulatore Modbus
├── models/
│   ├── water.tm.json                    # TD Water Digital Twin
│   ├── water-quality-sensor.tm.json     # TD Sensore
│   ├── filter-pump.tm.json              # TD Pompa (HTTP)
│   └── filter-pump-modbus.td.json       # TD Pompa (Modbus)
├── build/                               # Compiled JavaScript
├── www/                                 # Static files (dashboard)
│   ├── main.js
│   └── style.css
├── index.html                           # Web dashboard
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📚 Riferimenti e Standard

### W3C Web of Things
- **Specifica TD**: https://www.w3.org/TR/wot-thing-description/
- **Implementazione**: https://github.com/eclipse-thingweb/node-wot

### ETSI SAREF Ontology
- **Specifiche**: https://saref.etsi.org/
- **Modelli**: Smart Sensors, Actuators

### Protocolli
- **HTTP**: RFC 7230-7237
- **Modbus**: Specification V1.1b3

---

## 📝 Licenza e Note Finali

Progetto didattico per dimostrare l'applicazione di Web of Things in scenari IoT reali.

**Versione Attuale**: 1.0.0 - Demo Mode
- ✅ Simulazione completa di degradazione/correzione
- ✅ Controllo automatico pompa
- ✅ Dashboard interattivo
- ✅ Campionamento parametrizzato

**Future Improvements**:
- 🔄 Semplificazione configurazione Demo/Produzione
- 🔄 Database persistente per storage dati storici
- 🔄 API REST per controllo remoto
- 🔄 Integrazione Modbus reale con dispositivi fisici
- 🔄 Machine Learning per predizione degrado qualità
````