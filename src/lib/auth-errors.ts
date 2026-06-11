export function getRegistrationErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already been registered") ||
    normalizedMessage.includes("user already exists") ||
    normalizedMessage.includes("duplicate")
  ) {
    return "Cette adresse email est déjà utilisée.";
  }

  if (normalizedMessage.includes("rate limit")) {
    return "Trop de tentatives d'inscription. Réessayez dans quelques minutes.";
  }

  return errorMessage;
}
