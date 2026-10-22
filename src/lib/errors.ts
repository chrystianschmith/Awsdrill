/** Erro com mensagem amigável em pt-BR que pode ser mostrada ao usuário. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = "erro",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code?: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}
