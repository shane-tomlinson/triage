/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global before, describe, it*/

/**
 * Test the generic route infrastructure to ensure both values and promises
 * are handled correctly.
 */

const assert = require('chai').assert;
const path = require('path');
const Router = require('express').Router;
const TEST_ROUTES_DIRECTORY = path.join(__dirname, '..', 'mocks', 'routes');

const Triage = require('../../lib/triage');

var RequestMock = {
  query: {},
  params: {
    hostname: 'testuser.com'
  },
  session: {
    email: 'testuser@testuser.com'
  }
};

describe('a route handler', function () {
  var triage, router;

  before(function () {
    router = new Router();
    triage = new Triage();
    triage.init({
      cwd: TEST_ROUTES_DIRECTORY,
      router: router,
    });
  });

  describe('that returns a value', function () {
    it('renders the value', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/return_value';

      router.handle(request, {
        render: function(template, templateData) {
          assert.equal(template, 'template');
          assert.equal(templateData.success, true);
          done();
        }
      });
    });
  });

  describe('that returns an error', function () {
    it('sends the error', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/return_error';

      router.handle(request, {
        send: function() {
          assert.isTrue(false, 'unexpected send');
        }
      }, function next(err) {
        assert.equal(err.message, 'this is an error');
        done();
      });
    });
  });

  describe('that returns false', function () {
    it('does nothing', function () {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/return_false';

      return router.handle(request, {
        send: function() {
          console.trace();
          assert(false, 'unexpected send');
        },
        render: function() {
          console.trace();
          assert(false, 'unexpected render');
        }
      });
    });
  });

  describe('that returns a promise that becomes fulfilled', function () {
    it('renders the value', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/return_promise_fulfill';

      router.handle(request, {
        render: function(template, templateData) {
          assert.equal(template, 'template');
          assert.equal(templateData.success, true);
          done();
        }
      });
    });
  });

  describe('that returns a promise that becomes rejected', function () {
    it('sends the error', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/return_promise_reject';

      router.handle(request, {
        send: function() {
          assert.isTrue(false, 'unexpected send');
        }
      }, function next(err) {
        assert.equal(err.message, 'this is a rejection notice');
        done();
      });
    });
  });

  describe('that requires an unauthenticated user to authenticate', function () {
    it('redirects to the `/user` page with a `redirectTo` query parameter', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/user_not_authenticated';

      router.handle(request, {
        send: function () {
          assert.istrue(false, 'unexpected send');
        },
        redirect: function () {
          assert.istrue(false, 'unexpected redirect');
        }
      }, function (err) {
        assert.equal(err.message, 'not authorized');
        done();
      });
    });
  });

  describe('that allows an authorized authenticated user', function () {
    it('serves the page', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/user_authenticated';

      router.handle(request, {
        render: function () {
          done();
        }
      });
    });
  });

  describe('that needs to be instantiated', function () {
    it('serves the page', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/requires_initialization';

      router.handle(request, {
        render: function () {
          done();
        }
      });
    });
  });

  describe('that declares static locals', function () {
    it('merges the locals before render', function (done) {
      var request = Object.create(RequestMock);
      request.method = 'get';
      request.url = '/static_locals';

      var respMock = {
        locals: {},
        render: function () {
          assert.isTrue(this.locals.hasOwnProperty('added_to_locals'));
          done();
        }
      };

      router.handle(request, respMock);
    });
  });
});
