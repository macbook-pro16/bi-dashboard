// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// 開発中のホットリロード対策（グローバルシングルトン）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * 接続が切れているかを確認し、切れていれば再接続する
 */
export async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error: any) {
    if (error.message?.includes('Closed') || error.message?.includes('connection')) {
      console.log('[Prisma] 接続が切れたため再接続します');
      await prisma.$connect();
    } else {
      throw error;
    }
  }
}

/**
 * Prisma クエリを安全に実行するラッパー
 * エラーが発生した場合、接続が切れていれば再接続し、1度だけリトライする
 */
export async function withConnection<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (
      error.message?.includes('Closed') ||
      error.message?.includes('connection') ||
      error.message?.includes('Can\'t reach database server')
    ) {
      await prisma.$connect();
      return await fn(); // リトライ
    }
    throw error;
  }
}