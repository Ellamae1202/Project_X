require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const LoginLog = require('./models/LoginLog');
const nodemailer = require('nodemailer');
const Course = require('./models/Course');
const Attendance = require('./models/Attendance');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const courseId = req.url.split('/').pop(); // Get courseId from URL
  console.log(`WebSocket connection established for course: ${courseId}`);

  ws.on('error', console.error);

  ws.on('close', () => {
    console.log(`WebSocket connection closed for course: ${courseId}`);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/projectx')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login attempt received:', { username: req.body.username });
    const { username, password } = req.body;

    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    console.log('User found:', { userId: user._id, username: user.username, role: user.role });

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for user:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    console.log('Password verified for user:', username);

    try {
      // Create login log entry
      console.log('Creating login log entry...');
      const loginLog = new LoginLog({
        userId: user._id,
        username: user.username,
        role: user.role
      });
      
      // Save login log with explicit error handling
      console.log('Attempting to save login log...');
      const savedLog = await loginLog.save();
      console.log('Login log saved successfully:', {
        logId: savedLog._id,
        userId: savedLog.userId,
        username: savedLog.username,
        role: savedLog.role,
        loginTime: savedLog.loginTime
      });

      // Verify the log was saved by querying it
      const verifiedLog = await LoginLog.findById(savedLog._id);
      console.log('Verified saved log:', verifiedLog ? 'Found' : 'Not found');
    } catch (logError) {
      console.error('Error saving login log:', {
        error: logError.message,
        stack: logError.stack,
        userId: user._id,
        username: user.username
      });
    }

    // Return user data without password
    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (error) {
    console.error('Login error:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error' });
  }
});

