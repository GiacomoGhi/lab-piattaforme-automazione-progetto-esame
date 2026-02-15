# Aquarium Monitor - WoT Project

Sistema di monitoraggio acquario basato su Web of Things (WoT). Tre Things collaborano per mantenere i parametri dell'acqua ottimali, con orchestrazione automatica e dashboard web.

**Protocolli:** HTTP (Things WoT) + Modbus TCP (pompa filtro)

## Quick Start

```bash
# Installa dipendenze
npm install

# Compila TypeScript
npm run build

# Terminal 1: Avvia il mock server Modbus
npm run mock

# Terminal 2: Avvia il sistema
npm start

# Apri il browser
# http://localhost:3000
```

## Scripts

| Comando | Descrizione |
|---------|-------------|
| `npm run build` | Compila TypeScript in `build/` |
| `npm start` | Avvia orchestratore + server statico |
| `npm run mock` | Avvia mock Modbus TCP su porta 502 |
| `npm run mock:build` | Build + mock in un comando |
| `npm run start:build` | Build + start in un comando |

## Porte e Endpoint

| Servizio | URL |
|----------|-----|
| UI Dashboard | http://localhost:3000 |
| Water Digital Twin | http://localhost:8080/water |
| Water Quality Sensor | http://localhost:8080/waterqualitysensor |
| Filter Pump (HTTP proxy) | http://localhost:8080/filterpump |
| Modbus TCP mock | 127.0.0.1:502 |

## Troubleshooting

### Port 8080 already in use
```bash
# Windows (PowerShell)
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8080
kill -9 <PID>
```

### Port 502 permission denied
La porta Modbus 502 richiede privilegi elevati:
```bash
# Linux/macOS
sudo npm run mock

# Oppure usa una porta > 1024 modificando ModbusFilterPumpMockServer.ts
```

### Cannot find module
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
rm -rf build/
npm run build
```

### UI non si aggiorna
1. Verifica che mock (`npm run mock`) e app (`npm start`) siano entrambi in esecuzione
2. Apri la console browser (F12) e cerca errori di connessione
3. Verifica che http://localhost:3000 sia raggiungibile

