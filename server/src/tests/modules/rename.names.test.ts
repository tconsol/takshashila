import fs from 'fs';
import path from 'path';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CourseModel } from '../../modules/courses/course.model';
import { ScheduledClassModel } from '../../modules/schedules/schedule.model';
import { DomainEvent } from '../../constants/events';

describe('curriculum/course rename — names', () => {
  it('stores curricula in "curricula" and student courses in "courses"', () => {
    expect(CurriculumModel.collection.collectionName).toBe('curricula');
    expect(CourseModel.collection.collectionName).toBe('courses');
  });

  it('a course references its curriculum and topics by the new field names', () => {
    const paths = Object.keys(CourseModel.schema.paths);
    expect(paths).toEqual(expect.arrayContaining(['curriculumPublicId', 'topicPublicIds']));
    expect(paths).not.toContain('coursePublicId');
    expect(paths).not.toContain('selectedTopicPublicIds');
  });

  it('a scheduled class links course, curriculum and topic by the new field names', () => {
    const paths = Object.keys(ScheduledClassModel.schema.paths);
    expect(paths).toEqual(expect.arrayContaining(['coursePublicId', 'curriculumPublicId', 'topicPublicId']));
    expect(paths).not.toContain('courseRequestPublicId');
    expect(paths).not.toContain('courseTopicPublicId');
  });

  it('course events use the COURSE_* names', () => {
    expect(DomainEvent).toEqual(expect.objectContaining({
      COURSE_CREATED: 'COURSE_CREATED',
      COURSE_ACCEPTED: 'COURSE_ACCEPTED',
      COURSE_REJECTED: 'COURSE_REJECTED',
      COURSE_CANCELLED: 'COURSE_CANCELLED',
      COURSE_COMPLETED: 'COURSE_COMPLETED',
      COURSE_CLASS_SCHEDULED: 'COURSE_CLASS_SCHEDULED',
    }));
    expect(Object.keys(DomainEvent).some((k) => k.startsWith('COURSE_REQUEST_'))).toBe(false);
  });

  it('keeps persisted wallet strings byte-identical', () => {
    const src = [
      fs.readFileSync(path.join(__dirname, '../../modules/courses/course.service.ts'), 'utf8'),
      fs.readFileSync(path.join(__dirname, '../../modules/classes/class.service.ts'), 'utf8'),
    ].join('\n');
    for (const s of [
      "'COURSE_REQUEST_ACCEPT'",
      "'COURSE_REQUEST_CANCEL'",
      '`course-request-accept-${',
      '`course-request-cancel-${',
      '`course-class-${',
      '`course-class-cancel-refund-${',
    ]) {
      expect(src).toContain(s);
    }
  });
});
