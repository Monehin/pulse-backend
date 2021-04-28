"use strict";

const { isDraft } = require("strapi-utils").contentTypes;

/**
 * Email.js controller
 *
 * @description: Helper functions for geting items from any database collection.
 */

module.exports = {
  async getOne(model, filter) {
    let plugin;
    if (["user", "role"].includes(model)) plugin = "users-permissions";
    const whereObject = typeof filter == "string" ? { id: filter } : filter;
    return strapi.query(model, plugin).findOne(whereObject, []);
  },

  async create(model, data, { files } = {}) {
    const _isDraft = isDraft(data, strapi.models[model]);
    const validData = await strapi.entityValidator.validateEntityCreation(
      strapi.models[model],
      data,
      { isDraft: _isDraft }
    );
    const entry = await strapi.query(model).create(validData);

    if (files) {
      // automatically uploads the files based on the entry and the model
      await strapi.entityService.uploadFiles(entry, files, {
        model: model,
        // if you are using a plugin's model you will have to add the `source` key (source: 'users-permissions')
      });
      return strapi.query(model).findOne({ id: entry.id });
    }
    return entry;
  },
};
