# Curriculum: State Master, Chapters and Topics — Design Spec

Date: 2026-09-30
Status: **Draft for review.** Sections 1–3 agreed in conversation; high school is an **open item** (§8).
Extends / partly replaces: `2026-09-25-school-districts-design.md` (district as the anchor) and
`2026-09-25-curriculum-materials-design.md` (materials attach to topics).

## 1. Goal

Let the platform hold the real state syllabi the business has produced (16 Word files, 14 states), give
students and parents a clear picture of what is taught and how far a course has got, and let admins keep the
content up to date afterwards.

Success looks like:
- Every state that has a file is browsable by a student in that state, with sources shown.
- A student ticks **chapters** when requesting a course; a tutor records which **topics** each class covered;
  progress reads "3 of 5 topics done" per chapter.
- A student in a state that is not loaded yet is told so, and the app records the demand.
- Admins can add, rename, reorder and delete chapters and topics without a re-import.

## 2. Decisions (from brainstorming; not open questions)

| # | Decision |
|---|---|
| 1 | **Anchor = state.** One master curriculum per state, subject and grade. Counties/districts add information only. The student's profile (state, county, grade) selects it. |
| 2 | **Three levels: Curriculum → Chapter → Topic.** (The state files call these grade+subject → strand → learning outcome.) |
| 3 | Student and parent pick **chapters**. A class is tied to one chapter. The tutor ticks the **topics** covered. Progress rolls up topic → chapter → curriculum. |
| 4 | **County additions are information only**, shown by county and grade range. No chapters, classes or progress. |
| 5 | **Superseded by decision 14.** (Original: load the six revised files first, then master files for the other states, no "draft" label.) Still true: Alaska and Colorado use the **revised** file; the file kind is stored invisibly. |
| 6 | **Import every subject; an admin on/off switch per subject.** Launch with English Language Arts, Mathematics, Science, Social Studies and Computer Science on; the rest off. |
| 7 | A student whose state is not loaded sees "not available yet"; the app **records the request** (student, state). |
| 8 | **Materials attach to a chapter and optionally to named topics in it** (none named = the whole chapter). One material may span several chapters. |
| 9 | **Bulk load once, run by us** (drafts, per-state report, then publish). Afterwards admins edit inside the app. No upload screen now. |
| 10 | **Kindergarten** becomes its own grade wherever a file contains it (all six revised files do; master files start at Grade 1). |
| 11 | Recording covered topics is a **prompt, never a requirement**. When scheduling, the tutor may tick **intended topics**; after the class the prompt shows those as pre-filled checkboxes (other topics of the chapter can be added). Completing a class and paying the tutor never depend on it. |
| 12 | **California and Missouri are combined** from two files each: the older master file supplies Grades 1–8 (with its sources); the newer-format file supplies Kindergarten, the high-school content and the county add-on lessons. Their high school is compared under the open high-school item (§8). **Not loaded in the first release** (decision 14); the combination rule is kept for when better files exist. |
| 13 | **County add-on lessons stay information only**, but are stored as **structured records** (county, subject, grade range, list of topics) so they can become optional lessons later without re-importing. The other kind of county content (programs and schools) is stored the same way with an empty topic list. |
| 14 | **First release = Group A (the six revised states) plus Georgia, and Georgia loads only after a spot-check against the state's own published standards** (§3.1). Alabama, Arizona, Arkansas, California, Connecticut, Delaware and Missouri are **not loaded**: their files are largely one generic template with the state name swapped (§3.1). Students in those states see "not available yet" and the app records the demand (decision 7), until a proper revised file exists. County content for states that are not loaded is also not loaded. |

## 3. Source files (inventory, read 2026-09-30)

| Kind | States | Notes |
|---|---|---|
| Revised (6) | Alaska, Colorado, Hawaii, Idaho, Iowa, Louisiana | K–12 (13 grade headings). Sources section in each. Empty-subject marks: AK 5, CO 14, HI 0, ID 0, IA 1, LA 17. No county additions. |
| Master (10) | Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware, Georgia, Missouri | Grades 1–12, County Additions section in every file. Alabama, California, Georgia and Missouri also carry a sources section and a few "Not verified" marks. |
| New format (2) | California, Missouri | K–12 in one document **without Word heading styles** (structure is in the formatting and text patterns): grade lines like "CALIFORNIA - GRADE 1" (bold, larger), subject lines in upper case (bold), chapter lines (plain or bold, inconsistent in California), topics as "•" bullets. Grades 9–12 are one block organised by subject and course. Subjects are merged (Health + PE, Fine Arts + Computer Science). No sources. County table of add-on lessons (California: a real Word table; Missouri: Markdown text pasted into Word). Missouri has **421 stray `[cite: 1]` markers** in its text and a typo ("Number Sense and Sciences"). Kindergarten present (95 topics each). |

