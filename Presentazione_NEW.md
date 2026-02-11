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

## 🚀 Stack Tecnologico

### Framework e Librerie
- **node-wot** (v0.8-0.9): Runtime WoT compliant W3C
  - `@node-wot/core`: Core WoT runtime
  - `@node-wot/binding-http`: Binding HTTP
  - `@node-wot/binding-modbus`: Binding Modbus

- **TypeScript**: Linguaggio di programmazione per type-safety
- **modbus-serial**: Comunicazione Modbus (dispositivi reali)
- **Node.js**: Runtime JavaScript

### Protocolli
- **HTTP**: Comunicazione tra Things WoT (ambienti demo e reale)
- **Modbus RTU/TCP**: Comunicazione con dispositivi fisici (solo produzione)

---

## 🧬 Ontologie Utilizzate (Universali)

### 1. **WoT Thing Description (TD)** - W3C Standard
Ogni Thing è descritto mediante un **Thing Description** conforme allo standard W3C, che definisce:
- Metadati del dispositivo
- Properties (proprietà leggibili/scrivibili)
- Actions (azioni eseguibili)
- Events (eventi emessi)
- Binding Protocol (HTTP, Modbus, ecc.)

**File TD nel progetto:**
- `models/water-quality-sensor.tm.json` - TD del sensore acqua
- `models/filter-pump.tm.json` - TD della pompa filtro (HTTP proxy)
- `models/filter-pump-modbus.td.json` - TD del dispositivo Modbus (produzione)

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

## 📋 Requisiti Funzionali Base (Validi in Demo e Produzione)

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
Range ottimale: 24-26°C

IF temperature ∈ [22, 24) OR (26, 28] (WARNING):
  → Emette alert di warning
  → Nessuna azione pompa

IF temperature < 22°C OR temperature > 28°C (CRITICO):
  → Aumenta velocità pompa di +15%
  → Attiva correzione acqua automatica (±0.8/sec)
  → Migliora la circolazione per distribuzione termica
  → (Futuro: Integrazione pompa di calore per heating/cooling attivo)
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

**Demo Mode - Accelerazione Degrado Filtro:**
- Check ogni **1 secondo** (invece di 5 in produzione)
- Rate di degradazione: 0-0.5% per check, max alla velocità pompa 100%
- Da 100% → 50% (trigger cleaning): ~100 secondi (~1.5 minuti)

Questo assicura che il filtro sia sempre mantenuto in buone condizioni e permette di osservare il ciclo di pulizia automatica in demo.

---

## 🔄 Flussi di Comunicazione: DEMO vs REAL

### **MODALITÀ DEMO** - Architettura Completa Simulata

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP Server (Port 8080)                      │
│                    [node-wot servient]                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ Water Digital Twin       │  │ Water Quality Sensor     │    │
│  │ (SIMULAZIONE Acqua)      │  │ (HTTP - Legge DT)       │    │
│  │                          │  │                          │    │
│  │ - Degradazione attiva    │  │ - Campionamento 3 sec   │    │
│  │   (pompa OFF)            │  │ - Alert emessi          │    │
│  │ - Correzione pompa       │  │ - Subscribe a DT        │    │
│  │   (pompa ON)             │  │                          │    │
│  │                          │  │                          │    │
│  │ Events: waterStateChanged│  │ Events: parameterAlert   │    │
│  └──────────────┬───────────┘  └──────────────┬───────────┘    │
│                 │ (publish)                   │ (subscribe)     │
│                 │                             │                 │
│                 └──────────────┬───────────────┘                │
│                                │                               │
│                   ┌────────────▼─────────────┐                │
│                   │ Filter Pump Thing        │                │
│                   │ (HTTP - Simulato)       │                │
│                   │                         │                │
│                   │ - Correzione ±0.8/sec   │                │
│                   │ - Controllo automatico  │                │
│                   │ - Mock Modbus memory    │                │
│                   └─────────────────────────┘                │
│                          ▲                                    │
│                          │ HTTP                              │
│                          │                                    │
│                   ┌──────┴──────┐                            │
│                   │ Orchestrator│                            │
│                   │ (app.ts)    │                            │
│                   │             │                            │
│                   │ - Alert Sub │                            │
│                   │ - Pump Ctrl │                            │
│                   └─────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Flusso Dati DEMO:**
1. Water DT simula degradazione/correzione
2. Sensor legge ogni 3 sec
3. Orchestrator monitora alert
4. Orchestrator accende/spegne pompa
5. Pump applica correzioni in memoria

---

### **MODALITÀ REALE** - Architettura con Dispositivi Fisici

