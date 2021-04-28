"use strict";

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */

  async create(ctx) {
    let entity;
    const params = _.assign(ctx.request.body);
    const { email } = params.data ? JSON.parse(params.data) : params;

    if (!email) {
      return ctx.badRequest("please specify the email");
    }

    const existingUser = await strapi.query("user", "users-permissions").findOne({
      email: email.toLowerCase(),
    });

    const existingInvite = await strapi.query("invite").findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return ctx.badRequest(`user with email ${email} exists`);
    }

    if (existingInvite) {
      return ctx.badRequest(`invite to ${email} already sent`);
    }

    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.invite.create(data, { files });
    } else {
      entity = await strapi.services.invite.create(ctx.request.body);
    }
    return sanitizeEntity(entity, { model: strapi.models.invite });
  },
};
