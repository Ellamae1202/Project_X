require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const users = [
  {
    idNumber: '2020-0001',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    username: 'admin',
    password: 'password123',
    role: 'admin'
  },
  {
    idNumber: '2020-0002',
    firstName: 'Lecturer',
    lastName: 'User',
    email: 'lecturer@example.com',
    username: 'lecturer',
    password: 'password123',
    role: 'lecturer'
  },
  {
    idNumber: '2020-0003',
    firstName: 'Student',
    lastName: 'User',
    email: 'student@example.com',
    username: 'student',
    password: 'password123',
    role: 'student'
  }
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing users
    console.log('Clearing existing users...');
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create new users
    console.log('Creating seed users...');
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${user.username}`);
      console.log(`Password hash: ${user.password.substring(0, 20)}...`);
    }

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed(); 