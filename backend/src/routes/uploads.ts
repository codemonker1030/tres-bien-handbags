import { Router, type IRouter } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

// ─── R2 client setup ───────────────────────────────────────────────────────
// Cloudflare R2 is S3-compatible, so the standard AWS S3 SDK works against it
// unmodified — we just point it at R2's endpoint instead of AWS's.
const requiredEnvVars = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

for (const name of requiredEnvVars) {
  if (!process.env[name]) {
    throw new Error(
      `${name} must be set. Product photo uploads are stored in Cloudflare R2 — see LOCAL_SETUP.md for how to set this up.`,
    );
  }
}

const accountId = process.env.R2_ACCOUNT_ID!;
const bucketName = process.env.R2_BUCKET_NAME!;
// Public base URL for the bucket (either R2's own pub-*.r2.dev URL, or a
// custom domain you've connected) — trailing slash stripped for safe joining.
const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Files are held in memory only briefly, just long enough to stream the
// buffer up to R2 — never written to this server's own disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router: IRouter = Router();

router.post("/uploads", upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const ext = path.extname(req.file.originalname);
  const key = `products/${Date.now()}-${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }),
  );

  res.status(201).json({ url: `${publicUrl}/${key}` });
});

export default router;
