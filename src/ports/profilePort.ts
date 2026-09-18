import type {
  CoreProfile,
  LifeAreaRef,
  VisibleProfile,
} from '../profile/profileModel.js';

export type CoreProfilePatch = Partial<
  Pick<
    CoreProfile,
    | 'preferredName'
    | 'profilePhotoRef'
    | 'preferredLanguage'
    | 'countryCode'
    | 'timezone'
  >
>;

export interface ProfilePort {
  getCoreProfile(): Promise<CoreProfile | null>;
  updateCoreProfile(patch: CoreProfilePatch): Promise<CoreProfile>;
  listLifeAreas(): Promise<LifeAreaRef[]>;
  upsertLifeArea(area: LifeAreaRef): Promise<LifeAreaRef>;
  getVisibleProfile(scopeId: string): Promise<VisibleProfile | null>;
  updateVisibleProfile(profile: VisibleProfile): Promise<VisibleProfile>;
}
