"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    // Called before an entry is created
    async beforeCreate(data) {
      const {getOne} = strapi.services.database;
      const trainee = await getOne("user", data.trainee);
      const cohProg = await getOne("cohort-program", data.cohort_program_id);
      data.name = `${trainee.username} - ${cohProg.name}`;
    },
    // Called after an entry is created
    afterCreate(result) {},
  },
};