```
┌──────────────────────┐
│   Sensori Fisici     │
│                      │
│ - Sonda pH real      │
│ - Sensore Temp reale │
│ - Sensore O₂ reale   │
│                      │
│ (Modbus/HTTP direct) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│ Water Thing (HTTP Exposed)   │
│ Aggregatore dati sensori     │
│                              │
│ - Legge sensori fisici       │
│ - Pubblica state changes     │
│ - NO simulazione             │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Water Quality Sensor Thing   │
│ (HTTP - Campionamento reale) │
│                              │
│ - Campionamento 5-30 min     │
│ - Subscribe a Water Thing    │
│ - Alert reali                │
└──────────┬───────────────────┘
           │
           ▼
    ┌──────┴──────┐
    │ Orchestrator│
    │             │
    │ - Subscribe │
    │ - Ctrl pump │
    └──────┬──────┘
           │
           ▼
┌──────────────────────────────┐
│ Filter Pump Thing            │
│ (HTTP Proxy ↔ Modbus Real)   │
│                              │
│ - Modbus TCP 502             │
│ - Controllo pompa reale      │
│ - Feedback sensori pompa     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Dispositivi Fisici           │
│                              │
│ - Pompa filtro reale         │
│ - Controllore Modbus         │
│ - Hardware acquario          │
└──────────────────────────────┘
```

**Flusso Dati REALE:**
1. Sensori fisici leggono l'acqua
2. Water Thing aggrega dati reali
3. Sensor legge ogni 5-30 min
4. Orchestrator monitora alert
5. Orchestrator invia comandi Modbus
6. Pompa reale corregge l'acqua
7. Feedback dai sensori

---

## ⚙️ Logiche di Funzionamento REALE

### **Scenario Produzione: Pompa Fisicamente Controllata**

#### **Ciclo di Funzionamento Standard**

**FASE 1: Monitoraggio Passivo**
- Sensori fisici leggono continuamente l'acqua
- Orchestrator monitora i parametri ogni 5-30 minuti
- Se tutti i parametri ∈ range ottimale → pompa OFF

**FASE 2: Alert Rilevato**
```
Condizione: Un parametro esce dal range ottimale

Azione Orchestrator:
  1. Legge alert dal sensore
  2. Invia comando Modbus alla pompa: pumpSpeed = X%
  3. Pompa reale attiva la circolazione
  4. Sensori fisici misurano il cambio
```

**FASE 3: Correzione Attiva**
- Pompa fisicamente circola e migliora l'acqua
- Sensori rilevano il miglioramento
- Orchestrator monitora la convergenza

**FASE 4: Parametri Ottimali**
```
Condizione: pH ∈ [6.5, 7.5] AND Temp ∈ [24, 26] AND O₂ ∈ [6, 8]

Azione Orchestrator:
  1. Invia comando Modbus: pumpSpeed = 0%
  2. Pompa si ferma
  3. Sistema torna a FASE 1
```

---

## 🌊 Logiche Aggiuntive DEMO (Specifiche Modalità Test)

### **Aggiunta 1: Water Digital Twin - Simulazione Degradazione**

**Scopo**: Simulare il deterioramento naturale dell'acqua quando la pompa è spenta

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

**Dove**: `src/things/WaterThing.ts` metodi `startDegradationSimulation()` e `stopDegradationSimulation()`

### **Aggiunta 2: Filter Pump - Correzione Simulata**

**Scopo**: Simulare l'effetto della pompa nel migliorare i parametri

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

**Dove**: `src/things/FilterPumpThing.ts` metodi `startWaterCorrection()` e `stopWaterCorrection()`

### **Aggiunta 3: Campionamento Accelerato**

**Scopo**: Visualizzare i cicli completi in pochi minuti (demo didattica)

```typescript
// DEMO: Campionamento accelerato
samplingInterval = 3000; // 3 secondi (invece di 5-30 minuti reali)
degradationInterval = 1000; // 1 secondo (invece di minuti reali)
correctionInterval = 1000; // 1 secondo (invece di secondi reali)
```

Questo permette di osservare un intero ciclo completo (degradazione → alert → correzione) in circa **2-3 minuti**.

**Dove**: `src/app.ts` linea di inizializzazione WaterQualitySensorThing

### **Aggiunta 4: Water Digital Twin - Cicli Accelerati**

**Scopo**: Mostrare dinamiche di degradazione/correzione in sequenza rapida

- Ciclo degradazione: 10-15 secondi per raggiungere alert
- Ciclo correzione: 10-15 secondi per tornare a ottimale
- Cicli ripetuti continuamente per la demo

