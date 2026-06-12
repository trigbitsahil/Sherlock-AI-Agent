// import { google } from "googleapis";
// import * as dotenv from "dotenv";

// dotenv.config({ path: ".env" });

// async function run() {
//   const auth = new google.auth.GoogleAuth({
//     credentials: {
//       client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//       private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//     },
//     scopes: ["https://www.googleapis.com/auth/drive.readonly"],
//   });

//   const drive = google.drive({ version: "v3", auth });

//   console.log("Fetching all spreadsheets...");
//   const res = await drive.files.list({
//     q: "mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.shortcut'",
//     fields: "files(id, name, mimeType, shortcutDetails)",
//     pageSize: 1000,
//   });

//   const files = res.data.files || [];
//   console.log(`Found ${files.length} files.`);
//   files.forEach(f => {
//     console.log(`- ${f.name} (${f.mimeType}) ID: ${f.id}`);
//     if (f.shortcutDetails) {
//        console.log(`   Target ID: ${f.shortcutDetails.targetId}, Target MIME: ${f.shortcutDetails.targetMimeType}`);
//     }
//   });
// }

// run().catch(console.error);
