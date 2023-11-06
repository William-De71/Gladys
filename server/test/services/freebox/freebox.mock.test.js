const sinon = require('sinon');

const client = {
  init: sinon.stub(),
};

const FreeboxContext = function FreeboxContext() {
  this.client = client;
};

module.exports = {
  FreeboxContext,
  client,
};
