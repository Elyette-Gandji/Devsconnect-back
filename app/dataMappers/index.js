const authMapper = require('./authMapper');
const projectMapper = require('./projectMapper');
const userMapper = require('./userMapper');
const tagMapper = require('./tagMapper');
const projectUserMapper = require('./projectUserMapper'); 
const projectTagMapper = require('./projectTagMapper'); 
const userTagMapper = require('./userTagMapper');

// Exportez les fonctions regroupées par type
module.exports = {
  auth: authMapper,
  projects: projectMapper,
  users: userMapper,
  tags: tagMapper,
  projectUsers: projectUserMapper,
  projectTags: projectTagMapper,
  userTags: userTagMapper
};
