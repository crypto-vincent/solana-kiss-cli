import {
  argumentOptional,
  argumentRequired,
  command,
  commandWithSubcommands,
  execution,
  optionRepeatable,
  optionSingleValue,
  runAndExit,
  Type,
  typeString,
} from "cli-kiss";
import {
  approximateSolsForLamports,
  Pubkey,
  pubkeyFromBase58,
  rpcHttpFindProgramOwnedAccounts,
  Solana,
  UrlOrMoniker,
  urlRpcFromUrlOrMoniker,
} from "solana-kiss";

const typePubkey: Type<Pubkey> = {
  label: "PUBKEY(BASE58)",
  decoder: (value) => pubkeyFromBase58(value),
};

const typeRpcUrlOrMoniker: Type<UrlOrMoniker> = {
  label: "RPC_URL_OR_MONIKER",
  decoder: (value) => urlRpcFromUrlOrMoniker(new URL(value)),
};

const commandDebug = command<null, void>(
  { description: "debug description" },
  execution(
    {
      options: {},
      arguments: [
        argumentRequired({
          label: "DADA",
          description: "lol",
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

const commandAccount = command<null, void>(
  { description: "Inspect a Solana account" },
  execution(
    {
      options: {},
      arguments: [
        argumentRequired({
          description: "Base58 address of the account to inspect",
          label: "ACCOUNT-ADDRESS",
          type: typePubkey,
        }),
      ],
    },
    async (_context, inputs) => {
      const solana = new Solana("devnet"); // TODO - better loaders and local config for RPC URL
      const accountInfo = await solana.getAndInferAndDecodeAccount(
        inputs.arguments[0],
      );
      console.log(accountInfo);
    },
  ),
);

const commandFind = command<null, void>(
  {
    description: "Find accounts by program and optionally by account type name",
  },
  execution(
    {
      options: {},
      arguments: [
        argumentRequired({
          type: typePubkey,
          description: "Base58 address of the program",
          label: "PROGRAM",
        }),
        argumentOptional({
          label: "NAME",
          description: "Name of the account type to filter by",
          type: typeString,
          default: () => null,
        }),
      ],
    },
    async (_context, inputs) => {
      const solana = new Solana("mainnet"); // TODO - better loaders and local config for RPC URL
      const program = inputs.arguments[0];
      const name = inputs.arguments[1];
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

const commandRoot = commandWithSubcommands<null, null, void>(
  {
    description: "A CLI for Solana account inspection and manipulation",
    details: [
      "This CLI allows you to inspect Solana accounts, find accounts owned by a specific program, and more.",
      "Use the subcommands to perform different actions. For example, use `account` to inspect a specific account, or `find` to search for accounts owned by a program.",
    ].join(" "),
  },
  execution(
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
          long: "idl",
          label: "IDL_URL_OR_PATH",
          description:
            "URL or file path to an IDL JSON file. Can be specified multiple times to load multiple IDLs.",
          type: typeString,
        }),
      },
      arguments: [],
    },
    async (_context, _inputs) => {
      return null;
    },
  ),
  {
    account: commandAccount,
    find: commandFind,
    debug: commandDebug,
  },
);

runAndExit("solana-kiss", process.argv.slice(2), null, commandRoot, {
  buildVersion: process.env["npm_package_version"] as string,
});
