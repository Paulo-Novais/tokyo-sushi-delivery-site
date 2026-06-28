const catalogHandler = require("./catalog.js");

const buildReviewsUrl = (req) => {
  const requestUrl = new URL(String(req.url || ""), "http://localhost");

  requestUrl.pathname = "/api/catalog";
  requestUrl.searchParams.set("publicView", "reviews");

  return `${requestUrl.pathname}${requestUrl.search}`;
};

module.exports = async (req, res) => {
  const reviewsRequest = Object.create(req);
  reviewsRequest.url = buildReviewsUrl(req);

  return catalogHandler(reviewsRequest, res);
};
