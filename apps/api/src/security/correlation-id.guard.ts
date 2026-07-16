import { randomUUID } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<CorrelatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const requested = request.header("x-correlation-id");
    request.correlationId = requested && /^[0-9a-f-]{36}$/i.test(requested) ? requested : randomUUID();
    response.setHeader("x-correlation-id", request.correlationId);
    return true;
  }
}
