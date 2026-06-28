import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("subscription")
  .then(() => {
    console.log("validate:v1-subscription-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