// Password reset endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mock login log endpoint
app.post('/api/logs/mock', async (req, res) => {
  try {
    const { userId, username, role } = req.body;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('Invalid userId format:', userId);
      return res.status(400).json({ message: 'Invalid userId format' });
    }

    // Create mock login log entry
    const loginLog = new LoginLog({
      userId: userId, // No need to create new ObjectId, use the provided one
      username,
      role
    });

    const savedLog = await loginLog.save();
    console.log('Mock login log saved successfully:', {
      logId: savedLog._id,
      userId: savedLog.userId,
      username: savedLog.username,
      role: savedLog.role
    });

    res.json({ success: true, log: savedLog });
  } catch (error) {
    console.error('Error creating mock login log:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const { idNumber, firstName, lastName, email, username, password, role, employeeId } = req.body;

    // Validate required fields
    if (!idNumber || !firstName || !lastName || !email || !username || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? 
          'Username already exists' : 'Email already exists' 
      });
    }

    // Check if employeeId exists (for lecturer and admin roles)
    if (employeeId && (role === 'lecturer' || role === 'admin')) {
      const existingEmployeeId = await User.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
    }

    // Create new user
    const userData = {
      idNumber,
      firstName,
      lastName,
      email,
      username,
      password,
      role
    };
    
    // Only add employeeId if it's provided (prevents null values)
    if (employeeId) {
      userData.employeeId = employeeId;
    }
    
    const user = new User(userData);

    await user.save();

    // Return user data without password
    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.idNumber) {
      return res.status(400).json({ message: 'ID Number already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { idNumber, firstName, lastName, email, username, password, role, employeeId } = req.body;
    
    // Validate required fields
    if (!idNumber || !firstName || !lastName || !email || !username || !role) {
      return res.status(400).json({ message: 'All fields except password are required' });
    }

    // Check if username or email already exists for other users
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.params.id } },
        { $or: [{ username }, { email }] }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? 
          'Username already exists' : 'Email already exists' 
      });
    }

    // Check if employeeId exists for other users (if provided)
    if (employeeId && (role === 'lecturer' || role === 'admin')) {
      const existingEmployeeId = await User.findOne({
        _id: { $ne: req.params.id },
        employeeId
      });
      
      if (existingEmployeeId) {
        return res.status(400).json({ message: 'Employee ID already exists' });
      }
    }

    // Prepare update data
    const updateData = {
      idNumber,
      firstName,
      lastName,
      email,
      username,
      role
    };
    
    // Only add employeeId if it's provided
    if (employeeId) {
      updateData.employeeId = employeeId;
    }

    // Only update password if provided
    if (password) {
      updateData.password = password;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is trying to delete themselves
    if (user._id.toString() === req.user?._id?.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get login logs (admin only)
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await LoginLog.find()
      .sort({ loginTime: -1 })
      .populate('userId', 'firstName lastName email');
    res.json(logs);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test login logs endpoint
app.get('/api/logs/test', async (req, res) => {
  try {
    console.log('Testing login logs...');
    
    // Get total count of logs
    const totalLogs = await LoginLog.countDocuments();
    console.log('Total login logs:', totalLogs);
    
    // Get recent logs
    const recentLogs = await LoginLog.find()
      .sort({ loginTime: -1 })
      .limit(5)
      .populate('userId', 'firstName lastName');
    
    console.log('Recent logs:', recentLogs);
    
    res.json({
      totalLogs,
      recentLogs,
      message: 'Login logs test completed'
    });
  } catch (error) {
    console.error('Test login logs error:', error);
    res.status(500).json({ message: 'Error testing login logs' });
  }
});

// Send credentials email endpoint
app.post('/api/auth/send-credentials', async (req, res) => {
  try {
    const { email, username, password, role, firstName } = req.body;

    // Validate required fields
    if (!email || !username || !password || !role || !firstName) {
      console.error('Missing required fields for email:', { email, username, role, firstName });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured');
      return res.status(500).json({ message: 'Email service not configured' });
    }

    console.log('Attempting to send email to:', email);
    console.log('Using email account:', process.env.EMAIL_USER);

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('Email transporter verified successfully');
    } catch (verifyError) {
      console.error('Email transporter verification failed:', verifyError);
      return res.status(500).json({ message: 'Email service configuration error' });
    }

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to ProjectX - Your Account Credentials',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 0 0 5px 5px;
            }
            .credentials {
              background-color: white;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .credential-item {
              margin: 10px 0;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 3px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
            .button {
              display: inline-block;
              padding: 10px 20px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin-top: 20px;
            }
            .logo {
              max-width: 150px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to ProjectX!</h1>
          </div>
          <div class="content">
            <p>Hello ${firstName},</p>
            <p>Your account has been successfully created. Here are your login credentials:</p>
            
            <div class="credentials">
              <div class="credential-item">
                <strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
              <div class="credential-item">
                <strong>Username:</strong> ${username}
              </div>
              <div class="credential-item">
                <strong>Password:</strong> ${password}
              </div>
            </div>

            <p>For security reasons, please:</p>
            <ul>
              <li>Log in to your account immediately</li>
              <li>Change your password after your first login</li>
              <li>Keep your credentials secure and do not share them with anyone</li>
            </ul>

            <p>If you have any questions or need assistance, please contact the system administrator.</p>
            
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} ProjectX. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    res.json({ message: 'Credentials email sent successfully' });
  } catch (error) {
    console.error('Error sending credentials email:', error);
    res.status(500).json({ 
      message: 'Failed to send credentials email',
      error: error.message 
    });
  }
});

// Create new course
app.post('/api/courses', async (req, res) => {
  try {
    const { courseCode, courseName, description, lecturerId, schedules } = req.body;

    // Validate required fields
    if (!courseCode || !courseName || !description || !lecturerId || !schedules || schedules.length === 0) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if course code already exists
    const existingCourse = await Course.findOne({ courseCode });
    if (existingCourse) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    // Check if lecturer exists
    const lecturer = await User.findById(lecturerId);
    if (!lecturer || lecturer.role !== 'lecturer') {
      return res.status(400).json({ message: 'Invalid lecturer' });
    }

    // Create new course
    const course = new Course({
      courseCode,
      courseName,
      description,
      lecturerId,
      schedules
    });

    await course.save();

    // Populate lecturer details
    await course.populate('lecturerId', 'firstName lastName');

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().populate('lecturerId', 'firstName lastName');
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update course
app.put('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate required fields
    if (!updateData.courseCode || !updateData.courseName || !updateData.description || !updateData.lecturerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if the course exists
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // If students array is provided, validate that all student IDs exist
    if (updateData.students && updateData.students.length > 0) {
      const studentIds = updateData.students;
      const validStudents = await User.find({
        _id: { $in: studentIds },
        role: 'student'
      });

      if (validStudents.length !== studentIds.length) {
        return res.status(400).json({ message: 'One or more invalid student IDs provided' });
      }
    }

    // Update the course with the new data
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      { 
        $set: {
          courseCode: updateData.courseCode,
          courseName: updateData.courseName,
          description: updateData.description,
          lecturerId: updateData.lecturerId,
          schedules: updateData.schedules || [],
          students: updateData.students || [],
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    res.json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ message: 'Failed to update course', error: error.message });
  }
});

// Delete course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate QR code for attendance
app.post('/api/attendance/generate-qr', async (req, res) => {
  try {
    const { courseId, lecturerId } = req.body;

    // Validate course and lecturer
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.lecturerId.toString() !== lecturerId) {
      return res.status(403).json({ message: 'Unauthorized to generate QR for this course' });
    }

    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Convert to PH time (UTC+8)
    const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

    const qrData = JSON.stringify({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      generatedAt: phTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    });

    // Create attendance record
    const attendance = new Attendance({
      courseId: course._id,
      lecturerId: lecturerId,
      qrCodeData: qrData,
      generatedAt: phTime,
      expiresAt: expiryTime
    });

    await attendance.save();

    res.json({
      qrData,
      generatedAt: phTime,
      expiresAt: expiryTime
    });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record attendance from QR scan
app.post('/api/attendance/scan', async (req, res) => {
  try {
    const { qrData, studentId } = req.body;
    const qrInfo = JSON.parse(qrData);

    // Validate QR code expiration
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
    if (new Date(qrInfo.expiresAt) <= phTime) {
      return res.status(400).json({ message: 'QR code has expired' });
    }

    // Find the attendance record
    const attendance = await Attendance.findOne({
      courseId: qrInfo.courseId,
      generatedAt: new Date(qrInfo.generatedAt)
    });

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    // Check if student has already scanned
    const hasScanned = attendance.scannedBy.some(
      scan => scan.studentId.toString() === studentId
    );

    if (hasScanned) {
      return res.status(400).json({ message: 'You have already scanned this QR code' });
    }

    // Add student to scannedBy array
    attendance.scannedBy.push({
      studentId: studentId,
      scannedAt: phTime
    });

    await attendance.save();

    res.json({ message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Scan QR error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance records for a course
app.get('/api/attendance/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const attendanceRecords = await Attendance.find({ courseId })
      .populate('scannedBy.studentId', 'firstName lastName idNumber')
      .sort({ generatedAt: -1 });

    res.json(attendanceRecords);
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students enrolled in a course
app.get('/api/courses/:courseId/students', async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check if there are students enrolled
    if (!course.students || course.students.length === 0) {
      return res.json([]);
    }
    
    // Get all students in the course
    const students = await User.find(
      { 
        _id: { $in: course.students },
        role: 'student'
      },
      '-password'
    );
    
    res.json(students);
  } catch (error) {
    console.error('Error getting students for course:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname.startsWith('/api/attendance/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
}); 