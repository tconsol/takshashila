import { scheduleCourseClassSchema } from '../../modules/courses/course.validators';

const base = {
  startUTC: '2026-10-01T10:00:00.000Z',
  endUTC: '2026-10-01T11:00:00.000Z',
  title: 'Linear equations — session 1',
};

describe('scheduleCourseClassSchema', () => {
  it('requires a topic for a curriculum class, so progress can be tracked per topic', () => {
    const missing = scheduleCourseClassSchema.safeParse(base);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0].path).toEqual(['topicPublicId']);

    expect(scheduleCourseClassSchema.safeParse({ ...base, topicPublicId: '' }).success).toBe(false);
  });

  it('accepts a class with a topic', () => {
    expect(scheduleCourseClassSchema.safeParse({ ...base, topicPublicId: 'topic-1' }).success).toBe(true);
  });
});
