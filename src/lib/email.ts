// Transactional email seam (GAP-10). OFF by default: with no SMTP_* env the
// LogAdapter just records the message (so the invite/reset link is visible in the
// server log) and nothing is sent — invites/resets still work in log-only mode.
// Set SMTP_HOST/PORT/USER/PASS + MAIL_FROM to send for real via any SMTP (a Gmail
// app-password, SES-SMTP, Mailgun…). nodemailer is lazy-imported so the log path
// stays dependency-light and never bundles the SMTP client where it isn't needed.

export type Email = { to: string; subject: string; text: string };
export type SmtpConfig = { host: string; port: number; user?: string; pass?: string; from: string };

export function smtpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  return {
    host,
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER?.trim() || undefined,
    pass: env.SMTP_PASS?.trim() || undefined,
    from: env.MAIL_FROM?.trim() || env.SMTP_USER?.trim() || "no-reply@localhost",
  };
}

// Returns { delivered } — false in log-only mode. Never throws the caller's flow:
// an invite/reset shouldn't 500 because SMTP is down; the row already exists and
// the link is recoverable from the response (invite) or the log.
export async function sendEmail(email: Email, env: NodeJS.ProcessEnv = process.env): Promise<{ delivered: boolean }> {
  const cfg = smtpConfigFromEnv(env);
  if (!cfg) {
    console.log(`[email:log] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return { delivered: false };
  }
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    await transport.sendMail({ from: cfg.from, to: email.to, subject: email.subject, text: email.text });
    return { delivered: true };
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e);
    return { delivered: false };
  }
}
