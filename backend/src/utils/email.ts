import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // For Gmail, use an App Password
  },
});

export async function sendPasswordResetEmail(to: string, newPassword: string, name: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS not set in environment variables. Email sending skipped.');
    return;
  }

  const mailOptions = {
    from: `"StockSense Admin" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your StockSense Password Has Been Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #334155;">
        <h2 style="color: #0f172a; margin-top: 0;">Password Reset</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your password for StockSense has been recently reset by the administration.</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Your new temporary password is:</p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #020617;">${newPassword}</p>
        </div>
        <p>Please log in with this new password. If you didn't request a password reset, please contact the administrator immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          StockSense System &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendAccountCreatedEmail(to: string, password: string, name: string, role: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS not set in environment variables. Email sending skipped.');
    return;
  }

  const mailOptions = {
    from: `"StockSense Admin" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Welcome to StockSense - Your Account Has Been Created',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #334155;">
        <h2 style="color: #0b8252; margin-top: 0;">Welcome to StockSense!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>An account has been created for you with the role of <strong>${role === 'INVENTORY_MANAGER' ? 'Manager' : 'Cashier'}</strong>.</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Your login credentials:</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #334155;">Email: <strong>${to}</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #020617;">${password}</p>
        </div>
        <p>Please log in with this temporary password and change it as soon as possible.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          StockSense System &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendStatusToggleEmail(to: string, name: string, isActive: boolean) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS not set in environment variables. Email sending skipped.');
    return;
  }

  const actionText = isActive ? 'Activated' : 'Deactivated';
  const color = isActive ? '#0b8252' : '#e11d48';
  const message = isActive 
    ? 'Your account has been reactivated. You can now log in to the system.' 
    : 'Your account has been suspended. You will no longer be able to log in. Please contact the administrator for more information.';

  const mailOptions = {
    from: `"StockSense Admin" <${process.env.SMTP_USER}>`,
    to,
    subject: `StockSense Account ${actionText}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #334155;">
        <h2 style="color: ${color}; margin-top: 0;">Account ${actionText}</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>${message}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          StockSense System &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export interface AccountChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export async function sendAccountUpdatedEmail(to: string, name: string, changes: AccountChange[]) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS not set in environment variables. Email sending skipped.');
    return;
  }

  if (changes.length === 0) return;

  const changeRows = changes.map(c => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #334155;">${c.field}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #e11d48; text-decoration: line-through;">${c.oldValue}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0b8252; font-weight: 600;">${c.newValue}</td>
    </tr>
  `).join('');

  const mailOptions = {
    from: `"StockSense Admin" <${process.env.SMTP_USER}>`,
    to,
    subject: 'StockSense — Your Account Has Been Updated',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #334155;">
        <h2 style="color: #0f172a; margin-top: 0;">Account Updated</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>The administrator has made the following changes to your account:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 10px 14px; text-align: left; color: #64748b; font-size: 13px;">Field</th>
              <th style="padding: 10px 14px; text-align: left; color: #64748b; font-size: 13px;">Previous</th>
              <th style="padding: 10px 14px; text-align: left; color: #64748b; font-size: 13px;">Updated</th>
            </tr>
          </thead>
          <tbody>
            ${changeRows}
          </tbody>
        </table>
        <p>If you did not expect these changes, please contact the administrator immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          StockSense System &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
