// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isUnsupportedBrowser(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  // Chrome または Safari が含まれていればサポート
  if (ua.includes('chrome') || ua.includes('safari')) {
    return false;
  }
  // Edge (Chromiumベース) もOK
  if (ua.includes('edg')) {
    return false;
  }
  // それ以外は非対応とする
  return true;
}

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  
  if (isUnsupportedBrowser(userAgent)) {
    // /unsupported にリライト（専用ページを作成）
    const url = request.nextUrl.clone();
    url.pathname = '/unsupported';
    return NextResponse.rewrite(url);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|icon-.*|splash-.*|sw.js).*)'],
};