var should = require('should');
var soyloader = require('../lib/main');

describe('test include', function() {
    it('returns "test"', function(done) {
        soyloader({
            templateDir: __dirname + '/templates',
            soyFile: false,
            logging: false,
            callback: function() {
                var result = test.templates.test();
                result.should.eql('test');
                done();
            }
        });
    });
});
