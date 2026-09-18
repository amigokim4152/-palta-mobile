export type BusinessCapability =
  | "call"
  | "whatsapp"
  | "save"
  | "quote"
  | "reservation"
  | "queue"
  | "inquiry";

export type BusinessVerificationStatus =
  | "unverified"
  | "claimed"
  | "verified"
  | "suspended";

export function canPublishControlledOffer(
  status: BusinessVerificationStatus,
): boolean {
  return status === "verified";
}
