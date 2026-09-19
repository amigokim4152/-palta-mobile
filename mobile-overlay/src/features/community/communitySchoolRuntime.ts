import { mobileRuntime } from '../../services/paltaClient';
import { useCommunityPreview } from './communityRuntimePolicy';
import type {
  CommunityApiSchoolItem,
  CreateCommunitySchoolItemInput,
} from '../../../../src/api/paltaApiClient';
import type { SchoolStructuredItem } from '../../../../src/community/communityExperience';

export interface CommunitySchoolRuntime {
  loadItems(spaceId: string): Promise<SchoolStructuredItem[]>;
  createItem(spaceId: string, input: CreateCommunitySchoolItemInput): Promise<void>;
}


function client() {
  if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
  return mobileRuntime.client;
}

function toSchoolItem(item: CommunityApiSchoolItem): SchoolStructuredItem {
  return {
    id: item.id,
    postId: item.postId,
    stage: item.stage,
    title: item.title,
    detail: item.detail,
    status: item.status,
    actionRequired: item.actionRequired,
    sensitive: item.sensitive,
    ...(item.dueAt ? { dueAt: item.dueAt } : {}),
  };
}

export const communitySchoolRuntime: CommunitySchoolRuntime = {
  async loadItems(spaceId) {
    if (useCommunityPreview()) return [];
    return (await client().getCommunitySchoolItems(spaceId)).map(toSchoolItem);
  },
  async createItem(spaceId, input) {
    if (useCommunityPreview()) return;
    await client().createCommunitySchoolItem(spaceId, input);
  },
};
