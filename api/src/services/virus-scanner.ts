import * as clamscan  from 'clamscan';
import { promisify } from 'util';
import { db } from '../db';
import { files } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { spawn } from 'bun';

export async function scanFile(filePath:string,fileId:string):Promise<boolean>{
 try{
   const process = spawn({
     cmd: ['clamscan', '--no-summary', '--infected', filePath],
     stderr: 'pipe',
     stdout: 'pipe',
   });
   const existCode = await process.exited;

   const isMalicious = existCode === 1;

   await db.update(files)
     .set({
       scanned: true,
       isMalicious: isMalicious
     })
     .where(eq(files.id,fileId))

   console.log(`File ${filePath} is ${isMalicious ? 'malicious' : 'clean'}`);

   if(isMalicious){
     fs.unlinkSync(filePath);
     console.log(`Deleted Malicious File: ${filePath}`);
   }
   return isMalicious;
 } catch (error) {
   console.error(`Error scanning file ${fileId}: ${error}`);

   await db.update(files)
     .set({
       scanned: true,
       isMalicious: false
     })
     .where(eq(files.id,fileId))
   return false;
 }
}