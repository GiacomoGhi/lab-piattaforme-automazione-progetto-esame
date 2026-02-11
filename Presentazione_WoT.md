# Presentazione WoT - Assetto Attuale

## Assetto attuale
- Runtime WoT: servient unico che espone Water, WaterQualitySensor e FilterPump via HTTP, con un client WoT interno per orchestrazione in [src/app.ts](src/app.ts).
- WaterThing: digital twin con proprieta leggibili/scrivibili e polling da parte del sensore in [src/things/WaterThing.ts](src/things/WaterThing.ts).
- WaterQualitySensorThing: polling periodico, calcolo stato e pubblicazione eventi per stato per-parametro in [src/things/WaterQualitySensorThing.ts](src/things/WaterQualitySensorThing.ts).
- FilterPumpThing: proxy HTTP per Modbus, con correzione acqua simulata che modifica direttamente il DT in [src/things/FilterPumpThing.ts](src/things/FilterPumpThing.ts).
- UI: legge/scrive la configurazione via proprieta WoT del sensore in [www/main.js](www/main.js).
- Configurazione: persistita in config.json, letta/scritta dal sensore.

## Buone pratiche WoT rispettate
- Uso di TD per ciascun Thing con proprieta/azioni/eventi in [models](models).
- Separazione tra Thing (exposed) e orchestrazione (consumed) nel runtime.
- Proprieta osservabili per stati e metriche, con eventi solo per cambi di livello.
- Interazione via proprietà e azioni coerente con i ruoli dei Thing.
- Mapping Modbus documentato in TD del device.

## Gap rispetto alle best practice e migliorie proposte
1. Allineamento tra TD e implementazione: WaterThing non emette piu waterStateChanged ma il TD lo dichiara ancora. Rimuovere evento dal TD o ripristinare emissione. Vedi [models/water.tm.json](models/water.tm.json) e [src/things/WaterThing.ts](src/things/WaterThing.ts).
2. Sicurezza nei TD: Water e WaterQualitySensor non dichiarano securityDefinitions. Anche in demo e buona prassi usare nosec per esplicitare il modello di sicurezza. Vedi [models/water.tm.json](models/water.tm.json) e [models/water-quality-sensor.tm.json](models/water-quality-sensor.tm.json).
3. Schema della proprieta config: la proprieta config e un oggetto non tipizzato nel TD. Definire schema e required per validazione. Vedi [models/water-quality-sensor.tm.json](models/water-quality-sensor.tm.json).
4. Validazione input config: il sensore salva config senza validare i bounds configurabili. Aggiungere controlli min/max coerenti con la UI. Vedi [src/things/WaterQualitySensorThing.ts](src/things/WaterQualitySensorThing.ts).
5. I/O sincrono su config: lettura/scrittura sincrona su disco nella path dei handler puo bloccare il loop. Valutare cache + debounce o I/O async per produzione. Vedi [src/things/WaterQualitySensorThing.ts](src/things/WaterQualitySensorThing.ts).
6. Coerenza eventi e throttling: se molti cambi avvengono nello stesso tick, potrebbe servire un debounce per eventi di stato per ridurre traffico. Vedi [src/things/WaterQualitySensorThing.ts](src/things/WaterQualitySensorThing.ts).
7. Separazione servient: in produzione, separare processo che ospita i Thing da quello di orchestrazione per migliorare isolamento e sicurezza. Vedi [src/app.ts](src/app.ts).

## Note di conformita
- L utilizzo di observeproperty per metriche e subscribeevent per cambi di stato e coerente con WoT.
- Le azioni della pompa usano input/output coerenti con il TD, ma il device Modbus non e ancora integrato lato runtime.
