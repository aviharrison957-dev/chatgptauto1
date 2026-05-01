const { handler } = require("../netlify/functions/stripe-webhook");

handler({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify({ type: "checkout.session.completed" }),
  isBase64Encoded: false
}).then((response) => {
  console.log(`statusCode=${response.statusCode}`);
  console.log(response.body);
  if (response.statusCode !== 400) {
    process.exitCode = 1;
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
