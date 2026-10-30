import type { PluginClientContext } from "@getpaseo/plugin/client";
import type { PluginRpcContract } from "@getpaseo/plugin";
import type { ZodType, input as ZodInput, output as ZodOutput } from "zod";

let rpcFn: PluginClientContext["rpc"] | null = null;

export function setRpc(rpc: PluginClientContext["rpc"]): void {
  rpcFn = rpc;
}

export function callRpc<InputSchema extends ZodType, OutputSchema extends ZodType>(
  contract: PluginRpcContract<InputSchema, OutputSchema>,
  input: ZodInput<InputSchema>,
): Promise<ZodOutput<OutputSchema>> {
  if (!rpcFn) return Promise.reject(new Error("rpc unavailable"));
  return rpcFn(contract, input);
}
