import { CounterThing } from "./things/CounterThing";
import { SemaphoreThing } from "./things/SemaphoreThing";
import {
  createWoTRuntimeAsync,
  getTDFromFile,
  requestAndConsumeTDAsync,
  RuntimeType,
} from "./utils/wotRuntime";

/*
*SIMPLE THINGS ARE SMART TOGETHER
Fundamental smartIOT pattern according to WOT:
Things are independent between eachother, the intelligence is in the "orchestration logic"
-> In this example we suppose the things are deployed on a remote server, and the orchestrator interacts with them remotely
*/
(async function main() {
  console.log("---# Counter - Semaphore orchestrator #---");
  // Create wot server
  const wotServer = await createWoTRuntimeAsync(RuntimeType.Server);

  // Create counter
  const counter = new CounterThing(
    wotServer,
    getTDFromFile("./models/counter.tm.json")
  );

  // Create semaphore
  const semaphore = new SemaphoreThing(
    wotServer,
    getTDFromFile("./models/semaphore.tm.json")
  );

  // Start things
  counter.startAsync();
  semaphore.startAsync();

  // Create wot client
  const wotClient = await createWoTRuntimeAsync(RuntimeType.Client);

  // Consume and orchestrate them
  const counterThing = await requestAndConsumeTDAsync(
    wotClient,
    "http://localhost:8080/counter"
  );
  const semaphoreThing = await requestAndConsumeTDAsync(
    wotClient,
    "http://localhost:8080/semaphore"
  );

  //Theresolds
  const thresholds = {
    red: 0,
    yellow: 5,
    green: 10,
  };

  counterThing.observeProperty(
    "count",
    async (data) => {
      const currCount: number = (await data.value()) as any;
      let desiredColor: "red" | "yellow" | "green" = "red";

      if (currCount >= thresholds.green) desiredColor = "green";
      else if (currCount >= thresholds.yellow) desiredColor = "yellow";
      else desiredColor = "red";

      await semaphoreThing.invokeAction("setColor", desiredColor);
      console.log(`count = ${currCount}, color -> ${desiredColor}`);
    },
    (err) => {
      console.error("Error observing count:", err);
    }
  );
})();
