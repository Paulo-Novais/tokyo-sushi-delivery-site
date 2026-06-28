import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("audit")
  .then(() => {
    console.log("validate:v1-audit-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
