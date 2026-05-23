/**
 * Seed Script - Takshashila LMS
 *
 * Run:  npm run seed
 *
 * Clears ALL collections and creates:
 *  - 1 Super Admin
 *  - 1 Admin
 *
 * Password for both: from SEED_PASSWORD env var (default: Seed@1234!)
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

const MONGO_URI = process.env.MONGODB_URI!;
const PASSWORD = process.env.SEED_PASSWORD ?? 'Seed@1234!';

if (!MONGO_URI) {
  process.stderr.write('[seed] MONGODB_URI is not set\n');
  process.exit(1);
}

const step = (msg: string) => process.stdout.write(`[seed] ${msg}...\n`);
const ok   = (msg: string) => process.stdout.write(`[done] ${msg}\n`);

async function main() {
  step('Connecting to MongoDB');
  await mongoose.connect(MONGO_URI);
  ok('Connected');

  step('Clearing all collections');
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
  ok('All collections cleared');

  step('Hashing password');
  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  ok('Password hashed');

  step('Creating Super Admin and Admin');
  await UserModel.insertMany([
    {
      publicId: uuidv4(),
      email: 'superadmin@takshashila.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash,
      loginCount: 0,
      twoFAEnabled: false,
      isDeleted: false,
    },
    {
      publicId: uuidv4(),
      email: 'admin@takshashila.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash,
      loginCount: 0,
      twoFAEnabled: false,
      isDeleted: false,
    },
  ]);
  ok('Created 2 users');

  process.stdout.write('\n');
  process.stdout.write('='.repeat(50) + '\n');
  process.stdout.write(`  SEED COMPLETE  (password: ${PASSWORD})\n`);
  process.stdout.write('='.repeat(50) + '\n');
  process.stdout.write('  superadmin@takshashila.com  (SUPER_ADMIN)\n');
  process.stdout.write('  admin@takshashila.com       (ADMIN)\n');
  process.stdout.write('='.repeat(50) + '\n\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  process.stderr.write(`\n[ERROR] Seed failed: ${err.message}\n`);
  process.exit(1);
});
