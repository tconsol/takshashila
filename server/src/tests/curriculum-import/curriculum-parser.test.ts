import { parseCurriculumDoc } from '../../modules/curricula/import/curriculum-parser';

const h = (n: number, text: string) => ({ style: `Heading${n}`, text });
const li = (text: string) => ({ style: 'ListBullet', text });
const p = (text: string) => ({ style: '', text });

describe('parseCurriculumDoc', () => {
  it('reads grade > subject > chapter > topics from bullets', () => {
    const doc = parseCurriculumDoc([h(1, 'Kindergarten'), h(2, 'Mathematics'), p('Grade-band note'), h(3, 'Counting'), li('Count to 10'), li('Count to 20'), h(1, 'Grade 2'), h(2, 'Science'), h(3, 'Plants'), li('Seeds')]);
    expect(doc.grades.map((g) => [g.grade, g.level])).toEqual([['Kindergarten', 'KINDERGARTEN'], ['Grade 2', 'GRADE']]);
    const math = doc.grades[0].subjects[0];
    expect(math).toMatchObject({ name: 'Mathematics', note: 'Grade-band note', notVerified: false });
    expect(math.chapters).toEqual([{ title: 'Counting', topics: ['Count to 10', 'Count to 20'] }]);
  });
  it('reads plain paragraphs as topics (Georgia layout)', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 5'), h(2, 'Social Studies'), h(3, 'Colonial America'), p('Roanoke'), p('Jamestown')]);
    expect(doc.grades[0].subjects[0].chapters[0].topics).toEqual(['Roanoke', 'Jamestown']);
  });
  it('splits a course name from the subject', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 8'), h(2, 'Mathematics (Pre-Algebra)'), h(3, 'Ratios'), li('Rates')]);
    expect(doc.grades[0].subjects[0]).toMatchObject({ name: 'Mathematics', courseName: 'Pre-Algebra' });
  });
  it('flags Not verified subjects', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Dance'), p('Not verified: no state standard.')]);
    expect(doc.grades[0].subjects[0]).toMatchObject({ notVerified: true, chapters: [] });
  });
  it('accepts "Heading 1" and lowercase style spellings', () => {
    const doc = parseCurriculumDoc([{ style: 'Heading 1', text: 'Grade 1' }, { style: 'heading2', text: 'Science' }, { style: 'Heading 3', text: 'Air' }, li('Wind')]);
    expect(doc.grades[0].subjects[0].chapters[0].topics).toEqual(['Wind']);
  });
  it('skips grades 9 to 12 and reports them', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 9'), h(2, 'Science'), h(3, 'Cells'), li('x'), h(1, 'Grade 3'), h(2, 'Science'), h(3, 'Air'), li('y')]);
    expect(doc.grades.map((g) => g.grade)).toEqual(['Grade 3']);
    expect(doc.skippedHighSchoolGrades).toEqual(['Grade 9']);
  });
  it('separates county and source sections', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Science'), h(3, 'Air'), li('Wind'), h(1, 'County Additions'), h(2, 'Adams County'), h(1, 'Sources and Verification Notes'), h(3, 'Standards used'), li('Science: NGSS (2013) - https://x.org')]);
    expect(doc.countyParagraphs.map((x) => x.text)).toEqual(['Adams County']);
    expect(doc.sourceParagraphs.map((x) => x.text)).toEqual(['Standards used', 'Science: NGSS (2013) - https://x.org']);
  });
  it('keeps a subject with a chapter but no topics as an empty chapter', () => {
    const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Art'), h(3, 'Colour')]);
    expect(doc.grades[0].subjects[0].chapters).toEqual([{ title: 'Colour', topics: [] }]);
  });

  describe('real-file formats', () => {
    it('recognises grade H1s with a hyphen or en-dash prefix and normalises the label', () => {
      const doc = parseCurriculumDoc([
        h(1, 'Colorado - Kindergarten'), h(2, 'Art'), h(3, 'Line'), li('Draw'),
        h(1, 'Colorado - Grade 7'), h(2, 'Art'), h(3, 'Shape'), li('Cut'),
        h(1, 'Georgia State Master Curriculum – Grade 1  '), h(2, 'Art'), h(3, 'Colour'), p('Mix'),
      ]);
      expect(doc.grades.map((g) => [g.grade, g.level])).toEqual([['Kindergarten', 'KINDERGARTEN'], ['Grade 7', 'GRADE'], ['Grade 1', 'GRADE']]);
      expect(doc.grades[2].subjects[0].chapters[0].topics).toEqual(['Mix']);
    });
    it('skips prefixed high-school grade H1s', () => {
      const doc = parseCurriculumDoc([h(1, 'Colorado - Grade 10'), h(2, 'Art'), h(3, 'x'), li('y')]);
      expect(doc.grades).toEqual([]);
      expect(doc.skippedHighSchoolGrades).toEqual(['Grade 10']);
    });
    it('ignores Title and unstyled intro prose before the first H1', () => {
      const doc = parseCurriculumDoc([{ style: 'Title', text: 'Colorado Curriculum' }, p('This document is an intro.'), h(1, 'Colorado - Grade 1'), h(2, 'Art'), h(3, 'Line'), li('Draw')]);
      expect(doc.grades).toHaveLength(1);
      expect(doc.grades[0].subjects[0].note).toBeUndefined();
      expect(doc.grades[0].subjects[0].chapters).toEqual([{ title: 'Line', topics: ['Draw'] }]);
    });
    it('drops an unknown H1 section and does not attach it to the previous grade', () => {
      const doc = parseCurriculumDoc([h(1, 'Grade 1'), h(2, 'Art'), h(3, 'Line'), li('Draw'), h(1, 'Overview'), h(2, 'Stray'), h(3, 'Stray chapter'), li('stray'), p('prose'), h(1, 'Grade 2'), h(2, 'Art'), h(3, 'Shape'), li('Cut')]);
      expect(doc.grades.map((g) => g.grade)).toEqual(['Grade 1', 'Grade 2']);
      expect(doc.grades[0].subjects.map((s) => s.name)).toEqual(['Art']);
      expect(doc.grades[0].subjects[0].chapters).toEqual([{ title: 'Line', topics: ['Draw'] }]);
      expect(doc.countyParagraphs).toEqual([]);
      expect(doc.sourceParagraphs).toEqual([]);
    });
    it('does not treat "Sources and Verification Notes" as a grade', () => {
      const doc = parseCurriculumDoc([h(1, 'Sources and Verification Notes'), p('Grade 4 standards')]);
      expect(doc.grades).toEqual([]);
      expect(doc.sourceParagraphs.map((x) => x.text)).toEqual(['Grade 4 standards']);
    });
  });
});
