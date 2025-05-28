import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testConnection = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }

    console.log('Testing connection to MongoDB Atlas...');
    console.log('Using URI:', MONGODB_URI.replace(/\/\/[^@]*@/, '//****:****@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB Atlas');
    
    // List all databases
    if (mongoose.connection.db) {
      const dbs = await mongoose.connection.db.admin().listDatabases();
      console.log('Available databases:', dbs.databases.map(db => db.name));
    } else {
      console.log('Could not access database list');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Connection test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
};

testConnection(); 