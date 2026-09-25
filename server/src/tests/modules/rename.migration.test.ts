import { planRenameSteps } from '../../scripts/curriculum-course-rename-plan';

const fresh = { collections: ['courses', 'courserequests', 'scheduledclasses'], curriculaCount: 0, courseRequestsCount: 3, coursesHaveCurriculumField: false };

describe('planRenameSteps', () => {
  it('plans collection renames in collision-safe order, then field renames, then indexes', () => {
    const plan = planRenameSteps(fresh);
    expect(plan).toEqual({
      ok: true,
      steps: [
        { kind: 'renameCollection', from: 'courses', to: 'curricula' },
        { kind: 'renameCollection', from: 'courserequests', to: 'courses' },
        { kind: 'renameFields', collection: 'courses', fields: { coursePublicId: 'curriculumPublicId', selectedTopicPublicIds: 'topicPublicIds' } },
        { kind: 'renameFields', collection: 'scheduledclasses', fields: { coursePublicId: 'curriculumPublicId', courseTopicPublicId: 'topicPublicId' } },
        { kind: 'renameFields', collection: 'scheduledclasses', fields: { courseRequestPublicId: 'coursePublicId' } },
        { kind: 'dropIndex', collection: 'scheduledclasses', index: 'courseRequestPublicId_1' },
        { kind: 'syncIndexes' },
      ],
    });
  });

  it('refuses when curricula already has data (already migrated)', () => {
    const plan = planRenameSteps({ ...fresh, collections: ['curricula', 'courses', 'scheduledclasses'], curriculaCount: 4, courseRequestsCount: 0 });
    expect(plan.ok).toBe(false);
  });

  it('refuses when courses already hold curriculumPublicId (partially migrated)', () => {
    const plan = planRenameSteps({ ...fresh, coursesHaveCurriculumField: true });
    expect(plan.ok).toBe(false);
  });

  it('skips the courserequests rename when that collection never existed', () => {
    const plan = planRenameSteps({ ...fresh, collections: ['courses', 'scheduledclasses'], courseRequestsCount: 0 });
    expect(plan.ok && plan.steps.some((s) => s.kind === 'renameCollection' && s.from === 'courserequests')).toBe(false);
  });
});
