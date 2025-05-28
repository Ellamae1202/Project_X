import mongoose from 'mongoose';
import { connectDB } from '../lib/db';

const dropDatabase = async () => {
  try {
    await connectDB();
    await mongoose.connection.dropDatabase();
    console.log('Database dropped successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error dropping database:', error);
    process.exit(1);
  }
};

dropDatabase(); 