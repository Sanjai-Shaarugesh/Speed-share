import { authPlugin } from '@hapi/cookie';
import { Elysia } from 'elysia';

export function authPlugin() {
  return  Elysia()
    .use(jwt({
      name: 'jwt',
      secret: process.env.AUTH_SECRET,
      
    }))
  
    .use(cookie())
    .derive(({ cookie }) => {
      return {
        getSessionToken: () => {
          return cookie['next-auth.session-token'] || cookie['__Secure-next_auth.session-token'];
        }
      };
      
    })
    
    .derive(({ jwt, getSessionToken }) => {
      return {
        getSession: async () => {
          const token = getSessionToken();
          
          if (!token) return null;
          
          try {
            const decoded = jwt.verify(token);
            
            if (!decoded) return null;
            return {
              user: {
                id: decoded.sub,
                name: decoded.name,
                email: decoded.email,
                image: decoded.pictue
              },
              expires: new Date(decoded.exp * 1000).toISOString()
              
            };
            
          } catch (error) {
            console.error(`Error verifying JWT token: ${error.message}`);
            return null;
          }
        }
      }
    });
    
}

export async function handleAuth(request){
  return await Auth(request, authConfig);
} 