**States and the file each one uses**

| Group | States | Source of the standards | First release |
|---|---|---|---|
| A | Alaska, Colorado, Hawaii, Idaho, Iowa, Louisiana | Revised file (Alaska and Colorado's master files are used only for their county content) | **Yes** |
| B1 | Georgia | Master file (distinct text, sources section) | **Yes, after the spot-check (§3.1)** |
| B2 | Alabama, Arizona, Arkansas, Connecticut, Delaware | Master file (generic template, see §3.1) | No |
| C | California, Missouri | Would be combined: master (Grades 1–8) + new-format file | No |

### 3.1 How reliable are the older files? (measured 2026-09-30)

Comparing every master file's topic lines with the Colorado master, word for word:
Connecticut 96%, Delaware 96%, Arkansas 96%, Arizona 94%, Alaska 93%, Missouri 77%, California 75%,
Alabama 61%, **Georgia 0%**. Against the *revised* file for the same state, only 6% (Colorado) and 7% (Alaska)
of the master's topics have a close match, and the Colorado master lists a Media Arts subject that the state
does not have. The two new-format files share 84% of their lines with each other (California vs Missouri).
Conclusion: most master files are one generic template with the state name replaced; only the revised files
are state-specific and sourced. Georgia is a distinct, large document (2,946 topic lines) and is the only
master file that is not a copy of the template, but it has not been checked against the state.

**Georgia spot-check (before loading):** for a sample of grades and subjects (at least Grades 1, 5, 8 and one
high-school course in English Language Arts, Mathematics, Science and Social Studies) compare the file's
chapter titles and a set of topic lines with the Georgia Standards of Excellence published by the state's
Department of Education; record the result in the load report. Load Georgia only if the sample matches; if not,
it joins Group B2.

**Result of the first spot-check (2026-09-30, sample only, not line by line): passed.**
- Mathematics: the file's Grade 1 domains (Numerical Reasoning, Patterning and Algebraic Reasoning, Geometric and
  Spatial Reasoning, Measurement and Data Reasoning) are exactly the four domains of Georgia's K–8 Mathematics
  Standards.
- English Language Arts: the file's chapter groups (Foundations, Literacy Practices, Language, texts/reading)
  match the four domains of Georgia's K–12 ELA Standards (Foundations, Language, Texts, Practices).
- Social Studies Grade 5: the file's 47 history topics cover all seven state standards SS5H1–SS5H7 in order (turn of
  the century → World Wars → Depression → Cold War → 1950–75 → 1975–2001, ending with 11 September 2001). Two items
  that looked out of place (Chisholm Trail, cattle trails) do appear in the state's Grade 5 text.
