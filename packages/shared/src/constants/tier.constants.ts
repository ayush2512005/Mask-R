import { UserTier, type TierLimits } from '../types/tier.types.js';

export const FREE_TIER_SESSION_LIMIT = 5;

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  [UserTier.FREE]: {
    tier: UserTier.FREE,
    maxFilesPerSession: FREE_TIER_SESSION_LIMIT,
    maxFileSizeMb: 50,
    batchProcessing: false,
    profiles: false,
    fakeDataInjection: false,
  },
  [UserTier.PRO]: {
    tier: UserTier.PRO,
    maxFilesPerSession: Infinity,
    maxFileSizeMb: 500,
    batchProcessing: true,
    profiles: true,
    fakeDataInjection: true,
  },
  [UserTier.TEAM]: {
    tier: UserTier.TEAM,
    maxFilesPerSession: Infinity,
    maxFileSizeMb: 500,
    batchProcessing: true,
    profiles: true,
    fakeDataInjection: true,
  },
  [UserTier.ENTERPRISE]: {
    tier: UserTier.ENTERPRISE,
    maxFilesPerSession: Infinity,
    maxFileSizeMb: 500,
    batchProcessing: true,
    profiles: true,
    fakeDataInjection: true,
  },
};
