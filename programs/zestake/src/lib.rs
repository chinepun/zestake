use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};


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

    pub fn stake(ctx: Context<Stake>, bump_amount: u8, amount: u64) -> Result<()>
    {

        let user = &mut ctx.accounts.user;
        if user.owner != ctx.accounts.owner.key()
        {
            // has_one constraint should do this check on initialisation so this is not necessary
            return Err(ErrorCode::WrongOwnerPassed.into());
        }
        if user.stake_account.key() != ctx.accounts.mint_tokens.key() || user.x_stake_account.key() != ctx.accounts.x_mint_tokens.key()
        {
            return Err(ErrorCode::AccountInvalid.into());
        }
        // TODO- not safe, can oveflow or underflow(.checked_add(amount as u8).unwrap)
        user.amount_staked += amount;
        user.last_staked_time = Clock::get()?.unix_timestamp;
// TODO - take this if statement upwards, user cannot be increasing stake even if user does not have enough tokens
        if ctx.accounts.mint_tokens.amount < amount
        {
            return Err(ErrorCode::TryingToWithdrawMoreThanYouOwn.into())
        }
msg!("user has {} tokens now", ctx.accounts.mint_tokens.amount);
        // Transfer tokens to pda vault
        {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.mint_tokens.to_account_info(),
                    to: ctx.accounts.program_authority_stake_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, amount);
            msg!("i think i just sent {} of {} tokens to pda {}", amount, ctx.accounts.mint_tokens.owner, ctx.accounts.program_authority_stake_account.key());
        }
        //mint x_mint_tokens on the frontend to the user x_stake_account
        
        
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
    user: Box<Account<'info, User>>,

    #[account(address = mint_address)]
    mint: Box<Account<'info, Mint>>,

    #[account(mut,
        constraint = stake_account.mint  == mint.key(),
        constraint = stake_account.owner == owner.key()
    )]
    stake_account: Box<Account<'info, TokenAccount>>,
        
    #[account(address = x_mint_address)]
    x_mint: Box<Account<'info, Mint>>,

    #[account(mut,
        constraint = x_stake_account.mint  == x_mint.key(),
        constraint = x_stake_account.owner == owner.key()
    )]
    x_stake_account: Box<Account<'info, TokenAccount>>,


    /// sysvars
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, 
    // pub rent: Sysvar<'info, Rent>,
    // pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
#[instruction(bump_amount: u8)]
pub struct Stake<'info>
{
    #[account(mut)]
    owner: Signer<'info>,

    /// CHECK
    #[account(mut,
    //    payer = owner,
    // TODO remember this is risky
      seeds = [b"program_authority", mint.key().as_ref(), x_mint.key().as_ref()], 
      bump = bump_amount,
    //   space = 100,
    )]
    program_authority: UncheckedAccount<'info>,
    
    /// CHECK
    #[account(init,
        payer = owner,     
      // TODO not safe to be using raw seeds
      seeds = [b"program_authority_stake_account", mint.key().as_ref(), x_mint.key().as_ref()],
      bump,
      token::mint = mint,
      token::authority = program_authority,
    )]
    program_authority_stake_account: Account<'info, TokenAccount>,

    #[account(mut, has_one = owner)]
    user: Box<Account<'info, User>>,

    mint: Box<Account<'info, Mint>>,
    x_mint: Box<Account<'info, Mint>>,

    #[account(mut, constraint = mint_tokens.mint == mint.key())]
    mint_tokens: Account<'info, TokenAccount>,
    #[account(mut, constraint = x_mint_tokens.mint == x_mint.key())]
    x_mint_tokens: Account<'info, TokenAccount>,

    /// sysvars
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>, 
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
    
}

#[account]
#[derive(Default)]
pub struct User 
{
    owner: Pubkey,
    amount_staked: u64,
    last_staked_time: i64,
    stake_account: Pubkey,
    x_stake_account: Pubkey,
}

#[error_code]
pub enum ErrorCode
{
    #[msg("InvalidAccountData, pass correct accounts")]
    AccountInvalid,
    #[msg("Wrong Owner Passed in, are you trying to hack your way in???")]
    WrongOwnerPassed,
    #[msg("You do not own up to this amount you are trying to withdraw")]
    TryingToWithdrawMoreThanYouOwn
}
