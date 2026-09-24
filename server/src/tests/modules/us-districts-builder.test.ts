import { buildDistricts, parseCsvLine } from '../../scripts/us-districts-builder';

const HEADER = 'SCHOOL_YEAR,ST,LEA_NAME,LEAID,SY_STATUS,LEA_TYPE,OPERATIONAL_SCHOOLS';
const ccd = [
  HEADER,
  '2023-2024,AL,Albertville City,0100005,1,1,6',          // kept (leading zero)
  '2023-2024,NC,Wake County Schools,3704720,1,1,200',     // kept
  '2023-2024,NC,"Smith, Jones Academy",3700043,1,7,1',    // charter type → dropped
  '2023-2024,NC,Closed District,3700001,2,1,3',           // closed → dropped
  '2023-2024,NC,Empty District,3700002,1,1,0',            // no schools → dropped
  '2023-2024,PR,Puerto Rico Dept,7200030,1,1,800',        // territory → dropped
  '2023-2024,NC,Unknown County District,3700003,1,2,4',   // county not in gazetteer → dropped
].join('\n');

const edge = [
  '0100005|Albertville City|01|x|x|AL|35950|01|01095|Marshall County',
  '3704720|Wake County Schools|37|x|x|NC|27518|37|37183|Wake County',
  '3700043|Smith|37|x|x|NC|1|37|37183|Wake County',
  '3700001|Closed|37|x|x|NC|1|37|37183|Wake County',
  '3700002|Empty|37|x|x|NC|1|37|37183|Wake County',
  '7200030|PR|72|x|x|PR|1|72|72127|San Juan',
  '3700003|Unknown|37|x|x|NC|1|37|37999|Nowhere',
].join('\r\n');

const known = new Set(['01095', '37183', '72127']);

describe('parseCsvLine', () => {
  it('splits on commas and honours quoted fields with commas and escaped quotes', () => {
    expect(parseCsvLine('a,"b, c","d ""q"" e",')).toEqual(['a', 'b, c', 'd "q" e', '']);
  });
});

describe('buildDistricts', () => {
  it('keeps only open regular districts in the 50 states + DC with a known county', () => {
    const { districts, dropped } = buildDistricts(ccd, edge, known);
    expect(districts).toEqual([
      { id: '0100005', name: 'Albertville City', state: 'AL', countyFips: '01095' },
      { id: '3704720', name: 'Wake County Schools', state: 'NC', countyFips: '37183' },
    ]);
    expect(dropped).toEqual({ state: 1, type: 1, status: 1, noSchools: 1, county: 1 });
  });

  it('keeps LEAIDs as 7-char strings with leading zeros', () => {
    const { districts } = buildDistricts(ccd, edge, known);
    expect(districts[0].id).toBe('0100005');
    expect(typeof districts[0].id).toBe('string');
  });

  it('throws on a CCD file missing a required column', () => {
    expect(() => buildDistricts('LEAID,ST\n0100005,AL', edge, known)).toThrow(/LEA_NAME/);
  });
});
