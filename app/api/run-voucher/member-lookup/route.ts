import { NextRequest, NextResponse } from "next/server";
import { lookupMemberByPhone } from "@/lib/yinbao";

type LookupPayload = {
  phone?: string;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as LookupPayload | null;
  const phone = (body?.phone || "").trim();
  if (!phone) {
    return NextResponse.json({ success: false, error: "phone is required" }, { status: 400 });
  }

  const result = await lookupMemberByPhone(phone);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.message }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    customerNum: result.customerNum,
    customerUid: result.customerUid,
    memberName: result.memberName || ""
  });
}

