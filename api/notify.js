export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ ok: false, error: '缺少訂單內容' });
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineUserId = process.env.LINE_USER_ID;
    const resendApiKey = process.env.RESEND_API_KEY;
    const mailFrom = process.env.MAIL_FROM || '昌久貹 <onboarding@resend.dev>';
    const adminEmail = process.env.ADMIN_EMAIL;

    const studentEmailMatch = message.match(/Email：(.+)/);
    const studentEmail = studentEmailMatch ? studentEmailMatch[1].trim() : '';

    const jobs = [];

    if (lineToken && lineUserId) {
      jobs.push(
        fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'text', text: message }],
          }),
        })
      );
    }

    if (resendApiKey && studentEmail) {
      jobs.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom,
            to: studentEmail,
            subject: '昌久貹｜訂單送出成功通知',
            text:
`您好，您的訂單已送出成功。

以下是您的訂單資料：

${message}

我們將透過 LINE 或 Email 與您確認後續課程資訊。

昌久貹`,
          }),
        })
      );
    }

    if (resendApiKey && adminEmail) {
      jobs.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom,
            to: adminEmail,
            subject: '昌久貹｜新訂單通知',
            text: message,
          }),
        })
      );
    }

    const results = await Promise.allSettled(jobs);

    return res.status(200).json({
      ok: true,
      sent: {
        line: Boolean(lineToken && lineUserId),
        studentEmail: Boolean(resendApiKey && studentEmail),
        adminEmail: Boolean(resendApiKey && adminEmail),
      },
      results,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
