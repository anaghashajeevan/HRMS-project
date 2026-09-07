import type { UserProfile } from '../types/auth';

/**
 * Returns true ONLY for HR_ADMIN.
 * Returns false for SYSTEM_ADMIN, MANAGER, EMPLOYEE, etc.
 */
export function isHrAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;

  // 1. Direct check via role_codes array (e.g. ['HR_ADMIN'])
  if (Array.isArray(user.role_codes)) {
    return user.role_codes.includes('HR_ADMIN');
  }

  // 2. Fallback check via roles object array
  if (Array.isArray(user.roles)) {
    return user.roles.some((r) => r.code === 'HR_ADMIN');
  }

  return false;
}