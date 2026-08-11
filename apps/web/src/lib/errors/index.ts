export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} (${id}) não encontrado.` : `${entity} não encontrado.`, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  readonly issues?: Record<string, string[]>;

  constructor(message: string, issues?: Record<string, string[]>) {
    super(message, 422, "VALIDATION_ERROR");
    this.issues = issues;
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para executar esta ação.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class IntegrationError extends AppError {
  constructor(message: string) {
    super(message, 502, "INTEGRATION_ERROR");
  }
}

export function toActionErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocorreu um erro inesperado.";
}
