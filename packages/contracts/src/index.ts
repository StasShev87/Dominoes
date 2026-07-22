import { z } from "zod";

export const LocaleSchema = z.enum(["uk", "en", "ru"]);

export const UsernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/)
  .transform((value) => value.toLowerCase());

export const ProfileSchema = z.object({
  id: z.uuid(),
  username: UsernameSchema,
  locale: LocaleSchema,
  createdAt: z.iso.datetime()
}).strict();

export const CreateProfileRequestSchema = z.object({
  username: UsernameSchema,
  locale: LocaleSchema.default("uk")
}).strict();

export const MatchModeSchema = z.enum(["AI", "PRIVATE"]);

export const CreateMatchRequestSchema = z.object({
  mode: MatchModeSchema,
  targetScore: z.literal(100).default(100)
}).strict();

const TileIdSchema = z.string().regex(/^[0-6]-[0-6]$/).refine((value) => value[0]! <= value[2]!, {
  message: "Tile id must be canonical"
});

export const GameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLAY_TILE"), tileId: TileIdSchema, side: z.enum(["LEFT", "RIGHT"]) }).strict(),
  z.object({ type: z.literal("DRAW_TILE") }).strict(),
  z.object({ type: z.literal("PASS") }).strict(),
  z.object({ type: z.literal("CLAIM_FORFEIT") }).strict()
]);

export const CommandRequestSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  command: GameCommandSchema
}).strict();

export const ErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "USERNAME_TAKEN",
  "MATCH_NOT_FOUND",
  "NOT_YOUR_TURN",
  "ILLEGAL_MOVE",
  "STALE_VERSION",
  "INVITE_EXPIRED",
  "INVITE_ALREADY_USED",
  "FORFEIT_NOT_AVAILABLE",
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR"
]);

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  correlationId: z.string().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional()
}).strict();

export const TileSchema = z.object({
  id: TileIdSchema,
  left: z.number().int().min(0).max(6),
  right: z.number().int().min(0).max(6)
}).strict();

export const PlacedTileSchema = z.object({
  tile: TileSchema,
  left: z.number().int().min(0).max(6),
  right: z.number().int().min(0).max(6),
  moveNumber: z.number().int().nonnegative()
}).strict();

export const LegalActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLAY_TILE"), tileId: TileIdSchema, sides: z.array(z.enum(["LEFT", "RIGHT"])).min(1) }).strict(),
  z.object({ type: z.literal("DRAW_TILE") }).strict(),
  z.object({ type: z.literal("PASS") }).strict(),
  z.object({ type: z.literal("CLAIM_FORFEIT") }).strict()
]);

export const PlayerViewSchema = z.object({
  matchId: z.string().min(1),
  seat: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  status: z.enum(["ACTIVE", "FINISHED"]),
  scores: z.array(z.number().int().nonnegative()).min(2).max(4),
  targetScore: z.literal(100),
  winnerSeat: z.number().int().nonnegative().nullable(),
  roundNumber: z.number().int().positive(),
  currentSeat: z.number().int().nonnegative(),
  hand: z.array(TileSchema),
  seats: z.array(z.object({
    seat: z.number().int().nonnegative(),
    tileCount: z.number().int().nonnegative()
  }).strict()).min(2).max(4),
  boneyardCount: z.number().int().nonnegative(),
  chain: z.array(PlacedTileSchema),
  openEnds: z.tuple([
    z.number().int().min(0).max(6),
    z.number().int().min(0).max(6)
  ]).nullable(),
  legalActions: z.array(LegalActionSchema)
}).strict();

export const InviteSchema = z.object({
  token: z.string().min(32),
  expiresAt: z.iso.datetime(),
  matchId: z.string().min(1)
}).strict();

export type Locale = z.infer<typeof LocaleSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;
export type MatchMode = z.infer<typeof MatchModeSchema>;
export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;
export type PublicGameCommand = z.infer<typeof GameCommandSchema>;
export type CommandRequest = z.infer<typeof CommandRequestSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type PlayerView = z.infer<typeof PlayerViewSchema>;
export type Invite = z.infer<typeof InviteSchema>;
