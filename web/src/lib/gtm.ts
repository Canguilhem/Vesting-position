/** Optional GTM links — set in .env for production site. */
export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL ?? "hello@example.com";

export const SETUP_CALL_URL = import.meta.env.VITE_SETUP_CALL_URL ?? "";

export const contactMailto = (subject: string, body?: string) => {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
};
