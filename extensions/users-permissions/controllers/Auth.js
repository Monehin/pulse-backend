"use strict";

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require("crypto");
const _ = require("lodash");
const grant = require("grant-koa");
const { sanitizeEntity } = require("strapi-utils");

const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const formatError = (error) => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];
const {
  EMAIL_INVITE_URL,
  EMAIL_SEND_RETRY_DELAY_MILLISECONDS,
  EMAIL_RETRY_DELAY_MULTIPLIER,
  MAXIMUM_RETRY_DURATION,
} = process.env;

const generateTemplate = (invite) => {
  if (!invite.inviter) invite.inviter = {};
  if (!invite.role) invite.role = {};
  const {
    inviter: { first_name, last_name },
    role: { name },
  } = invite;
  return {
    subject: "Invitation to register on ATLP DevPulse",
    text: `Welcome to ATLP Rwanda
    ${first_name} ${last_name} is inviting you to join as ${name}, please click on, or copy and paste this ${EMAIL_INVITE_URL} into your browser's address bar to accept the invite`,
    html: `<h1>Welcome to ATLP Rwanda</h1>
    <p>${first_name || "ATLP"} ${
      last_name || "Rwanda"
    } is inviting you to join as ${
      name || "a contributor"
    }, please click on, or copy and paste this <a href=${EMAIL_INVITE_URL}>${EMAIL_INVITE_URL}</a> into your browser's address bar<p> to accept the invite`,
  };
};

module.exports = {
  async register(ctx) {
    const pluginStore = await strapi.store({
      environment: "",
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({
      key: "advanced",
    });

    if (!settings.allow_register) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.advanced.allow_register",
          message: "Register action is currently disabled.",
        })
      );
    }

    const params = {
      ..._.omit(ctx.request.body, [
        "confirmed",
        "confirmationToken",
        "resetPasswordToken",
      ]),
      provider: "local",
    };

    // Password is required.
    if (!params.password) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.password.provide",
          message: "Please provide your password.",
        })
      );
    }

    // Email is required.
    if (!params.email) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.provide",
          message: "Please provide your email.",
        })
      );
    }

    // Throw an error if the password selected by the user
    // contains more than three times the symbol '$'.
    if (
      strapi.plugins["users-permissions"].services.user.isHashed(
        params.password
      )
    ) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.password.format",
          message:
            "Your password cannot contain more than three times the symbol `$`.",
        })
      );
    }

    const invite = await strapi
      .query("invite")
      .findOne({ email: ctx.request.body.email }, []);

    if (!invite) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.notFound",
          message: "You're not not authorized to register",
        })
      );
    }

    const roleQuery = invite.role ? { id: invite.role } : { name: "Trainee" };
    const role = await strapi
      .query("role", "users-permissions")
      .findOne(roleQuery, []);

    if (!role) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.role.notFound",
          message: "Cannot find user role",
        })
      );
    }

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.format",
          message: "Please provide valid email address.",
        })
      );
    }

    params.role = role.id;
    params.password = await strapi.plugins[
      "users-permissions"
    ].services.user.hashPassword(params);

    const user = await strapi.query("user", "users-permissions").findOne({
      email: params.email,
    });

    if (user && user.provider === params.provider) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.taken",
          message: "Email is already taken.",
        })
      );
    }

    if (user && user.provider !== params.provider && settings.unique_email) {
      return ctx.badRequest(
        null,
        formatError({
          id: "Auth.form.error.email.taken",
          message: "Email is already taken.",
        })
      );
    }

    try {
      if (!settings.email_confirmation) {
        params.confirmed = true;
      }

      const user = await strapi
        .query("user", "users-permissions")
        .create(params);

      const sanitizedUser = sanitizeEntity(user, {
        model: strapi.query("user", "users-permissions").model,
      });

      if (settings.email_confirmation) {
        try {
          await strapi.plugins[
            "users-permissions"
          ].services.user.sendConfirmationEmail(user);
        } catch (err) {
          return ctx.badRequest(null, err);
        }

        return ctx.send({ user: sanitizedUser });
      }

      const jwt = strapi.plugins["users-permissions"].services.jwt.issue(
        _.pick(user, ["id"])
      );

      return ctx.send({
        jwt,
        user: sanitizedUser,
      });
    } catch (err) {
      const adminError = _.includes(err.message, "username")
        ? {
            id: "Auth.form.error.username.taken",
            message: "Username already taken",
          }
        : { id: "Auth.form.error.email.taken", message: "Email already taken" };

      ctx.badRequest(null, formatError(adminError));
    }
  },

  async sendEmailInvite(invite) {
    let resp,
      delay = EMAIL_SEND_RETRY_DELAY_MILLISECONDS;
    const template = generateTemplate(invite);
    (async function sendMail() {
      try {
        await strapi.plugins.email.services.email.sendTemplatedEmail(
          { to: invite.email },
          template,
          { user: {} }
        );
        resp = `Invitation email sent to ${invite.email}`;
      } catch (err) {
        if (Number(delay) < Number(MAXIMUM_RETRY_DURATION)) {
          setTimeout(async () => await sendMail(invite), delay);
          delay *= EMAIL_RETRY_DELAY_MULTIPLIER;
          resp = `Error sending email to ${invite.email}. You will be notified when the email is sent`;
        } else {
          resp = `Failed to send email to ${invite.email}. Aborting retrying. Please send this link, ${EMAIL_INVITE_URL}, manually`;
        }
      }
      return resp;
    })();
  },
};
