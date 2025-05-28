const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  idNumber: {
    type: String,
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    sparse: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'lecturer', 'student'],
    required: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('Comparing passwords...');
    console.log('Candidate password length:', candidatePassword.length);
    console.log('Stored password hash:', this.password.substring(0, 20) + '...');
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('Password match result:', isMatch);
    
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

module.exports = mongoose.model('User', userSchema); 