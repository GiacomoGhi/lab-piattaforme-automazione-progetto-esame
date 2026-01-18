# Presentazione Progetto - Aquarium Monitor

## 📋 Overview del Progetto

**Aquarium Monitor** è un sistema intelligente di monitoraggio e controllo per acquari basato su **Web of Things (WoT)**. Il sistema garantisce il mantenimento automatico dei parametri ottimali dell'acqua attraverso l'integrazione di molteplici dispositivi IoT che comunicano utilizzando diversi protocolli di rete.

### Obiettivo Principale
Monitorare continuamente i parametri chimici e fisici dell'acqua (pH, temperatura, ossigeno disciolto) e controllare automaticamente la pompa filtro per mantenere condizioni ideali per la fauna acquatica.

### Caratteristiche Principali
- **Monitoraggio in tempo reale** dei parametri dell'acqua
- **Controllo automatico** della pompa filtro basato su condizioni rilevate
- **Orchestrazione intelligente** tra dispositivi eterogenei
- **Alert e notifiche** quando i parametri escono dai range ottimali
- **Cicli di pulizia automatici** del filtro

---

## 🏗️ Architettura del Sistema

### Componenti Principali

#### 1. **Water Quality Sensor** (Sensore di Qualità dell'Acqua)
- **Protocollo**: HTTP
- **Tipo**: Sensore intelligente (basato su ontologia SAREF)
- **Ruolo**: Monitoraggio continuo dei parametri dell'acqua
- **Locazione**: Esposto su `http://localhost:8080/waterqualitysensor`

#### 2. **Filter Pump** (Pompa Filtro)
- **Protocollo**: HTTP (proxy) ↔ Modbus (dispositivo reale)
- **Ruolo**: Controllo della velocità di filtrazione e cicli di pulizia
- **Locazione**: Esposto su `http://localhost:8080/filterpump`
- **Caratteristica**: Agisce come proxy tra l'HTTP (client WoT) e il Modbus (hardware reale)

#### 3. **Orchestrator** (Logica Centrale)
- Implementato in `src/main.ts`
- Consuma entrambi i Things via HTTP
- Implementa la logica di automazione
- Gestisce gli alert e le reazioni automatiche

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

### 5. **Simulazione dei Dati Sensore**

Il sensore simula letture realistiche con piccole variazioni:
```typescript
pH += (Math.random() - 0.5) * 0.2;           // ±0.1 per lettura
temperature += (Math.random() - 0.5) * 0.5;  // ±0.25°C per lettura
oxygenLevel += (Math.random() - 0.5) * 0.3;  // ±0.15 mg/L per lettura
```

Con clamping per mantenere valori realistici.

### 6. **Logging Periodico dello Stato**

Ogni 10 secondi, il sistema registra lo stato completo dell'acquario:
```
📊 === AQUARIUM STATUS ===
   pH: 7.23
   Temperature: 25.1°C
   Oxygen: 7.2 mg/L
   Pump Speed: 65% (running)
   Filter Health: 78%
========================
```

---

## 📡 Flusso di Comunicazione

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Server (Port 8080)                  │
│                    [node-wot servient]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐     │
│  │ Water Quality Sensor │      │    Filter Pump       │     │
│  │ (HTTP Exposed Thing) │      │  (HTTP Proxy Thing)  │     │
│  │                      │      │                      │     │
│  │ Properties:          │      │ Properties:          │     │
│  │ - pH                 │      │ - pumpSpeed          │     │
│  │ - temperature        │      │ - filterStatus       │     │
│  │ - oxygenLevel        │      │ - filterHealth       │     │
│  │ - allParameters      │      │                      │     │
│  │                      │      │ Actions:             │     │
│  │ Events:              │      │ - setPumpSpeed       │     │
│  │ - parameterAlert     │      │ - cleaningCycle      │     │
│  └──────────────────────┘      └──────────────────────┘     │
│           ▲                              ▲                  │
│           │                              │                  │
│           │ HTTP                         │ HTTP             │
│           │ (Client Servient)            │                  │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            └──────┬───────────────────────┘
                   │
            ┌──────▼────────┐
            │  Orchestrator │
            │  (main.ts)    │
            │               │
            │ - Subscribe   │
            │   to alerts   │
            │ - Control pump│
            │ - Log status  │
            └───────────────┘
                   │
                   │ Modbus
                   │ (via FilterPumpThing proxy)
                   │
            ┌──────▼──────────────────┐
            │ Modbus Device (Mock)    │
            │ Real Filter Pump        │
            │                         │
            │ Registers:              │
            │ 0: pumpSpeed            │
            │ 1: filterStatus         │
            │ 2: filterHealth         │
            │ 3: cleaningCommand      │
            └─────────────────────────┘
```

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
2. **Modificare logiche di orchestrazione**: Editare le funzioni di reazione in `src/main.ts`
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
- **Componente**: `main.ts` (Orchestrator)
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