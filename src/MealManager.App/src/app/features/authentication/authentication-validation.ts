export const passwordHint = $localize`:@@authentication.passwordHint:Use 6+ characters, including A–Z, a–z, a number, and a symbol.`;

export function passwordMeetsPolicy(value: string): boolean {
  return (
    value.length >= 6 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export function emailError(value: string): string | null {
  if (!value.trim()) return $localize`:@@authentication.emailRequired:Enter your email address.`;
  return /^[^\s@]+@[^\s@]+$/.test(value.trim())
    ? null
    : $localize`:@@authentication.emailInvalid:Enter a valid email address.`;
}

export function newPasswordError(value: string): string | null {
  if (value.length < 6)
    return $localize`:@@authentication.passwordTooShort:Use at least 6 characters.`;
  return passwordMeetsPolicy(value) ? null : passwordHint;
}

export function focusInvalidControl(ids: string[]) {
  // The fields already exist; let the error descriptions render before moving focus.
  setTimeout(() => document.getElementById(ids[0])?.focus());
}
