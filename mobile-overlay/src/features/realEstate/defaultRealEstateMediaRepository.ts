import type { RealEstateMediaRepository } from '../../../../src/realEstate/realEstateMedia';
import { mobileRuntime } from '../../services/paltaClient';
import { ApiRealEstateMediaRepository } from './apiRealEstateMediaRepository';
import { defaultRealEstateDataSource } from './defaultRealEstateListingRepository';
import { demoRealEstateMediaRepository } from './demoRealEstateMediaRepository';

export const defaultRealEstateMediaRepository: RealEstateMediaRepository =
  defaultRealEstateDataSource === 'api' && mobileRuntime.status === 'ready'
    ? new ApiRealEstateMediaRepository(mobileRuntime.client)
    : demoRealEstateMediaRepository;
