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
 *  - 3 Parents linked to students
 *  - Scheduled / completed / live classes
 *  - Wallets with balances and transactions
 *  - Attendance records
 *  - Ratings
 *  - 2 Support tickets
 *  - Sample worksheets (published + draft)
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
import { ParentProfileModel } from '../modules/parents/parent.model';
import { WorksheetModel } from '../modules/worksheets/worksheet.model';

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
  // Parents
  { publicId: uid(), email: 'parent1@takshashila.com', firstName: 'Suresh', lastName: 'Gupta', role: 'PARENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98400 00001', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'parent2@takshashila.com', firstName: 'Lakshmi', lastName: 'Sharma', role: 'PARENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98400 00002', timezone: 'Asia/Kolkata' },
  { publicId: uid(), email: 'parent3@takshashila.com', firstName: 'Vijay', lastName: 'Reddy', role: 'PARENT', status: 'ACTIVE', emailVerified: true, phone: '+91 98400 00003', timezone: 'Asia/Kolkata' },
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
    ParentProfileModel.deleteMany({}),
    WorksheetModel.deleteMany({}),
  ]);
  ok('Cleared previous data');

  step('Hashing passwords');
  const passwordHash = await hashPw(PASSWORD);
  ok('Password hashed');

  step('Creating users (21)');
  const createdUsers = await UserModel.insertMany(
    USERS.map((u) => ({ ...u, passwordHash, loginCount: 0, twoFAEnabled: false, isDeleted: false }))
  );
  ok(`Created ${createdUsers.length} users`);

  const byEmail = (email: string) => createdUsers.find((u: any) => u.email === email)!;

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
  const parent1      = byEmail('parent1@takshashila.com');
  const parent2      = byEmail('parent2@takshashila.com');
  const parent3      = byEmail('parent3@takshashila.com');

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

  // Fetch student profiles to get their publicIds for parent linking
  const studentProfiles = await StudentProfileModel.find({}).lean() as any[];
  const spByUser = (userPid: string) => studentProfiles.find((sp: any) => sp.userPublicId === userPid)!;

  step('Creating parent profiles');
  await ParentProfileModel.insertMany([
    {
      publicId: uid(),
      userPublicId: parent1.publicId,
      // parent1 is Suresh Gupta parent of Aanya (student1) and Rohan (student2)
      childStudentPublicIds: [spByUser(student1.publicId).publicId, spByUser(student2.publicId).publicId],
      isDeleted: false,
    },
    {
      publicId: uid(),
      userPublicId: parent2.publicId,
      // parent2 is Lakshmi Sharma parent of Priya (student3) and Kabir (student4)
      childStudentPublicIds: [spByUser(student3.publicId).publicId, spByUser(student4.publicId).publicId],
      isDeleted: false,
    },
    {
      publicId: uid(),
      userPublicId: parent3.publicId,
      // parent3 is Vijay Reddy parent of Meera (student5), Aryan (student6), and Nisha (student7)
      childStudentPublicIds: [spByUser(student5.publicId).publicId, spByUser(student6.publicId).publicId, spByUser(student7.publicId).publicId],
      isDeleted: false,
    },
  ]);
  ok('Created 3 parent profiles (linked to 7 students)');

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

  step('Creating worksheets');
  await WorksheetModel.insertMany([
    // Math tutor worksheets
    {
      publicId: uid(), tutorPublicId: tpMath.publicId,
      title: 'Derivatives & Integration Practice Set 1',
      description: 'Foundational exercises covering differentiation rules, chain rule, and basic integrals.',
      content: `# Derivatives & Integration Practice Set 1\n\n## Differentiation\n\n1. Find dy/dx for y = 3x⁴ − 5x² + 7x − 2\n2. Differentiate f(x) = (2x + 1)⁵ using the chain rule\n3. Find the derivative of g(x) = sin(3x)·cos(x)\n\n## Integration\n\n4. Evaluate ∫(4x³ − 6x + 5) dx\n5. Compute ∫sin(2x) dx\n6. Find ∫(x² + 1)/(x) dx\n\n**Bonus:** Prove that d/dx[ln(x)] = 1/x from first principles.`,
      subject: 'Mathematics', sharedWithStudentPublicIds: [], status: 'PUBLISHED', isDeleted: false,
    },
    {
      publicId: uid(), tutorPublicId: tpMath.publicId,
      title: 'JEE Algebra Quadratics & Sequences',
      description: 'High-yield JEE problems on quadratic equations, AP/GP series, and binomial theorem.',
      content: `# JEE Algebra Practice\n\n## Quadratic Equations\n\n1. If α and β are roots of 2x² − 5x + 3 = 0, find α² + β² and αβ.\n2. For what values of k does x² − kx + (k+3) = 0 have equal roots?\n\n## Arithmetic & Geometric Progressions\n\n3. The 5th term of an AP is 17 and the 9th term is 33. Find the 20th term.\n4. Sum of an infinite GP is 12 and the first term is 4. Find the common ratio.\n\n## Binomial Theorem\n\n5. Find the middle term in (2x − 1/x)⁸`,
      subject: 'Mathematics', sharedWithStudentPublicIds: [spByUser(student1.publicId).publicId], status: 'PUBLISHED', isDeleted: false,
    },
    {
      publicId: uid(), tutorPublicId: tpMath.publicId,
      title: 'Trigonometry Identities DRAFT',
      description: 'Work in progress identities worksheet for Grade 11.',
      content: `# Trigonometry Identities\n\n(Coming soon Pythagorean, compound angle, and double angle identities)`,
      subject: 'Mathematics', sharedWithStudentPublicIds: [], status: 'DRAFT', isDeleted: false,
    },
    // Physics tutor worksheets
    {
      publicId: uid(), tutorPublicId: tpPhysics.publicId,
      title: "Newton's Laws Conceptual Problems",
      description: 'Free-body diagrams, friction, and system-of-particles problems.',
      content: `# Newton's Laws of Motion\n\n## Free Body Diagrams\n\n1. Draw FBDs for a 5 kg block on a 30° frictionless incline.\n2. A 10 kg box is pushed with 80 N on a surface with μ = 0.3. Find acceleration.\n\n## System Problems\n\n3. Two blocks (3 kg and 7 kg) connected by a string over a pulley. Find acceleration and tension.\n4. A lift accelerates upward at 2 m/s². What does a 60 kg person weigh on the scale inside?\n\n**Challenge:** Explain why a horse cannot pull a cart using Newton's 3rd Law.`,
      subject: 'Physics', sharedWithStudentPublicIds: [], status: 'PUBLISHED', isDeleted: false,
    },
    {
      publicId: uid(), tutorPublicId: tpPhysics.publicId,
      title: 'Electrostatics Coulomb & Gauss',
      description: "Coulomb's law calculations, electric field lines, Gauss's law applications.",
      content: `# Electrostatics Practice\n\n## Coulomb's Law\n\n1. Two charges +4μC and −6μC are 0.3 m apart. Find the force between them.\n2. At what point on the line joining them is the net field zero?\n\n## Electric Field & Potential\n\n3. Find E at a point 0.2 m from a +5μC charge in vacuum.\n4. Calculate the work done moving a +2μC charge from A (V=100V) to B (V=40V).\n\n## Gauss's Law\n\n5. State Gauss's Law and use it to find E inside and outside a uniformly charged sphere.`,
      subject: 'Physics', sharedWithStudentPublicIds: [spByUser(student3.publicId).publicId, spByUser(student4.publicId).publicId], status: 'PUBLISHED', isDeleted: false,
    },
    // Chemistry tutor worksheets
    {
      publicId: uid(), tutorPublicId: tpChem.publicId,
      title: 'Organic Chemistry Functional Groups & Reactions',
      description: 'Identification of functional groups, IUPAC naming, and key reaction mechanisms.',
      content: `# Organic Chemistry Worksheet\n\n## Functional Group Identification\n\n1. Identify all functional groups in Adrenaline (epinephrine).\n2. Draw structural formulas for: (a) ethanol (b) ethanal (c) ethanoic acid\n\n## IUPAC Naming\n\n3. Name: CH₃−CH(OH)−CH₂−CHO\n4. Name: CH₂=CH−C≡CH\n\n## Reactions\n\n5. Write the mechanism for the SN2 reaction of CH₃Br with OH⁻.\n6. What product forms when ethanol is oxidised with acidified K₂Cr₂O₇?`,
      subject: 'Chemistry', sharedWithStudentPublicIds: [], status: 'PUBLISHED', isDeleted: false,
    },
    // English tutor worksheets
    {
      publicId: uid(), tutorPublicId: tpEnglish.publicId,
      title: 'IELTS Writing Task 2 Opinion & Discussion Essays',
      description: 'Model essays, structural templates, and vocabulary for Band 7+ academic writing.',
      content: `# IELTS Writing Task 2 Guide\n\n## Essay Structure\n\n**Introduction:** Paraphrase the question + state your thesis (2-3 sentences)\n**Body 1:** Main argument with example\n**Body 2:** Counter-argument or second point with example\n**Conclusion:** Restate thesis + final thought\n\n## Practice Questions\n\n1. *"Technology is making people more isolated. Do you agree or disagree?"* (40 min)\n2. *"Some believe university education should be free for all. Discuss both views."* (40 min)\n\n## Useful Linking Phrases\n- Firstly / Furthermore / In addition / However / On the contrary\n- It is widely acknowledged that… / There is no denying that…\n- In conclusion / To sum up / All things considered…`,
      subject: 'English', sharedWithStudentPublicIds: [], status: 'PUBLISHED', isDeleted: false,
    },
    {
      publicId: uid(), tutorPublicId: tpEnglish.publicId,
      title: 'Grammar Mastery Tenses & Passive Voice',
      description: 'Tense revision, passive voice transformation, and common grammar mistakes to avoid.',
      content: `# Grammar Mastery Worksheet\n\n## Tenses\n\nFill in the correct tense:\n1. She ___ (study) for three hours by the time her friends arrived.\n2. By next month, I ___ (complete) this course.\n3. He ___ (work) here since 2019.\n\n## Passive Voice\n\nTransform to passive:\n4. The chef prepared the meal.\n5. Scientists are conducting new experiments.\n6. They had finished the project before the deadline.\n\n## Error Correction\n\nCorrect the errors:\n7. "Neither of the students have submitted their assignment."\n8. "He is more taller than his brother."`,
      subject: 'English', sharedWithStudentPublicIds: [spByUser(student7.publicId).publicId, spByUser(student8.publicId).publicId], status: 'PUBLISHED', isDeleted: false,
    },
  ]);
  ok('Created 8 worksheets (7 published, 1 draft)');

  process.stdout.write('\n');
  process.stdout.write('='.repeat(60) + '\n');
  process.stdout.write('  SEED COMPLETE - password for all: Seed@1234!\n');
  process.stdout.write('='.repeat(60) + '\n');
  process.stdout.write('  superadmin@takshashila.com     (Super Admin)\n');
  process.stdout.write('  admin@takshashila.com          (Admin)\n');
  process.stdout.write('  support@takshashila.com        (Support)\n');
  process.stdout.write('  principal1@takshashila.com     (Greenfield Academy)\n');
  process.stdout.write('  principal2@takshashila.com     (Sunrise Institute)\n');
  process.stdout.write('  tutor.math@takshashila.com     (Maths - 2 students)\n');
  process.stdout.write('  tutor.physics@takshashila.com  (Physics - 2 students)\n');
  process.stdout.write('  tutor.chemistry@takshashila.com (Chemistry - 2 students)\n');
  process.stdout.write('  tutor.english@takshashila.com  (English - 2 students)\n');
  process.stdout.write('  student1@takshashila.com .. student8@takshashila.com\n');
  process.stdout.write('  parent1@takshashila.com        (Suresh Gupta → student1, student2)\n');
  process.stdout.write('  parent2@takshashila.com        (Lakshmi Sharma → student3, student4)\n');
  process.stdout.write('  parent3@takshashila.com        (Vijay Reddy → student5, student6, student7)\n');
  process.stdout.write('='.repeat(60) + '\n\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`\n[ERROR] Seed failed: ${err.message}\n`);
  if (err.errors) process.stderr.write(JSON.stringify(err.errors, null, 2) + '\n');
  process.exit(1);
});
