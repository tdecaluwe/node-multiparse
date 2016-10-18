'use strict'

var expect = require('chai').expect;

var MessagePart = require('../messagepart.js');

describe('MessagePart', function () {
  var message;
  beforeEach(function () {
    message = new MessagePart();
  });
  it('should return true when not pushing past the highwater mark', function () {
    var buffer = new Buffer(1, 32);
    var result = message.push(buffer);
    expect(result).to.equal(true);
  });
  it('should return false when pushing past the highwater mark', function () {
    var buffer = new Buffer(16384, 32);
    var result = message.push(buffer);
    expect(result).to.equal(false);
  });
  it('should return false when pushing past the highwater mark with a listener', function () {
    var buffer = new Buffer(16384, 32);
    message.on('data', function () {});
    expect(message.push(buffer)).to.equal(false);
  });
  it('should emit a data event when new data is written', function (done) {
    var event;
    message.on('data', function () { event = 'data'; });
    message.push('data');
    setTimeout(function () { console.log(event); expect(event).to.equal('data'); done(); }, 1000);
  });
  it('should emit a part event when adding a part', function () {
    var event;
    message.on('part', function () { event = 'part'; });
    message.part();
    expect(event).to.equal('part');
  });
});
