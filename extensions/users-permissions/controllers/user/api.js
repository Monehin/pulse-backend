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

const getDateObject = (date) => (date ? new Date(date) : new Date());

module.exports = {
  /**
   * Create a/an user record.
   * @return {Object}
   */
  async create(ctx) {
    const advanced = await strapi
      .store({
        environment: "",
        type: "plugin",
        name: "users-permissions",
        key: "advanced",
      })
      .get();
    const { create, getAll, getOne, getIdFromName } = strapi.services.database;
    const { email, username, password } = ctx.request.body;
    let manager, cohortProgram, cohort, program;

    if (!email) return ctx.badRequest("missing.email");
    if (!username) return ctx.badRequest("missing.username");
    if (!password) return ctx.badRequest("missing.password");

    const allCohortPrograms = await getAll("cohort-program");

    const bootCampId = await getIdFromName("programs", "Bootcamp");

    const candidatePrograms = allCohortPrograms.filter(
      (f) =>
        getDateObject(f.start_date) <= getDateObject() &&
        f.program.id === bootCampId
    );

    const defaultCohortProgram = candidatePrograms.sort(
      (a, b) => getDateObject(b.start_date) - getDateObject(a.start_date)
    )[0];

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

    if (invite.cohort_program_schedule) {
      cohortProgram = await getOne("cohort-program", {
        id: invite.cohort_program_schedule,
      });
    }
    cohortProgram = cohortProgram || defaultCohortProgram;

    if (invite.inviter) {
      const invitingUser = await getOne("user", { id: invite.inviter });
      const inviterRole = await getOne("role", { id: invitingUser.role });
      // manager is an array
      if (inviterRole.name === "Manager") manager = [invitingUser.id];
    }

    const [v, k] = invite.role
      ? [invite.role, "id"]
      : [advanced.default_role, "type"];
    const role = await getOne("role", { [k]: v });

    const userWithSameUsername = await getOne("user", { username });

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

      const [trainee, cohort_program_id] = [data.id, cohortProgram.id];
      const userProgram =
        role.name === "Trainee" ? { trainee, cohort_program_id } : null;

      if (manager && userProgram) Object.assign(userProgram, { manager });
      if (userProgram) await create("user-program", userProgram);
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
