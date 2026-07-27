const jwt = require('jsonwebtoken');
const { defaultLogger } = require('../utils/logger');

// Decodes a Bearer JWT if present and belongs to a customer, but never fails the request.
// Sets req.customer when a valid customer token is provided.
function optionalCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      if (process.env.JWT_SECRET) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.role === 'customer') {
          req.customer = payload;
        }
      }
    } catch (error) {
      defaultLogger.debug('Optional customer auth failed:', error.message);
    }
  }
  next();
}

module.exports = { optionalCustomerAuth };
