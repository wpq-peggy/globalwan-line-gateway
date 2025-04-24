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
  try {
    // 確保正確範圍 "工作表1!A:D" 設置
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "工作表1!A:D",  // 目標寫入的範圍
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [userData.userId, userData.displayName, new Date().toISOString(), "未估價"]  // 增加「未估價」欄位
        ],
      },
    });
  } catch (error) {
    console.error("Error writing to Google Sheets:", error);
    return res.status(500).send('Error writing to Google Sheets');
  }

  // 3. 跳轉 Google 表單（預填 userId）
  const redirectUrl = `${process.env.REDIRECT_FORM_URL}${userData.userId}`;
  res.writeHead(302, { Location: redirectUrl });
  res.end();
}
