import { v4 as uuidv4 } from 'uuid';
import { CurriculumModel } from './curriculum.model';
import type { ICurriculum } from './curriculum.types';
import type { CreateCurriculumDto, UpdateCurriculumDto, CurriculumAdminQueryDto, CurriculumCatalogQueryDto } from './curriculum.validators';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/error';
import { CourseModel } from '../courses/course.model';
import { CourseStatus } from '../courses/course.types';
import { geoService } from '../geo/geo.service';
import { GRADE_LIST } from '../students/student.validators';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class CurriculumService {
  async create(adminUserPublicId: string, dto: CreateCurriculumDto): Promise<ICurriculum> {
    const created = await CurriculumModel.create({
      publicId: uuidv4(),
      ...locationFromDistrict(dto.districtId),
      grade: dto.grade,
      subject: dto.subject,
      title: dto.title,
      description: dto.description,
      topics: dto.topics.map((t, i) => ({
        publicId: t.publicId ?? uuidv4(),
        title: t.title,
        order: t.order ?? i,
      })),
      createdByAdminPublicId: adminUserPublicId,
      isPublished: false,
      isDeleted: false,
    });
    return created.toObject();
  }

  async update(curriculumPublicId: string, dto: UpdateCurriculumDto): Promise<ICurriculum> {
    const { districtId, ...rest } = dto;
    const setFields: Record<string, unknown> = { ...rest };
    if (districtId) Object.assign(setFields, locationFromDistrict(districtId));
    if (dto.topics) {
      const existing = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
      if (!existing) throw new NotFoundError('Curriculum');
      const merged = mergeTopics(existing.topics ?? [], dto.topics);

      const removed = (existing.topics ?? []).filter((t) => !merged.some((m) => m.publicId === t.publicId));
      if (removed.length > 0) {
        const inUse = await CourseModel.find({
          curriculumPublicId,
          status: { $in: [CourseStatus.PENDING, CourseStatus.ACCEPTED] },
          isDeleted: false,
          topicPublicIds: { $in: removed.map((t) => t.publicId) },
        }, { topicPublicIds: 1 }).lean();
        if (inUse.length > 0) {
          const used = new Set(inUse.flatMap((c) => c.topicPublicIds ?? []));
          const names = removed.filter((t) => used.has(t.publicId)).map((t) => `"${t.title}"`).join(', ');
          throw new ConflictError(
            `Cannot remove topic${names.includes(',') ? 's' : ''} ${names}: referenced by ${inUse.length} active course request${inUse.length === 1 ? '' : 's'}`,
          );
        }
      }
      setFields.topics = merged;
    }
    const updated = await CurriculumModel.findOneAndUpdate(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: setFields },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Curriculum');
    return updated;
  }

  async setPublished(curriculumPublicId: string, isPublished: boolean): Promise<ICurriculum> {
    const updated = await CurriculumModel.findOneAndUpdate(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: { isPublished } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Curriculum');
    return updated;
  }

  /** Soft delete. Refused while students hold PENDING or ACCEPTED (prepaid) requests —
   *  admins can unpublish instead. Finished requests keep resolving the curriculum title. */
  async softDelete(curriculumPublicId: string): Promise<void> {
    const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
    if (!curriculum) throw new NotFoundError('Curriculum');
    const active = await CourseModel.countDocuments({
      curriculumPublicId,
      status: { $in: [CourseStatus.PENDING, CourseStatus.ACCEPTED] },
      isDeleted: false,
    });
    if (active > 0) {
      throw new ConflictError(`Curriculum has ${active} active request${active === 1 ? '' : 's'} — unpublish it instead`);
    }
    await CurriculumModel.updateOne(
      { publicId: curriculumPublicId, isDeleted: false },
      { $set: { isDeleted: true, isPublished: false } },
    );
  }

  async getByPublicId(curriculumPublicId: string): Promise<ICurriculum> {
    const curriculum = await CurriculumModel.findOne({ publicId: curriculumPublicId, isDeleted: false }).lean();
    if (!curriculum) throw new NotFoundError('Curriculum');
    return curriculum;
  }

  /** Student-facing catalog: published curricula in one district. With `grade` it's the
   *  "My grade" view; without, "All grades", ordered by grade then title. */
  async listCatalog(filters: CurriculumCatalogQueryDto): Promise<ICurriculum[]> {
    const filter: Record<string, unknown> = { districtId: filters.districtId, isPublished: true, isDeleted: false };
    if (filters.grade) filter.grade = filters.grade;
    if (filters.subject) filter.subject = filters.subject;
    const curricula = await CurriculumModel.find(filter).sort({ title: 1 }).limit(500).lean();
    return curricula.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.title.localeCompare(b.title));
  }

  /** Admin-facing listing: any county/grade/subject/published state. */
  async listForAdmin(query: CurriculumAdminQueryDto): Promise<PaginatedResult<ICurriculum>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.state) filter.state = query.state;
    if (query.countyFips) filter.countyFips = query.countyFips;
    if (query.districtId) filter.districtId = query.districtId;
    if (query.grade) filter.grade = query.grade;
    if (query.subject) filter.subject = query.subject;
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished === 'true';

    const [items, total] = await Promise.all([
      CurriculumModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CurriculumModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

/** Keeps existing topic publicIds when the client omits them: an id-less input takes the id of
 *  the existing topic at the same position if titles match, else the first unclaimed existing
 *  topic with the same title. Truly new topics get a fresh id. */
export function mergeTopics(
  existing: Array<{ publicId: string; title: string; order?: number }>,
  input: Array<{ publicId?: string; title: string; order?: number }>,
): Array<{ publicId: string; title: string; order: number }> {
  const claimed = new Set(input.map((t) => t.publicId).filter((id): id is string => !!id));
  const sorted = [...existing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return input.map((t, i) => {
    let publicId = t.publicId;
    if (!publicId) {
      const atPos = sorted[i];
      const match = atPos && !claimed.has(atPos.publicId) && atPos.title === t.title
        ? atPos
        : sorted.find((e) => !claimed.has(e.publicId) && e.title === t.title);
      if (match) { publicId = match.publicId; claimed.add(publicId); }
    }
    return { publicId: publicId ?? uuidv4(), title: t.title, order: t.order ?? i };
  });
}

/** Validators already reject unknown districts; this guards direct service callers. */
function locationFromDistrict(districtId: string) {
  const district = geoService.getDistrict(districtId);
  if (!district) throw new ValidationError({ districtId: [`Unknown school district ${districtId}`] });
  return {
    country: 'US',
    state: district.state,
    countyFips: district.countyFips,
    // The district builder only keeps districts whose county is in the gazetteer.
    county: geoService.getCounty(district.countyFips)?.name ?? district.countyFips,
    districtId: district.id,
    district: district.name,
  };
}

const GRADE_RANK = new Map<string, number>(GRADE_LIST.map((g, i) => [g, i]));
/** Unknown grade strings sort after every known grade. */
function gradeRank(grade: string): number {
  return GRADE_RANK.get(grade) ?? GRADE_LIST.length;
}

export const curriculumService = new CurriculumService();
