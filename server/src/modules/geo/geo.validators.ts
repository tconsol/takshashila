import { z } from 'zod';
import { US_STATE_CODES } from './us-states';
import { geoService } from './geo.service';

/** Location fields shared by Curriculum and Student profile. The county NAME is never
 *  accepted from clients — services derive it from `countyFips`. */
export const locationShape = {
  country: z.literal('US').default('US'),
  state: z.enum(US_STATE_CODES),
  countyFips: z.string().regex(/^\d{5}$/, 'County FIPS must be 5 digits'),
};

/** state and countyFips must travel together and the county must belong to the state.
 *  Works for both full and `.partial()` schemas. */
export function refineLocation(
  data: { state?: string; countyFips?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.state === undefined && data.countyFips === undefined) return;
  if (data.state === undefined || data.countyFips === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [data.state === undefined ? 'state' : 'countyFips'],
      message: 'state and countyFips must be provided together',
    });
    return;
  }
  const county = geoService.getCounty(data.countyFips);
  if (!county || county.state !== data.state) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['countyFips'],
      message: `County ${data.countyFips} is not in state ${data.state}`,
    });
  }
}

export const curriculumLocationSchema = z.object(locationShape).superRefine(refineLocation);
export const partialLocationSchema = z.object(locationShape).partial().superRefine(refineLocation);

/** NCES LEAID of a district in us-districts.json. Services derive every other
 *  location field from it. */
export const districtIdSchema = z
  .string()
  .regex(/^\d{7}$/, 'District id must be 7 digits')
  .refine((id) => !!geoService.getDistrict(id), { message: 'Unknown school district' });
