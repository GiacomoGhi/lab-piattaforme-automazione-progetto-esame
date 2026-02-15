# Aquarium Monitor - Presentazione Progetto

## Overview

**Aquarium Monitor** è un sistema di monitoraggio e controllo automatico per acquari basato su **Web of Things (WoT)**. Tre Things collaborano per mantenere i parametri dell'acqua (pH, temperatura, ossigeno disciolto) entro range ottimali, con orchestrazione automatica della pompa filtro.

**Protocolli:** HTTP (Things WoT) + Modbus TCP (pompa filtro hardware)

---

## Stack Tecnologico

- **node-wot** (v0.8-0.9): Runtime WoT conforme W3C
  - `@node-wot/core`, `@node-wot/binding-http`, `@node-wot/binding-modbus`
- **TypeScript** + **Node.js**
- **modbus-serial**: Comunicazione Modbus TCP
- **Express**: Server statico per la dashboard web

---

## Ontologie

### WoT Thing Description (W3C)
Ogni Thing è descritto da un TD conforme allo standard W3C che dichiara properties, actions, events e binding protocol.

**File TD:**
- `models/water.tm.json` — Water Digital Twin
- `models/water-quality-sensor.tm.json` — Sensore qualità acqua
- `models/filter-pump.tm.json` — Pompa filtro (HTTP proxy)
- `models/filter-pump-modbus.td.json` — Dispositivo Modbus

### SAREF (ETSI)
Il Water Quality Sensor è annotato come `saref:Sensor`, il Water Digital Twin come `saref:DigitalTwin`, per interoperabilità semantica.

### JSON Schema
Ogni proprietà nei TD è tipizzata con JSON Schema (`type`, `minimum`, `maximum`, `enum`, `unit`).

---

## Architettura

### Componenti

#### 1. Water Digital Twin (`src/things/WaterThing.ts`)
- **Protocollo**: HTTP
- **Endpoint**: `http://localhost:8080/water`
- **Ruolo**: Fonte di verità per lo stato dell'acqua
- **Properties**: `pH`, `temperature`, `oxygenLevel` (read/write, observable)
- **Simulazione demo**: Degradazione continua con cicli UP/DOWN e parametro accelerato rotante
- **Correzione**: Legge la velocità pompa via WoT e applica correzioni proporzionali verso i target ottimali
- **Target ottimali**: Ottenuti dal Sensor via WoT (`readProperty("config")` + subscribe `configChanged`)

#### 2. Water Quality Sensor (`src/things/WaterQualitySensorThing.ts`)
- **Protocollo**: HTTP
- **Endpoint**: `http://localhost:8080/waterqualitysensor`
- **Tipo**: `saref:Sensor`
- **Properties**: `pH`, `temperature`, `oxygenLevel`, `pHStatus`, `temperatureStatus`, `oxygenLevelStatus`, `allParameters`, `mode`, `samplingIntervalMs`, `config`
- **Events**: `pHStatusChanged`, `temperatureStatusChanged`, `oxygenLevelStatusChanged`, `configChanged`
- **Funzionamento**: Polling periodico del Water DT, calcolo status per parametro (ok/warning/alert), emissione eventi al cambio di livello
- **Configurazione**: Owner di `config.json` — unico Thing che legge/scrive il file, espone la config come proprietà WoT

#### 3. Filter Pump (`src/things/FilterPumpThing.ts`)
- **Protocollo**: HTTP (proxy) ↔ Modbus TCP
- **Endpoint**: `http://localhost:8080/filterpump`
- **Properties**: `pumpSpeed`, `filterStatus`, `filterHealth`, `lastCleaningTime`
- **Actions**: `setPumpSpeed`, `cleaningCycle`
- **Ruolo**: Proxy HTTP per il dispositivo Modbus — traduce azioni WoT in letture/scritture di holding registers

