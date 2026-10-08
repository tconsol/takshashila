import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCredits } from './billing';
import { formatDate } from './utils';

/** Shape of GET /users/me/export — only the fields the PDF reads. */
interface Rec { [key: string]: unknown }
export interface MyDataExport {
  exportedAt: string;
  account: Rec;
  profile: Rec | null;
  wallet: Rec | null;
  walletTransactions: Rec[];
  classes: Rec[];
  attendance: Rec[];
}

type Row = [string, string];

const str = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v));
const date = (v: unknown) => (v ? formatDate(v as string) : '—');
const dateTime = (v: unknown) => (v ? formatDate(v as string, { hour: 'numeric', minute: '2-digit' }) : '—');
const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : '—');
const yesNo = (v: unknown) => (v ? 'Yes' : 'No');
const credits = (v: unknown) => (typeof v === 'number' ? `${formatCredits(v)} credits` : '—');
const label = (v: unknown) => str(v).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function accountRows(a: Rec): Row[] {
  const rows: Row[] = [
    ['Name', `${str(a.firstName)} ${a.lastName ?? ''}`.trim()],
    ['Email', str(a.email)],
    ['Phone', str(a.phone)],
    ['Role', label(a.role)],
    ['Account status', label(a.status)],
    ['Email verified', yesNo(a.emailVerified)],
    ['Timezone', str(a.timezone)],
    ['Member since', date(a.createdAt)],
    ['Last sign-in', dateTime(a.lastLoginAt)],
  ];
  if (a.studentId) rows.splice(2, 0, ['Student ID', str(a.studentId)]);
  return rows;
}

function profileRows(role: string, p: Rec): Row[] {
  switch (role) {
    case 'STUDENT':
      return [
        ['Grade', str(p.grade)],
        ['Country', str(p.country)],
        ['State', str(p.state)],
        ['Enrolment status', label(p.status)],
        ['Classes booked', str(p.totalClassesBooked)],
        ['Classes attended', str(p.totalClassesAttended)],
        ['Classes missed', str(p.totalClassesMissed)],
        ['Attendance rate', `${Number(p.attendanceRate ?? 0)}%`],
      ];
    case 'TUTOR':
      return [
        ['Subjects', list(p.subjects)],
        ['Grades taught', Array.isArray(p.gradesTaught) && p.gradesTaught.length ? list(p.gradesTaught) : 'All grades'],
        ['Languages', list(p.languages)],
        ['Qualifications', list(p.qualifications)],
        ['Hourly rate', credits(p.hourlyRateCents)],
        ['Verified tutor', yesNo(p.isVerified)],
        ['Rating', p.ratingCount ? `${Number(p.rating).toFixed(1)} / 5 (${p.ratingCount} reviews)` : 'No reviews yet'],
        ['Total students', str(p.totalStudents)],
        ['Classes completed', str(p.totalClassesCompleted)],
      ];
    case 'PRINCIPAL':
      return [
        ['Organization', str(p.organizationName)],
        ['Website', str(p.organizationWebsite)],
        ['Status', label(p.status)],
        ['Total tutors', str(p.totalTutors)],
        ['Total students', str(p.totalStudents)],
      ];
    case 'PARENT':
      return [['Linked children', str(Array.isArray(p.childStudentPublicIds) ? p.childStudentPublicIds.length : 0)]];
    default:
      return [];
  }
}

/** Builds a readable PDF of the user's key account data and saves it. */
export function downloadMyDataPdf(data: MyDataExport) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 50;

  const nextY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  const heading = (text: string) => {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(30);
    doc.text(text, marginX, y);
    y += 8;
  };

  const keyValue = (rows: Row[]) => {
    autoTable(doc, {
      startY: y,
      body: rows,
      theme: 'plain',
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150, textColor: 90 } },
    });
    y = nextY();
  };

  const table = (head: string[], body: string[][], empty: string) => {
    if (!body.length) {
      doc.setFont('helvetica', 'italic').setFontSize(10).setTextColor(120);
      doc.text(empty, marginX, y + 14);
      y += 38;
      return;
    }
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: 'striped',
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [55, 65, 81] },
    });
    y = nextY();
  };

  // Title
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(20);
  doc.text('brainbaseedu: My Data', marginX, y);
  y += 18;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110);
  doc.text(`Exported ${dateTime(data.exportedAt)}`, marginX, y);
  y += 28;

  const role = String(data.account.role ?? '');

  heading('Account');
  keyValue(accountRows(data.account));

  if (data.profile) {
    const rows = profileRows(role, data.profile);
    if (rows.length) {
      heading(`${label(role)} profile`);
      keyValue(rows);
    }
  }

  if (data.wallet) {
    heading('Wallet');
    keyValue([
      ['Balance', credits(data.wallet.balanceCents)],
      ['Total spent', credits(data.wallet.totalSpentCents)],
      ['Total earned', credits(data.wallet.totalEarnedCents)],
    ]);
  }

  if (role === 'STUDENT' || role === 'TUTOR') {
    heading('Classes');
    table(
      ['Date', 'Title', 'Type', 'Duration', 'Status'],
      data.classes
        .slice()
        .sort((a, b) => String(b.startUTC).localeCompare(String(a.startUTC)))
        .map((c) => [dateTime(c.startUTC), str(c.title), label(c.classType), `${str(c.durationMinutes)} min`, label(c.status)]),
      'No classes yet.',
    );
  }

  if (role === 'STUDENT') {
    const titles = new Map(data.classes.map((c) => [c.publicId, c]));
    heading('Attendance');
    table(
      ['Date', 'Class', 'Status', 'Minutes present'],
      data.attendance
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((a) => {
          const cls = titles.get(a.classPublicId);
          return [date(cls?.startUTC ?? a.createdAt), str(cls?.title), label(a.status), str(a.durationPresentMinutes)];
        }),
      'No attendance records yet.',
    );
  }

  heading('Wallet transactions');
  table(
    ['Date', 'Description', 'Type', 'Amount', 'Balance after'],
    data.walletTransactions.map((t) => [
      date(t.createdAt), str(t.description), label(t.type), credits(t.amountCents), credits(t.balanceAfterCents),
    ]),
    'No transactions yet.',
  );

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - marginX, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  doc.save(`brainbaseedu-my-data-${new Date().toISOString().slice(0, 10)}.pdf`);
}
