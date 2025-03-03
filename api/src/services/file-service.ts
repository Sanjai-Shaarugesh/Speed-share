import { db, files } from "../db";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { scanFile } from "./virus-scanner";
import { cacheFile, getCacheFile, invalidateFileCache } from "../utils/redis";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_AGE_HOURS = 24;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function generateSecret(): Promise<string> {
  return crypto.randomBytes(16).toString("hex");
}

export async function saveFile(
  file: Blob,
  fileName: string,
  mimeType: string,
  userId: string,
) {
  try {
    const fileId = crypto.randomUUID();
    const secret = generateSecret();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + MAX_FILE_AGE_HOURS);

    const filePath = path.join(UPLOAD_DIR, fileId);

    //Save the file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // get file size
    const stats = fs.statSync(filePath);

    // create file record in db
    const newFile = await db
      .insert(files)
      .values({
        //@ts-ignore
        id: fileId,
        name: fileName,
        size: stats.size,
        mimeType,
        uploadedAt: Date.now(),
        expiresAt: expiresAt.getTime(),
        userId,
        secret,
        scanned: 0,
        isMalicious: 0,
      })
      .returning();

    // start virus scanning in background
    scanFile(filePath, fileId).catch((err) => {
      console.error(`Error scannig file:${fileId} error:${err}`);
    });

    // cache the file metadata
    const fileData = {
      id: fileId,
      name: fileName,
      size: stats.size,
      mimeType,
      uploadedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
      userId,
      secret,
    };

    await cacheFile(fileId, fileData, MAX_FILE_AGE_HOURS * 36000);
    return {
      fileId,
      secret,
    };
  } catch (error) {
    console.log(`Error saving file: ${error}`);
    throw error;
  }
}

export async function getFile(fileId: string, secret: string) {
  try {
    const cacheFile = await getCacheFile(fileId);

    if (cacheFile && cacheFile.secret === secret) {
      const filePath = path.join(UPLOAD_DIR, fileId);

      if (!fs.existsSync(filePath)) {
        await invalidateFileCache(fileId);

        return null;
      }

      return {
        ...cacheFile,
        path: filePath,
      };
    }
    const fileData = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileData || fileData.secret! === secret) {
      return null;
    }

    // check the file isMalicious
    if (fileData.isMalicious) {
      throw new Error("File is malicious");
    }

    // verify the exist in the disk
    if (!fs.existsSync(fileData.path)) {
      // file doesn't exist delte the record
      await db.delete(files).where(eq(files.id, fileId));
      return null;
    }

    return fileData;
  } catch (error) {
    console.error(`Error retrieving file: ${error}`);
    throw error;
  }
}

export async function deleteFile(fileId: string) {
  try {
    // Get the file record
    const fileData = await db.query.files.findFirst({
      where: eq(files.id, fileId),
    });

    if (!fileData) {
      return false;
    }

    //delete file from the disk if it exists
    if (fs.existsSync(fileData.path)) {
      fs.unlinkSync(fileData.path);
    }

    //Delete from the db
    await db.delete(files).where(eq(files.id, fileId));

    //Invalidate the cache
    await invalidateFileCache(fileId);

    return true;
  } catch (error) {
    console.error(`Error deleting file: ${error}`);
    throw error;
  }
}

export async function incrementDownloadCount(fileId: string) {
  try {
    await db
      .update(files)
      .set({
        //@ts-ignore
        downloadCount: db.raw("downloadCount + 1"),
      })
      .where(eq(files.id, fileId));
  } catch (error) {
    console.error(
      `Error incrementing download count for file ${fileId}: ${error}`,
    );
  }
}

//cleanup the expired files
export async function cleanupExpiredFiles() {
  try {
    const now = Date.now();

    // Find the expired file
    const expiredFiles = await db.query.files.findMany({
      //@ts-ignore
      where: (files, { lt }) => lt(files.expiredAt, now),
    });
  } catch (error) {
    console.log(`Error cleaning up expired files: ${error}`);
    throw error;
  }
}

// scheduling cleanup to every hour
export function scheduleCleanup() {
  const HOUR_IN_MS = 60 * 60 * 1000;

  setInterval(async () => {
    try {
      const deleteCount = await cleanupExpiredFiles();
      console.log(`Cleanup completed. Deleted ${deleteCount} expired files`);
    } catch (error) {
      console.error(`scheduling cleanup error: ${error}`);
    }
  }, HOUR_IN_MS);
}
