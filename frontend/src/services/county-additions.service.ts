// frontend/src/services/county-additions.service.ts
import { api } from '../lib/axios';

/** An extra program a county offers on top of the state curriculum. Information only. */
export interface CountyAddition {
  publicId: string;
  stateCode: string;
  county: string; // display name
  countyFips?: string; // missing until the record is linked to a county
  district: string;
  gradeFrom: number; // 0 = Kindergarten
  gradeTo: number;
  category: string;
  subjectName?: string;
  description: string;
  topics: string[];
  isPublished: boolean;
}

export interface CountyAdditionInput {
  countyFips: string;
  district?: string;
  gradeFrom: number;
  gradeTo: number;
  category: string;
  subjectName?: string;
  description?: string;
  topics?: string[];
}

export const gradeLabel = (n: number) => (n === 0 ? 'Kindergarten' : `Grade ${n}`);
export const gradeRangeLabel = (from: number, to: number) =>
  from === 0 && to === 12 ? 'All grades' : from === to ? gradeLabel(from) : `${gradeLabel(from)}–${to === 0 ? 'K' : to}`;

export const countyAdditionsService = {
  /** Published add-ons of one county, optionally for one grade (students and parents). */
  forCounty: (params: { stateCode: string; countyFips: string; grade?: string }): Promise<CountyAddition[]> =>
    api.get('/county-additions', { params }).then((r) => r.data.data),

  listForAdmin: (stateCode: string): Promise<CountyAddition[]> =>
    api.get('/county-additions/admin', { params: { stateCode } }).then((r) => r.data.data),

  create: (dto: CountyAdditionInput & { stateCode: string }): Promise<CountyAddition> =>
    api.post('/county-additions', dto).then((r) => r.data.data),

  update: (publicId: string, dto: Partial<CountyAdditionInput>): Promise<CountyAddition> =>
    api.put(`/county-additions/${publicId}`, dto).then((r) => r.data.data),

  /** Publishes every draft of the state (or one county) that is linked to a county. */
  publishAll: (params: { stateCode: string; countyFips?: string }): Promise<{ published: number; skippedUnlinked: number }> =>
    api.post('/county-additions/publish-all', params).then((r) => r.data.data),

  publish: (publicId: string): Promise<CountyAddition> => api.post(`/county-additions/${publicId}/publish`).then((r) => r.data.data),
  unpublish: (publicId: string): Promise<CountyAddition> => api.post(`/county-additions/${publicId}/unpublish`).then((r) => r.data.data),
  remove: (publicId: string): Promise<void> => api.delete(`/county-additions/${publicId}`).then(() => undefined),
};
