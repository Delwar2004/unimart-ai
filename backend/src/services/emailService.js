import nodemailer from 'nodemailer';

/**
 * Configure Nodemailer transport using environment variables if provided
 */
const createTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }

  return null;
};

/**
 * Send university verification email
 */
export const sendVerificationEmail = async ({ to, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM || '"UniMart AI" <no-reply@unimart.edu>';

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[Email Service - Dev Sandbox] Verification email for: ${to}`);
    console.log(`[Email Service - Dev Sandbox] Verification Link: ${verificationUrl}`);
    console.log(`[Email Service - Dev Sandbox] Verification Token: ${token}`);
    return { devMode: true, verificationUrl, token };
  }

  const mailOptions = {
    from: fromEmail,
    to,
    subject: 'UniMart AI - Verify Your University Student Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
        <h2 style="color: #4f46e5;">Welcome to UniMart AI, ${name}!</h2>
        <p>Thank you for registering. Please verify your university email to activate your account and start trading on the campus marketplace.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">This verification link will expire in 24 hours.</p>
        <p style="color: #64748b; font-size: 13px;">If you did not request this, please disregard this email.</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async ({ to, name, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM || '"UniMart AI" <no-reply@unimart.edu>';

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[Email Service - Dev Sandbox] Password reset email for: ${to}`);
    console.log(`[Email Service - Dev Sandbox] Reset Link: ${resetUrl}`);
    console.log(`[Email Service - Dev Sandbox] Reset Token: ${token}`);
    return { devMode: true, resetUrl, token };
  }

  const mailOptions = {
    from: fromEmail,
    to,
    subject: 'UniMart AI - Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
        <h2 style="color: #4f46e5;">UniMart AI - Password Reset</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">This link will expire in 1 hour.</p>
        <p style="color: #64748b; font-size: 13px;">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  };

  return await transporter.sendMail(mailOptions);
};
