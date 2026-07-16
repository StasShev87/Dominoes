import { BadRequestException, Body, Controller, Inject, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "./principal.js";
import { GuestSessionService } from "./guest-session.service.js";

@Controller("guest-sessions")
export class GuestSessionsController {
  constructor(@Inject(GuestSessionService) private readonly guests: GuestSessionService) {}

  @Public()
  @Post()
  async create(@Body() body: { displayName?: unknown }, @Res({ passthrough: true }) response: Response) {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (displayName.length < 2 || displayName.length > 20) throw new BadRequestException("INVALID_GUEST_NAME");
    const session = await this.guests.issue(displayName);
    response.cookie(this.guests.cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: session.maxAge * 1000,
      path: "/"
    });
    return { guestId: session.guestId };
  }
}
