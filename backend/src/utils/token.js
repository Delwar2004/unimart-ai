import jwt from 'jsonwebtoken';

/**
 * Validate and retrieve JWT secret configuration
 * Refuses to fall back to insecure default secrets.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing or empty.');
  }
  return secret;
};

/**
 * Generate a stateless JSON Web Token
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User role ('student' or 'admin')
 * @returns {string} Signed JWT token
 */
export const generateToken = (userId, role) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      userId,
      role,
    },
    secret,
    {
      expiresIn,
    }
  );
};

/**
 * Verify a JSON Web Token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
};
