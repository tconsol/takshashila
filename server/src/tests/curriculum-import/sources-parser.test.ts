import { parseSources, pickSource } from '../../modules/curricula/import/sources-parser';

const li = (text: string) => ({ style: 'ListBullet', text });
const h3 = (text: string) => ({ style: 'Heading3', text });
const p = (text: string) => ({ style: '', text });

describe('parseSources', () => {
  it('reads "Subject: Name (year) - url" lines', () => {
    const s = parseSources([h3('Standards used'), li('Mathematics: Colorado Academic Standards (2020) - https://cde.state.co.us/math'), li('Science: NGSS (2013) - https://nextgenscience.org')]);
    expect(pickSource(s, 'Mathematics')).toEqual({ name: 'Colorado Academic Standards', year: 2020, url: 'https://cde.state.co.us/math' });
    expect(pickSource(s, 'science')?.year).toBe(2013);
  });
  it('uses a state-wide citation when the subject has none (Georgia layout)', () => {
    const s = parseSources([h3('Sources Used for Georgia'), { style: '', text: 'Georgia Standards of Excellence (2021) https://www.gadoe.org/standards' }]);
    expect(pickSource(s, 'Social Studies')).toEqual({ name: 'Georgia Standards of Excellence', year: 2021, url: 'https://www.gadoe.org/standards' });
  });
  it('returns null and keeps notes when nothing matches', () => {
    const s = parseSources([h3('Notes'), { style: '', text: 'Some caveat' }]);
    expect(pickSource(s, 'Art')).toBeNull();
    expect(s.notes).toEqual(['Some caveat']);
  });

  // ---- real-document layouts ----
  it('keeps parentheses inside the name and takes the trailing (year) as the year (revised layout)', () => {
    const s = parseSources([h3('Standards used'),
      li('Science: K-12 Science Standards for Alaska (based on NGSS, adopted 2019) (2019) - https://education.alaska.gov/akstandards/science/x.pdf'),
      li('Mathematics: Alaska Mathematics Standards (adopted June 2012; edited 7/25/2022) (2012) - https://education.alaska.gov/m.pdf')]);
    expect(pickSource(s, 'Science')).toEqual({ name: 'K-12 Science Standards for Alaska (based on NGSS, adopted 2019)', year: 2019, url: 'https://education.alaska.gov/akstandards/science/x.pdf' });
    expect(pickSource(s, 'Mathematics')?.year).toBe(2012);
  });
  it('only splits at the first colon so names may contain colons', () => {
    const s = parseSources([h3('Standards used'), li('Health Education: Alaska Content Standards: Skills for a Healthy Life (2016) - https://e.gov/h.pdf')]);
    expect(pickSource(s, 'Health Education')?.name).toBe('Alaska Content Standards: Skills for a Healthy Life');
  });
  it('keeps the first citation when a subject has several, and reads a "(None)" year as null', () => {
    const s = parseSources([h3('Standards used'),
      li('Science: Next Generation Science Standards (NGSS) (2016) - https://nextgenscience.org/a.pdf'),
      li('Science: Hawaii DOE Subject Matter Standards page (None) - https://hawaiipublicschools.org/x')]);
    expect(pickSource(s, 'Science')?.url).toBe('https://nextgenscience.org/a.pdf');
    const t = parseSources([h3('Standards used'), li('Dance: Hawaii DOE Learning Design page (None) - https://h.org/fine-arts')]);
    expect(pickSource(t, 'Dance')).toEqual({ name: 'Hawaii DOE Learning Design page', year: null, url: 'https://h.org/fine-arts' });
  });
  it('applies a "A / B / C" prefix to every listed subject', () => {
    const s = parseSources([h3('Standards used'), li('Visual Arts / Music / Dance / Theatre: LAC 28 Part LI Louisiana Arts Content Standards (2004) - https://bese.louisiana.gov/28v51.pdf')]);
    expect(pickSource(s, 'Music')?.year).toBe(2004);
    expect(pickSource(s, 'Theatre')?.name).toBe('LAC 28 Part LI Louisiana Arts Content Standards');
  });
  it('matches real subject names against differently worded prefixes and aliases', () => {
    const s = parseSources([h3('Standards used'),
      li('English Language Arts and Literacy: Iowa ELA Standards (2024) - https://e.gov/ela'),
      li('Math: Idaho Math (2022) - https://e.gov/math'),
      li('Health: Idaho Health (2023) - https://e.gov/health'),
      li('PE: Idaho PE (2023) - https://e.gov/pe'),
      li('Theater: Idaho Theatre (2023) - https://e.gov/th'),
      li('CS: Idaho CS (2024) - https://e.gov/cs')]);
    expect(pickSource(s, 'English Language Arts')?.url).toBe('https://e.gov/ela');
    expect(pickSource(s, 'Mathematics')?.url).toBe('https://e.gov/math');
    expect(pickSource(s, 'Health Education')?.url).toBe('https://e.gov/health');
    expect(pickSource(s, 'Physical Education')?.url).toBe('https://e.gov/pe');
    expect(pickSource(s, 'Theatre')?.url).toBe('https://e.gov/th');
    expect(pickSource(s, 'Computer Science')?.url).toBe('https://e.gov/cs');
  });
  it('prefers an exact subject match over a longer-prefix match and never matches a mere substring', () => {
    const s = parseSources([h3('Standards used'), li('Music Technology: MT (2020) - https://e.gov/mt'), li('Music: M (2021) - https://e.gov/m')]);
    expect(pickSource(s, 'Music')?.url).toBe('https://e.gov/m');
    expect(pickSource(s, 'Art')).toBeNull();
  });
  it('sends paragraphs under non-source H3 groups to notes with the group title as prefix (URLs there are not citations)', () => {
    const s = parseSources([
      h3('Standards used'), li('Science: NGSS (2013) - https://n.org/s'),
      h3('Not verified'), li('Media Arts K-12: Colorado has no Media Arts standards'),
      h3('Notes'), li('Standards PDFs were downloaded from https://ed.cde.state.co.us/fs/x'),
      h3('Build warnings (data gaps)'), li('music grade 9 has no modules')]);
    expect(s.notes).toEqual([
      'Not verified: Media Arts K-12: Colorado has no Media Arts standards',
      'Standards PDFs were downloaded from https://ed.cde.state.co.us/fs/x',
      'Build warnings: music grade 9 has no modules']);
    expect(s.stateWide).toBeNull();
    expect(pickSource(s, 'Media Arts')).toBeNull();
  });
  it('reads URL-less Georgia "Sources Used for <Subject> (Grades a-b)" paragraphs as that subject citation', () => {
    const s = parseSources([
      h3('Sources Used for Computer Science (Grades 6–12)'),
      p('Georgia Standards of Excellence for K–8 Computer Science, grade band 6–8 (Georgia Department of Education)'),
      p('AP Computer Science A and AP Computer Science Principles course frameworks (College Board)'),
      h3('Sources Used for Visual Arts (Grades 2–12)'),
      p('Georgia Standards of Excellence (GSE) Kindergarten–Grade 12 Visual Art (Georgia Department of Education, 2017): grade-specific standards K–8'),
      h3('Corrections Made to County Entries'), p('Fulton: Principles of Engineering is Foundations of Engineering & Technology in the catalog'),
      h3('Not Verified (Kept as Provided)'), p('Fulton: Foreign Language exploration (Grades 6–8)')]);
    expect(pickSource(s, 'Computer Science')).toEqual({ name: 'Georgia Standards of Excellence for K–8 Computer Science, grade band 6–8 (Georgia Department of Education)', year: null, url: '' });
    expect(pickSource(s, 'Visual Arts')).toEqual({ name: 'Georgia Standards of Excellence (GSE) Kindergarten–Grade 12 Visual Art (Georgia Department of Education, 2017)', year: 2017, url: '' });
    expect(pickSource(s, 'Mathematics')).toBeNull();
    expect(s.stateWide).toBeNull();
    expect(s.notes).toEqual([
      'Corrections Made to County Entries: Fulton: Principles of Engineering is Foundations of Engineering & Technology in the catalog',
      'Not Verified: Fulton: Foreign Language exploration (Grades 6–8)']);
  });
});
