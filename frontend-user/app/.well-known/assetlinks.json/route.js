import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.vercel.pet_protocols.twa",
        sha256_cert_fingerprints: [
          "A7:F1:5C:26:FD:E6:E0:26:A3:1B:58:03:F3:C2:DD:0F:36:CE:D8:F0:2F:D2:41:88:76:D5:FB:B7:38:CB:AB:74",
        ],
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
