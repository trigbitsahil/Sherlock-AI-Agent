require("dotenv").config({ path: ".env.local" });
const { google } = require("googleapis");

async function run() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.readonly"]
  });

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await drive.files.list({ q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", fields: "files(id, name)" });
  console.log(res.data.files.map(f => f.name).join(", "));
}
run();
