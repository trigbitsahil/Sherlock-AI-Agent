import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({
      version: "v3",
      auth,
    });

    const files1 = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: "files(id,name)",
      pageSize: 50,
    });

    const files2 = await drive.files.list({
      q: "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.shortcut') and trashed=false",
      fields: "files(id, name, mimeType, shortcutDetails)",
      pageSize: 1000,
    });

    return NextResponse.json({
      success: true,
      count1: files1.data.files?.length,
      count2: files2.data.files?.length,
      sheets1: files1.data.files,
      sheets2: files2.data.files,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}