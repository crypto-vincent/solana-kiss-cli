import { Console } from "node:console";
import { pubkeyFromBase58, Solana } from "solana-kiss";
import yargs, { CommandModule } from "yargs";
import { hideBin } from "yargs/helpers";

const cc = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
  colorMode: "auto", // TODO - configurable ?
});

const commandAccount: CommandModule<{}, { address: string }> = {
  command: "account <address>",
  describe: "Fetch and decode an account",
  builder: (y) =>
    y.positional("address", {
      type: "string",
      describe: "Base58 address of the account",
      demandOption: true,
    }),
  handler: async (argv) => {
    const address = pubkeyFromBase58(argv.address);
    const solana = new Solana("devnet"); // TODO - better loaders and local config for RPC URL
    const dudu = await solana.getAndInferAndDecodeAccount(address);
    cc.log({
      address: argv.address,
      executable: dudu.accountExecutable,
      programAddress: dudu.programAddress,
      type: `${dudu.programIdl.metadata.name}::${dudu.accountIdl.name}`,
      lamports: dudu.accountLamports,
      bytes: [...dudu.accountData],
      state: dudu.accountState,
    });
  },
};

async function run() {
  await yargs(hideBin(process.argv))
    .scriptName("solana-kiss")
    .strict()
    .command(commandAccount)
    .help()
    .parseAsync();
}

run().catch((err) => {
  cc.error(err);
  process.exit(1);
});
