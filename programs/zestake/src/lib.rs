use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Cftyb3MtY2iTtb5JWrt2JtMbek1Gtwt4wUr8DZbLaVzB");

#[program]
pub mod zestake {
    use super::*;

    pub fn create_user(ctx: Context<CreateUser>, mint_address: Pubkey, x_mint_address: Pubkey) -> Result<()>
    {
        let user = &mut ctx.accounts.user;

        user.owner = ctx.accounts.owner.key();
        user.amount_staked = 0;
        user.last_staked_time = 0;

        user.stake_account = ctx.accounts.stake_account.key();
        user.x_stake_account = ctx.accounts.x_stake_account.key();
        msg!("user created at address {} for pubkey {}", user.key(), ctx.accounts.owner.key());

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
    mint: Account<'info, Mint>,

    #[account(mut,
        constraint = stake_account.mint  == mint.key(),
        constraint = stake_account.owner == owner.key()
    )]
    stake_account: Account<'info, TokenAccount>,
        
    #[account(address = x_mint_address)]
    x_mint: Account<'info, Mint>,

    #[account(mut,
        constraint = x_stake_account.mint  == x_mint.key(),
        constraint = x_stake_account.owner == owner.key()
    )]
    x_stake_account: Account<'info, TokenAccount>,


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