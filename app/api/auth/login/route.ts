import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD_HASH in environment variables.");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (email !== adminEmail) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log("Checking credentials:");
    console.log("Email:", email, "===", adminEmail);
    console.log("Hash length:", adminPasswordHash?.length);
    console.log("Hash starts with quote?", adminPasswordHash?.startsWith("'"));

    let actualHash = adminPasswordHash as string;
    // Strip quotes if Next.js included them literally
    if (actualHash.startsWith("'") && actualHash.endsWith("'")) {
      actualHash = actualHash.slice(1, -1);
    }
    // Remove backslashes used to escape the $ symbol in .env
    actualHash = actualHash.replace(/\\/g, '');

    const isValidPassword = await bcrypt.compare(password, actualHash);

    if (!isValidPassword) {
      console.log("bcrypt compare failed!");
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ email: adminEmail, role: 'admin' });

    const response = NextResponse.json({ success: true });
    
    // Set cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
