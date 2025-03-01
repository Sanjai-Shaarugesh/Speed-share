import { handleAuth , authPlugin } from "../auth/Auth";
import { Elysia } from 'elysia';

export const authRoutes = new Elysia({prefix: '/auth/auth'})
  .use(authPlugin())
  
  .all('/:apth' , async({request}:{request:any}) =>{
     try{
       return await handleAuth(request);
     }
     catch(error){
       console.error(`Auth Error: ${error}`);
       
       return new Response(JSON.stringify({ error: "Authendication error" }), {
         status: 500,
         headers: {
           'Content-Type': 'application/json'
         }
       });
       
       
     }
  })

  .get('/session' , async({getSession}:{getSession:any})=>{
    const session = await getSession();
    
    if(!session){
      return {
        status: 401,
        body: {
          authendicated: false
        }
      };
    }
    
    return {
      status: 200,
      body: {
        authendicated: true,
        user: session.user,
        expires: session.expires
      }
      
    }
  })