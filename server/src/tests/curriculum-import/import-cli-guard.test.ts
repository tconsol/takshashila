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

describe('verifyBackup', () => {
  const fs = require('fs') as typeof import('fs');
  const os = require('os') as typeof import('os');
  const path = require('path') as typeof import('path');
  const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), 'b.json');
  const write = (o: unknown) => { const f = tmp(); fs.writeFileSync(f, JSON.stringify(o)); return f; };
  const { verifyBackup } = require('../../scripts/import-state-curricula') as typeof import('../../scripts/import-state-curricula');

  it('accepts a backup whose array lengths match', () => {
    const f = write({ curricula: [{}, {}], countyadditions: [{}] });
    expect(() => verifyBackup(f, { curricula: 2, countyadditions: 1 })).not.toThrow();
  });
  it('rejects a missing file', () => {
    expect(() => verifyBackup(path.join(os.tmpdir(), 'nope-xyz.json'), { curricula: 0, countyadditions: 0 })).toThrow(/backup/i);
  });
  it('rejects an empty file', () => {
    const f = tmp(); fs.writeFileSync(f, '');
    expect(() => verifyBackup(f, { curricula: 0, countyadditions: 0 })).toThrow(/backup/i);
  });
  it('rejects unparseable content', () => {
    const f = tmp(); fs.writeFileSync(f, '{oops');
    expect(() => verifyBackup(f, { curricula: 0, countyadditions: 0 })).toThrow(/backup/i);
  });
  it('rejects a count mismatch', () => {
    const f = write({ curricula: [{}], countyadditions: [] });
    expect(() => verifyBackup(f, { curricula: 2, countyadditions: 0 })).toThrow(/curricula/);
  });
});
