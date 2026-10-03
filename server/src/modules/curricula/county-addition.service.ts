import { v4 as uuidv4 } from 'uuid';
import { CountyAdditionModel, type ICountyAddition } from './county-addition.model';
import { geoService } from '../geo/geo.service';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/error';

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

/** 'Kindergarten' is 0, 'Grade 5' is 5. 'High School' is the band 9-12. Anything else: no grade filter. */
export function gradeBand(grade?: string): { from: number; to: number } | undefined {
  if (!grade) return undefined;
  if (grade === 'Kindergarten') return { from: 0, to: 0 };
  if (grade === 'High School') return { from: 9, to: 12 };
  const m = /^Grade (\d{1,2})$/.exec(grade);
  return m ? { from: Number(m[1]), to: Number(m[1]) } : undefined;
}

const clean = (topics?: string[]) => (topics ?? []).map((t) => t.trim()).filter(Boolean);

export class CountyAdditionService {
  /** Everything for one state, including drafts and records not linked to a county yet (admin). */
  async listAdmin(stateCode: string): Promise<ICountyAddition[]> {
    const items = await CountyAdditionModel.find({ stateCode, isDeleted: false }).lean();
    return items.sort((a, b) => a.county.localeCompare(b.county) || a.gradeFrom - b.gradeFrom || a.category.localeCompare(b.category));
  }

  /** Published add-ons for one county, optionally for a grade (students and parents). */
  async listForCounty(filters: { stateCode: string; countyFips: string; grade?: string }): Promise<ICountyAddition[]> {
    const filter: Record<string, unknown> = { stateCode: filters.stateCode, countyFips: filters.countyFips, isPublished: true, isDeleted: false };
    const band = gradeBand(filters.grade);
    if (band) Object.assign(filter, { gradeFrom: { $lte: band.to }, gradeTo: { $gte: band.from } });
    const items = await CountyAdditionModel.find(filter).lean();
    return items.sort((a, b) => a.gradeFrom - b.gradeFrom || a.category.localeCompare(b.category));
  }

  private countyFields(stateCode: string | undefined, countyFips: string) {
    const county = geoService.getCounty(countyFips);
    if (!county || (stateCode && county.state !== stateCode)) {
      throw new ValidationError({ countyFips: ['Pick a county in this state'] });
    }
    return { stateCode: county.state, countyFips: county.fips, county: county.name };
  }

  async create(dto: CountyAdditionInput & { stateCode: string }): Promise<ICountyAddition> {
    try {
      const created = await CountyAdditionModel.create({
        publicId: uuidv4(),
        ...this.countyFields(dto.stateCode, dto.countyFips),
        district: dto.district?.trim() ?? '',
        gradeFrom: dto.gradeFrom,
        gradeTo: dto.gradeTo,
        category: dto.category.trim(),
        subjectName: dto.subjectName?.trim() || undefined,
        description: dto.description?.trim() ?? '',
        topics: clean(dto.topics),
        isPublished: false,
        isDeleted: false,
      });
      return created.toObject();
    } catch (err) {
      throw this.translate(err);
    }
  }

  async update(publicId: string, dto: Partial<CountyAdditionInput>): Promise<ICountyAddition> {
    const existing = await CountyAdditionModel.findOne({ publicId, isDeleted: false });
    if (!existing) throw new NotFoundError('County add-on');
    if (dto.countyFips) Object.assign(existing, this.countyFields(existing.stateCode, dto.countyFips));
    if (dto.district !== undefined) existing.district = dto.district.trim();
    if (dto.gradeFrom !== undefined) existing.gradeFrom = dto.gradeFrom;
    if (dto.gradeTo !== undefined) existing.gradeTo = dto.gradeTo;
    if (dto.category !== undefined) existing.category = dto.category.trim();
    if (dto.subjectName !== undefined) existing.subjectName = dto.subjectName.trim() || undefined;
    if (dto.description !== undefined) existing.description = dto.description.trim();
    if (dto.topics !== undefined) existing.topics = clean(dto.topics);
    try {
      await existing.save();
    } catch (err) {
      throw this.translate(err);
    }
    return existing.toObject();
  }

  async setPublished(publicId: string, isPublished: boolean): Promise<ICountyAddition> {
    const existing = await CountyAdditionModel.findOne({ publicId, isDeleted: false });
    if (!existing) throw new NotFoundError('County add-on');
    // An add-on that is not linked to a county could never be shown to anyone.
    if (isPublished && !existing.countyFips) throw new AppError('Pick the county before publishing', 400);
    existing.isPublished = isPublished;
    await existing.save();
    return existing.toObject();
  }

  /** Publishes every draft of a state (or one county) that is linked to a county. Unlinked drafts are left alone. */
  async publishAllDrafts(filters: { stateCode: string; countyFips?: string }): Promise<{ published: number; skippedUnlinked: number }> {
    const base = { stateCode: filters.stateCode, isPublished: false, isDeleted: false };
    const linked = { ...base, countyFips: filters.countyFips ?? { $exists: true, $nin: [null, ''] } };
    const res = await CountyAdditionModel.updateMany(linked, { $set: { isPublished: true } });
    const skippedUnlinked = filters.countyFips
      ? 0
      : await CountyAdditionModel.countDocuments({ ...base, $or: [{ countyFips: { $exists: false } }, { countyFips: null }, { countyFips: '' }] });
    return { published: res.modifiedCount, skippedUnlinked };
  }

  async remove(publicId: string): Promise<void> {
    const res = await CountyAdditionModel.updateOne({ publicId, isDeleted: false }, { $set: { isDeleted: true, isPublished: false } });
    if (res.matchedCount === 0) throw new NotFoundError('County add-on');
  }

  private translate(err: unknown): unknown {
    const e = err as { code?: number; errors?: Record<string, { message: string }> };
    if (e?.code === 11000) return new ConflictError('This county already has an add-on with the same category and grades');
    if (e?.errors?.gradeTo) return new ValidationError({ gradeTo: [e.errors.gradeTo.message] });
    return err;
  }
}

export const countyAdditionService = new CountyAdditionService();
