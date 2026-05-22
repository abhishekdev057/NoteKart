const FALLBACK_ADMINS = ["9256308961", "9461217285"];

export function normalizeMobile(mobile: string) {
  return mobile.replace(/\D/g, "").slice(-10);
}

export function isValidOtp(otp: string) {
  return /^(\d)\1{3}$/.test(otp.trim());
}

export function isAdminMobile(mobile: string) {
  const configured = process.env.ADMIN_MOBILES?.split(",").map(normalizeMobile).filter(Boolean);
  const admins = configured?.length ? configured : FALLBACK_ADMINS;
  return admins.includes(normalizeMobile(mobile));
}
