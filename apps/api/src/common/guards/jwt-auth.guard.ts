import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Combines JWT authentication with role-based authorisation.
 *
 * Order of checks:
 *   1. Is the JWT valid and not expired? (passport-jwt)
 *   2. Does the user's role match any @Roles(...) declared on the
 *      handler or the controller?
 *
 * If a route has no @Roles() metadata, any authenticated user passes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. JWT — throws UnauthorizedException if invalid
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    // 2. Roles — read metadata from handler and class
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('insufficient_role');
    }

    return true;
  }
}
