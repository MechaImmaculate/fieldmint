use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("FFPqgWfSXD16jCwqppxFCi8G8BmEsU6p7kPZaAGs6Rcq");

const MAX_FEE_BPS: u16 = 2_000;

#[program]
pub mod escrow {
    use super::*;

    /// Creates the campaign escrow and locks the full budget (rewards + fees) in it.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: [u8; 16],
        reward_lamports: u64,
        max_payouts: u32,
        fee_bps: u16,
        deadline: i64,
        reviewer: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        require!(reward_lamports > 0 && max_payouts > 0, EscrowError::InvalidAmount);
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        require!(deadline > Clock::get()?.unix_timestamp, EscrowError::DeadlineInPast);

        let fee = fee_for(reward_lamports, fee_bps)?;
        let total = reward_lamports
            .checked_add(fee)
            .and_then(|per| per.checked_mul(max_payouts as u64))
            .ok_or(EscrowError::MathOverflow)?;

        {
            let c = &mut ctx.accounts.campaign;
            c.owner = ctx.accounts.owner.key();
            c.reviewer = reviewer;
            c.treasury = treasury;
            c.campaign_id = campaign_id;
            c.reward_lamports = reward_lamports;
            c.fee_bps = fee_bps;
            c.max_payouts = max_payouts;
            c.paid_count = 0;
            c.deadline = deadline;
            c.bump = ctx.bumps.campaign;
        }

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.campaign.to_account_info(),
                },
            ),
            total,
        )
    }

    /// Reviewer approves one submission: pays the contributor and the treasury fee,
    /// and writes a permanent receipt (which also blocks paying the same submission twice).
    pub fn payout(ctx: Context<ReleasePayout>, submission_hash: [u8; 32]) -> Result<()> {
        let reward = ctx.accounts.campaign.reward_lamports;
        let fee = fee_for(reward, ctx.accounts.campaign.fee_bps)?;
        let total = reward.checked_add(fee).ok_or(EscrowError::MathOverflow)?;
        require!(
            ctx.accounts.campaign.paid_count < ctx.accounts.campaign.max_payouts,
            EscrowError::BudgetExhausted
        );

        let campaign_info = ctx.accounts.campaign.to_account_info();
        let rent_min = Rent::get()?.minimum_balance(campaign_info.data_len());
        let remaining = campaign_info
            .lamports()
            .checked_sub(total)
            .ok_or(EscrowError::InsufficientFunds)?;
        require!(remaining >= rent_min, EscrowError::InsufficientFunds);

        **campaign_info.try_borrow_mut_lamports()? -= total;
        **ctx.accounts.contributor.to_account_info().try_borrow_mut_lamports()? += reward;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;

        ctx.accounts.campaign.paid_count += 1;

        let receipt = &mut ctx.accounts.receipt;
        receipt.campaign = ctx.accounts.campaign.key();
        receipt.contributor = ctx.accounts.contributor.key();
        receipt.submission_hash = submission_hash;
        receipt.amount = reward;
        receipt.paid_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;
        Ok(())
    }

    /// Owner reclaims whatever is left, only after the deadline or when everything is paid.
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        let c = &ctx.accounts.campaign;
        let now = Clock::get()?.unix_timestamp;
        require!(now >= c.deadline || c.paid_count == c.max_payouts, EscrowError::StillLocked);
        Ok(())
    }
}

fn fee_for(reward: u64, fee_bps: u16) -> Result<u64> {
    let fee = (reward as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(EscrowError::MathOverflow)?
        / 10_000u128;
    u64::try_from(fee).map_err(|_| error!(EscrowError::MathOverflow))
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub owner: Pubkey,
    pub reviewer: Pubkey,
    pub treasury: Pubkey,
    pub campaign_id: [u8; 16],
    pub reward_lamports: u64,
    pub fee_bps: u16,
    pub max_payouts: u32,
    pub paid_count: u32,
    pub deadline: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub campaign: Pubkey,
    pub contributor: Pubkey,
    pub submission_hash: [u8; 32],
    pub amount: u64,
    pub paid_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 16])]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", owner.key().as_ref(), campaign_id.as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(submission_hash: [u8; 32])]
pub struct ReleasePayout<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,
    #[account(
        mut,
        has_one = reviewer @ EscrowError::Unauthorized,
        seeds = [b"campaign", campaign.owner.as_ref(), campaign.campaign_id.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub contributor: SystemAccount<'info>,
    #[account(mut, address = campaign.treasury @ EscrowError::WrongTreasury)]
    pub treasury: SystemAccount<'info>,
    #[account(
        init,
        payer = reviewer,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", campaign.key().as_ref(), submission_hash.as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner,
        close = owner,
        seeds = [b"campaign", campaign.owner.as_ref(), campaign.campaign_id.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
}

#[error_code]
pub enum EscrowError {
    #[msg("Reward and payout count must be greater than zero")]
    InvalidAmount,
    #[msg("Fee is above the allowed maximum")]
    FeeTooHigh,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("All payouts for this campaign have been made")]
    BudgetExhausted,
    #[msg("Escrow does not hold enough funds")]
    InsufficientFunds,
    #[msg("Funds are locked until the deadline or until every payout is made")]
    StillLocked,
    #[msg("Only the campaign reviewer can release payments")]
    Unauthorized,
    #[msg("Treasury account does not match the campaign")]
    WrongTreasury,
}