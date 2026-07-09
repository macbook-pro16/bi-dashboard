import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/api/auth/signin',
  },
  callbacks: {
    authorized({ token }) {
      console.log('Middleware authorized check, token:', token);
      return !!token;
    },
  },
});

export const config = {
  matcher: ['/dashboard/:path*'],
};