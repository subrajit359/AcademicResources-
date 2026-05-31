import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'academic-hub-secret-key') {
  console.error('[SECURITY] JWT_SECRET is missing or uses the insecure default. Set a strong secret in your environment.');
}
const SECRET = JWT_SECRET || 'academic-hub-secret-key';

/* ── Token helpers ── */
const extractToken = (req) => {
  const raw = req.headers.authorization?.split(' ')[1];
  return (!raw || raw === 'null' || raw === 'undefined') ? null : raw;
};

const decodeToken = (token) => jwt.verify(token, SECRET);

/* ── verifyToken ── */
export const verifyToken = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = decodeToken(token);
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/* ── verifyAdmin ── */
export const verifyAdmin = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = decodeToken(token);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/* ── verifyTeacher ── */
export const verifyTeacher = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = decodeToken(token);
    if (!['teacher', 'admin'].includes(decoded.role))
      return res.status(403).json({ message: 'Teacher access required' });
    req.userId   = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/* ── validateObjectId — returns 400 instead of crashing on bad IDs ── */
export const validateObjectId = (...paramNames) => (req, res, next) => {
  const names = paramNames.length ? paramNames : ['id'];
  for (const name of names) {
    const val = req.params[name];
    if (val && !mongoose.Types.ObjectId.isValid(val)) {
      return res.status(400).json({ message: `Invalid ID: ${name}` });
    }
  }
  next();
};
