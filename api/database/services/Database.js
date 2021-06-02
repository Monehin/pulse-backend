"use strict";

const { isDraft } = require("strapi-utils").contentTypes;

const getDateObject = (date = new Date()) => new Date(date);

const normalizedArgs = (model, filter = {}) => {
  let plugin, whereObject;
  if (["user", "role"].includes(model)) plugin = "users-permissions";
  whereObject = typeof filter == "string" ? { id: filter } : filter;
  return { plugin, whereObject };
};

const getAll = async (model) => strapi.query(model).find({});

const existingUserName = async (username) => await getOne("user", { username });

async function getOne(model, filter) {
  const { plugin, whereObject } = normalizedArgs(model, filter);
  return strapi.query(model, plugin).findOne(whereObject, []);
}

async function getIdFromName(model, name) {
  const target = await strapi.query(model).findOne({ name }, []);
  return target.id;
}

async function create(model, data, { files } = {}) {
  const { plugin } = normalizedArgs(model);
  const _isDraft = isDraft(data, strapi.models[model]);
  const validData = await strapi.entityValidator.validateEntityCreation(
    strapi.models[model],
    data,
    { isDraft: _isDraft }
  );
  const entry = await strapi.query(model, plugin).create(validData);

  if (files) {
    // automatically uploads the files based on the entry and the model
    await strapi.entityService.uploadFiles(entry, files, {
      model: model,
      source: plugin,
    });
    return strapi.query(model, plugin).findOne({ id: entry.id });
  }
  return entry;
}

// function to correct plural misnomer of models
const normalizeModelName = (name) =>
  name.endsWith("s") ? name.slice(0, -1) : name;

async function addRelatedCombinations(
  current,
  currentModel,
  targetModel,
  combinationModel = "cohort-program"
) {
  if (!current.autoPopulate) return;
  const allTarget = await getAll(targetModel);
  if (!allTarget.length) return;
  allTarget.forEach(async (target) => {
    if (!target.autoPopulate || current.cohort_programs.length > 0) return;
    await create(combinationModel, {
      [normalizeModelName(currentModel)]: current.id,
      [normalizeModelName(targetModel)]: target.id,
    });
  });
}

async function defaultCohortProgram(invite) {
  const allCohortPrograms = await strapi.query("cohort-program").find({});
  const entryProgram = await getOne("programs", { prerequisite: 0 });
  const bootCampId = await getIdFromName("programs", entryProgram.name);
  const candidatePrograms = allCohortPrograms.filter(
    (f) =>
      getDateObject(f.start_date) <= getDateObject() &&
      f.program.id === bootCampId
  );

  if (invite) return getOne("cohort-program", { id: invite });
  return candidatePrograms.sort(
    (a, b) => getDateObject(b.start_date) - getDateObject(a.start_date)
  )[0];
}

async function getRole(invite, settings) {
  const [v, k] = invite.role
    ? [invite.role, "id"]
    : [settings.default_role, "type"];
  return getOne("role", { [k]: v });
}

async function addUserRelations(invite, user) {
  let cohortProgram, userProgram, manager;
  cohortProgram = await defaultCohortProgram(invite.cohort_program_schedule);
  const [trainee, cohort_program_id] = [user.id, cohortProgram.id];
  // check if inviter role is and if so, is manager
  if (invite.inviter) {
    const invitingUser = await getOne("user", { id: invite.inviter });
    const inviterRole = await getOne("role", { id: invitingUser.role });
    if (inviterRole.name === "Manager") manager = [invitingUser.id]; // manager is an array
  }
  // only create user-program for trainees
  if (user.role.name === "Trainee")
    userProgram = { trainee, cohort_program_id };
  // manager inviter is default manager if invitee a trainee
  if (manager && userProgram) Object.assign(userProgram, { manager });
  if (userProgram) await create("user-program", userProgram);
}

module.exports = {
  getAll,
  getOne,
  getIdFromName,
  create,
  normalizeModelName,
  addRelatedCombinations,
  defaultCohortProgram,
  getRole,
  addUserRelations,
  existingUserName,
};