#### 4. Modbus Mock Server (`src/mock/ModbusFilterPumpMockServer.ts`)
- **Protocollo**: Modbus TCP su porta 502
- **Registers**: `0:pumpSpeed`, `1:filterStatus`, `2:filterHealth`, `3:cleaningCommand`
- **Simulazione**: Degrado salute filtro proporzionale alla velocità pompa

#### 5. Orchestrator (`src/app.ts`)
- Consuma Sensor e Pump come Things WoT via HTTP
- Sottoscrive gli eventi di cambio status dal Sensor
- Calcola velocità pompa: `warning × 20% + alert × 40%` (cap 100%)
- Ciclo giornaliero di pulizia automatica se `filterHealth < 50%`

---

## Flussi di Comunicazione

### Interazioni WoT tra i componenti

```
┌───────────┐         HTTP polling          ┌─────────────────────┐
│    UI     │ ────────────────────────────► │  Water Quality      │
│ (browser) │ GET/PUT config, mode, props   │  Sensor             │
└───────────┘                               │  :8080/waterquality │
       ┌───────────────────────────────────►│  sensor             │
       |        consume: readProperty       └────────┬────────────┘
       |                                             │
       |                                   polls HTTP│  
       |                                   (every 3s)│ 
       |                                             ▼
┌───────────────┐                         ┌──────────────────────┐
│ Orchestrator  │                         │  Water Digital Twin  │
│ (app.ts)      │                         │  :8080/water         │
│               │                         │                      │
│               │                         │  consume: readProp   │
│               │                         │  (config) from       │
│               │                         │  Sensor + subscribe  │
│               │                         │  configChanged       │
└───────┬───────┘                         └──────────┬───────────┘
        │                                            │
        │ invokeAction(setPumpSpeed)                 │ consume: readProperty
        │ invokeAction(cleaningCycle)                │ (pumpSpeed) from Pump
        ▼                                            ▼
┌─────────────────────┐                   ┌─────────────────────┐
│  Filter Pump        │                   │  (stessa connessione│
│  :8080/filterpump   │ ◄────────────────-│   WoT HTTP)         │
│  (HTTP proxy)       │                   └─────────────────────┘
└────────┬────────────┘
         │ Modbus TCP (R/W holding registers)
         ▼
┌─────────────────────┐
│  Modbus Mock Server │
│  127.0.0.1:502      │
│  Registers 0-3      │
└─────────────────────┘
```

**Nota architetturale WoT**: ogni Thing interagisce con gli altri esclusivamente tramite il protocollo WoT (properties, actions, events). Il file `config.json` è letto/scritto solo dal Sensor per persistenza tra riavvii — il Water DT ottiene i target ottimali consumando la property `config` del Sensor via HTTP.

---

## Logica di Orchestrazione

### Calcolo velocità pompa
```
Per ogni parametro (pH, temperature, oxygenLevel):
  - status "ok"      → +0%
  - status "warning"  → +20%
  - status "alert"    → +40%

targetSpeed = somma dei contributi (cap 100%)
```

Quando tutti i parametri tornano "ok", la pompa si spegne (speed = 0).

### Pulizia automatica filtro
Ogni 30 secondi l'orchestrator controlla:
```
IF filterHealth < 50% AND non già pulito oggi
  → invokeAction("cleaningCycle")
```

---

## Simulazione Demo

### Degradazione acqua (WaterThing)
Ciclo continuo che altera i parametri ogni secondo:
- **Base**: ±0.2/sec su tutti i parametri
- **Accelerato**: ±0.4/sec aggiuntivi su un parametro rotante
- Alterna cicli UP e DOWN ogni 30 secondi
- Rotazione: pH → temperature → oxygenLevel

### Correzione acqua (WaterThing)
Ogni secondo, se `pumpSpeed > 0`:
- Legge la velocità pompa dal FilterPump via WoT
- Calcola `maxStep = 2.2 × (pumpSpeed / 100)`
- Corregge ogni parametro verso il target ottimale di `maxStep` al massimo
- I target ottimali vengono dal Sensor via WoT (`config.parameters.*.optimal`)

