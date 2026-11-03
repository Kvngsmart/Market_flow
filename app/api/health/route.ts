import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "marketflow-web",
    timestamp: new Date().toISOString()
  });
}
