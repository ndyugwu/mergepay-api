/** Application error with a stable machine code + HTTP status. */
export class AppError extends Error {
  status: number;
  /** Mirror of `status` so Fastify's default handler also returns the right code. */
  statusCode: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required") =>
    new AppError(401, "unauthorized", msg),
  forbidden: (msg = "You do not have access to this resource") =>
    new AppError(403, "forbidden", msg),
  notFound: (msg = "Not found") => new AppError(404, "not_found", msg),
  badRequest: (code: string, msg: string) => new AppError(400, code, msg),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
  upstream: (msg: string) => new AppError(502, "upstream_error", msg),
};
