"use strict";

/**
 * Email.js controller
 *
 * @description: Helper function for sending emails.
 */

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
