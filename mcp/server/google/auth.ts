import { google } from "googleapis";

/**
 * Creates an authenticated Google API client using a Service Account.
 * Credentials are loaded from environment variables.
 */
export function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "Missing Google credentials: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are required."
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });

  return auth;
}

/**
 * Returns an authenticated Google Sheets API client.
 */
export async function getSheetsClient() {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

/**
 * Returns an authenticated Google Drive API client.
 */
export async function getDriveClient() {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  return drive;
}
