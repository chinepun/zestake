import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Zestake } from "../target/types/zestake";

describe("zestake", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Zestake as Program<Zestake>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
