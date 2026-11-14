export type UserRole = 'user' | 'admin';

// 会话中透传给前端/服务端的用户信息（不含 password_hash / salt）
export interface SessionUser {
  id: number;
  username: string;
  nickname: string;
  role: UserRole;
}
