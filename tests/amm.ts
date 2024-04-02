import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID as associatedTokenProgram,
  TOKEN_PROGRAM_ID as tokenProgram,
  //createMint,
  //createAccount,
  //mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createAssociatedTokenAccount,
  getMint,
  createInitializeAccountInstruction,
  getAccountLenForMint,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Connection,
  Transaction,
  Signer,
  ConfirmOptions,
  TransactionSignature,
} from "@solana/web3.js";
import { startAnchor, ProgramTestContext } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { randomBytes } from "crypto";
import { Amm, IDL } from "../target/types/amm";

//const program = anchor.workspace.Amm as Program<Amm>;

//const connection = anchor.getProvider().connection;

let program: Program<Amm>;
let connection: Connection;

let programId = new anchor.web3.PublicKey(
  "EC74LrPycjACM3kYnS2m1XUBSrBt4MrtSqB4thXmcLJG"
);

const confirm = async (signature: string): Promise<string> => {
  const block = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    signature,
    ...block,
  });
  return signature;
};

const confirmTxs = async (signatures: string[]) => {
  await Promise.all(signatures.map(confirm));
};

const log = async (signature: string): Promise<string> => {
  console.log(
    `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
  );
  return signature;
};

const newMintToAta = async (
  minter: Keypair
): Promise<{ mint: PublicKey; ata: PublicKey }> => {
  const mint = await createMint(minter, minter.publicKey, null, 6);
  // await getAccount(connection, mint, commitment)
  const ata = await createAccount(minter, mint, minter.publicKey);
  const signature = await mintTo(minter, mint, ata, minter, 21e8).then(confirm);
  //await confirmTx(signature);
  return {
    mint,
    ata,
  };
};

describe("amm", () => {
  let initializer: Keypair;
  const user = Keypair.generate();
  const seed = new BN(randomBytes(8));

  const auth = PublicKey.findProgramAddressSync(
    [Buffer.from("auth")],
    programId
  )[0];

  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), seed.toBuffer("le")],
    programId
  )[0];

  const mint_lp = PublicKey.findProgramAddressSync(
    [Buffer.from("lp"), config.toBuffer()],
    programId
  )[0];

  let mint_x: PublicKey;
  let mint_y: PublicKey;

  //ATA
  let initializer_x_ata: PublicKey;
  let initializer_y_ata: PublicKey;
  let initializer_lp_ata: PublicKey;

  let vault_x_ata: PublicKey;
  let vault_y_ata: PublicKey;
  //let vault_lp_ata: PublicKey;

  let context: ProgramTestContext;
  let provider: BankrunProvider;

  before("Setup Bankrun", async () => {
    context = await startAnchor("./", [], []);
    provider = new BankrunProvider(context);
    program = new anchor.Program<Amm>(IDL, programId, provider);
    //anchor.setProvider(provider);
    anchor.setProvider(provider);
    initializer = context.payer;
  });

  xit("Airdrop", async () => {
    await connection
      .requestAirdrop(initializer.publicKey, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);

    await connection
      .requestAirdrop(user.publicKey, LAMPORTS_PER_SOL * 10)
      .then(confirm)
      .then(log);
  });

  it("Create mints, tokens and ATAs", async () => {
    // Create mints and ATAs
    let [u1, u2] = await Promise.all(
      [initializer, initializer].map(async (a) => {
        return await newMintToAta(a);
      })
    );
    mint_x = u1.mint;
    mint_y = u2.mint;
    initializer_x_ata = u1.ata;
    initializer_y_ata = u2.ata;
    initializer_lp_ata = await getAssociatedTokenAddress(
      mint_lp,
      initializer.publicKey,
      false,
      tokenProgram
    );
    // Create take ATAs
    vault_x_ata = await getAssociatedTokenAddress(
      mint_x,
      auth,
      true,
      tokenProgram
    );
    vault_y_ata = await getAssociatedTokenAddress(
      mint_y,
      auth,
      true,
      tokenProgram
    );
    // vault_lp_ata = await getAssociatedTokenAddress(
    //   mint_lp,
    //   auth,
    //   true,
    //   tokenProgram
    // );
  });

  xit("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize(seed, 200, initializer.publicKey)
      .accounts({
        initializer: initializer.publicKey,
        mintX: mint_x,
        mintY: mint_y,
        // mintLp: mint_lp,
        vaultX: vault_x_ata,
        vaultY: vault_y_ata,
        auth: auth,
        config: config,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([initializer])
      .rpc()
      .then(confirm)
      .then(log);
  });

  xit("Deposit some tokens", async () => {
    // Add your test here.
    const tx = await program.methods
      .deposit(
        new BN(20),
        new BN(20),
        new BN(20),
        new BN(Math.floor(new Date().getTime() / 1000) + 600)
      )
      .accounts({
        user: initializer.publicKey,
        mintX: mint_x,
        mintY: mint_y,
        mintLp: mint_lp,
        vaultX: vault_x_ata,
        vaultY: vault_y_ata,
        userX: initializer_x_ata,
        userY: initializer_y_ata,
        userLp: initializer_lp_ata,
        auth: auth,
        config: config,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([initializer])
      .rpc()
      .then(confirm)
      .then(log);
  });
});

async function createMint(
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  programId = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let prov = anchor.getProvider();
  const lamports = await getMinimumBalanceForRentExemptMint(prov.connection);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId,
    }),
    createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    )
  );

  await prov.sendAndConfirm(transaction, [payer, keypair]);

  return keypair.publicKey;
}

async function createAccount(
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  keypair?: Keypair,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let prov = anchor.getProvider();
  // If a keypair isn't provided, create the associated token account and return its address
  if (!keypair)
    return await createAssociatedTokenAccount(
      connection,
      payer,
      mint,
      owner,
      confirmOptions,
      programId
    );

  // Otherwise, create the account with the provided keypair and return its public key
  const mintState = await getMint(
    connection,
    mint,
    confirmOptions?.commitment,
    programId
  );
  const space = getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space,
      lamports,
      programId,
    }),
    createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      owner,
      programId
    )
  );

  await prov.sendAndConfirm(transaction, [payer, keypair]);

  // await sendAndConfirmTransaction(
  //   connection,
  //   transaction,
  //   [payer, keypair],
  //   confirmOptions
  // );

  return keypair.publicKey;
}

async function createAssociatedTokenAccount(
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let prov = anchor.getProvider();
  const associatedToken = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    programId,
    associatedTokenProgramId
  );

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedToken,
      owner,
      mint,
      programId,
      associatedTokenProgramId
    )
  );

  await prov.sendAndConfirm(transaction, [payer]);

  // await sendAndConfirmTransaction(
  //   connection,
  //   transaction,
  //   [payer],
  //   confirmOptions
  // );

  return associatedToken;
}

async function mintTo(
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<string> {
  let prov = anchor.getProvider();
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const transaction = new Transaction().add(
    createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId
    )
  );

  return await prov.sendAndConfirm(transaction, [payer, ...signers]);

  // return await sendAndConfirmTransaction(
  //   connection,
  //   transaction,
  //   [payer, ...signers],
  //   confirmOptions
  // );
}

function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}
