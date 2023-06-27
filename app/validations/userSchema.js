const Joi = require('joi');

const userCreate = Joi.object({
  name: Joi.string()
    .max(30)
    .required(),
  firstname: Joi.string()
    .max(30)
    .required(),
  pseudo: Joi.string()
    .max(30)
    .required(),
  email: Joi.string()
    .email({minDomainSegments: 2})
    .required(),
  password: Joi.string()
  // regex exemple not implemented for demo "^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$"
    .pattern(new RegExp())
    .required(),
  description: Joi.string().allow('').allow(null),
  availability: Joi.boolean(),
  tags: Joi.array()
    .items(Joi.number().integer()),
});

const userUpdate = Joi.object({
  name: Joi.string()
    .max(30),
  firstname: Joi.string()
    .max(30),
  pseudo: Joi.string()
    .max(30),
  email: Joi.string()
    .email({minDomainSegments: 2}),
  password: Joi.string().allow('').allow(null)
    // regex exemple not implemented for demo "^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$"
    .pattern(new RegExp()),
  description: Joi.string().allow('').allow(null),
  availability: Joi.boolean(),
  tags: Joi.array()
    .items(Joi.number().integer()),
});

module.exports = { userCreate, userUpdate };

