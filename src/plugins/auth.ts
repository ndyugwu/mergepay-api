import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Errors } from "../errors";

export interface AuthUser {
  id: string;
  stellarPublicKey: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, pk: user.stellarPublicKey },
    config.JWT_SECRET,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
  return { id: String(decoded.sub), stellarPublicKey: String(decoded.pk) };
}

async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw Errors.unauthorized();
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyToken(token);
  } catch {
    throw Errors.unauthorized("Invalid or expired session");
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", authenticate);
});

/** Read the authenticated user or throw 401. */
export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw Errors.unauthorized();
  return req.user;
}
