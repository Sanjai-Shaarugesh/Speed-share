import {Elysia} from "elysia";
import { authPlugin } from './Auth.js';

export const verifyAuth = new Elysia()
  .use(authPlugin())
  .derive(({ getSession }) => {
    return {
      session: getSession()
    };
  })
  
  .onBeforeHandle(async ({ session, set }) => {
    if (!session) {
      set.status = 401,
        set.header['WWW-Authendicate'] = 'Bearer';
        
      return {
        error: 'unauthorized',
        message: 'You must be signed to to access the resource'
      };
    }
  });

