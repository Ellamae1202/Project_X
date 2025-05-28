import { connectDB } from '../lib/db';
import User from '../lib/models/User';
import { generateUsername, generateInitialPassword } from '../lib/utils/auth';
import { sendCredentials } from '../lib/utils/email';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const seedAdmin = async () => {
  try {
    console.log('Attempting to connect to database...');
    await connectDB();
    console.log('Successfully connected to database');

    // Check if admin already exists
    console.log('Checking for existing admin account...');
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin account already exists');
      process.exit(0);
    }

    const adminData = {
      idNumber: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'User',
      email: process.env.ADMIN_EMAIL,
      role: 'admin' as const,
    };

    if (!adminData.email) {
      throw new Error('ADMIN_EMAIL is not defined in .env file');
    }

    console.log('Generating credentials...');
    const username = generateUsername(adminData.firstName, adminData.lastName, adminData.idNumber);
    const password = generateInitialPassword(adminData.firstName, adminData.lastName, adminData.idNumber);
    
    console.log('Generated credentials:');
    console.log('Username:', username);
    console.log('Password:', password);

    console.log('Creating admin account...');
    const admin = new User({
      ...adminData,
      username,
      password,
    });

    await admin.save();
    console.log('Admin account created successfully in database');

    // Send credentials email
    console.log('Attempting to send credentials email...');
    console.log('Email configuration:');
    console.log('From:', process.env.EMAIL_USER);
    console.log('To:', adminData.email);
    
    await sendCredentials(adminData.email, username, password, 'Admin');
    console.log('Credentials email sent successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error in seedAdmin:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
};

seedAdmin(); 