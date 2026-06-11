export enum UserTier {
  FREE = 'free',
  PRO = 'pro',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

export interface TierLimits {
  tier: UserTier;
  maxFilesPerSession: number;
  maxFileSizeMb: number;
  batchProcessing: boolean;
  profiles: boolean;
  fakeDataInjection: boolean;
}
