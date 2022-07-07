use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("4cS8pM5n6gSndA4PdpixesVHTmRPyd7TnYC81oEjSfEB");

#[program]
pub mod zestake {
    use super::*;

    pub fn create_user(ctx: Context<CreateUser>, mint_address: Pubkey, x_mint_address: Pubkey) -> Result<()>
    {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(mint_address: Pubkey, x_mint_address: Pubkey)]
pub struct CreateUser<'info>
{
    #[account(mut)]
    owner: Signer<'info>,

    #[account(init, 
      payer = owner,
      space = 8 + 32 + 8 + 16 + 32 + 32,
    )]
    user: Account<'info, User>,

    #[account(address = mint_address)]
    x_mint: Account<'info, Mint>,

    #[account(mut,
        constraint = stake_account.mint == x_mint.key(),
        constraint = stake_account.owner == owner.key()
    )]
    stake_account: Account<'info, TokenAccount>,
        
    /// sysvars
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, 
}

#[account]
#[derive(Default)]
pub struct User 
{
    owner: Pubkey,
    amount_staked: u64,
    last_staked_time: u128,
    stake_account: Pubkey,
    x_stake_account: Pubkey,
}