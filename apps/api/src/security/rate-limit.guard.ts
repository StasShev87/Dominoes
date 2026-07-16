import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AppError } from "../matches/match.service.js";

interface Bucket { count: number; resetAt: number }

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.endsWith("/health")) return true;
    const limit = request.path.endsWith("/guest-sessions") ? 10 : request.path.includes("/commands") ? 60 : 120;
    const windowMs = 60_000;
    const now = Date.now();
    const key = `${request.ip}:${request.method}:${request.path}`;
    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (bucket.count > limit) throw new AppError("RATE_LIMITED");
    return true;
  }
}
