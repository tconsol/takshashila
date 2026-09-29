/**
 * Creates the first SUPER_ADMIN account in an empty database.
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npx ts-node --transpile-only src/scripts/seed-super-admin.ts
 *
 * Refuses to run if a super admin already exists. Uses the same password hashing
 * settings as normal registration, and creates the account already verified/ACTIVE.
 */
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { UserModel } from '../modules/users/user.model';
import { UserStatus } from '../modules/users/user.types';

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  // Show only the host so credentials never reach the terminal.
  console.log('Connected to', mongoose.connection.host, '/ db:', mongoose.connection.name);

  const existing = await UserModel.countDocuments({ role: 'SUPER_ADMIN', isDeleted: false });
  if (existing > 0) throw new Error(`A super admin already exists (${existing}); refusing to create another`);
  if (await UserModel.exists({ email })) throw new Error(`A user with ${email} already exists`);

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  const user = await UserModel.create({
    publicId: uuidv4(),
    email,
    passwordHash,
    firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Super',
    lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Admin',
    role: 'SUPER_ADMIN',
    status: UserStatus.ACTIVE,
    emailVerified: true,
    timezone: 'UTC',
    loginCount: 0,
    pushTokens: [],
    isDeleted: false,
  });
  console.log('Created SUPER_ADMIN', user.email, user.publicId);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error('FAILED:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
