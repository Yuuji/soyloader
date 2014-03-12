var should = require('should');
var soyloader = require('../lib/main');

describe('test include', function() {
    it('returns "test"', function(done) {
        this.timeout(10000);
        soyloader(__dirname + '/templates', false);
        setTimeout(function() {
            var result = test.templates.test();
            result.should.eql('test');
            done();
        }, 8000);
    });
});
