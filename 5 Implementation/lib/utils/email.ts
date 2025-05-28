import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendCredentials = async (
  email: string,
  username: string,
  password: string,
  role: string
) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your ProjectX Account Credentials',
    html: `
      <h1>Welcome to ProjectX!</h1>
      <p>Your account has been created with the following credentials:</p>
      <p><strong>Role:</strong> ${role}</p>
      <p><strong>Username:</strong> ${username}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Please login and change your password immediately.</p>
      <p>Best regards,<br>ProjectX Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Credentials email sent successfully');
  } catch (error) {
    console.error('Error sending credentials email:', error);
    throw error;
  }
}; 