import { runV1Scenario } from "./v1-validation-suite.mjs";

runV1Scenario("security-hardening")
  .then(() => {
    console.log("validate:v1-security-hardening-local OK");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
