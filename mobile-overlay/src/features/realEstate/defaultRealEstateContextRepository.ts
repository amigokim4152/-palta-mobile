import type { RealEstateContextRepository } from '../../../../src/realEstate/realEstateContext';
import { mobileRuntime } from '../../services/paltaClient';
import { ApiRealEstateContextRepository } from './apiRealEstateContextRepository';
import { defaultRealEstateDataSource } from './defaultRealEstateListingRepository';
import { demoRealEstateContextRepository } from './demoRealEstateContextRepository';

export const defaultRealEstateContextRepository: RealEstateContextRepository =
  defaultRealEstateDataSource === 'api' && mobileRuntime.status === 'ready'
    ? new ApiRealEstateContextRepository(mobileRuntime.client)
    : demoRealEstateContextRepository;
