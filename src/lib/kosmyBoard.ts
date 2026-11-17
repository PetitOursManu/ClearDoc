/** Texte d'une erreur `kosmy_error` renvoyée par les routes de connexion Kosmy Board. */
export function kosmyErrorMessage(t: (key: string) => string, code: string): string {
  const key = `kosmy.error.${code}`;
  const msg = t(key);
  return msg === key ? t('kosmy.error.failed') : msg;
}
