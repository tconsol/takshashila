import { v4 as uuidv4 } from 'uuid';
import { walletService } from './wallet.service';
import { CreditType } from './wallet.types';
import type { IWalletTransaction } from './wallet.types';
import { userRepository } from '../users/user.repository';
import { auditService } from '../audit/audit.service';
import { NotFoundError, ValidationError } from '../../utils/error';
import { Role } from '../../constants/roles';

/**
 * Manual wallet adjustments from the admin console — granting a goodwill
 * credit, correcting a support-ticket dispute, or clawing back an over-grant.
 * Everything here is super-admin only: this moves real money-equivalent
 * balance without a class or payment behind it, so it is the one wallet path
 * with no natural transaction to point an audit reader at except "an admin
 * decided to."
 */

/** Grants above this in one action need a paper trail beyond a text reason —
 *  caught here rather than silently allowed. */
const MAX_GRANT_CENTS = 100_000_00; // $100,000

const invalid = (msg: string) => new ValidationError([msg], msg);

export interface WalletAdjustActor {
  publicId: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export interface GrantCreditsDto {
  amountCents: number;
  creditType: CreditType;
  reason: string;
}

export interface DeductCreditsDto {
  amountCents: number;
  reason: string;
}

const GRANTABLE_ROLES = [Role.STUDENT, Role.TUTOR, Role.PRINCIPAL] as const;

export class WalletAdminService {
  private async assertGrantableTarget(targetPublicId: string) {
    const target = await userRepository.findByPublicId(targetPublicId);
    if (!target) throw new NotFoundError('User');
    if (!GRANTABLE_ROLES.includes(target.role as (typeof GRANTABLE_ROLES)[number])) {
      throw invalid(`Cannot adjust credits for a ${target.role.replace('_', ' ').toLowerCase()} account`);
    }
    return target;
  }

  async grant(
    targetPublicId: string,
    dto: GrantCreditsDto,
    actor: WalletAdjustActor,
  ): Promise<IWalletTransaction> {
    const target = await this.assertGrantableTarget(targetPublicId);

    const amountCents = Math.round(Number(dto.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw invalid('Amount must be a positive number');
    }
    if (amountCents > MAX_GRANT_CENTS) {
      throw invalid(`Single grants are capped at $${(MAX_GRANT_CENTS / 100).toLocaleString()}`);
    }
    if (!Object.values(CreditType).includes(dto.creditType)) {
      throw invalid(`Unknown credit type "${dto.creditType}"`);
    }
    const reason = dto.reason?.trim();
    if (!reason) throw invalid('A reason is required for a manual credit grant');

    const transaction = await walletService.creditWallet({
      ownerPublicId: targetPublicId,
      amountCents,
      creditType: dto.creditType,
      description: `Admin grant: ${reason}`,
      // One-shot key: a retried click with the same idempotencyKey would just
      // return the first transaction rather than double-crediting, but each
      // *distinct* grant must still get its own key.
      idempotencyKey: `admin-grant-${targetPublicId}-${uuidv4()}`,
      referenceType: 'ADMIN_GRANT',
      metadata: { grantedBy: actor.publicId, reason },
    });

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'WALLET_CREDIT_GRANTED',
      resourceType: 'Wallet',
      resourceId: targetPublicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: {
        targetName: `${target.firstName} ${target.lastName}`,
        targetRole: target.role,
        amountCents,
        creditType: dto.creditType,
        reason,
        transactionPublicId: transaction.publicId,
      },
    });

    return transaction;
  }

  /** Claws back a grant made in error. Never touches earned/payout-eligible funds by default. */
  async deduct(
    targetPublicId: string,
    dto: DeductCreditsDto,
    actor: WalletAdjustActor,
  ): Promise<IWalletTransaction> {
    const target = await this.assertGrantableTarget(targetPublicId);

    const amountCents = Math.round(Number(dto.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw invalid('Amount must be a positive number');
    }
    const reason = dto.reason?.trim();
    if (!reason) throw invalid('A reason is required for a manual credit deduction');

    const transaction = await walletService.debitWallet({
      ownerPublicId: targetPublicId,
      amountCents,
      description: `Admin adjustment: ${reason}`,
      idempotencyKey: `admin-deduct-${targetPublicId}-${uuidv4()}`,
      referenceType: 'ADMIN_ADJUSTMENT',
      metadata: { adjustedBy: actor.publicId, reason },
    });

    await auditService.log({
      actorId: actor.publicId,
      actorRole: actor.role,
      action: 'WALLET_CREDIT_DEDUCTED',
      resourceType: 'Wallet',
      resourceId: targetPublicId,
      ip: actor.ip,
      userAgent: actor.userAgent,
      after: {
        targetName: `${target.firstName} ${target.lastName}`,
        targetRole: target.role,
        amountCents,
        reason,
        transactionPublicId: transaction.publicId,
      },
    });

    return transaction;
  }
}

export const walletAdminService = new WalletAdminService();
