import { checkCommitGuard, validateManifest } from '../../scripts/import-state-curricula';

describe('checkCommitGuard', () => {
  it('allows dry-run with nothing else', () => {
    expect(() => checkCommitGuard({ commit: false, connectedDb: 'prod' })).not.toThrow();
  });
  it('refuses commit without database confirmation', () => {
    expect(() => checkCommitGuard({ commit: true, connectedDb: 'prod', backupPath: 'b.json' })).toThrow(/confirm-db/);
  });
  it('refuses commit when confirmation names another database', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'test', connectedDb: 'prod', backupPath: 'b.json' })).toThrow(/does not match/);
  });
  it('refuses commit without a backup', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'prod', connectedDb: 'prod' })).toThrow(/backup/i);
  });
  it('allows a confirmed, backed-up commit', () => {
    expect(() => checkCommitGuard({ commit: true, confirmDb: 'prod', connectedDb: 'prod', backupPath: 'b.json' })).not.toThrow();
  });
});

describe('validateManifest', () => {
  const e = (stateCode: string, countyOnly?: boolean) => ({ file: `${stateCode}.docx`, stateCode, kind: 'revised' as const, ...(countyOnly ? { countyOnly } : {}) });
  it('accepts one full file plus countyOnly files per state', () => {
    expect(() => validateManifest([e('AK'), e('AK', true), e('CO')])).not.toThrow();
  });
  it('rejects two non-countyOnly files for one state', () => {
    expect(() => validateManifest([e('AK'), e('AK')])).toThrow(/AK/);
  });
});
