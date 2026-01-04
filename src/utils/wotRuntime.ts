import * as fs from "fs";
import { HttpClientFactory, HttpServer } from "@node-wot/binding-http";
import Servient from "@node-wot/core";

export enum RuntimeType {
  Server,
  Client,
}

export async function createWoTRuntimeAsync(
  type: RuntimeType,
  port: number = 8080
): Promise<typeof WoT> {
  const remoteServient = new Servient();

  switch (type) {
    case RuntimeType.Server:
      remoteServient.addServer(new HttpServer({ port: port }));
      break;

    default:
      remoteServient.addClientFactory(new HttpClientFactory(null));
  }

  return await remoteServient.start();
}

export const getTDFromFile = (filePath: string): WoT.ThingDescription =>
  JSON.parse(fs.readFileSync(filePath).toString());

export async function requestAndConsumeTDAsync(
  wotRuntime: typeof WoT,
  endpoint: string
): Promise<WoT.ConsumedThing> {
  const consumedTD = await wotRuntime.requestThingDescription(endpoint);
  return await wotRuntime.consume(consumedTD);
}
