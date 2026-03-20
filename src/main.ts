import {
  command,
  commandWithSubcommands,
  operation,
  optionRepeatable,
  optionSingleValue,
  positionalOptional,
  positionalRequired,
  positionalVariadics,
  runAsCliAndExit,
  Type,
  typeString,
} from "cli-kiss";
import {
  approximateSolsForLamports,
  Pubkey,
  pubkeyFromBase58,
  rpcHttpFindProgramOwnedAccounts,
  Solana,
  urlRpcFromUrlOrMoniker,
} from "solana-kiss";

type CommandContext = {
  rpcUrl: URL;
  idlUrlsOrPaths: string[];
};

const typePubkey: Type<Pubkey> = {
  label: "PUBKEY(BASE58)",
  decoder: (value) => pubkeyFromBase58(value),
};

const typeRpcUrlOrMoniker: Type<URL> = {
  label: "RPC_URL_OR_MONIKER",
  decoder: (value) => urlRpcFromUrlOrMoniker(value),
};

const commandDebug = command<CommandContext, void>(
  {
    description: "debug description",
    details: "debug details",
  },
  operation(
    {
      options: {},
      positionals: [
        positionalRequired({
          label: "DADA",
          description: "required positional",
          type: typeString,
        }),
        positionalOptional({
          label: "DODO",
          description: "optional positional",
          type: typeString,
          default: () => "default value for DODO",
        }),
        positionalVariadics({
          label: "DUDU",
          description: "variadic positionals",
          type: typeString,
        }),
      ],
    },
    async (context, inputs) => {
      console.log("context", context);
      console.log("inputs", inputs);
    },
  ),
);

const commandAccount = command<CommandContext, void>(
  {
    description: "Inspect a Solana account",
    details:
      "Fetches and decodes the account data for a given Solana account address. The account data is decoded using the IDL files provided via the --idl option at the root level, allowing for human-readable output of account fields based on known account types.",
  },
  operation(
    {
      options: {
        dudu: optionRepeatable({
          short: "d",
          long: "dudu",
          label: "DUDU",
          description: "lol",
          type: typeString,
        }),
      },
      positionals: [
        positionalRequired({
          description: "Base58 address of the account to inspect",
          label: "ACCOUNT-ADDRESS",
          type: typePubkey,
        }),
      ],
    },
    async (_context, inputs) => {
      const solana = new Solana("devnet"); // TODO - better loaders and local config for RPC URL
      const accountInfo = await solana.getAndInferAndDecodeAccount(
        inputs.positionals[0],
      );
      console.log(accountInfo);
    },
  ),
);

const commandFind = command<CommandContext, void>(
  {
    description: "Find accounts by program and optionally by account type name",
  },
  operation(
    {
      options: {},
      positionals: [
        positionalRequired({
          type: typePubkey,
          description: "Base58 address of the program",
          label: "PROGRAM",
        }),
        positionalOptional({
          label: "NAME",
          description: "Name of the account type to filter by",
          type: typeString,
          default: () => null,
        }),
      ],
    },
    async (_context, inputs) => {
      const solana = new Solana("mainnet"); // TODO - better loaders and local config for RPC URL
      const program = inputs.positionals[0];
      const name = inputs.positionals[1];
      if (name === null) {
        const ownedAccounts = await rpcHttpFindProgramOwnedAccounts(
          solana.getRpcHttp(),
          program,
        );
        console.log(ownedAccounts);
        let totalAccounts = 0;
        let totalLamports = 0n;
        for (const account of ownedAccounts) {
          totalAccounts += 1;
          totalLamports += account.accountLamports;
        }
        console.log(
          `Total accounts: ${totalAccounts}, total lamports: ${totalLamports} (~${approximateSolsForLamports(totalLamports)} SOL)`,
        );
      } else {
        const ownedAccounts = await solana.findProgramOwnedAccounts(
          program,
          name,
        );
        console.log(ownedAccounts);
      }
    },
  ),
);

const commandRoot = commandWithSubcommands<null, CommandContext, void>(
  {
    description: "A CLI for Solana account inspection and manipulation",
    details: [
      "This CLI allows you to inspect Solana accounts, find accounts owned by a specific program, and more.",
      "Use the subcommands to perform different actions. For example, use `account` to inspect a specific account, or `find` to search for accounts owned by a program.",
    ].join(" "),
  },
  operation(
    {
      options: {
        rpc: optionSingleValue({
          short: "r",
          long: "rpc",
          label: "RPC_URL_OR_MONIKER",
          description: "URL of the Solana RPC endpoint to connect to",
          default: () => urlRpcFromUrlOrMoniker("mainnet"),
          type: typeRpcUrlOrMoniker,
        }),
        idl: optionRepeatable({
          short: "i",
          long: "idl",
          label: "IDL_URL_OR_PATH",
          description: "URL or file path to an IDL JSON file.",
          type: typeString,
        }),
      },
      positionals: [],
    },
    async (_context, inputs) => {
      return {
        rpcUrl: inputs.options.rpc,
        idlUrlsOrPaths: inputs.options.idl,
      };
    },
  ),
  {
    account: commandAccount,
    find: commandFind,
    debug: commandDebug,
  },
);

runAsCliAndExit("solana-kiss", process.argv.slice(2), null, commandRoot, {
  buildVersion: process.env["npm_package_version"] as string,
});