- Course names in the high-school blocks ("Tenth Grade Literature & Composition", "Geometry: Concepts &
  Connections", "American Government / Civics") and the Grade 8 Social Studies block (Georgia history) are consistent
  with the state's courses.
- **Not yet verified:** Science topics; topic-by-topic wording; the sources section's links. Georgia therefore loads in
  the first release, with a full line-by-line review listed as a follow-up.

Structure is the same in all files: **Heading 1 = grade** (plus a title, a County Additions or Sources section),
**Heading 2 = subject** (up to 12 per grade; high school may carry a course name in brackets),
**Heading 3 = chapter**, and the lines under it = **topics**.

Differences the loader must handle:
- Topics are usually a bullet style, but **Georgia's are plain paragraphs** under the chapter heading.
- Text directly under a subject heading (before its first chapter) is a **subject note**, not a topic
  (for example "Grade-band standards (9-10)…" or a "Not verified: the state has no Media Arts standard").
- "Not verified" means **the state has no standard for that subject**; the subject is left empty on purpose.
- High-school subject headings carry a **course name in brackets** in the revised files and in Georgia
  ("Mathematics (Geometry)"); the other master files have only "Mathematics".

Approximate scale per state: revised 2,200–4,100 topics, 500–850 chapters; master 620–700 topics, 420–450
chapters (Georgia 560 chapters, count of topics to be measured by the loader).

## 4. Data model

**Curriculum** (replaces the district × grade × subject shape)
- `stateCode` (anchor), `subject`, `title`, `description`.
- `level`: `KINDERGARTEN | GRADE`, and `grade` (K, 1–12). Grades 9–12 use `level = GRADE` for now (see §8);
  a `HIGH_SCHOOL_COURSE` level is **not** added until the open high-school item is decided.
- `courseName` (optional, e.g. "Geometry") and `usualGrade` (optional).
- `source`: `{ name, year, url }` from the file's sources section (absent for files without one).
- `sourceKind`: `revised | master` (admin-only, never shown to users).
- `chapters[]`, `isPublished`, `isDeleted`. Legacy `districtId/countyFips/district/county` remain on
  existing curricula only and are optional on new ones.

**Chapter**: `publicId`, `title`, `order`, `topics[]`.
**Topic**: `publicId`, `title`, `order`.

**Subject setting** (platform settings): `enabledSubjects: string[]`. Default: ELA, Mathematics, Science,
Social Studies, Computer Science.

**CountyAddition**: `stateCode`, `county`, `district`, `gradeFrom`, `gradeTo`, `category`, `subjectName`
(optional; the add-on's subject, e.g. "Marine Biology & Coastal Ecology"), `description`, and `topics[]`
(strings; empty for a plain program or school entry). Read-only for users; editable by admins. The
add-on lessons in the California and Missouri new-format files arrive here with their topics filled in;
they are shown as information only (decision 13).

**StateRequest**: `studentPublicId`, `stateCode`, `createdAt`; unique on student + state. Admin sees counts per state.

**Materials** (Resource, Assignment, Worksheet): replace `topicPublicIds` with
`attachments: [{ chapterPublicId, topicPublicIds?: string[] }]`; empty `topicPublicIds` = whole chapter.

**Course**: `chapterPublicIds` (was topic ids), frozen at acceptance as today.
**ScheduledClass** (course classes): `chapterPublicId`, `intendedTopicPublicIds[]`, `coveredTopicPublicIds[]`.

**Progress** (per topic): a topic is *Covered* when it appears in `coveredTopicPublicIds` of a completed class
in the course; *Scheduled* when it is in the intended list of an upcoming class; *Missed* when its class was
missed and not superseded; otherwise *Not scheduled*. A chapter's status and its "x of y topics" are derived.

## 5. Flows

**Student / parent**
1. Profile: state, county, grade (district optional).
2. Curriculum page: enabled subjects only; grades K–8 by grade; state not loaded → "not available yet" +
   StateRequest; "Programs in your county" = county additions for the student's county and grade range.
3. Course request: tick chapters, choose tutor, free times. Price rule unchanged (tutor rate × classes, every
   class 60 minutes, charged at acceptance).
4. Course page: per chapter "x of y topics done"; materials listed under their chapter with "covers n of m topics".

**Tutor**
1. Accept: sees chosen chapters and total topics ("3 chapters, 14 topics").
2. Schedule: start time, **chapter**, optional intended topics.
3. After completion: a prompt with checkboxes (intended topics pre-ticked, other topics of the chapter
   available). Skippable; editable later.
4. Create worksheet/assignment: curriculum → chapter → optional topics (removes the old "must pick a topic" gate, T41).
5. Offerable curricula: matched to the tutor's subjects and the grades/courses they teach.

**Admin**
1. Curriculum list: filters (state, subject, grade/course, status); per-state counts.
2. Edit chapters/topics (add, rename, reorder, delete). Deleting a chapter or topic that a course request, class
   or covered-topic record uses is refused, naming the course (extends today's guard).
3. Attach materials to chapters/topics; publish/unpublish per curriculum.
4. Settings: subject switches. Lists: state requests (ranked), county additions.

## 6. Loading the files (one-off, run by us)

1. Parse by heading levels; topics are the non-heading lines under a chapter heading (bullet **or** plain).
2. Text between a subject heading and its first chapter is stored as a subject note.
3. Subjects with no chapters (the "no state standard" cases) are not created; they are listed in the report.
4. Kindergarten heading → `KINDERGARTEN`; Grades 1–8 → `GRADE`.
5. Source from each subject's entry in "Sources and Verification Notes" when present.
6. County content: programs and schools from the master files (including for Alaska and Colorado, whose standards
   come from the revised file); add-on lessons from the two new-format files. All go into `CountyAddition`.
6a. **Second reader for the new-format files (California, Missouri)**, which have no Word heading styles:
   - Grade lines are matched by text ("<STATE> - KINDERGARTEN", "<STATE> - GRADE n", "<STATE> - GRADES 9 THROUGH 12");
     subject lines by upper case + bold; a line that starts with "•" is a topic; a short plain or bold line between
     a subject and its first topic is a chapter; topics that sit directly under a subject (no chapter line) go into
     a chapter named after the subject.
   - Text is cleaned: `[cite: …]` markers and Markdown characters (`**`, `|`, `<br>`, leading `-`) are removed; the
     report counts what was removed.
   - Only Kindergarten and the high-school block are used from these files (decision 12). Grades 1–8 in them are read
     for the report and compared with the master file, not loaded.
   - Merged subjects ("Health & Physical Education", "Fine Arts & Computer Science") are kept as the file names them,
     because splitting them would invent structure. They are reported as anomalies.
   - The county table is read into structured add-on records (California: Word table cells; Missouri: the pasted
     Markdown table); topics are split at the "•" characters inside a cell.
7. Everything loads as **draft**. Per-state report: grades, subjects, chapters, topics, skipped subjects, anomalies
   (duplicate titles, empty chapters, unstyled text before any chapter).
8. Re-running a state replaces that state's own imported drafts; it never overwrites a published curriculum
   without an explicit flag; it never creates duplicates (key: state + subject + grade/course + source kind).
9. Runs on the **test database only**. Any other database is loaded only when the owner names it, after an export.

**Converting existing data:** each old topic becomes a chapter with one topic of the same name (same `publicId`
kept on the chapter so existing courses, classes and materials still resolve). Export before, rehearse on a copy.

## 7. Testing

- Loader unit tests against the real files: grade/subject/chapter/topic counts per file; Georgia's plain-text
  topics; subject notes not counted as topics; empty subjects skipped; sources parsed; Kindergarten present
  only in the revised files; Alaska and Colorado resolved to the revised file.
- New-format reader tests against the real California and Missouri files: Kindergarten and high-school blocks found;
  no `[cite` text and no Markdown characters left; five add-on records per state with their topics; merged subjects
  reported; Grades 1–8 of these files not loaded.
- Idempotence test (load twice = same result); published curricula not overwritten.
- Conversion test on a copy of the current data.
- Server tests for: material attachment rules, covered-topic prompt (never blocks completion or payment),
  progress derivation, deletion guards, subject switches, state request uniqueness.
- Browser walkthrough: student picks chapters → tutor schedules with intended topics → completes and ticks
  topics → progress and materials display; admin edits a chapter; student in an unloaded state.

## 8. Open items

1. **High school (grades 9–12) — parked for further discussion.** Two candidate models: (a) one curriculum per
   grade × subject block, as the files list it; (b) a High School level whose items are *courses* the student
   picks, with grade as a hint. The revised files give exactly one named course per subject per grade
   (Alaska Grade 10 Math = "Geometry", Hawaii = "Algebra 1 + Data Analytics"); most master files give no course
   name, Georgia does. **Interim behaviour until decided:** load each grade 9–12 subject block as its own
   curriculum, keep the bracketed course name in `courseName` when present, and keep `usualGrade`. This is
   compatible with either model and blocks nothing else.
1a. For California and Missouri the combined result has **two views of high school** (grade-based from the master
   file, course-based from the new file). Which one is loaded is decided together with item 1.
2. Which database counts as production, and when to load it.
3. Whether the "draft/reviewed" label for master-based states is wanted later (the data to support it is stored).
4. Wording changes to the legal pages (course classes are 60 minutes; refunds within 48 hours) are separate.

## 9. Out of scope

Adding tutors' own curricula; per-district syllabi; recorded lesson content; a file-upload screen for admins;
non-US states or countries; changing pricing or the 60-minute course rule.
