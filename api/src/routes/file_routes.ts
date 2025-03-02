import { Elysia, t } from 'elysia';
import { verifyAuth } from '../auth/middleware';
import { saveFile,getFile,deleteFile, incrementDownloadCount} from '../services/file-service';
import { db, files } from '../db';
import { eq, Param } from 'drizzle-orm';

export const fileRoutes = new Elysia({prefix: '/api/files'})
  //Middlewares 
  .use(verifyAuth)

  //upload file
  .post('/upload',async({request,session}:{request:any,session:any})=>{
    try{
     // Get the file from the request
      const formData = await request.formData();
      const file = formData.get('file') as Blob;

     if(!file){
       return {
         status: 400,
         body: {
           error: "No file provided"
         }
       }
     } 

      const fileName = formData.get('fileName') as string || 'unknown';
      const mimeType = file.type || 'application/octet-stream';

      // save file 
      const { fileId, secret } = await saveFile(file, fileName, mimeType, session.user.id);

      // return the file i and url 
      return {
        status: 200,
        body: {
          fileId,
          secret,
          url: `/api/files/${fileId}?secret=${secret}`,
          qrcode: `/api/files/qr/${fileId}?secret=${secret}`,
        }
      };


    }
    catch(error){
      console.error(`Error uploading file: ${error}`);
      return {
        status: 500,
        body: {
          error: 'failed to upload file'
        }
      }
    }
  },{
    body: t.Object({
      user: t.Object({
        id: t.String(),
        email: t.String(),
        name: t.String()
      }),
      file: t.Object({
        id: t.String(),
        name: t.String(),
        mimeType: t.String(),
        size: t.Number(),
        createdAt: t.String(),
        updatedAt: t.String()
      })
    }),
    response: {
        200: t.Object({
          fileId: t.String(),
          secret: t.String(),
          url: t.String(),
          qrcode: t.String(),
        }),
        201: t.Object({
          fileId: t.String(),
          secret: t.String(),
          url: t.String(),
          qrCode: t.String(),
        }),
        400: t.Object({
          error: t.String()
        }),
        500: t.Object({
          error: t.String()
        })
      }
  })
  
  // Get the file metadata
  .get('/:fileId',async({params,query}:{params:any,query:any})=>{
    try{
      const { fileId } = params;
      const { secret } = query;
      
      if(!secret){
        return {
          status: 400,
          body: {
            error: 'Secret is required'
          }
        }
      }
      
      const fileData = await getFile(fileId, secret);
      
      if(!fileData){
        return {
          status: 401,
          body: {
            error: 'File not found'
          }
        }
      }
      
      return {
        staus: 200,
        body: {
          id: fileData.id,
          name: fileData.name,
          size: fileData.size,
          mimeType: fileData.mimeType,
          uploadedAt: fileData.uploadedAt,
          expiresAt: fileData.expiresAt,
        }
      };
    }
    catch(error){
      console.error(`Error getting file metadata: ${error}`);
      return {
        status: 500,
        body: {
          error: "Failed to retrieve file metadata"
        }
      }
    }
  },{
    params: t.Object({
      fileId: t.String()
    }),
    query: t.Object({
      ecret: t.String()
    }),
    response: {
      200: t.Object({
        id: t.String(),
        name: t.String(),
        size: t.Number(),
        mimeType: t.String(),
        uploadedAt: t.Number(),
        expiresAt: t.Number(),
      }),
      400: t.Object({
        error: t.String()
      }),
      404: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String()
      })
    }
  })
  