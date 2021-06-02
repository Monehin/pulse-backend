"use strict";

const _ = require("lodash");
const { sanitizeEntity } = require("strapi-utils");

const sanitizeUser = (user) =>
  sanitizeEntity(user, {
    model: strapi.query("user", "users-permissions").model,
  });

const formatError = (error) => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
  /**
   * Create a/an user record.
   * @return {Object}
   */
  async create(ctx) {
    const { getOne, getRole, addUserRelations, existingUserName } =
      strapi.services.database;
    const { email, username, password } = ctx.request.body;

    const advanced = await strapi
      .store({
        environment: "",
        type: "plugin",
        name: "users-permissions",
        key: "advanced",
      })
      .get();

    if (!email) return ctx.badRequest("missing email");
    if (!username) return ctx.badRequest("missing username");
    if (!password) return ctx.badRequest("missing password");

    const invite = await getOne("invite", { email });
    if (!invite) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.notFound",
          message: "You're not not authorized to register",
        })
      );
    }

    const userWithSameUsername = await existingUserName(username);

    if (userWithSameUsername) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.username.taken",
          message: "Username already taken.",
          field: ["username"],
        })
      );
    }

    if (advanced.unique_email) {
      const userWithSameEmail = await getOne("user", {
        email: email.toLowerCase(),
      });

      if (userWithSameEmail) {
        return ctx.badRequest(
          null,
          formatError({
            id: "Auth.form.error.email.taken",
            message: "Email already taken.",
            field: ["email"],
          })
        );
      }
    }

    const role = await getRole(invite, advanced);

    const user = {
      ...ctx.request.body,
      provider: "local",
      role,
    };
    user.email = user.email.toLowerCase();

    try {
      const data = await strapi.plugins["users-permissions"].services.user.add(
        user
      );
      ctx.created(sanitizeUser(data));

      await addUserRelations(invite, data);
    } catch (error) {
      ctx.badRequest(null, formatError(error));
    }
  },

  /**
   * Update a/an user record.
   * @return {Object}
   */

  async update(ctx) {
    const advancedConfigs = await strapi
      .store({
        environment: "",
        type: "plugin",
        name: "users-permissions",
        key: "advanced",
      })
      .get();

    const { id } = ctx.params;
    const { email, username, password } = ctx.request.body;

    const user = await strapi.plugins["users-permissions"].services.user.fetch({
      id,
    });

    if (_.has(ctx.request.body, "email") && !email) {
      return ctx.badRequest("email.notNull");
    }

    if (_.has(ctx.request.body, "username") && !username) {
      return ctx.badRequest("username.notNull");
    }

    if (
      _.has(ctx.request.body, "password") &&
      !password &&
      user.provider === "local"
    ) {
      return ctx.badRequest("password.notNull");
    }

    if (_.has(ctx.request.body, "username")) {
      const userWithSameUsername = await strapi
        .query("user", "users-permissions")
        .findOne({ username });

      if (userWithSameUsername && userWithSameUsername.id != id) {
        return ctx.badRequest(
          null,
          formatError({
            id: "Auth.form.error.username.taken",
            message: "username.alreadyTaken.",
            field: ["username"],
          })
        );
      }
    }

    if (_.has(ctx.request.body, "email") && advancedConfigs.unique_email) {
      const userWithSameEmail = await strapi
        .query("user", "users-permissions")
        .findOne({ email: email.toLowerCase() });

      if (userWithSameEmail && userWithSameEmail.id != id) {
        return ctx.badRequest(
          null,
          formatError({
            id: "Auth.form.error.email.taken",
            message: "Email already taken",
            field: ["email"],
          })
        );
      }
      ctx.request.body.email = ctx.request.body.email.toLowerCase();
    }

    let updateData = {
      ...ctx.request.body,
    };

    if (_.has(ctx.request.body, "password") && password === user.password) {
      delete updateData.password;
    }

    const data = await strapi.plugins["users-permissions"].services.user.edit(
      { id },
      updateData
    );

    ctx.send(sanitizeUser(data));
  },
};
