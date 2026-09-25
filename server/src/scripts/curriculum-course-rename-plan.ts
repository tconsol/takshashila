// Uses the OLD collection/field names on purpose — this is the migration from them.
export interface DbState {
  collections: string[];
  curriculaCount: number;
  courseRequestsCount: number;
  /** true if any doc in `courses` already has curriculumPublicId (i.e. it holds student courses). */
  coursesHaveCurriculumField: boolean;
}

export type Step =
  | { kind: 'renameCollection'; from: string; to: string }
  | { kind: 'renameFields'; collection: string; fields: Record<string, string> }
  | { kind: 'dropIndex'; collection: string; index: string }
  | { kind: 'syncIndexes' };

export type Plan = { ok: true; steps: Step[] } | { ok: false; reason: string };

export function planRenameSteps(state: DbState): Plan {
  const has = (c: string) => state.collections.includes(c);
  if (has('curricula') && state.curriculaCount > 0) {
    return { ok: false, reason: 'curricula already has documents — migration appears to have run' };
  }
  if (state.coursesHaveCurriculumField) {
    return { ok: false, reason: 'courses already contains curriculumPublicId — partially migrated; fix by hand' };
  }

  const steps: Step[] = [];
  if (has('courses')) steps.push({ kind: 'renameCollection', from: 'courses', to: 'curricula' });
  if (has('courserequests')) {
    steps.push({ kind: 'renameCollection', from: 'courserequests', to: 'courses' });
    steps.push({ kind: 'renameFields', collection: 'courses', fields: { coursePublicId: 'curriculumPublicId', selectedTopicPublicIds: 'topicPublicIds' } });
  }
  // $rename can't swap names in one pass: move the curriculum id out of the way first.
  steps.push({ kind: 'renameFields', collection: 'scheduledclasses', fields: { coursePublicId: 'curriculumPublicId', courseTopicPublicId: 'topicPublicId' } });
  steps.push({ kind: 'renameFields', collection: 'scheduledclasses', fields: { courseRequestPublicId: 'coursePublicId' } });
  steps.push({ kind: 'dropIndex', collection: 'scheduledclasses', index: 'courseRequestPublicId_1' });
  steps.push({ kind: 'syncIndexes' });
  return { ok: true, steps };
}
