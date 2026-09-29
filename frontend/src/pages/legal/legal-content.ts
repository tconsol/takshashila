/**
 * Draft legal documents shown at /privacy, /terms, /cookies and /data-policy.
 *
 * IMPORTANT: these are working drafts written from what the platform actually
 * does. Have a lawyer review the wording for the places where users live (for
 * example India, the United States and the EU/UK), especially for children,
 * before relying on them. Replace the bracketed company details.
 *
 * Bump LEGAL_VERSION here AND on the server (server/src/config/legal.ts)
 * together whenever the text changes materially.
 */
export const LEGAL_VERSION = '2026-10-01';
export const LEGAL_EFFECTIVE = '1 October 2026';
export const COMPANY = '[Company legal name], [registered address]';
export const CONTACT_EMAIL = 'support@brainbaseedu.com';

export interface LegalSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface LegalDoc {
  slug: 'privacy' | 'terms' | 'cookies' | 'data-policy';
  title: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What personal data brainbaseedu collects, why, who sees it, who it is shared with, and how long it is kept.',
    sections: [
      {
        heading: 'Who we are',
        body: [
          `brainbaseedu ("we", "us") is an online tutoring platform run by ${COMPANY}. This policy explains how we handle personal data when you use our website and mobile app. Questions: ${CONTACT_EMAIL}.`,
        ],
      },
      {
        heading: 'What we collect',
        body: ['We collect only what the platform needs to work:'],
        bullets: [
          'Identity and contact: name, email, phone number, Student ID, profile photo, time zone.',
          "Children's data: grade, school district, county and state, the parent or guardian linked to the account, and the parent's email.",
          'Sign-in and device: password (stored only in scrambled form), last login time, IP address, browser and device details, login sessions, and phone push tokens.',
          'Learning: classes booked and attended, when each person joined, attendance, homework and quiz answers and scores, grades, feedback, ratings and courses.',
          'Money: wallet balance, every credit and debit, payout details and payment records with our payment providers. We do not store full card numbers.',
          'Communication: chat messages and attachments, support tickets and notifications.',
          'Staff records: an audit log of important actions, including the actor, IP address and browser.',
        ],
      },
      {
        heading: 'Why we use it',
        body: ['We use personal data to run accounts, connect students with tutors, deliver live classes, take payments and pay tutors, keep the platform safe, prevent fraud, give support, and meet legal duties. We do not sell personal data.'],
      },
      {
        heading: 'Who can see it',
        body: [
          'A student’s classes, attendance and progress are visible to that student, their tutor, their linked parent or guardian, the principal of the tutor’s organization, and platform staff who need it to help or investigate. Tutors see only their own students. Chat is visible only to the people in the conversation and to staff handling a report.',
        ],
      },
      {
        heading: 'Companies that receive data',
        body: ['We use service providers who process data for us:'],
        bullets: [
          'Stripe and Razorpay: payments.',
          'Agora: live video, audio and whiteboard.',
          'Google: sign-in with Google and cloud file storage.',
          'Pusher: real-time messages.',
          'Firebase and Expo: phone alerts.',
          'An email provider: account and notification emails.',
          'Database and cache hosting providers.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'Students may be under 18. A child’s account must be created by, or with the agreement of, a parent or guardian, who agrees to this policy and the Terms of Use on the child’s behalf. We record who agreed, when and to which version. A parent or guardian can ask us to show, correct or delete a child’s data at any time.',
        ],
      },
      {
        heading: 'How long we keep data',
        body: ['See the Data Retention and Deletion Policy. In short: account data until you delete your account; money records for as long as accounting law requires; audit logs for a fixed period.'],
      },
      {
        heading: 'Your rights',
        body: [
          `You can download your data and delete your account from Profile → Security. You can also ask us to correct your details, restrict or object to a use, or withdraw consent by writing to ${CONTACT_EMAIL}. Depending on where you live you may also have the right to complain to your data-protection authority.`,
        ],
      },
      {
        heading: 'Security',
        body: ['Passwords are stored hashed. Traffic is encrypted in transit. Access to personal data is limited by role and recorded in an audit log. No system is perfectly secure; if a breach affects you we will tell you as the law requires.'],
      },
      {
        heading: 'Changes',
        body: ['If we change this policy in a way that matters we will update the version and date below and ask you to agree again.'],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    summary: 'The rules for students, tutors, principals and parents, including payments, refunds, cancellation fees and behaviour in classes.',
    sections: [
      {
        heading: 'Agreeing to these terms',
        body: [
          'By creating an account or using brainbaseedu you agree to these Terms and to the Privacy Policy. If you create or manage an account for a child you agree for them and are responsible for their use.',
        ],
      },
      {
        heading: 'Accounts',
        body: ['Give accurate details, keep your password private, and tell us if you think your account was misused. One person, one account. Students under 18 need a parent or guardian’s agreement.'],
      },
      {
        heading: 'Credits, payments and payouts',
        body: ['The platform uses credits (1 credit = 1 US dollar).'],
        bullets: [
          'Free demo credits are for demo classes only. They cannot be spent on paid classes, courses or programs, and cannot be withdrawn.',
          'A paid one-on-one class is charged when it is completed and the student attended: the tutor’s hourly rate in proportion to the class length, plus a flat platform fee. The tutor receives the rate minus the platform fee.',
          'Courses and skill programs are charged up front when accepted or enrolled.',
          'Tutors can request a payout of earned credits above the minimum. Earnings are held for 48 hours after a class so refunds and disputes can be handled.',
        ],
      },
      {
        heading: 'Cancellations and refunds',
        body: [
          'A class can be cancelled by the tutor or the student. Cancelling a paid class less than 24 hours before it starts costs the person who cancels a platform fee of 1 credit. Earlier cancellations and demo classes are free. If a class was already charged, the student is refunded. Platform staff can refund a completed class where it did not take place properly.',
        ],
      },
      {
        heading: 'Behaviour in classes',
        body: ['Be respectful. No harassment, hate speech, sharing of private contact details to avoid the platform, illegal content, cheating, or recording a class without everyone’s permission. We may suspend or remove accounts that break these rules.'],
      },
      {
        heading: 'Tutors and organizations',
        body: ['Tutors are independent and responsible for the accuracy of their profile and the quality of their teaching. Principals are responsible for the tutors and students they manage on the platform.'],
      },
      {
        heading: 'Our responsibilities',
        body: ['We work to keep the service available but do not guarantee it will be uninterrupted or error-free. To the extent the law allows, we are not liable for indirect losses, and our total liability is limited to the amount you paid us in the previous 12 months.'],
      },
      {
        heading: 'Changes and contact',
        body: [`We may update these Terms; if the change matters we will ask you to agree again. Contact: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    summary: 'The cookies and browser storage we use, and the outside scripts the site loads.',
    sections: [
      {
        heading: 'What we store in your browser',
        body: ['We keep the browser storage strictly needed to run the service:'],
        bullets: [
          'Sign-in cookies that keep you logged in and protect your session.',
          'Local storage for preferences such as theme, the last tab you used, and your consent choice.',
        ],
      },
      {
        heading: 'Outside scripts',
        body: [
          'To take payments and provide live classes and sign-in, pages may load scripts from Stripe, Razorpay, Agora and Google. These providers may set their own cookies or read your IP address and device details. See their policies for details.',
        ],
      },
      {
        heading: 'Your choice',
        body: [
          'We show a notice on your first visit. You can accept all or keep only the strictly necessary storage, and change your mind at any time by clearing your browser data. Blocking necessary storage will stop sign-in from working.',
        ],
      },
    ],
  },
  {
    slug: 'data-policy',
    title: 'Data Retention, Deletion and Management Policy',
    summary: 'How to ask for your data or its deletion, what is kept and for how long, who inside the company and inside a school can see what, and how data is protected.',
    sections: [
      {
        heading: 'Deleting your data',
        body: [
          'You can close your own account from Profile → Security → Delete my account. You must confirm with your password and by typing DELETE. Before closing, any wallet balance, pending payout, booked or live classes, active courses or skill program enrolments must be settled. We sign you out everywhere, free your email address and email you a confirmation.',
          `You can also ask in writing (${CONTACT_EMAIL}). We aim to reply within 30 days.`,
        ],
      },
      {
        heading: 'What is kept and for how long',
        body: ['Deleted accounts are hidden at once and can be restored by an administrator for a short recovery period. After that period personal data is removed, except records we must keep:'],
        bullets: [
          'Money records (wallet transactions, payouts, payments and refunds): as long as tax and accounting law require, typically 7 years.',
          'Audit logs: 12 months, longer where an investigation needs them.',
          'Chat and attachments: deleted with the account, or on request, unless needed for a report or dispute.',
          'Attendance and learning records: deleted with the account; kept for a student’s school or parent only while the account exists.',
        ],
      },
      {
        heading: 'Download your data',
        body: ['Profile → Security → Download my data gives you a file with your account, profile, wallet and transactions, classes and attendance.'],
      },
      {
        heading: 'Who can see what',
        body: [],
        bullets: [
          'Students: their own data.',
          'Tutors: their own students’ classes, attendance, homework and grades.',
          'Principals: the tutors and students of their organization. A student is only linked to an organization through their tutor; the platform tells the student or parent.',
          'Parents: their linked children’s classes, attendance and progress, after the child accepts the link.',
          'Platform staff: only what their role needs, and every important staff action is written to an audit log.',
        ],
      },
      {
        heading: 'How data is protected and what happens after a breach',
        body: [
          'Access is limited by role. Passwords are hashed, traffic is encrypted, backups are kept by our hosting providers, and staff actions are logged. If personal data is exposed we will investigate at once, contain it, and tell affected people and regulators within the time the law requires.',
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
