require('dotenv').config();
const aiService = require('./services/aiService');

async function test() {
  const res = await aiService.extractDriverQuote("560000");
  console.log(res);
}

test();
