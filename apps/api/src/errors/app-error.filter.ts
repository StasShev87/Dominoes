import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import type { CorrelatedRequest } from "../security/correlation-id.guard.js";
import { AppError } from "../matches/match.service.js";

const statusByCode: Partial<Record<AppError["code"], number>> = {
  AUTH_REQUIRED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  USERNAME_TAKEN: HttpStatus.CONFLICT,
  MATCH_NOT_FOUND: HttpStatus.NOT_FOUND,
  NOT_YOUR_TURN: HttpStatus.CONFLICT,
  ILLEGAL_MOVE: HttpStatus.UNPROCESSABLE_ENTITY,
  STALE_VERSION: HttpStatus.CONFLICT,
  INVITE_EXPIRED: HttpStatus.GONE,
  INVITE_ALREADY_USED: HttpStatus.CONFLICT,
  FORFEIT_NOT_AVAILABLE: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS
};

@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter<AppError> {
  catch(error: AppError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<CorrelatedRequest>();
    response.status(statusByCode[error.code] ?? HttpStatus.BAD_REQUEST).json({
      code: error.code,
      message: error.message,
      correlationId: request.correlationId
    });
  }
}
