const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'lecturer', 'student'],
    required: true,
    index: true
  },
  loginTime: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Add compound index for common queries
loginLogSchema.index({ userId: 1, loginTime: -1 });

// Add validation
loginLogSchema.pre('save', function(next) {
  if (!this.userId || !this.username || !this.role) {
    next(new Error('Missing required fields'));
  }
  next();
});

module.exports = mongoose.model('LoginLog', loginLogSchema); 