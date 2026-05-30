import { Resend } from 'resend';
import { passwordReset, emailVerification } from '../i18n/notifications.js';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'SpicyPick <noreply@spicypick.com>';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function sendPasswordResetEmail(email: string, resetToken: string, locale = 'en'): Promise<void> {
  const resetUrl = `${process.env.APP_URL || 'https://spicypick.app'}/reset-password?token=${resetToken}`;
  const strings = passwordReset[locale as keyof typeof passwordReset] || passwordReset.en;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: strings.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #FF6B35;">SpicyPick</h2>
        <p>${strings.heading}</p>
        <a href="${resetUrl}" style="display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">${strings.button}</a>
        <p style="color: #666; font-size: 14px;">${strings.footer}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendEmailVerificationEmail(email: string, verificationToken: string, locale = 'en'): Promise<void> {
  const verifyUrl = `${process.env.APP_URL || 'https://spicypick.app'}/verify-email?token=${verificationToken}`;
  const strings = emailVerification[locale as keyof typeof emailVerification] || emailVerification.en;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: strings.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #FF6B35;">SpicyPick</h2>
        <p>${strings.heading}</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #FF6B35; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">${strings.button}</a>
        <p style="color: #666; font-size: 14px;">${strings.footer}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendSupportEmail({ userId, userEmail, subject, message }: {
  userId: string;
  userEmail?: string;
  subject: string;
  message: string;
}): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    throw new Error('SUPPORT_EMAIL is not configured');
  }

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: supportEmail,
    replyTo: userEmail,
    subject: `[Support] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #FF6B35;">SpicyPick Support Request</h2>
        <p><strong>From:</strong> ${escHtml(userEmail || 'unknown')} (userId: ${escHtml(userId)})</p>
        <p><strong>Subject:</strong> ${escHtml(subject)}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escHtml(message)}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send support email:', error);
    throw new Error('Failed to send email');
  }
}
