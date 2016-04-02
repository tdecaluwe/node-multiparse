'use strict'

var expect = require('chai').expect;

var Message = require('../message.js');

describe('Message', function () {
  var message;
  beforeEach(function () {
    message = new Message();
  });
  it('should emit a data event when new data is written', function () {
    var event;
    message.on('data', function () { event = 'data'; });
    message.write('data');
    expect(event).to.equal('data');
  });
  it('should emit a part event when adding a part', function () {
    var event;
    message.on('part', function () { event = 'part'; });
    message.part();
    expect(event).to.equal('part');
  });
});