Permette di testare completamente l'orchestrator e le transizioni pompa in pochi minuti.

---

## 🎯 Flusso di Esecuzione DEMO Completo

### **Timeline di un Ciclo Demo (2-3 minuti)**

```
T=0s    → Avvio: pompa OFF, simulazione degradazione UP con pH accelerato
         → Water DT: pH 7.0 → 7.6 → 8.2 → ...

T=6s    → Sensor legge (ogni 3 sec): pH = 8.0
         → Alert threshold raggiunto (pH > 7.5)
         → Orchestrator accende pompa: pumpSpeed = 20%

T=7s    → Water DT: STOP degradazione, START correzione
         → Pump applica correzioni: pH -= 0.8/sec

T=12s   → Water DT: pH 8.0 → 7.2 → 6.4
         → Sensor legge: pH = 6.4
         → Temperature e Oxygen ancora fuori range

T=15s   → Tutti i parametri convergono verso ottimale
         → pH = 7.0, Temp = 25.0, O₂ = 7.0

T=16s   → Orchestrator: "All water parameters optimal!"
         → Pompa: pumpSpeed = 0% (OFF)
         → Water DT: ciclo cambia da UP a DOWN
         → Parametro accelerato: pH → Temperature

T=17s   → Ricomincia degradazione (ciclo DOWN, Temp accelerata)
         → Temperatura inizia a diminuire più rapidamente

T=30s   → Nuovo alert (Temp < 24°C o simile)
         → Ciclo si ripete
```

---

## 🎮 Confronto Rapido Demo vs Reale

| Aspetto | DEMO | REALE |
|---------|------|-------|
| **Fonte Dati** | Water DT simulato | Sensori fisici |
| **Campionamento** | 3 sec | 5-30 min |
| **Degradazione** | Simulata ±0.2-0.6/sec | Naturale (ore/giorni) |
| **Correzione Pompa** | Simulata ±0.8/sec | Fisica graduale |
| **Persistenza** | In memoria | Database |
| **Tempo Ciclo Completo** | 2-3 minuti | Ore/giorni |
| **Scopo** | Didattica e test | Produzione |

---

## 🏗️ Architettura Componenti Dettagliata

### 1. **Water Digital Twin** (Rappresentazione Digitale dell'Acqua)
- **Protocollo**: HTTP
- **Ruolo**: Fonte di verità per lo stato dell'acqua
- **Locazione**: Esposto su `http://localhost:8080/water`
- **Simulazione**: Modella degradazione/miglioramento qualitativo dell'acqua
- **Cicli**: Alternanza UP/DOWN con parametro accelerato ciclico
  - **Ciclo UP**: Parametri aumentano di 0.2/sec base + 0.4/sec parametro accelerato
  - **Ciclo DOWN**: Parametri diminuiscono di 0.2/sec base + 0.4/sec parametro accelerato
  - **Rotazione**: Ogni ciclo completo, il parametro accelerato cambia (pH → Temperature → Oxygen)

### 2. **Water Quality Sensor** (Sensore di Qualità dell'Acqua)
- **Protocollo**: HTTP
- **Tipo**: Sensore intelligente (basato su ontologia SAREF)
- **Ruolo**: Monitoraggio continuo dei parametri dell'acqua
- **Locazione**: Esposto su `http://localhost:8080/waterqualitysensor`
- **Campionamento**: Ogni 3 secondi (demo) - configurabile da 3 sec a 30 min (produzione)
- **Subscribe**: Legge dal Water Digital Twin tramite event subscription

### 3. **Filter Pump** (Pompa Filtro Controllata)
- **Protocollo**: HTTP (proxy) ↔ Modbus (simulazione in-memory)
- **Ruolo**: Controllo della velocità di filtrazione e cicli di pulizia
- **Locazione**: Esposto su `http://localhost:8080/filterpump`
- **Caratteristica**: Agisce come proxy tra l'HTTP (client WoT) e il Modbus (simulazione)
- **Correzione Attiva**: Quando attiva, applica correzioni di ±0.8/sec per riportare i parametri ai valori ottimali
  - Sottrae fino a 0.8 quando il valore è sopra l'ottimale
  - Aggiunge fino a 0.8 quando il valore è sotto l'ottimale
  - Spegne automaticamente quando tutti i parametri rientrano nei range ottimali

### 4. **Orchestrator** (Logica Centrale di Automazione)
- Implementato in `src/app.ts`
- Consuma tutti i Things via HTTP
- Implementa la logica di automazione e reazione agli alert
- Gestisce gli alert e le transizioni pompa ON/OFF
- Coordina i cicli di simulazione degradazione/correzione

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
