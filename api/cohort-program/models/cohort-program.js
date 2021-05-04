"use strict";

const { getOne } = require('../../database/services/Database');
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    // Called before an entry is created
    async beforeCreate(data) {
      const program = await getOne("programs", data.program);
      const cohort = await getOne("cohort", data.cohort);
      data.name = `${cohort.name} ${program.name}`;
    },
    // Called after an entry is created
    afterCreate(result) {},
  },
};
