# Aquarium Monitor - WoT Project

## Overview

Sistema di monitoraggio acquario con Web of Things (WoT). Due Things collaborano per mantenere i parametri dell'acqua ottimali per i pesci.

**Protocolli usati:**

- Water Quality Sensor → **HTTP**
- Filter Pump → **Modbus** (esposto via HTTP proxy)

## Things

### 1. Water Quality Sensor (HTTP)

Sensore che monitora i parametri dell'acqua.

**Properties:**

- `pH` - Livello pH (0-14)
- `temperature` - Temperatura in °C
- `oxygenLevel` - Ossigeno disciolto in mg/L
- `allParameters` - Tutti i parametri con timestamp

**Events:**

- `parameterAlert` - Emesso quando un parametro è fuori range

### 2. Filter Pump (Modbus → HTTP Proxy)

Pompa filtro con controllo velocità e ciclo di pulizia. Comunica via Modbus con l'hardware, esposto via HTTP proxy.

**Modbus Registers:**

- Register 0: pumpSpeed (0-100)
- Register 1: filterStatus (0=idle, 1=running, 2=cleaning, 3=error)
- Register 2: filterHealth (0-100)
- Register 3: cleaningCommand (write 1 to trigger)

**HTTP Properties (proxy):**

- `pumpSpeed` - Velocità pompa (0-100%)
- `filterStatus` - Stato: idle | running | cleaning | error
- `filterHealth` - Salute filtro (0-100%)
- `lastCleaningTime` - Timestamp ultima pulizia

**HTTP Actions (proxy):**

- `setPumpSpeed` - Imposta velocità pompa
- `cleaningCycle` - Avvia ciclo pulizia

## Logica Orchestrator

L'orchestrator coordina i due Things con questa logica:

1. **pH fuori range** (< 6.5 o > 7.5) → Aumenta velocità pompa del 20%
2. **Temperatura > 26°C** → Emette alert
3. **Ossigeno basso** (< 6 mg/L) → Aumenta velocità pompa del 25%
4. **Auto cleaning cycle giornaliero** → Quando filter health < 50%

## Come Eseguire

```bash
# Installa dipendenze
npm install

# Compila TypeScript
npm run build

# Terminal 1: Avvia il mock server Modbus
npm run mock

# Terminal 2: Avvia il sistema principale
npm start
```

## UI Web

Apri `index.html` nel browser dopo aver avviato il backend.

L'interfaccia mostra:

- Parametri acqua (pH, temperatura, ossigeno) con indicatori di stato
- Controlli pompa con slider velocità
- Sezione alert in tempo reale