### Degrado filtro (ModbusMockServer)
La salute del filtro degrada proporzionalmente alla velocità pompa. Il ciclo di pulizia ripristina health al 100%.

---

## Configurazione

Il file `config.json` contiene:
- **mode**: `demo` o `production` (cambia gli intervalli di campionamento)
- **parameters**: range ottimali e configurabili per ogni parametro
- **modes**: timing specifici per demo e produzione

La configurazione è gestita esclusivamente dal `WaterQualitySensorThing`, che:
1. La legge da disco all'avvio
2. La espone come proprietà WoT (`config`)
3. Accetta modifiche via PUT dalla UI
4. Persiste le modifiche su disco
5. Emette `configChanged` per notificare gli altri Things

---

## Proxy Modbus a 3 livelli

| Livello | Componente | Protocollo |
|---------|-----------|-----------|
| Applicazione | Orchestrator (`app.ts`) | HTTP — consuma FilterPump come Thing WoT |
| Proxy | FilterPumpThing | HTTP ↔ Modbus — traduce azioni WoT in registri |
| Hardware | Modbus Mock Server | Modbus TCP 502 — registri in memoria |

**Holding Registers:**

| Register | Nome | Range | Accesso |
|----------|------|-------|---------|
| 0 | pumpSpeed | 0-100% | R/W |
| 1 | filterStatus | 0=idle, 1=running, 2=cleaning, 3=error | R |
| 2 | filterHealth | 0-100% | R |
| 3 | cleaningCommand | write 1 per avviare pulizia | W |

---

## Dashboard Web

La UI (`www/`) esegue polling ogni 3 secondi e mostra:
- Parametri acqua con indicatori di stato (ok/warning/alert)
- Controlli pompa (slider velocità, pulizia, stop)
- Configurazione range ottimali e modalità
- Log alert in tempo reale

Tutte le interazioni passano attraverso le API WoT HTTP dei Things esposti.

---

## Buone Pratiche WoT Rispettate

- TD per ogni Thing con properties/actions/events dichiarati nei modelli JSON
- Separazione tra Thing esposti e orchestrazione tramite consumed Things
- Proprietà osservabili per metriche, eventi solo per cambi di stato
- `securityDefinitions` con `nosec` dichiarato esplicitamente in tutti i TD
- Nessun accoppiamento tra Things via risorse condivise (file, variabili globali)
- Interazione esclusivamente via protocollo WoT (HTTP/Modbus)

---

## Struttura File

```
├── src/
│   ├── app.ts                           # Entry point + Orchestrator
│   ├── things/
│   │   ├── WaterThing.ts                # Digital Twin dell'acqua
│   │   ├── WaterQualitySensorThing.ts   # Sensore qualità
│   │   └── FilterPumpThing.ts           # Proxy HTTP → Modbus
│   ├── types/
│   │   └── WaterTypes.ts                # Interfacce condivise
│   └── mock/
│       └── ModbusFilterPumpMockServer.ts # Mock Modbus TCP
├── models/
│   ├── water.tm.json
│   ├── water-quality-sensor.tm.json
│   ├── filter-pump.tm.json
│   └── filter-pump-modbus.td.json
├── www/
│   ├── index.html                       # Dashboard
│   ├── main.js                          # Frontend logic
│   └── style.css
├── config.json                          # Configurazione persistente
├── package.json
├── tsconfig.json
└── README.md
```

---

## Riferimenti

- **W3C WoT Thing Description**: https://www.w3.org/TR/wot-thing-description/
- **node-wot**: https://github.com/eclipse-thingweb/node-wot
- **ETSI SAREF Ontology**: https://saref.etsi.org/
- **Modbus**: Specification V1.1b3
