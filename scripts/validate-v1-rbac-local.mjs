import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("rbac")
  .then(() => {
    console.log("validate:v1-rbac-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
