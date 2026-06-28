import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("pilot-journey")
  .then(() => {
    console.log("validate:v1-pilot-journey-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
