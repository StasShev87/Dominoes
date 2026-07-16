import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AppModule } from "./app.module.js";
import { io } from "socket.io-client";

describe("HTTP API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("v1");
    await app.init();
  });

  afterEach(async () => app.close());

  test("reports health", async () => {
    const response = await request(app.getHttpServer()).get("/v1/health").expect(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("creates, joins, and reads a private match through public endpoints", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/matches/private")
      .set("x-test-principal", "ACCOUNT:owner")
      .send({ seed: 42 })
      .expect(201);

    const joined = await request(app.getHttpServer())
      .post(`/v1/invites/${created.body.inviteToken}/join`)
      .set("x-test-principal", "GUEST:guest")
      .expect(201);

    expect(joined.body.matchId).toBe(created.body.matchId);
    const snapshot = await request(app.getHttpServer())
      .get(`/v1/matches/${created.body.matchId}`)
      .set("x-test-principal", "ACCOUNT:owner")
      .expect(200);
    expect(snapshot.body.hand).toHaveLength(7);
    expect(snapshot.body).not.toHaveProperty("boneyard");
  });

  test("requires an authenticated principal", async () => {
    await request(app.getHttpServer()).post("/v1/matches/private").send({ seed: 1 }).expect(401);
  });

  test("issues an HttpOnly guest session that can join an invitation", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/matches/private")
      .set("x-test-principal", "ACCOUNT:owner")
      .send({ seed: 7 })
      .expect(201);
    const session = await request(app.getHttpServer())
      .post("/v1/guest-sessions")
      .send({ displayName: "Table Guest" })
      .expect(201);

    expect(session.body.guestId).toMatch(/^[0-9a-f-]{36}$/);
    const cookie = session.headers["set-cookie"]?.[0];
    expect(cookie).toContain("dominoes_guest=");
    expect(cookie).toContain("HttpOnly");

    await request(app.getHttpServer())
      .post(`/v1/invites/${created.body.inviteToken}/join`)
      .set("Cookie", cookie!)
      .expect(201);
  });

  test("rate limits repeated guest-session creation", async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer()).post("/v1/guest-sessions").send({ displayName: `Guest ${index}` }).expect(201);
    }
    const limited = await request(app.getHttpServer())
      .post("/v1/guest-sessions")
      .send({ displayName: "One too many" })
      .expect(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("creates a unique public profile", async () => {
    const principal = "ACCOUNT:018f47a2-62f4-7af8-bf65-2f641f9c3e5a";
    const created = await request(app.getHttpServer())
      .post("/v1/profiles")
      .set("x-test-principal", principal)
      .send({ username: "Player_01", locale: "uk" })
      .expect(201);

    expect(created.body.username).toBe("player_01");
    await request(app.getHttpServer())
      .post("/v1/profiles")
      .set("x-test-principal", "ACCOUNT:018f47a2-62f4-7af8-bf65-2f641f9c3e5b")
      .send({ username: "PLAYER_01", locale: "en" })
      .expect(409);
  });

  test("subscribes an authorized player to a personalized match snapshot", async () => {
    const principal = "ACCOUNT:owner";
    const created = await request(app.getHttpServer())
      .post("/v1/matches/ai")
      .set("x-test-principal", principal)
      .send({ seed: 42 })
      .expect(201);
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    const socket = io(`http://127.0.0.1:${address.port}/matches`, {
      transports: ["websocket"],
      auth: { testPrincipal: principal }
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
      });
      const snapshotPromise = new Promise<Record<string, unknown>>((resolve) => {
        socket.once("match:snapshot", resolve);
      });
      socket.emit("match:join", { matchId: created.body.matchId });

      const snapshot = await snapshotPromise;
      expect(snapshot.matchId).toBe(created.body.matchId);
      expect(snapshot.hand).toHaveLength(7);
      expect(snapshot).not.toHaveProperty("boneyard");
    } finally {
      socket.close();
    }
  });
});
