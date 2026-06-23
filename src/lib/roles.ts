export type Role = 'admin' | 'editor' | 'viewer';

const userRoles: Record<string, Role> = {
  'yamasaki.sunauto@gmail.com': 'admin',
  // 'editor@example.com': 'editor',  // 編集者を増やす場合は追加
};

export function getUserRole(email: string): Role {
  return userRoles[email] || 'viewer';
}