export default {
  idl: "../target/idl/vesting_positions.json",
  before: [],
  scripts: {
    js: {
      from: "@codama/renderers-js",
      args: ["src/generated/vesting-positions"],
    },
  },
};
