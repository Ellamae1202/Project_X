const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lecturerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  qrCodeData: {
    type: String,
    required: true
  },
  generatedAt: {
    type: Date,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  scannedBy: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    scannedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index to ensure a student can only scan once per QR code
attendanceSchema.index({ 'scannedBy.studentId': 1, courseId: 1, generatedAt: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema); 