import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtPayload } from '../decorators/current-player.decorator';

/**
 * 校验当前认证用户是否有权访问路由中 :playerId 指向的资源。
 * 管理员可访问任意玩家数据；普通用户只能访问自己的。
 *
 * 仅在路由包含 :playerId 参数时生效，否则直接放行。
 */
@Injectable()
export class PlayerOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const playerId = request.params?.playerId as string | undefined;

    if (!playerId || !user) return true;
    if (user.isAdmin) return true;

    if (user.sub !== playerId) {
      throw new ForbiddenException('无权访问其他玩家的数据');
    }

    return true;
  }
}
