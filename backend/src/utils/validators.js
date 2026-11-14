/**
 * Validate password strength:
 * Minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number.
 */
export const isPasswordStrong = (password) => {
  if (!password || typeof password !== 'string') return false;
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
};

/**
 * Validate whether the email belongs to an allowed university domain
 * Domain list is loaded from UNIVERSITY_EMAIL_DOMAINS (comma-separated), e.g. "bup.edu.bd,du.ac.bd"
 */
export const isValidUniversityEmail = (email) => {
  if (!email || typeof email !== 'string') return false;

  const domainsEnv = process.env.UNIVERSITY_EMAIL_DOMAINS;
  // If no domains specified in env, allow any valid institutional .edu/.ac or university domain for testing
  if (!domainsEnv || domainsEnv.trim() === '') {
    return /^[^\s@]+@[^\s@]+\.(edu(\.[a-z]{2})?|ac(\.[a-z]{2})?)$/i.test(email) || email.endsWith('.edu.bd');
  }

  const allowedDomains = domainsEnv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain) return false;

  return allowedDomains.some((domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`));
};
