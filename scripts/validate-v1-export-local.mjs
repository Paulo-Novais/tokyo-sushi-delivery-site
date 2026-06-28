import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("export")
  .then(() => {
    console.log("validate:v1-export-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
