"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    dB: () => strapi.services.database,
    // Called before an entry is created
    beforeCreate(data) {},
    // Called after an entry is created
    async afterCreate(result) {
      // const { addRelatedCombinations } = strapi.services.database;
      await this.dB().addRelatedCombinations(result, "cohort", "programs");
    },
    async afterUpdate(result) {
      await this.dB().addRelatedCombinations(result, "cohort", "programs");
    },
  },
};
