import * as anchor from "@project-serum/anchor";
import { createMint, getAccount, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token"
import { Program } from "@project-serum/anchor";
import { Zestake } from "../target/types/zestake";
import mint_keypair from '../key/mint.json';
// Read .env into process.env
import { min } from "bn.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";


//const program = new anchor.Program(idl, programId);
const { assert } = require('chai');

const mint_secret = new Uint8Array(mint_keypair);
const mintAccount = anchor.web3.Keypair.fromSecretKey(mint_secret);
console.log("mint wallet account = ", mintAccount.publicKey.toString())

describe("zestake", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Zestake as Program<Zestake>;

  const provider_address = provider.wallet;// anchor.web3.Keypair.generate();

  const user = anchor.web3.Keypair.generate();
  let mint, x_mint;
  // let stakeAccount, xStakeAccount;
  let provider_mint_token_account, provider_x_mint_token_account;

  before(async () => {
    var transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: mintAccount.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL / 100,
      })
    );

    const tx = await provider.sendAndConfirm(transaction)
    console.log("provider sent money to mint in transaction ", tx);
    const tx1 = await provider.connection.requestAirdrop(provider_address.publicKey, 100000000);
    console.log("provider has ", (await provider.connection.getBalance(provider.wallet.publicKey)));
    const tx2 = await provider.connection.requestAirdrop(mintAccount.publicKey, 100000000);
    console.log("mintAccount has ", await provider.connection.getBalance(mintAccount.publicKey));

    // console.log("airdrop transaction successful, signature is ", tx1);
    // console.log("airdrop transaction successful, signature is ", tx2);
    
    mint = await createMint(
      provider.connection,
      mintAccount,
      mintAccount.publicKey,
      mintAccount.publicKey,
      6
    );
    console.log("MINT I CREATED AT = ", mint.toString())

    provider_mint_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAccount,
      mint,
      provider.wallet.publicKey
    );
    console.log("Provider mint token account is ", provider_mint_token_account.address.toString());

    x_mint = await createMint(
      provider.connection,
      mintAccount,
      mintAccount.publicKey,
      mintAccount.publicKey,
      6
    );
    console.log("MINT II CREATED AT = ", x_mint.toString())

    provider_x_mint_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAccount,
      x_mint,
      provider.wallet.publicKey
    );
    console.log("Provider x_mint token account is ", provider_x_mint_token_account.address.toString());

  })

  it("Create New User", async () => {
    // Add your test here.
    const tx = await program.methods.createUser(mint, x_mint).
    accounts({
      owner: provider.wallet.publicKey,
      user: user.publicKey,
      mint: mint,
      stakeAccount: provider_mint_token_account.address,
      xMint: x_mint,
      xStakeAccount: provider_x_mint_token_account.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([user])
    .rpc();
    console.log("Your transaction signature", tx);
  
    let userAccount = await program.account.user.fetch(user.publicKey);

    assert.equal(userAccount.amountStaked.toNumber(), 0)
    assert.equal(userAccount.lastStakedTime.toNumber(), 0)
    assert.equal(userAccount.owner.toString(), provider.wallet.publicKey.toString())
    assert.equal(userAccount.stakeAccount.toString(), provider_mint_token_account.address.toString());
    assert.equal(userAccount.xStakeAccount.toString(), provider_x_mint_token_account.address.toString());
    
    console.log("Tests passed");

  });
});
