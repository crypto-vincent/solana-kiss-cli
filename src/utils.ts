import { promises as fsp } from "node:fs";
import { resolve } from "node:path";
import {
  ErrorStack,
  IdlProgram,
  JsonValue,
  Solana,
  casingLosslessConvertToCamel,
  casingLosslessConvertToSnake,
  idlProgramParse,
  pubkeyFromBase58,
  withErrorContext,
} from "solana-kiss";
import { fileURLToPath } from "url";

export async function utilsResolveProgramIdl(params: {
  idlUrlOrPath: string | undefined;
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
  try {
    let url = new URL(urlOrPath);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching ${url.toString()}`);
      }
      return await res.json();
    }
    if (url.protocol === "file:") {
      return JSON.parse(await fsp.readFile(fileURLToPath(url), "utf8"));
    }
    utilsThrowWithOptions(`Unsupported URL protocol: ${url.protocol}`, [
      "http",
      "https",
      "file",
    ]);
  } catch (errorByUrl) {
    try {
      return JSON.parse(await fsp.readFile(resolve(urlOrPath), "utf8"));
    } catch (errorByPath) {
      throw new ErrorStack(`Could not resolve URL: ${urlOrPath}`, [
        errorByUrl,
        errorByPath,
      ]);
    }
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
