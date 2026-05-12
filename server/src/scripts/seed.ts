/**
 * Seed Script - Takshashila LMS
 *
 * Run:  npm run seed
 *
 * Creates a full demo dataset:
 *  - 1 Super Admin, 1 Admin, 1 Support agent
 *  - 2 Principals (Greenfield Academy, Sunrise Institute)
 *  - 4 Tutors (Mathematics, Physics, Chemistry, English)
 *  - 8 Students (2 per tutor)
 *  - Scheduled / completed / live classes
 *  - Wallets with balances and transactions
 *  - Attendance records
 *  - Ratings
 *  - 2 Support tickets
 *
 * All passwords: Seed@1234!
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { UserModel } from '../modules/users/user.model';
import { TutorProfileModel } from '../modules/tutors/tutor.model';
import { StudentProfileModel } from '../modules/students/student.model';
import { PrincipalProfileModel } from '../modules/principals/principal.model';
import { WalletModel } from '../modules/wallets/wallet.model';
import { WalletTransactionModel } from '../modules/wallets/wallet-transaction.model';
import { ScheduledClassModel } from '../modules/schedules/schedule.model';
import { AttendanceModel } from '../modules/attendance/attendance.model';
import { RatingModel } from '../modules/ratings/rating.model';
import { TicketModel, TicketMessageModel } from '../modules/support/support.model';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/takshashila';
const PASSWORD = 'Seed@1234!';

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

async function hashPw(plain: string) {
  return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

function uid() { return uuidv4(); }

const step = (msg: string) => process.stdout.write(`[seed] ${msg}...\n`);
const ok = (msg: string) => process.stdout.write(`[done] ${msg}\n`);

const USERS = [
  { publicId: uid(), email: 'superadmin@takshashila.com', firstName: 'Vikram', lastName: 'Singh', role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true, phone: '+91 98000 00001', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'admin@takshashila.com', firstName: 'Priya', lastName: 'Nair', role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phone: '+91 98000 00002', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'support@takshashila.com', firstName: 'Arjun', lastName: 'Kumar', role: 'SUPPORT', status: 'ACTIVE', emailVerified: true, phone: '+91 98000 00003', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'principal1@takshashila.com', firstName: 'Anita', lastName: 'Rao', role: 'PRINCIPAL', status: 'ACTIVE', emailVerified: true, phone: '+91 98100 00001', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'principal2@takshashila.com', firstName: 'Ravi', lastName: 'Sharma', role: 'PRINCIPAL', status: 'ACTIVE', emailVerified: true, phone: '+91 98100 00002', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'tutor.math@takshashila.com', firstName: 'Dr. Mehul', lastName: 'Joshi', role: 'TUTOR', status: 'ACTIVE', emailVerified: true, phone: '+91 98200 00001', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'tutor.physics@takshashila.com', firstName: 'Sunita', lastName: 'Patel', role: 'TUTOR', status: 'ACTIVE', emailVerified: true, phone: '+91 98200 00002', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'tutor.chemistry@takshashila.com', firstName: 'Karan', lastName: 'Malhotra', role: 'TUTOR', status: 'ACTIVE', emailVerified: true, phone: '+91 98200 00003', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'tutor.english@takshashila.com', firstName: 'Deepa', lastName: 'Menon', role: 'TUTOR', status: 'ACTIVE', emailVerified: true, phone: '+91 98200 00004', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student1@takshashila.com', firstName: 'Aanya', lastName: 'Gupta', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00001', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student2@takshashila.com', firstName: 'Rohan', lastName: 'Verma', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00002', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student3@takshashila.com', firstName: 'Priya', lastName: 'Sharma', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00003', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student4@takshashila.com', firstName: 'Kabir', lastName: 'Singh', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00004', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student5@takshashila.com', firstName: 'Meera', lastName: 'Iyer', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00005', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student6@takshashila.com', firstName: 'Aryan', lastName: 'Khanna', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00006', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student7@takshashila.com', firstName: 'Nisha', lastName: 'Reddy', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00007', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'student8@takshashila.com', firstName: 'Dev', lastName: 'Kapoor', role: 'STUDENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98300 00008', timezone: 'Asia/Kolkata' },
];

async function main() {
  step('Connecting to MongoDB');
  await mongoose.connect(MONGO_URI);
  ok('Connected to MongoDB');

  step('Clearing previous data');
  await Promise.all([
    UserModel.deleteMany({}),
    TutorProfileModel.deleteMany({}),
    StudentProfileModel.deleteMany({}),
    PrincipalProfileModel.deleteMany({}),
    WalletModel.deleteMany({}),
    WalletTransactionModel.deleteMany({}),
    ScheduledClassModel.deleteMany({}),
    AttendanceModel.deleteMany({}),
    RatingModel.deleteMany({}),
    TicketModel.deleteMany({}),
    TicketMessageModel.deleteMany({}),
  ]);
  ok('Cleared previous data');

  step('Hashing passwords');
  const passwordHash = await hashPw(PASSWORD);
  ok('Password hashed');

  step('Creating users (18)');
  const createdUsers = await UserModel.insertMany(
    USERS.map((u) => ({ ...u, passwordHash, loginCount: 0, twoFAEnabled: false, isDeleted: false }))
  );
  ok(`Created ${createdUsers.length} users`);

  const byEmail = (email: string) => createdUsers.find((u) => u.email === email)!;

  const superAdmin   = byEmail('superadmin@takshashila.com');
  const principal1   = byEmail('principal1@takshashila.com');
  const principal2   = byEmail('principal2@takshashila.com');
  const tutorMath    = byEmail('tutor.math@takshashila.com');
  const tutorPhysics = byEmail('tutor.physics@takshashila.com');
  const tutorChem    = byEmail('tutor.chemistry@takshashila.com');
  const tutorEnglish = byEmail('tutor.english@takshashila.com');
  const student1     = byEmail('student1@takshashila.com');
  const student2     = byEmail('student2@takshashila.com');
  const student3     = byEmail('student3@takshashila.com');
  const student4     = byEmail('student4@takshashila.com');
  const student5     = byEmail('student5@takshashila.com');
  const student6     = byEmail('student6@takshashila.com');
  const student7     = byEmail('student7@takshashila.com');
  const student8     = byEmail('student8@takshashila.com');
  const supportAgent = byEmail('support@takshashila.com');

  step('Creating wallets');
  await WalletModel.insertMany(
    createdUsers.map((u) => ({
      publicId: uid(),
      ownerPublicId: u.publicId,
      balanceCents: (() => {
        if (u.role === 'STUDENT') return Math.floor(Math.random() * 500000 + 50000);
        if (u.role === 'TUTOR') return Math.floor(Math.random() * 1000000 + 100000);
        if (u.role === 'PRINCIPAL') return Math.floor(Math.random() * 2000000 + 500000);
        return 0;
      })(),
      demoCreditsCents: u.role === 'STUDENT' ? 15000 : 0,
      purchasedCreditsCents: u.role === 'STUDENT' ? 50000 : 0,
      bonusCreditsCents: u.role === 'STUDENT' ? 10000 : 0,
      earnedCreditsCents: u.role === 'TUTOR' ? 250000 : 0,
      totalEarnedCents: u.role === 'TUTOR' ? 350000 : u.role === 'PRINCIPAL' ? 800000 : 0,
      totalSpentCents: u.role === 'STUDENT' ? 120000 : 0,
      currency: 'USD',
      isLocked: false,
      isDeleted: false,
    }))
  );
  ok('Created wallets');

  step('Creating principal profiles');
  const pp1 = {
    publicId: uid(), userPublicId: principal1.publicId, status: 'ACTIVE',
    organizationName: 'Greenfield Academy', organizationWebsite: 'https://greenfield.edu',
    bio: 'Premier STEM education institution serving 200+ students across Mumbai.',
    commissionRatePercent: 15, totalTutors: 2, totalStudents: 4, totalRevenueCents: 450000,
    trustScore: 90, approvedBy: superAdmin.publicId, approvedAt: daysAgo(90), isDeleted: false,
  };
  const pp2 = {
    publicId: uid(), userPublicId: principal2.publicId, status: 'ACTIVE',
    organizationName: 'Sunrise Institute', organizationWebsite: 'https://sunrise.edu',
    bio: 'Holistic learning environment with focus on sciences and languages.',
    commissionRatePercent: 12, totalTutors: 2, totalStudents: 4, totalRevenueCents: 320000,
    trustScore: 85, approvedBy: superAdmin.publicId, approvedAt: daysAgo(60), isDeleted: false,
  };
  await PrincipalProfileModel.insertMany([pp1, pp2]);
  ok('Created 2 principal profiles');

  step('Creating tutor profiles');
  const tutorProfiles = await TutorProfileModel.insertMany([
    {
      publicId: uid(), userPublicId: tutorMath.publicId, principalPublicId: pp1.publicId,
      status: 'ACTIVE', subjects: ['Mathematics', 'Statistics', 'Calculus'], languages: ['English', 'Hindi', 'Gujarati'],
      hourlyRateCents: 150000, commissionRatePercent: 20,
      bio: '12 years teaching advanced mathematics. IIT Bombay alumni. Specialised in JEE, CAT prep.',
      qualifications: ['B.Tech IIT Bombay', 'M.Sc Mathematics', 'JEE Expert Trainer'],
      timezone: 'Asia/Kolkata', trustScore: 95, totalStudents: 2, totalClassesCompleted: 48,
      totalEarningsCents: 720000, rating: 4.9, ratingCount: 42,
      isVerified: true, verifiedAt: daysAgo(80), verifiedBy: pp1.publicId, isDeleted: false,
    },
    {
      publicId: uid(), userPublicId: tutorPhysics.publicId, principalPublicId: pp1.publicId,
      status: 'ACTIVE', subjects: ['Physics', 'Applied Physics', 'Mechanics'], languages: ['English', 'Hindi'],
      hourlyRateCents: 130000, commissionRatePercent: 20,
      bio: 'MSc Physics from Delhi University. 8 years of experience. Making complex concepts simple.',
      qualifications: ['MSc Physics Delhi University', 'B.Ed', 'NEET Specialist'],
      timezone: 'Asia/Kolkata', trustScore: 88, totalStudents: 2, totalClassesCompleted: 35,
      totalEarningsCents: 455000, rating: 4.7, ratingCount: 29,
      isVerified: true, verifiedAt: daysAgo(75), verifiedBy: pp1.publicId, isDeleted: false,
    },
    {
      publicId: uid(), userPublicId: tutorChem.publicId, principalPublicId: pp2.publicId,
      status: 'ACTIVE', subjects: ['Chemistry', 'Organic Chemistry', 'Physical Chemistry'], languages: ['English', 'Hindi', 'Punjabi'],
      hourlyRateCents: 120000, commissionRatePercent: 20,
      bio: 'Certified chemistry educator with 6 years experience. Turning chemistry fear into love.',
      qualifications: ['MSc Chemistry', 'B.Ed', 'CSIR NET Qualified'],
      timezone: 'Asia/Kolkata', trustScore: 82, totalStudents: 2, totalClassesCompleted: 28,
      totalEarningsCents: 336000, rating: 4.6, ratingCount: 22,
      isVerified: true, verifiedAt: daysAgo(55), verifiedBy: pp2.publicId, isDeleted: false,
    },
    {
      publicId: uid(), userPublicId: tutorEnglish.publicId, principalPublicId: pp2.publicId,
      status: 'ACTIVE', subjects: ['English Literature', 'Grammar', 'Creative Writing', 'IELTS'], languages: ['English', 'Malayalam', 'Hindi'],
      hourlyRateCents: 100000, commissionRatePercent: 20,
      bio: 'MA English Literature from Hyderabad University. Specialised in IELTS/TOEFL prep.',
      qualifications: ['MA English Literature', 'CELTA Certified', 'IELTS Expert'],
      timezone: 'Asia/Kolkata', trustScore: 79, totalStudents: 2, totalClassesCompleted: 22,
      totalEarningsCents: 220000, rating: 4.5, ratingCount: 18,
      isVerified: true, verifiedAt: daysAgo(40), verifiedBy: pp2.publicId, isDeleted: false,
    },
  ]);
  ok('Created 4 tutor profiles');

  const tpMath    = tutorProfiles[0];
  const tpPhysics = tutorProfiles[1];
  const tpChem    = tutorProfiles[2];
  const tpEnglish = tutorProfiles[3];

  step('Creating student profiles');
  await StudentProfileModel.insertMany([
    { publicId: uid(), userPublicId: student1.publicId, tutorPublicId: tpMath.publicId, status: 'ACTIVE', grade: 'Grade 11', demoClassesUsed: 1, totalClassesAttended: 18, totalClassesMissed: 2, totalClassesBooked: 20, attendanceRate: 90, invitedBy: tpMath.publicId, approvedBy: tpMath.publicId, approvedAt: daysAgo(70), isDeleted: false },
    { publicId: uid(), userPublicId: student2.publicId, tutorPublicId: tpMath.publicId, status: 'ACTIVE', grade: 'Grade 12', demoClassesUsed: 1, totalClassesAttended: 15, totalClassesMissed: 1, totalClassesBooked: 16, attendanceRate: 94, invitedBy: tpMath.publicId, approvedBy: tpMath.publicId, approvedAt: daysAgo(65), isDeleted: false },
    { publicId: uid(), userPublicId: student3.publicId, tutorPublicId: tpPhysics.publicId, status: 'ACTIVE', grade: 'Grade 11', demoClassesUsed: 1, totalClassesAttended: 12, totalClassesMissed: 3, totalClassesBooked: 15, attendanceRate: 80, invitedBy: tpPhysics.publicId, approvedBy: tpPhysics.publicId, approvedAt: daysAgo(55), isDeleted: false },
    { publicId: uid(), userPublicId: student4.publicId, tutorPublicId: tpPhysics.publicId, status: 'ACTIVE', grade: 'Grade 12', demoClassesUsed: 2, totalClassesAttended: 10, totalClassesMissed: 0, totalClassesBooked: 10, attendanceRate: 100, invitedBy: tpPhysics.publicId, approvedBy: tpPhysics.publicId, approvedAt: daysAgo(50), isDeleted: false },
    { publicId: uid(), userPublicId: student5.publicId, tutorPublicId: tpChem.publicId, status: 'ACTIVE', grade: 'Grade 10', demoClassesUsed: 1, totalClassesAttended: 8, totalClassesMissed: 1, totalClassesBooked: 9, attendanceRate: 89, invitedBy: tpChem.publicId, approvedBy: tpChem.publicId, approvedAt: daysAgo(40), isDeleted: false },
    { publicId: uid(), userPublicId: student6.publicId, tutorPublicId: tpChem.publicId, status: 'ACTIVE', grade: 'Grade 11', demoClassesUsed: 1, totalClassesAttended: 7, totalClassesMissed: 2, totalClassesBooked: 9, attendanceRate: 78, invitedBy: tpChem.publicId, approvedBy: tpChem.publicId, approvedAt: daysAgo(38), isDeleted: false },
    { publicId: uid(), userPublicId: student7.publicId, tutorPublicId: tpEnglish.publicId, status: 'ACTIVE', grade: 'Undergraduate', demoClassesUsed: 1, totalClassesAttended: 6, totalClassesMissed: 0, totalClassesBooked: 6, attendanceRate: 100, invitedBy: tpEnglish.publicId, approvedBy: tpEnglish.publicId, approvedAt: daysAgo(30), isDeleted: false },
    { publicId: uid(), userPublicId: student8.publicId, tutorPublicId: tpEnglish.publicId, status: 'ACTIVE', grade: 'Grade 12', demoClassesUsed: 1, totalClassesAttended: 5, totalClassesMissed: 1, totalClassesBooked: 6, attendanceRate: 83, invitedBy: tpEnglish.publicId, approvedBy: tpEnglish.publicId, approvedAt: daysAgo(28), isDeleted: false },
  ]);
  ok('Created 8 student profiles');

  step('Creating scheduled classes');
  const classBase = (tutorPid: string, studentPid: string, title: string, cost: number) => ({
    publicId: uid(),
    tutorPublicId: tutorPid,
    studentPublicId: studentPid,
    title,
    ianaTimezone: 'Asia/Kolkata',
    durationMinutes: 60,
    costCents: cost,
    idempotencyKey: uid(),
    isDeleted: false,
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    meetingProvider: 'google_meet',
  });

  const classes = await ScheduledClassModel.insertMany([
    // Math - completed
    { ...classBase(tpMath.publicId, student1.publicId, 'Calculus - Derivatives & Integrals', 150000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(20), endUTC: new Date(daysAgo(20).getTime() + 3600000) },
    { ...classBase(tpMath.publicId, student1.publicId, 'JEE Prep - Algebra Intensive', 150000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(13), endUTC: new Date(daysAgo(13).getTime() + 3600000) },
    { ...classBase(tpMath.publicId, student2.publicId, 'Statistics - Probability Basics', 150000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(18), endUTC: new Date(daysAgo(18).getTime() + 3600000) },
    { ...classBase(tpMath.publicId, student2.publicId, 'Demo - Advanced Calculus', 0), classType: 'DEMO', status: 'COMPLETED', startUTC: daysAgo(67), endUTC: new Date(daysAgo(67).getTime() + 3600000) },
    // Math - upcoming
    { ...classBase(tpMath.publicId, student1.publicId, 'Integration Techniques', 150000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(2), endUTC: new Date(daysFromNow(2).getTime() + 3600000) },
    { ...classBase(tpMath.publicId, student2.publicId, 'Coordinate Geometry', 150000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(4), endUTC: new Date(daysFromNow(4).getTime() + 3600000) },
    { ...classBase(tpMath.publicId, student1.publicId, 'JEE Mock Test Review', 150000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(7), endUTC: new Date(daysFromNow(7).getTime() + 7200000) },
    // Physics - completed
    { ...classBase(tpPhysics.publicId, student3.publicId, "Newton's Laws of Motion", 130000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(15), endUTC: new Date(daysAgo(15).getTime() + 3600000) },
    { ...classBase(tpPhysics.publicId, student4.publicId, "Electrostatics - Coulomb's Law", 130000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(10), endUTC: new Date(daysAgo(10).getTime() + 3600000) },
    // Physics - upcoming
    { ...classBase(tpPhysics.publicId, student3.publicId, 'Wave Optics Fundamentals', 130000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(3), endUTC: new Date(daysFromNow(3).getTime() + 3600000) },
    { ...classBase(tpPhysics.publicId, student4.publicId, 'Electromagnetic Induction', 130000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(5), endUTC: new Date(daysFromNow(5).getTime() + 3600000) },
    // Chemistry - completed
    { ...classBase(tpChem.publicId, student5.publicId, 'Organic Chemistry - Hydrocarbons', 120000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(8), endUTC: new Date(daysAgo(8).getTime() + 3600000) },
    { ...classBase(tpChem.publicId, student6.publicId, 'Chemical Bonding & Molecular Structure', 120000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(6), endUTC: new Date(daysAgo(6).getTime() + 3600000) },
    // Chemistry - upcoming
    { ...classBase(tpChem.publicId, student5.publicId, 'Thermodynamics in Chemistry', 120000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(1), endUTC: new Date(daysFromNow(1).getTime() + 3600000) },
    { ...classBase(tpChem.publicId, student6.publicId, 'Electrochemistry Fundamentals', 120000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: daysFromNow(6), endUTC: new Date(daysFromNow(6).getTime() + 3600000) },
    // Live now
    { ...classBase(tpMath.publicId, student1.publicId, 'Live: Trigonometry Deep Dive', 150000), classType: 'ONE_ON_ONE', status: 'LIVE', startUTC: new Date(now.getTime() - 30 * 60000), endUTC: new Date(now.getTime() + 30 * 60000) },
    // English - completed
    { ...classBase(tpEnglish.publicId, student7.publicId, 'IELTS Writing Task 2 - Opinion Essays', 100000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(5), endUTC: new Date(daysAgo(5).getTime() + 3600000) },
    { ...classBase(tpEnglish.publicId, student8.publicId, 'English Grammar - Tenses & Voice', 100000), classType: 'ONE_ON_ONE', status: 'COMPLETED', startUTC: daysAgo(4), endUTC: new Date(daysAgo(4).getTime() + 3600000) },
    // English - upcoming
    { ...classBase(tpEnglish.publicId, student7.publicId, 'IELTS Speaking Practice', 100000), classType: 'ONE_ON_ONE', status: 'SCHEDULED', startUTC: hoursFromNow(26), endUTC: new Date(hoursFromNow(26).getTime() + 3600000) },
  ]);
  ok(`Created ${classes.length} classes`);

  step('Creating attendance records');
  const completedClasses = classes.filter((c) => (c as any).status === 'COMPLETED');
  await AttendanceModel.insertMany(
    completedClasses.map((cls: any) => ({
      publicId: uid(),
      classPublicId: cls.publicId,
      studentPublicId: cls.studentPublicId,
      tutorPublicId: cls.tutorPublicId,
      status: Math.random() > 0.15 ? 'PRESENT' : 'ABSENT',
      source: 'AUTOMATIC',
      joinedAt: new Date(cls.startUTC.getTime() + 2 * 60000),
      leftAt: new Date(cls.endUTC.getTime() - 5 * 60000),
      durationPresentMinutes: cls.durationMinutes - 7,
      remarks: Math.random() > 0.7 ? 'Good engagement, participated actively.' : undefined,
      isDeleted: false,
    }))
  );
  ok(`Created ${completedClasses.length} attendance records`);

  step('Creating ratings');
  const rateableClasses = [
    { cls: classes[0], rater: student1.publicId, score: 5, comment: 'Excellent session! Dr. Joshi explained derivatives so clearly. Finally understood the chain rule.' },
    { cls: classes[1], rater: student1.publicId, score: 5, comment: 'Amazing JEE preparation. He covers every angle of the problem.' },
    { cls: classes[2], rater: student2.publicId, score: 5, comment: "Best tutor I've had. Probability seems easy now!" },
    { cls: classes[7], rater: student3.publicId, score: 4, comment: "Great explanation of Newton's laws. Would love more practice problems." },
    { cls: classes[8], rater: student4.publicId, score: 5, comment: 'Perfect session on electrostatics. Crystal clear concepts now.' },
    { cls: classes[11], rater: student5.publicId, score: 5, comment: 'Karan made organic chemistry fun! Great analogies.' },
    { cls: classes[12], rater: student6.publicId, score: 4, comment: 'Good session on bonding, needed more time on hybridisation.' },
    { cls: classes[16], rater: student7.publicId, score: 5, comment: 'Deepa is an incredible IELTS coach. My writing improved drastically.' },
    { cls: classes[17], rater: student8.publicId, score: 4, comment: 'Clear grammar explanations. Very patient tutor.' },
  ];
  await RatingModel.insertMany(
    rateableClasses.map(({ cls, rater, score, comment }) => ({
      publicId: uid(),
      classPublicId: (cls as any).publicId,
      raterPublicId: rater,
      tutorPublicId: (cls as any).tutorPublicId,
      score,
      comment,
      isDeleted: false,
    }))
  );
  ok(`Created ${rateableClasses.length} ratings`);

  step('Creating wallet transactions');
  const walletS1 = await WalletModel.findOne({ ownerPublicId: student1.publicId }).lean();
  const walletTM = await WalletModel.findOne({ ownerPublicId: tutorMath.publicId }).lean();
  if (walletS1 && walletTM) {
    await WalletTransactionModel.insertMany([
      { publicId: uid(), idempotencyKey: uid(), walletPublicId: walletS1.publicId, ownerPublicId: student1.publicId, type: 'CREDIT', creditType: 'PURCHASED_CREDITS', amountCents: 200000, balanceBeforeCents: 50000, balanceAfterCents: 250000, description: 'Wallet top-up via Razorpay', status: 'COMPLETED', createdAt: daysAgo(30) },
      { publicId: uid(), idempotencyKey: uid(), walletPublicId: walletS1.publicId, ownerPublicId: student1.publicId, type: 'DEBIT', amountCents: 150000, balanceBeforeCents: 250000, balanceAfterCents: 100000, description: 'Payment: Calculus class booking', status: 'COMPLETED', createdAt: daysAgo(20) },
      { publicId: uid(), idempotencyKey: uid(), walletPublicId: walletS1.publicId, ownerPublicId: student1.publicId, type: 'DEBIT', amountCents: 150000, balanceBeforeCents: 100000, balanceAfterCents: 0, description: 'Payment: JEE Intensive booking', status: 'COMPLETED', createdAt: daysAgo(14) },
      { publicId: uid(), idempotencyKey: uid(), walletPublicId: walletTM.publicId, ownerPublicId: tutorMath.publicId, type: 'CREDIT', creditType: 'EARNED_CREDITS', amountCents: 120000, balanceBeforeCents: 480000, balanceAfterCents: 600000, description: 'Earnings: Calculus session (after 20% commission)', status: 'COMPLETED', createdAt: daysAgo(20) },
      { publicId: uid(), idempotencyKey: uid(), walletPublicId: walletTM.publicId, ownerPublicId: tutorMath.publicId, type: 'CREDIT', creditType: 'EARNED_CREDITS', amountCents: 120000, balanceBeforeCents: 600000, balanceAfterCents: 720000, description: 'Earnings: JEE Intensive (after 20% commission)', status: 'COMPLETED', createdAt: daysAgo(14) },
    ]);
    ok('Created 5 wallet transactions');
  }

  step('Creating support tickets');
  const ticket1 = await TicketModel.create({
    publicId: uid(), requesterPublicId: student1.publicId, assigneePublicId: supportAgent.publicId,
    subject: 'Unable to join live class - meeting link not working',
    category: 'TECHNICAL', priority: 'HIGH', status: 'IN_PROGRESS', isDeleted: false,
  });
  const ticket2 = await TicketModel.create({
    publicId: uid(), requesterPublicId: tutorMath.publicId, assigneePublicId: supportAgent.publicId,
    subject: 'Wallet payout not processed for last month',
    category: 'BILLING', priority: 'MEDIUM', status: 'OPEN', isDeleted: false,
  });
  await TicketMessageModel.insertMany([
    { publicId: uid(), ticketPublicId: ticket1.publicId, senderPublicId: student1.publicId, body: 'Hi, the Google Meet link for my 10 AM session is returning an error. I tried on both my phone and laptop. Please help urgently.', isInternal: false, createdAt: daysAgo(1) },
    { publicId: uid(), ticketPublicId: ticket1.publicId, senderPublicId: supportAgent.publicId, body: "Hi Aanya, we've received your request. The tutor has been notified and a fresh meeting link will be shared within 15 minutes.", isInternal: false, createdAt: daysAgo(1) },
    { publicId: uid(), ticketPublicId: ticket1.publicId, senderPublicId: supportAgent.publicId, body: 'Internal note: Meeting link expired. Auto-generated a new one and sent to both tutor and student.', isInternal: true, createdAt: daysAgo(1) },
    { publicId: uid(), ticketPublicId: ticket2.publicId, senderPublicId: tutorMath.publicId, body: "Hello, my earnings from last month haven't been credited to my bank account yet. The payout was supposed to be processed on the 1st. Please investigate.", isInternal: false, createdAt: daysAgo(2) },
  ]);
  ok('Created 2 tickets with messages');

  process.stdout.write('\n');
  process.stdout.write('='.repeat(57) + '\n');
  process.stdout.write('  SEED COMPLETE - password for all: Seed@1234!\n');
  process.stdout.write('='.repeat(57) + '\n');
  process.stdout.write('  superadmin@takshashila.com   (Super Admin)\n');
  process.stdout.write('  admin@takshashila.com        (Admin)\n');
  process.stdout.write('  support@takshashila.com      (Support)\n');
  process.stdout.write('  principal1@takshashila.com   (Greenfield Academy)\n');
  process.stdout.write('  principal2@takshashila.com   (Sunrise Institute)\n');
  process.stdout.write('  tutor.math@takshashila.com\n');
  process.stdout.write('  tutor.physics@takshashila.com\n');
  process.stdout.write('  tutor.chemistry@takshashila.com\n');
  process.stdout.write('  tutor.english@takshashila.com\n');
  process.stdout.write('  student1@takshashila.com .. student8@takshashila.com\n');
  process.stdout.write('='.repeat(57) + '\n\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`\n[ERROR] Seed failed: ${err.message}\n`);
  if (err.errors) process.stderr.write(JSON.stringify(err.errors, null, 2) + '\n');
  process.exit(1);
});
