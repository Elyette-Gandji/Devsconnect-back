const jwt = require('jsonwebtoken');
const dataMapper = require('../dataMappers/dataMapper');
const ApiError = require('../errors/apiError.js');

const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;
const ACCESS_TOKEN_EXPIRATION = process.env.ACCESS_TOKEN_EXPIRATION ?? '15m';
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION ?? '7d';

const auth = {
  /**
   * generates an access token
   *
   * @param {string} ip - ip that has authenticated
   * @param {object} user - authenticated user
   * @returns an access token
   */
  generateAccessToken(ip, user) {
    return jwt.sign(
      {
        data: {
          ip,
          email: user.email,
          id: user.id,
        },
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRATION },
    );
  },

  /**
   * generates a refresh token
   *
   * @param {number} id - user id
   * @returns a refresh token
   */
  generateRefreshToken(id) {
    return jwt.sign({ id }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
    });
  },

  /**
   * generate middleware to authorize route access according to token roles
   *
   * @param {string} permission - the permission required
   * @param {*} section - the section that needs the permission
   * @returns {function} a mw function to check permission on the section
   */
  authorize(permission, section) {
    // eslint-disable-next-line consistent-return
    return async (req, _, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const token = authHeader.split('Bearer ')[1];
          // retrieve token
          const decoded = jwt.verify(token, JWT_SECRET);
          // check ip consistency
          if (decoded.data.ip !== req.ip) {
            new ApiError('Unauthorized', { statusCode: 401 });
          }

          // check for create project 
          if (permission === "create" && section === "project") {
            return next();
          }

          // check for modify or delete project 
          if (permission === "modify" && section === "project" || permission === "delete" && section === "project") {
            const projectID = parseInt(req.params.id);
            const projectOwnerId = await dataMapper.findProjectOwner(projectID);
            if(!projectOwnerId){
              new ApiError('Not found', { statusCode: 404 });
            };
            if (decoded.data.id === projectOwnerId){
              return next();
            };
          }

          if (permission === "modify" && section === "user" || permission === "delete" && section === "user") {
            const routeID = parseInt(req.params.id);
            if (decoded.data.id === routeID){
              return next();
            };
          }

          // forbidden
          new ApiError('Unauthorized', { statusCode: 401 });
        }
        new ApiError('Forbidden', { statusCode: 403 });
      } catch (ApiError) {
        throw ApiError;
      }
    };
  },

  /**
   * validite refreshToken against the one stored in db
   *
   * @param {string} token - a refresh token
   * @returns {boolean}
   */
  async isValidRefreshToken(token) {
    const decodedToken = jwt.verify(token, JWT_REFRESH_SECRET);
    const storedToken = await dataMapper.getRefreshToken(decodedToken.id);
    return token === storedToken;
  },

  /**
   * get user from email stored in access token
   *
   * @param {string} token - an accesToken (may have expired)
   * @returns {object} a user object
   */
  async getTokenUser(token) {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    return dataMapper.findUserByEmail(decoded.data.email);
  },
};

module.exports = auth;