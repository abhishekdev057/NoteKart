import { NextResponse } from "next/server";
import { getCloudinary } from "@/lib/cloudinary";
import { consumeRateLimit } from "@/lib/db";
import { getSession } from "@/lib/session";
import { clientIp, errorResponse } from "@/lib/http";

// Anonymous users can upload custom-cover artwork (images only, small).
// Admins can also upload product media including video, with a larger cap.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_ADMIN_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const isAdmin = session?.role === "admin";

    // Rate-limit anonymous uploads by IP to prevent abuse of our Cloudinary quota.
    if (!isAdmin) {
      const allowed = await consumeRateLimit(`upload:${clientIp(request)}`, 20, 3600);
      if (!allowed) {
        return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a file." }, { status: 400 });
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !(isAdmin && isVideo)) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 415 });
    }

    const maxBytes = isAdmin ? MAX_ADMIN_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Maximum ${Math.round(maxBytes / (1024 * 1024))} MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
    const result = await getCloudinary().uploader.upload(dataUri, {
      folder: "notekart",
      // Lock to the validated type rather than trusting Cloudinary's auto-detect.
      resource_type: isVideo ? "video" : "image",
      transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    return errorResponse(error, "Upload failed.");
  }
}
