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
- `pHStatus` - Stato pH (ok | warning | alert)
- `temperatureStatus` - Stato temperatura (ok | warning | alert)
- `oxygenLevelStatus` - Stato ossigeno (ok | warning | alert)
- `allParameters` - Tutti i parametri con timestamp
- `mode` - Modalita di campionamento (demo | production)
- `samplingIntervalMs` - Intervallo di campionamento attivo
- `config` - Configurazione completa (range e mode)

**Events:**

- `pHStatusChanged` - Emesso quando cambia lo stato del pH
- `temperatureStatusChanged` - Emesso quando cambia lo stato della temperatura
- `oxygenLevelStatusChanged` - Emesso quando cambia lo stato dell'ossigeno
- `configChanged` - Emesso quando cambia la configurazione

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

1. **All OK** → Pompa OFF
2. **Warning** → +15% per ogni parametro in warning
3. **Alert** → +30% per ogni parametro in alert (cap 100%)
4. **Auto cleaning cycle giornaliero** → Quando filter health < 50%

## Come Eseguire

```bash
# Installa dipendenze
npm install

# Compila TypeScript
npm run build

# Terminal 1: Avvia il mock server Modbus
# (prima compila con npm run build, oppure usa direttamente mock:build)
npm run mock

# Alternativa: build + mock in un solo comando
npm run mock:build

# Terminal 2: Avvia il sistema principale
npm start
```

## UI Web

Apri `index.html` nel browser dopo aver avviato il backend.

L'interfaccia mostra:

- Parametri acqua (pH, temperatura, ossigeno) con indicatori di stato
- Controlli pompa con slider velocità
- Sezione alert in tempo reale

---

## ⚠️ Troubleshooting

### Errore: Port 8080 already in use

Se la porta 8080 è già occupata:

```bash
# Soluzione 1: Killare il processo sulla porta 8080
# Windows (PowerShell):
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :8080
kill -9 <PID>

# Soluzione 2: Usa una porta diversa
npm start -- --port 3000
```

### Errore: Cannot find module 'wot-typescript-definitions'

Dipendenze non installate o corrotte:

```bash
# Opzione 1: Pulisci e reinstalla
rm -rf node_modules package-lock.json
npm install

# Opzione 2: Pulisci cache npm
npm cache clean --force
npm install
```

### Errore: Modbus server non si connette

Se il mock server non comunica:

```bash
# Verifica che sia in ascolto
# Terminal 1: npm run mock
# Vedi output: ✅ Modbus Mock Server listening on 127.0.0.1:502

# Verifica la connessione:
# Windows (PowerShell):
Test-NetConnection -ComputerName 127.0.0.1 -Port 502

# macOS/Linux:
nc -zv 127.0.0.1 502
```

### Errore: EACCES - Permission denied (port 502)

La porta Modbus 502 richiede privilegi root:

```bash
# Soluzione 1: Esegui con sudo
sudo npm run mock

# Soluzione 2: Usa una porta diversa (> 1024)
# Modifica src/mock/ModbusFilterPumpMockServer.ts
# Cambia: new ModbusFilterPumpMockServer(502)
# In:     new ModbusFilterPumpMockServer(5502)
```

### Build fallisce con errori TypeScript

TypeScript non compila correttamente:

```bash
# Pulisci cartella build e ricompila
rm -rf build/
npm run build

# Se persiste, controlla tsconfig.json
cat tsconfig.json
```

### UI non si aggiorna in tempo reale

Il dashboard non mostra i dati:

```bash
# 1. Verifica che tutti i 3 servizi siano avviati:
#    - npm run mock (Terminal 1)
#    - npm start (Terminal 2)
#    - Browser con index.html aperto

# 2. Apri la console del browser (F12)
#    Cerca errori CORS o connessione HTTP

# 3. Assicurati che il file index.html sia sul corretto path:
#    file:///C:/Temp/WoT/project/lab-piattaforme-automazione-progetto-esame/index.html
```

### Sensore non genera alert

Se gli alert non vengono generati:

```bash
# 1. Controlla i range ottimali in src/things/WaterQualitySensorThing.ts
# 2. Verifica che il valore esca dal range:
#    pH: 6.5-7.5 (warning: 6.0-8.0)
#    Temperature: 24-26°C (warning: 22-28°C)
#    Oxygen: 6-8 mg/L (warning: 5-10 mg/L)

# 3. Verifica che il sensore emetta `parameterStatusChanged`
```

