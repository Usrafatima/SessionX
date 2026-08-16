import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID });
}
