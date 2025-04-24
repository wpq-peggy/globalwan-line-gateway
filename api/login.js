import { google } from 'googleapis';

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  // 1. 用 code 換 LINE access token
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://globalwan-gateway.vercel.app/api/login',
      client_id: process.env.LINE_CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET,
    }),
  });
  const tokenData = await tokenRes.json();

  const userRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();

  // 2. 寫入 Google 試算表
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });

  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${process.env.GOOGLE_SHEET_NAME}!A:D`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[userData.userId, userData.displayName, new Date().toISOString()]],
    },
  });

  // 3. 跳轉 Google 表單（預填 userId）
  const redirectUrl = `${process.env.REDIRECT_FORM_URL}${userData.userId}`;
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}
