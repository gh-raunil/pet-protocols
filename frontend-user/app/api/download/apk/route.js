import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "pet-protocols-release.apk");

  if (!fs.existsSync(apkPath)) {
    return new NextResponse("APK file not found on server", { status: 404 });
  }

  const stat = fs.statSync(apkPath);
  const fileStream = fs.createReadStream(apkPath);

  // Convert Node readable stream to Web ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="pet-protocols-1.1.apk"',
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=86400, must-revalidate",
    },
  });
}
