import { v4 as uuidv4 } from 'uuid';
import { CourseModel } from './course.model';
import type { ICourse } from './course.types';
import type { CreateCourseDto, UpdateCourseDto, CourseCatalogQueryDto } from './course.validators';
import { NotFoundError, ValidationError } from '../../utils/error';
import { geoService } from '../geo/geo.service';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class CourseService {
  async create(adminUserPublicId: string, dto: CreateCourseDto): Promise<ICourse> {
    const created = await CourseModel.create({
      publicId: uuidv4(),
      country: dto.country,
      state: dto.state,
      countyFips: dto.countyFips,
      county: countyName(dto.countyFips),
      grade: dto.grade,
      subject: dto.subject,
      title: dto.title,
      description: dto.description,
      topics: dto.topics.map((t, i) => ({
        publicId: t.publicId ?? uuidv4(),
        title: t.title,
        order: t.order ?? i,
        resourceIds: t.resourceIds,
        assignmentIds: t.assignmentIds,
        worksheetIds: t.worksheetIds,
      })),
      createdByAdminPublicId: adminUserPublicId,
      isPublished: false,
      isDeleted: false,
    });
    return created.toObject();
  }

  async update(coursePublicId: string, dto: UpdateCourseDto): Promise<ICourse> {
    const setFields: Record<string, unknown> = { ...dto };
    if (dto.countyFips) setFields.county = countyName(dto.countyFips);
    if (dto.topics) {
      setFields.topics = dto.topics.map((t, i) => ({
        publicId: t.publicId ?? uuidv4(),
        title: t.title,
        order: t.order ?? i,
        resourceIds: t.resourceIds,
        assignmentIds: t.assignmentIds,
        worksheetIds: t.worksheetIds,
      }));
    }
    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, isDeleted: false },
      { $set: setFields },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Course');
    return updated;
  }

  async setPublished(coursePublicId: string, isPublished: boolean): Promise<ICourse> {
    const updated = await CourseModel.findOneAndUpdate(
      { publicId: coursePublicId, isDeleted: false },
      { $set: { isPublished } },
      { new: true },
    ).lean();
    if (!updated) throw new NotFoundError('Course');
    return updated;
  }

  async getByPublicId(coursePublicId: string): Promise<ICourse> {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    return course;
  }

  /** Student-facing catalog: only published courses, always scoped by countyFips+grade.
   *  Matching on FIPS (not county name) because names repeat across states. */
  async listCatalog(filters: { countyFips?: string; grade?: string; subject?: string }): Promise<ICourse[]> {
    const filter: Record<string, unknown> = { isPublished: true, isDeleted: false };
    if (filters.countyFips) filter.countyFips = filters.countyFips;
    if (filters.grade) filter.grade = filters.grade;
    if (filters.subject) filter.subject = filters.subject;
    return CourseModel.find(filter).sort({ title: 1 }).skip(0).limit(100).lean();
  }

  /** Admin-facing listing: any county/grade/subject/published state. */
  async listForAdmin(query: CourseCatalogQueryDto): Promise<PaginatedResult<ICourse>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.state) filter.state = query.state;
    if (query.countyFips) filter.countyFips = query.countyFips;
    if (query.grade) filter.grade = query.grade;
    if (query.subject) filter.subject = query.subject;
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished === 'true';

    const [items, total] = await Promise.all([
      CourseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CourseModel.countDocuments(filter),
    ]);
    return buildPaginatedResult(items, total, page, limit);
  }
}

/** Validators already reject unknown FIPS codes; this guards direct service callers. */
function countyName(countyFips: string): string {
  const county = geoService.getCounty(countyFips);
  if (!county) throw new ValidationError({ countyFips: [`Unknown county ${countyFips}`] });
  return county.name;
}

export const courseService = new CourseService();
