export type VerifiedUserIdentity = {
  userId: string;
};

export function assertVerifiedUserIdentity(
  identity: VerifiedUserIdentity,
): void {
  if (!identity.userId.trim()) {
    throw new Error('Verified user identity must contain a userId.');
  }
}
