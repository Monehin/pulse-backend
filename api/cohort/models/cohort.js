"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    // Called before an entry is created
    beforeCreate(data) {},
    // Called after an entry is created
    async afterCreate(result) {
      await strapi.services.database.addRelatedCombinations(
        result,
        "cohort",
        "programs"
      );
    },
  },
};
