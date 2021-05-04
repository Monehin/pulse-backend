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
    const { getOne, create } = strapi.services.database;
    const params = _.assign(ctx.request.body);
    const { email } = params.data ? JSON.parse(params.data) : params;

    if (!email) return ctx.badRequest("please specify the email");

    const _user = await getOne("user", { email: email.toLowerCase() });

    const _invite = await getOne("invite", { email: email.toLowerCase() });

    if (_user) return ctx.badRequest(`user with email ${email} exists`);

    if (_invite) return ctx.badRequest(`invite to ${email} already sent`);

    if (ctx.is("multipart")) {
      const { data, files } = parseMultipartData(ctx);
      entity = await create("invite", data, { files });
    } else {
      entity = await create("invite", ctx.request.body);
    }
    // temporary condition awaiting building of the send-invite frontend page
    if (ctx.state.user.role.name === "Super Admin")
      await strapi.services.email.sendEmailInvite(entity);
    return sanitizeEntity(entity, { model: strapi.models.invite });
  },
};
