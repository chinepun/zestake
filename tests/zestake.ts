import * as anchor from "@project-serum/anchor";
import { createMint, getAccount, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo, createMintToInstruction, mintToChecked } from "@solana/spl-token"
import { AnchorError, Program } from "@project-serum/anchor";
import { Zestake } from "../target/types/zestake";
import mint_keypair from '../key/mint.json';

import { PublicKey, clusterApiUrl, SystemProgram, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction, Connection } from "@solana/web3.js";

// import { SwitchboardTestEnvironment } from "@switchboard-xyz/sbv2-utils";
// import { SwitchboardTestContext } from "@switchboard-xyz/sbv2-utils";

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

  let provider_amount: any;
  before(async () => {
    // const testEnvironment = await SwitchboardTestEnvironment.create(
    //   "../key/mint.json"
    // );
    // testEnvironment.writeAll(".switchboard");
    

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
//    let usern = anchor.web3.Keypair.generate()
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
    // .instruction([
    //   await program.account.usern.createInstruction(
    //     usern,
    //     8 + 32 + 8 + 16 + 32 + 32
    //   )
    // ])
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

  it("User Stakes first time but without funds", async () => {
    const [programPDA, programPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority'),
        mint.toBuffer(),
        x_mint.toBuffer(),
      ], program.programId
   )

    const [programTokenPDA, programTokenPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority_stake_account'),
        mint.toBuffer(),
        x_mint.toBuffer()
      ], program.programId
    );
    try{
      const tx = await program.methods.stake(new anchor.BN(programPDABump), new anchor.BN(20))
      .accounts(
        {
          owner: provider.wallet.publicKey,
          programAuthority: programPDA,
          programAuthorityStakeAccount: programTokenPDA,
          user: user.publicKey,
          mint: mint,
          xMint: x_mint,
          mintTokens: provider_mint_token_account.address,
          xMintTokens: provider_x_mint_token_account.address,
        
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([])
        .rpc();

      console.log("stake signature is ", tx);
    }catch(err){
      const errMsg = "You do not own up to this amount you are trying to withdraw";
      assert.equal((err as AnchorError).error.errorMessage, errMsg)
    }
  })

  it ("Pass fake owner to stake ", async () => {
    const [programPDA, programPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority'),
        mint.toBuffer(),
        x_mint.toBuffer(),
      ], program.programId
   )

    const [programTokenPDA, programTokenPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority_stake_account'),
        mint.toBuffer(),
        x_mint.toBuffer()
      ], program.programId
    );
    
    const fake_owner_keypair = anchor.web3.Keypair.generate();
    
    var transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: fake_owner_keypair.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL / 100,
      })
    );

    await provider.sendAndConfirm(transaction);
    console.log("funded fake owner wallet has ", await provider.connection.getBalance(fake_owner_keypair.publicKey));
    try{
      const tx = await program.methods.stake(new anchor.BN(programPDABump), new anchor.BN(20))
      .accounts(
        {
          owner: fake_owner_keypair.publicKey,
          programAuthority: programPDA,
          programAuthorityStakeAccount: programTokenPDA,
          user: user.publicKey,
          mint: mint,
          xMint: x_mint,
          mintTokens: provider_mint_token_account.address,
          xMintTokens: provider_x_mint_token_account.address,
        
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([fake_owner_keypair])
        .rpc();

      console.log("stake signature is ", tx);
    }catch(err){
      const errMsg = "A has one constraint was violated";
      assert.equal((err as AnchorError).error.errorMessage, errMsg)
    }
  });

  it ("Pass in legit owner but malicious tokenaccount(s)", async () => {
    const attacker = anchor.web3.Keypair.generate();
    const attacker_user = anchor.web3.Keypair.generate();

    var transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: attacker.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL / 100,
      })
    );

    await provider.sendAndConfirm(transaction);
    
    const attacker_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAccount,
      mint,
      attacker.publicKey
    );
    console.log("Attacker mint token account is ", attacker_token_account.address.toString());

    const attacker_x_token_account = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      mintAccount,
      x_mint,
      attacker.publicKey
    );
    console.log("Attacker x_mint token account is ", attacker_x_token_account.address.toString());

    console.log('creating attacker user account');
    const tx = await program.methods.createUser(mint, x_mint).
    accounts({
      owner: attacker.publicKey,
      user: attacker_user.publicKey,
      mint: mint,
      stakeAccount: attacker_token_account.address,
      xMint: x_mint,
      xStakeAccount: attacker_x_token_account.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([attacker, attacker_user])
    .rpc();

    console.log('calling stake instruction passing it invalid keys')

    const [programPDA, programPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority'),
        mint.toBuffer(),
        x_mint.toBuffer(),
      ], program.programId
   )

    const [programTokenPDA, programTokenPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority_stake_account'),
        mint.toBuffer(),
        x_mint.toBuffer()
      ], program.programId
    );
    console.log('invalid mintTokens')
    try{
      const tx = await program.methods.stake(new anchor.BN(programPDABump), new anchor.BN(20))
      .accounts(
        {
          owner: attacker.publicKey,
          programAuthority: programPDA,
          programAuthorityStakeAccount: programTokenPDA,
          user: attacker_user.publicKey,
          mint: mint,
          xMint: x_mint,
          mintTokens: provider_mint_token_account.address,
          xMintTokens: attacker_x_token_account.address,
        
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([attacker])
        .rpc();

      console.log("stake signature is ", tx);
    }catch(err){
      const errMsg = "InvalidAccountData, pass correct accounts";
      assert.equal((err as AnchorError).error.errorMessage, errMsg)
    }
  });

  it ('user is able to stake because of sufficient funds', async () => {
    // let mintInstruction = await createMintToInstruction(
    //   mint,
    //   provider_mint_token_account,
    //   mint.owner,
    //   10000,
    //   [mintAccount],
    //   TOKEN_PROGRAM_ID
    //   );
      console.log("here")
    // await provider.sendAndConfirm(new Transaction().add(mintInstruction));
    
    provider_amount = 9 * 10 ** 6;
    console.log(`minting ${provider_amount} tokens to user so he can stake part of thos tokens`);
    const amount_to_stake = 6 * 10 ** 6;
    console.log(`staking ${amount_to_stake} tokens `);

    await mintToChecked(
      provider.connection,
      mintAccount,
      mint,
      provider_mint_token_account.address,
      mintAccount,
      provider_amount,
      6
      )


    const [programPDA, programPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority'),
        mint.toBuffer(),
        x_mint.toBuffer(),
      ], program.programId
    )

    const [programTokenPDA, programTokenPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority_stake_account'),
        mint.toBuffer(),
        x_mint.toBuffer()
      ], program.programId
    );


    try{
      const tx = await program.methods.stake(new anchor.BN(programPDABump), new anchor.BN(amount_to_stake))
      .accounts(
        {
          owner: provider.wallet.publicKey,
          programAuthority: programPDA,
          programAuthorityStakeAccount: programTokenPDA,
          user: user.publicKey,
          mint: mint,
          xMint: x_mint,
          mintTokens: provider_mint_token_account.address,
          xMintTokens: provider_x_mint_token_account.address,
        
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([])
        .rpc();

      console.log("stake signature is ", tx);
    }catch(err){
      const errMsg = "You do not own up to this amount you are trying to withdraw";
      assert.equal((err as AnchorError).error.errorMessage, errMsg)
    }
    const userAccount = await program.account.user.fetch(user.publicKey);
    const userAmount = await provider.connection.getTokenAccountBalance(provider_mint_token_account.address);
    const pdaAmount = await provider.connection.getTokenAccountBalance(programTokenPDA);

    assert.equal(userAccount.stakeAccount.toString(), provider_mint_token_account.address.toString())
    assert.equal(userAmount.value.uiAmount, 3);
    assert.equal(pdaAmount.value.uiAmount, 6);

  })

  it ('user is able to unstake ', async() => {

    const [programPDA, programPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority'),
        mint.toBuffer(),
        x_mint.toBuffer(),
      ], program.programId
    )

    const [programTokenPDA, programTokenPDABump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode('program_authority_stake_account'),
        mint.toBuffer(),
        x_mint.toBuffer()
      ], program.programId
    );

    console.log("PDA BALANCE(Token)", await provider.connection.getBalance(programTokenPDA))
    console.log("is ", programTokenPDA.toString())
    console.log("PDA BALANCE", await provider.connection.getBalance(programPDA))
    console.log("is ", programPDA.toString())

    const amount_to_unstake = 5 * 10 ** 6;
    console.log(`unstaking ${amount_to_unstake} tokens `);
    
    try{
      const tx = await program.methods.unstake(new anchor.BN(programPDABump), new anchor.BN(programTokenPDABump), new anchor.BN(amount_to_unstake))
    .accounts(
      {
        owner: provider.wallet.publicKey,
        programAuthority: programPDA,
        programAuthorityStakeAccount: programTokenPDA,
        user: user.publicKey,
        mint: mint,
        xMint: x_mint,
        mintTokens: provider_mint_token_account.address,
        xMintTokens: provider_x_mint_token_account.address,
      
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .signers([])
      .rpc();
    }catch(err) {console.log("Error ", err)}

      const userAccount = await program.account.user.fetch(user.publicKey);
      const userAmount = await provider.connection.getTokenAccountBalance(provider_mint_token_account.address);
      const pdaAmount = await provider.connection.getTokenAccountBalance(programTokenPDA);
  
      assert.equal(userAccount.stakeAccount.toString(), provider_mint_token_account.address.toString())
      assert.equal(userAmount.value.uiAmount, 8);
      assert.equal(pdaAmount.value.uiAmount, 1);
  console.log('did you pass');
  })

  it ('user tries to predict some future event', async () => {
    console.log("'Let's first create user prediction account")
    const provider_predict_account = anchor.web3.Keypair.generate();
    let prediction_of_sol_usd_price_feed = 35;
    let odds = 1.5;
    let amount = 250.0;
    let  tx = await program.methods.createPredictAccount()
               .accounts(
                {
                  user: provider.wallet.publicKey,
                  predictInfo: provider_predict_account.publicKey,
                  systemProgram: SystemProgram.programId,
                })
                .signers([provider_predict_account])
                .rpc();

    let predictAccount = await program.account.predictInfo.fetch(provider_predict_account.publicKey);

    assert.equal(predictAccount.data.toNumber(), 0);
    assert.equal(predictAccount.owner.toString(), provider.wallet.publicKey.toString());
    assert.equal(predictAccount.odds, 0)
    assert.equal(predictAccount.amount, 0);
              
    console.log("let's read on chain data");

    tx = await program.methods.predict(new anchor.BN(prediction_of_sol_usd_price_feed), odds, amount)
          .accounts(
            {
              owner: provider.wallet.publicKey,
              predictInfo: provider_predict_account.publicKey,
              systemProgram: SystemProgram.programId
            }
          ).signers([]).rpc();
    predictAccount = await program.account.predictInfo.fetch(provider_predict_account.publicKey);

    assert.equal(predictAccount.data.toNumber(), prediction_of_sol_usd_price_feed);
    assert.equal(predictAccount.owner.toString(), provider.wallet.publicKey.toString());
    assert.equal(predictAccount.odds, odds)
    assert.equal(predictAccount.amount, amount);
       
  })



});
