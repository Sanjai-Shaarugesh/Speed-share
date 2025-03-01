import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from '../db';
import { users, accounts, sessions, verificationTokens } from '../db/schema';
import Google from '@auth/core/providers/google';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import cookie from '@elysiajs/cookie';
import { Auth } from '@auth/core';

export const authConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    })
  ],
  
  callbacks: {
    async session({ session, user, token }: { session: any, user: any, token: any }) {
      if (session.user) {
        session.user.id = token.sub || user.id;
        
      }
      return session;
      
    },
    async jwt({ token, user }: { token: any, user: any }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
      
    },
    pages: {
      signIn: '/auth/signin',
      signOut: '/auth/signout',
      error: '/auth/error',
      
    },
    
    
    
    
    
  },
  
  secret: process.env.AUTH_SECRET!,
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days 
     
  },
   
  debug: process.env.NODE_ENV === 'development',
};

export { authPlugin } from './Auth.js';