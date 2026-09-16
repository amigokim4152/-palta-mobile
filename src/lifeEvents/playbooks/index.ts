import { stolenVehicleRules } from './stolenVehicle.js';
import { lostPhoneRules } from './lostPhone.js';
import { lostKeysRules } from './lostKeys.js';

export const defaultLifeEventRules = [
  ...stolenVehicleRules,
  ...lostPhoneRules,
  ...lostKeysRules,
] as const;
