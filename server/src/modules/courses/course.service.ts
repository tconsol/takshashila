import { v4 as uuidv4 } from 'uuid';
import { CourseModel } from './course.model';
import type { ICourse } from './course.types';
import type { CreateCourseDto, UpdateCourseDto, CourseCatalogQueryDto, StudentCatalogQueryDto } from './course.validators';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/error';
import { CourseRequestModel } from '../course-requests/course-request.model';
import { CourseRequestStatus } from '../course-requests/course-request.types';
import { geoService } from '../geo/geo.service';
import { GRADE_LIST } from '../students/student.validators';
import type { PaginatedResult } from '../../shared/types';
import { parsePaginationQuery, buildPaginatedResult } from '../../utils/pagination';

export class CourseService {
  async create(adminUserPublicId: string, dto: CreateCourseDto): Promise<ICourse> {
    const created = await CourseModel.create({
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
    const { districtId, ...rest } = dto;
    const setFields: Record<string, unknown> = { ...rest };
    if (districtId) Object.assign(setFields, locationFromDistrict(districtId));
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

  /** Soft delete. Refused while students hold PENDING or ACCEPTED (prepaid) requests —
   *  admins can unpublish instead. Finished requests keep resolving the course title. */
  async softDelete(coursePublicId: string): Promise<void> {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    const active = await CourseRequestModel.countDocuments({
      coursePublicId,
      status: { $in: [CourseRequestStatus.PENDING, CourseRequestStatus.ACCEPTED] },
      isDeleted: false,
    });
    if (active > 0) {
      throw new ConflictError(`Course has ${active} active request${active === 1 ? '' : 's'} — unpublish it instead`);
    }
    await CourseModel.updateOne(
      { publicId: coursePublicId, isDeleted: false },
      { $set: { isDeleted: true, isPublished: false } },
    );
  }

  async getByPublicId(coursePublicId: string): Promise<ICourse> {
    const course = await CourseModel.findOne({ publicId: coursePublicId, isDeleted: false }).lean();
    if (!course) throw new NotFoundError('Course');
    return course;
  }

  /** Student-facing catalog: published courses in one district. With `grade` it's the
   *  "My grade" view; without, "All grades", ordered by grade then title. */
  async listCatalog(filters: StudentCatalogQueryDto): Promise<ICourse[]> {
    const filter: Record<string, unknown> = { districtId: filters.districtId, isPublished: true, isDeleted: false };
    if (filters.grade) filter.grade = filters.grade;
    if (filters.subject) filter.subject = filters.subject;
    const courses = await CourseModel.find(filter).sort({ title: 1 }).limit(500).lean();
    return courses.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.title.localeCompare(b.title));
  }

  /** Admin-facing listing: any county/grade/subject/published state. */
  async listForAdmin(query: CourseCatalogQueryDto): Promise<PaginatedResult<ICourse>> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.state) filter.state = query.state;
    if (query.countyFips) filter.countyFips = query.countyFips;
    if (query.districtId) filter.districtId = query.districtId;
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

export const courseService = new CourseService();
