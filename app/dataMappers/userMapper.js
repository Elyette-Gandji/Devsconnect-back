const client = require('./database');
const userTagMapper = require('./userTagMapper');
const ApiError = require('../errors/apiError.js');

const setRefreshToken = async(id, token) => {
  const preparedQuery = {
    text: 'UPDATE "user" set "refresh_token" = $2 WHERE "id" = $1 RETURNING *',
    values: [id, token],
  };
  const results = await client.query(preparedQuery);
  return results.rows;
}

const getRefreshToken = async (id) => {
  const preparedQuery = {
    text: 'SELECT "refresh_token" FROM "user" WHERE "id" = $1',
    values: [id],
  };
  const results = await client.query(preparedQuery);
  return results.rows[0].refresh_token;
}

const findAllUsers = async () => {
  const preparedQuery ={
    text: `SELECT
      "user"."id",
      "user"."name",
      "user"."firstname",
      "user"."pseudo",
      "user"."description",
      "user"."availability",
      (
        SELECT json_agg(json_build_object('id', "project"."id", 'title', "project"."title"))
        FROM (
          SELECT DISTINCT "project"."id", "project"."title"
          FROM "project"
          INNER JOIN "project_has_user" ON "project"."id" = "project_has_user"."project_id"
          WHERE "project_has_user"."user_id" = "user"."id"
        )AS "project"
      ) AS "projects",
      (
        SELECT json_agg(json_build_object('id', "tag"."id", 'name', "tag"."name"))
        FROM (
          SELECT DISTINCT "tag"."id", "tag"."name"
          FROM "tag"
          INNER JOIN "user_has_tag" ON "tag"."id" = "user_has_tag"."tag_id"
          WHERE "user_has_tag"."user_id" = "user"."id"
        ) AS "tag"
      )AS "tags"
    FROM "user"`};
  const results = await client.query(preparedQuery);
  return results.rows; 
}

/* async function getAllUsers() {
  const findAllUsers = await client.query(`SELECT * FROM find_all_users`);
  const results = findAllUsers.rows[0];
  console.log(results);
  return results;
} */

const findOneUser = async(id) => {
  const preparedQuery = {
    text: `SELECT
    "user"."id",
    "user"."name",
    "user"."firstname",
    "user"."pseudo",
    "user"."email",
    "user"."description",
    "user"."availability",
    (
      SELECT json_agg(json_build_object('id', "project"."id", 'title', "project"."title", 'description', "project"."description", 'availability', "project"."availability"))
      FROM (
        SELECT DISTINCT "project"."id", "project"."title", "project"."description", "project"."availability"
        FROM "project"
        INNER JOIN "project_has_user" ON "project"."id" = "project_has_user"."project_id"
        WHERE "project_has_user"."user_id" = "user"."id"
      )AS "project"
    ) AS "projects",
    (
      SELECT json_agg(json_build_object('id', "tag"."id", 'name', "tag"."name"))
      FROM (
        SELECT DISTINCT "tag"."id", "tag"."name"
        FROM "tag"
        INNER JOIN "user_has_tag" ON "tag"."id" = "user_has_tag"."tag_id"
        WHERE "user_has_tag"."user_id" = "user"."id"
      ) AS "tag"
    ) AS "tags"
    FROM "user"
    WHERE "id" = $1`,
    values: [id],
  };
  const results = await client.query(preparedQuery);
  if (!results.rows[0]) {
    throw new ApiError('User not found', { statusCode: 204 });
  }
  return results.rows[0]; 
}

/* async function getUserById(id) {
  const findOneUser = await client.query(`SELECT * FROM "find_user_by_id"($1)`, [id]);
  const user = findOneUser.rows[0];
  return user;
} */

const removeOneUser = async(id) => { 
  const preparedQuery = {
    text: `DELETE FROM "user" WHERE "id" = $1 RETURNING *`,
    values: [id],
  };
  const [results] = (await client.query(preparedQuery)).rows;
  if (!results) {
    throw new ApiError('User already deleted', { statusCode: 204 });
  }
  return results;
}

const createOneUser = async (name, firstname, email, pseudo, password, description, availability, tags) => {
  const preparedUserQuery = {
    text: `INSERT INTO "user" ("name", "firstname", "email", "pseudo", "password", "description", "availability") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    values: [name, firstname, email, pseudo, password, description, availability],
  };

  const [user] = (await client.query(preparedUserQuery)).rows;
  if (!user) {
    throw new ApiError('Nothing to create', { statusCode: 204 });
  }

  for (const tagId of tags) {
    await userTagMapper.createUserHasTag(user.id, tagId);
  }

  return user;
}

const updateOneUser = async (userId, userUpdate) => { 
  const currentUser = await findOneUser(userId);
    if (!currentUser) {
      throw new ApiError('User not found', { statusCode: 204 });
    };

  // opérateur d'accès conditionnel (?.) remplace if pour gérer les cas où currentProject.tags ou projectUpdate.tags sont null ou undefined
  const UpdatedTags = userUpdate.tags;
  const currentUserTags = currentUser.tags.map(tag => tag.id);
  
  // Id des tags au lieu des objets complets
  const tagsToDelete = currentUserTags?.filter(tagId => !UpdatedTags?.includes(tagId)) || [];
    for (const tagId of tagsToDelete) {
      await userTagMapper.deleteUserHasTag(userId, tagId);
    }
    
  const tagsToAdd = UpdatedTags?.filter(tagId => !currentUserTags?.includes(tagId)) || [];
    for (const tagId of tagsToAdd) {
      await userTagMapper.createUserHasTag(userId, tagId);
    }
    
  const preparedQuery = {
    text: `UPDATE "user"
    SET "name" = COALESCE($1, "name"), 
        "firstname" = COALESCE($2, "firstname"), 
        "email" = COALESCE($3, "email"), 
        "pseudo" = COALESCE($4, "pseudo"), 
        "password" = COALESCE($5, "password"), 
        "description" = COALESCE($6, "description"), 
        "availability" = COALESCE($7, "availability"),
        "updated_at"= NOW()
    WHERE "id"=$8 
    RETURNING "name", "firstname", "email", "pseudo", "description", "availability", "updated_at"`,
    values: [
      userUpdate.name,
      userUpdate.firstname,
      userUpdate.email,
      userUpdate.pseudo,
      userUpdate.password,
      userUpdate.description,
      userUpdate.availability,
      userId
    ],
  };

  const [results] = (await client.query(preparedQuery)).rows;

  return results;
};

const findUserByEmail = async(email) => {
  const preparedQuery = {
    text: `SELECT * FROM "user"
           WHERE "email" = $1`,
    values: [email],
  };

  const [results] = (await client.query(preparedQuery)).rows;
  return results;
}

const findUserByPseudo = async(pseudo) => {
  const preparedQuery = {
    text: `SELECT * FROM "user"
           WHERE "pseudo" = $1`,
    values: [pseudo],
  };

  const [results] = (await client.query(preparedQuery)).rows;
  return results;
}

module.exports = {
  setRefreshToken,
  getRefreshToken,
  findAllUsers,
  //getAllUsers,
  findOneUser,
  //getUserById,
  removeOneUser,
  createOneUser,
  updateOneUser,
  findUserByEmail,
  findUserByPseudo
};
