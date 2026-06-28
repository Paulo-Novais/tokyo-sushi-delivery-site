import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("onboarding")
  .then(() => {
    console.log("validate:v1-onboarding-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
