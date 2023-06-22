const client = require('./database');
const projectTagMapper = require('./projectTagMapper');
const projectUserMapper = require('./projectUserMapper');
const ApiError = require('../errors/apiError.js');

const findAllProjects = async () => {
  const results = await client.query(`
  SELECT
    "project"."id",
    "project"."title",
    "project"."description",
    "project"."availability",
    "project"."user_id",
    (
      SELECT json_agg(json_build_object('id', "tag"."id", 'name', "tag"."name"))
      FROM (
        SELECT DISTINCT "tag"."id", "tag"."name"
        FROM "tag"
        INNER JOIN "project_has_tag" ON "tag"."id" = "project_has_tag"."tag_id"
        WHERE "project_has_tag"."project_id" = "project"."id"
      ) AS "tag"
    ) AS "tags",
    (
      SELECT json_agg(json_build_object('id', "user"."id", 'pseudo', "user"."pseudo", 'is_active', "user"."is_active"))
      FROM (
        SELECT DISTINCT "user"."id", "user"."pseudo", "project_has_user"."is_active"
        FROM "user"
        INNER JOIN "project_has_user" ON "user"."id" = "project_has_user"."user_id"
        WHERE "project_has_user"."project_id" = "project"."id"
      )AS "user"
    ) AS "users"
  FROM "project"
  GROUP BY
    "project"."id";
  `);
  return results.rows; 
}

const findOneProject = async (id) => {
  const preparedQuery = {
    text: `SELECT
    "project"."id",
    "project"."title",
    "project"."description",
    "project"."availability",
    "project"."user_id",
    (  
        SELECT "user"."pseudo"
        FROM "user"
        WHERE "user"."id" = "project"."user_id"
    ) AS user_pseudo,
    (
        SELECT json_agg(json_build_object('tag_id', "tag"."id", 'tag_name', "tag"."name"))
        FROM (
            SELECT DISTINCT ON ("tag"."id") "tag"."id", "tag"."name"
            FROM "tag"
            INNER JOIN "project_has_tag" ON "project_has_tag"."tag_id" = "tag"."id"
            WHERE "project_has_tag"."project_id" = "project"."id"
            ORDER BY "tag"."id"
        ) AS "tag"
    ) AS "tags",
    (
        SELECT json_agg(json_build_object('user_id', "user"."id", 'pseudo', "user"."pseudo", 'is_active', "user"."is_active"))
        FROM (
            SELECT DISTINCT ON ("user"."id") "user"."id", "user"."pseudo", "project_has_user"."is_active"
            FROM "user"
            INNER JOIN "project_has_user" ON "project_has_user"."user_id" = "user"."id"
            WHERE "project_has_user"."project_id" = "project"."id"
            ORDER BY "user"."id"
        ) AS "user"
    ) AS "users"
FROM
    "project"
WHERE
    "project"."id" = $1;`,
    values: [id],
  };
  const results = await client.query(preparedQuery);
  if (!results.rows[0]) {
    throw new ApiError('Project not found', { statusCode: 204 });
  }
  return results.rows[0]; 
}

const removeOneProject = async(id) => {
  const preparedQuery = {
    text: `DELETE FROM "project" WHERE "id" = $1 RETURNING *`,
    values: [id],
  }
  // destructuration de tableau pour récupérer le premier élément
  const [results] = (await client.query(preparedQuery)).rows;
  if (!results) {
    throw new ApiError('Project already deleted', { statusCode: 204 });
  }
  return results;
}

const createOneProject = async(title, description, availability, user_id, tags) => {
  const preparedProjectQuery= {
     text: `INSERT INTO "project" ("title", "description", "availability", "user_id") VALUES ($1, $2, $3, $4) RETURNING *`,
     values: [title, description, availability, user_id]
  }
  // destructuration de tableau pour récupérer le premier élément
  const [project] = (await client.query(preparedProjectQuery)).rows;
  if (!project) {
    throw new ApiError('Nothing to create', { statusCode: 204 });
  }

  // opérateur d'accès conditionnel (?.) remplace if pour gérer les cas où currentProject.tags ou projectUpdate.tags sont null ou undefined
  parsedTags = JSON.parse(tags);
  const addTagsToProject = parsedTags?.map(async (tagId) => {
    const preparedTagQuery = {
        text: `INSERT INTO "project_has_tag" ("project_id", "tag_id") VALUES ($1, $2) RETURNING *`,
        values: [project.id, tagId],
    };
    // destructuration de tableau pour récupérer le premier élément
    const [tagResults] = (await client.query(preparedTagQuery)).rows;
    return tagResults;
  });

  await Promise.all(addTagsToProject);

  // ajout du titulaire du projet dans projectHasUser
  await projectUserMapper.createProjectHasUser(project.id, project.user_id);

  return project;
};

const updateOneProject = async (projectId, projectUpdate) => {
  const currentProject = await findOneProject(projectId);
  if (!currentProject) {
    throw new ApiError('Project not found', { statusCode: 204 });
  }

  const UpdatedTags = projectUpdate.tags;
  console.log(UpdatedTags);
  const currentProjectTags = currentProject.tags.map(tag => tag.id);
  console.log(currentProjectTags); // undefined
  
  // Id des tags au lieu des objets complets
  const tagsToDelete = currentProjectTags?.filter(tagId => !UpdatedTags?.includes(tagId)) || [];
    for (const tagId of tagsToDelete) {
      await projectTagMapper.deleteProjectHasTag(projectId, tagId);
    }
    
  const tagsToAdd = UpdatedTags?.filter(tagId => !currentProjectTags?.includes(tagId)) || [];
    for (const tagId of tagsToAdd) {
      await projectTagMapper.createProjectHasTag(projectId, tagId);
    }

  const preparedQuery = {
    text: `UPDATE "project" 
      SET title = COALESCE($1, title), 
        description = COALESCE($2, description), 
        availability = COALESCE($3, availability),
        updated_at = NOW()
      WHERE id=$4 RETURNING *`,
    values: [projectUpdate.title, projectUpdate.description, projectUpdate.availability, projectId],
  };
  // destructuration de tableau pour récupérer le premier élément
  const [results] = (await client.query(preparedQuery)).rows;

  return results;
};

const findProjectOwner = async(projectId) => {
  const preparedQuery = {
    text: `SELECT "project"."user_id" FROM "project"
           WHERE "project"."id" = $1`,
    values: [projectId],
  };
// destructuration de tableau pour récupérer le premier élément
  const [results] = (await client.query(preparedQuery)).rows;
  return results.user_id;
}

module.exports = {
  findAllProjects,
  findOneProject,
  removeOneProject,
  createOneProject,
  updateOneProject,
  findProjectOwner
};