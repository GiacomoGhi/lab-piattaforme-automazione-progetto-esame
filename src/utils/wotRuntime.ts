import * as fs from "fs";
import { HttpClientFactory, HttpServer } from "@node-wot/binding-http";
import { ModbusClientFactory } from "@node-wot/binding-modbus";
import Servient from "@node-wot/core";

export enum RuntimeType {
  HttpServer,
  HttpClient,
  ModbusClient,
}

export async function createWoTRuntimeAsync(
  type: RuntimeType,
  port: number = 8080
): Promise<typeof WoT> {
  const remoteServient = new Servient();

  switch (type) {
    case RuntimeType.HttpServer:
      remoteServient.addServer(new HttpServer({ port: port }));
      break;

    case RuntimeType.HttpClient:
      remoteServient.addClientFactory(new HttpClientFactory(null));
      break;

    case RuntimeType.ModbusClient:
      remoteServient.addClientFactory(new ModbusClientFactory());
      break;
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
