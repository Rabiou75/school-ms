import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marks a route (or controller) as requiring one of the given roles.
 * Combined with JwtAuthGuard which enforces the check.
 *
 *   @Roles('ADMIN', 'ACCOUNTANT')
 *   @Get('summary')
 *   summary() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
