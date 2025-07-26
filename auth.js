require('dotenv').config();
const jwt = require('jsonwebtoken');

/**
 * Handles user login by checking credentials from the .env file.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
function login(req, res) {
    const { username, password } = req.body;

    // Read credentials securely from environment variables
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check if the provided credentials match the environment variables
    if (username === adminUsername && password === adminPassword) {
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
}

/**
 * Middleware to verify the JWT token from the Authorization header.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The next middleware function.
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

module.exports = {
    login,
    verifyToken
};