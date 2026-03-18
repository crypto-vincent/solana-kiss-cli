import { promises as fsp } from "node:fs";
import { resolve } from "node:path";
import {
  ErrorStack,
  IdlProgram,
  JsonValue,
  Result,
  Solana,
  casingLosslessConvertToCamel,
  casingLosslessConvertToSnake,
  idlProgramParse,
  pubkeyFromBase58,
  withErrorContext,
} from "solana-kiss";
import { fileURLToPath } from "url";

export async function utilsResolveProgramIdl(params: {
  idlUrlOrPath: URL | undefined;
  solanaRpcUrl: string | undefined;
  programAddress: string | undefined;
}): Promise<IdlProgram> {
  if (params.idlUrlOrPath !== undefined) {
    const idlUrlOrPath = params.idlUrlOrPath;
    return idlProgramParse(
      await withErrorContext(
        `Resolving IDL from URL: ${idlUrlOrPath}`,
        async () => await utilsResolveUrlJson(idlUrlOrPath),
      ),
    );
  }
  const solana = new Solana(params.solanaRpcUrl ?? "mainnet");
  if (params.programAddress === undefined) {
    throw new Error("Either --idl or --program must be specified");
  }
  const { programIdl } = await solana.getOrLoadProgramIdl(
    pubkeyFromBase58(params.programAddress),
  );
  return programIdl;
}

export async function utilsResolveUrlJson(
  urlOrPath: string,
): Promise<JsonValue> {
  const url = utilsTrySync(urlOrPath, (str) => new URL(str));
  const urlValue = url.value;
  if (urlValue) {
    if (urlValue.protocol === "http:" || urlValue.protocol === "https:") {
      const res = await fetch(urlValue);
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} while fetching ${urlValue.toString()}`,
        );
      }
      return await res.json();
    }
    if (urlValue.protocol === "file:") {
      return JSON.parse(await fsp.readFile(fileURLToPath(urlValue), "utf8"));
    }
    utilsThrowWithOptions(`Unsupported URL protocol: ${urlValue.protocol}`, [
      "http",
      "https",
      "file",
    ]);
  }
  try {
    return JSON.parse(await fsp.readFile(resolve(urlOrPath), "utf8"));
  } catch (errorByPath) {
    throw new ErrorStack(`Could not resolve URL: ${urlOrPath}`, [
      url.error,
      errorByPath,
    ]);
  }
}

function utilsTrySync<Input, Output>(
  input: Input,
  fn: (input: Input) => Output,
): Result<Output> {
  try {
    return { value: fn(input) };
  } catch (error) {
    return { error };
  }
}

function utilsThrowWithOptions(message: string, options: string[]): never {
  throw new ErrorStack(
    message,
    options.map((opt) => `Expected: ${opt}`),
  );
}

export function utilsMapGetOrFail<Value>(
  map: Map<string, Value>,
  key: string,
  context: string,
): Value {
  const value = map.get(key);
  if (value !== undefined) {
    return value;
  }
  const keyCamel = casingLosslessConvertToCamel(key);
  const valueCamel = map.get(keyCamel);
  if (valueCamel !== undefined) {
    return valueCamel;
  }
  const keySnake = casingLosslessConvertToSnake(key);
  const valueSnake = map.get(keySnake);
  if (valueSnake !== undefined) {
    return valueSnake;
  }
  if (map.size === 0) {
    throw new Error(`Program has no known ${context}s defined`);
  }
  throw new ErrorStack(
    `Program doesn't have any ${context} named: ${key}`,
    [...map.keys()].map((k) => `Expected: ${k}`),
  );
}
