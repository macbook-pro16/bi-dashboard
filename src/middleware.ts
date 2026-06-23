import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/api/auth/signin',
  },
  callbacks: {
    authorized({ token }) {
      console.log('Middleware authorized check, token:', token); // 一時追加
      return !!token;
    },
  },
});

export const config = {
  matcher: ['/dashboard/:path*'],
};