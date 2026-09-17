export class AccountingError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AccountingError";
  }
}
