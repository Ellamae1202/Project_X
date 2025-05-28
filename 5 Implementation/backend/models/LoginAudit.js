const mongoose = require('mongoose');

const loginAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'lecturer', 'student'],
    required: true
  },
  loginTime: {
    type: Date,
    default: function() {
      // Create date object with Philippines time (UTC+8)
      const now = new Date();
      return new Date(now.getTime() + (8 * 60 * 60 * 1000));
    }
  },
  logoutTime: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('LoginAudit', loginAuditSchema); 