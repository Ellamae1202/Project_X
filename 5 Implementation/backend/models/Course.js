const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  days: [{
    type: String,
    required: true
  }],
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
});

const courseSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    unique: true
  },
  courseName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  lecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  schedules: [scheduleSchema],
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Course', courseSchema); 