import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../config/prisma';

interface SendEmailParams {
  senderEmail: string;
  senderName?: string;
  recipient: string;
  subject: string;
  body: string;
}

interface SendEmailResult {
  messageId: string;
  etherealPreviewUrl: string | false;
  senderEmail: string;
}

class EmailService {
  private defaultTransporter: Transporter | null = null;
  private defaultAccountEmail: string = '';
  private transporterCache: Map<string, Transporter> = new Map();

  /**
   * Initializes the default Ethereal SMTP transporter.
   * If ETHEREAL_USER is not provided, dynamically creates a new test account.
   */
  public async init(): Promise<void> {
    try {
      if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
        this.defaultTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.ethereal.email',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.ETHEREAL_USER,
            pass: process.env.ETHEREAL_PASS,
          },
        });
        this.defaultAccountEmail = process.env.ETHEREAL_USER;
        console.log(`[EmailService] Configured default SMTP for ${this.defaultAccountEmail}`);
      } else {
        console.log('[EmailService] Generating dynamic Ethereal test account...');
        const testAccount = await nodemailer.createTestAccount();
        this.defaultTransporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.defaultAccountEmail = testAccount.user;
        console.log(`[EmailService] Dynamic Ethereal account created: ${testAccount.user}`);
      }
    } catch (error) {
      console.error('[EmailService] Failed to initialize default SMTP transporter:', error);
    }
  }

  public getDefaultSenderEmail(): string {
    return this.defaultAccountEmail || 'reachinbox-sender@ethereal.email';
  }

  /**
   * Resolves or builds a transporter for the given sender email.
   * If the sender is registered in SenderProfile table, uses their credentials.
   * Otherwise falls back to the default Ethereal transporter.
   */
  private async getTransporterForSender(senderEmail: string): Promise<{ transporter: Transporter; fromAddress: string; displayName: string }> {
    if (this.transporterCache.has(senderEmail)) {
      const cached = this.transporterCache.get(senderEmail)!;
      return { transporter: cached, fromAddress: senderEmail, displayName: senderEmail.split('@')[0] };
    }

    try {
      const profile = await prisma.senderProfile.findUnique({
        where: { email: senderEmail },
      });

      if (profile && profile.user && profile.pass) {
        const customTransporter = nodemailer.createTransport({
          host: profile.host,
          port: profile.port,
          auth: {
            user: profile.user,
            pass: profile.pass,
          },
        });
        this.transporterCache.set(senderEmail, customTransporter);
        return { transporter: customTransporter, fromAddress: profile.email, displayName: profile.name };
      }
    } catch {
      // Fallback if DB query fails or table not yet migrated
    }

    if (!this.defaultTransporter) {
      await this.init();
    }

    return {
      transporter: this.defaultTransporter!,
      fromAddress: senderEmail || this.defaultAccountEmail,
      displayName: 'ReachInbox Sender',
    };
  }

  /**
   * Dispatches an email via SMTP and extracts the Ethereal test preview URL.
   */
  public async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { senderEmail, senderName, recipient, subject, body } = params;
    const { transporter, fromAddress, displayName } = await this.getTransporterForSender(senderEmail);

    const fromHeader = senderName ? `"${senderName}" <${fromAddress}>` : `"${displayName}" <${fromAddress}>`;

    const isHtml = /<[a-z][\s\S]*>/i.test(body);

    const mailOptions = {
      from: fromHeader,
      to: recipient,
      subject: subject,
      text: isHtml ? undefined : body,
      html: isHtml ? body : undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    const etherealUrl = nodemailer.getTestMessageUrl(info);

    console.log(`[EmailService] Email dispatched successfully to ${recipient} (MessageID: ${info.messageId})`);
    if (etherealUrl) {
      console.log(`[EmailService] Ethereal Preview URL: ${etherealUrl}`);
    }

    return {
      messageId: info.messageId,
      etherealPreviewUrl: etherealUrl,
      senderEmail: fromAddress,
    };
  }
}

export const emailService = new EmailService();
