/**
 * Maps raw Supabase / network error messages to safe, user-facing strings.
 * Never expose project IDs, URLs, table names, or internal details to the UI.
 */

const SUPABASE_URL_PATTERN = /https?:\/\/[a-z0-9]+\.supabase\.(co|io|com)[^\s]*/gi;
const PROJECT_ID_PATTERN = /[a-z]{20,}/g; // supabase project IDs are ~20 lowercase chars

type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_already_exists"
  | "weak_password"
  | "rate_limit"
  | "network"
  | "generic";

const CODE_MESSAGES: Record<AuthErrorCode, { fr: string; en: string }> = {
  invalid_credentials: {
    fr: "Email ou mot de passe incorrect.",
    en: "Incorrect email or password.",
  },
  email_not_confirmed: {
    fr: "Veuillez confirmer votre email avant de vous connecter.",
    en: "Please confirm your email address before signing in.",
  },
  user_already_exists: {
    fr: "Un compte existe déjà avec cet email.",
    en: "An account already exists with this email.",
  },
  weak_password: {
    fr: "Le mot de passe doit faire au moins 8 caractères.",
    en: "Password must be at least 8 characters.",
  },
  rate_limit: {
    fr: "Trop de tentatives. Réessayez dans quelques minutes.",
    en: "Too many attempts. Please try again in a few minutes.",
  },
  network: {
    fr: "Erreur réseau. Vérifiez votre connexion.",
    en: "Network error. Please check your connection.",
  },
  generic: {
    fr: "Une erreur est survenue. Réessayez.",
    en: "Something went wrong. Please try again.",
  },
};

function classifyError(raw: string): AuthErrorCode {
  const lower = raw.toLowerCase();
  if (
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("invalid email or password")
  )
    return "invalid_credentials";
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed"))
    return "email_not_confirmed";
  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("email address is already")
  )
    return "user_already_exists";
  if (
    lower.includes("password should be") ||
    lower.includes("weak_password") ||
    lower.includes("password is too short")
  )
    return "weak_password";
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429"))
    return "rate_limit";
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("failed to fetch"))
    return "network";
  return "generic";
}

export function sanitizeAuthError(error: unknown, lang: "fr" | "en" = "fr"): string {
  if (!error) return CODE_MESSAGES.generic[lang];

  let raw = "";
  if (error instanceof Error) raw = error.message;
  else if (typeof error === "string") raw = error;
  else raw = String(error);

  const code = classifyError(raw);
  return CODE_MESSAGES[code][lang];
}

/** Safe version for non-auth errors (order errors, etc.) */
export function sanitizeError(error: unknown, lang: "fr" | "en" = "fr"): string {
  if (!error) return CODE_MESSAGES.generic[lang];

  let raw = "";
  if (error instanceof Error) raw = error.message;
  else if (typeof error === "string") raw = error;
  else raw = String(error);

  // Strip any Supabase URLs or project IDs from the message before showing
  const stripped = raw
    .replace(SUPABASE_URL_PATTERN, "[service]")
    .replace(PROJECT_ID_PATTERN, "[id]");

  if (
    stripped.includes("[service]") ||
    stripped.includes("[id]") ||
    stripped.includes("supabase") ||
    stripped.includes("postgrest") ||
    stripped.includes("PGRST") ||
    stripped.includes("23") // PostgreSQL error codes start with 23
  ) {
    return CODE_MESSAGES.generic[lang];
  }

  // If it looks like a safe, short user message, return it
  if (stripped.length < 120 && !stripped.includes("http")) return stripped;

  return CODE_MESSAGES.generic[lang];
}

/** Validates a redirect URL is safe (relative or same-origin only) */
export function isSafeRedirect(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;

  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === window.location.origin
    );
  } catch {
    return false;
  }
}

export function normalizeSafeRedirect(url: string, fallback = "/app"): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//")) return url;

  if (typeof window === "undefined") return fallback;

  try {
    const parsed = new URL(url, window.location.origin);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === window.location.origin
    ) {
      const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return normalized || fallback;
    }
  } catch {
    // fall back to the default destination below
  }

  return fallback;
}
