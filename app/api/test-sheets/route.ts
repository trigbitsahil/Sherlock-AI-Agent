import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Authenticate using Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });

    // Create Drive client
    const drive = google.drive({
      version: "v3",
      auth,
    });

    // List all spreadsheets accessible by service account
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      pageSize: 1000,

      // Important for shared drives / shared files
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,

      // Keep fields simple (valid syntax)
      fields:
        "files(id,name,mimeType,createdTime,owners(displayName,emailAddress),driveId)",
    });

    const sheets =
      response.data.files?.map((file) => ({
        id: file.id,
        name: file.name,
        ownerName: file.owners?.[0]?.displayName || "Unknown",
        ownerEmail: file.owners?.[0]?.emailAddress || "Unknown",
        createdTime: file.createdTime,
        driveId: file.driveId || null,
      })) || [];

    return NextResponse.json({
      success: true,
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      totalAccessibleSheets: sheets.length,
      sheets,
    });
  } catch (error: any) {
    console.error("Google Drive Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}