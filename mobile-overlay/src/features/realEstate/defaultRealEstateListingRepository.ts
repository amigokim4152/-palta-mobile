import type { RealEstateListingRepository } from '../../../../src/realEstate/realEstateRepository';
import { mobileRuntime } from '../../services/paltaClient';
import { ApiRealEstateListingRepository } from './apiRealEstateListingRepository';
import { demoRealEstateListingRepository } from './demoRealEstateListingRepository';

export type RealEstateDataSource = 'demo' | 'api';

const apiEnabled = process.env.EXPO_PUBLIC_REAL_ESTATE_API_ENABLED === '1';

export const defaultRealEstateDataSource: RealEstateDataSource =
  apiEnabled && mobileRuntime.status === 'ready' ? 'api' : 'demo';

export const defaultRealEstateListingRepository: RealEstateListingRepository =
  defaultRealEstateDataSource === 'api' && mobileRuntime.status === 'ready'
    ? new ApiRealEstateListingRepository(mobileRuntime.client)
    : demoRealEstateListingRepository;
