import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@swigs.ch';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Resamatic2026!';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (!existing.role) {
      existing.role = 'admin';
      await existing.save();
      console.log(`Admin role patched on existing user: ${ADMIN_EMAIL}`);
    } else {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    }
  } else {
    await User.create({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash: ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log(`Admin user created: ${ADMIN_EMAIL}`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
