import { NextResponse } from "next/server";

import { getDevelopmentRuntimeStatus } from "@/server/db/development-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json({ data: await getDevelopmentRuntimeStatus() });
  } catch {
    return NextResponse.json({ error: "Development runtime assertion failed." }, { status: 503 });
  }
}
