/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// All routes are loaded from the individual files in the routes subdirectory.
// Each .js file in the routes subdirectory should contain 3 fields:
//  * method - get, post, put, delete, etc.
//  * path - path the respond to
//  * handler - function to handle the route.


const path = require('path');
const cors = require('cors');
const globRequire = require('glob-require');
const joi = require('joi');
const Promises = require('bluebird');

function Triage() {
  // nothing to do here.
}

Triage.prototype = {
  init: function (options) {
    options = options || {};

    this._cwd = options.cwd;
    if (! this._cwd) {
      throw new Error('missing `cwd` in options');
    }

    this._router = options.router;
    if (! this._router) {
      throw new Error('missing `router` in options');
    }

    this._routeConfig = options.route_config || {};

    this.load();
  },

  load: function () {
    return loadRoutes(this._cwd, this._routeConfig).then(this.registerRoutes.bind(this));
  },

  registerRoutes: function (routes) {
    routes.forEach(this.registerRoute.bind(this));
  },

  registerRoute: function (route) {
    validateRoute(route);

    var handler = routeHandler.bind(route);
    if (route.cors) {
      var options;
      if (typeof route.cors === 'object') options = route.cors;

      var corsMiddleware = cors(options);
      this._router[route.method](route.path, corsMiddleware, handler);
      this._router.options(route.path, corsMiddleware);
    } else {
      this._router[route.method](route.path, handler);
    }
  }
};

function validateRoute(route) {
  var requiredFields = [
    'authorization',
    'handler',
    'method',
    'path'
  ];

  requiredFields.forEach(function (field) {
    if (! route[field]) {
      throw new Error('missing `' + field + '` in route definition');
    }
  });
}

module.exports = Triage;

function extend(target/*, src...*/) {
  var sources = [].slice.call(arguments, 1);
  sources.forEach(function(source) {
    for (var key in source) {
      target[key] = source[key];
    }
  });
  return target;
}

function loadRoutes(root, routeConfigs) {
  return new Promises(function (fulfill, reject) {
    globRequire(root, function (err, modules) {
      if (err) return reject(err);

      var routes = modules.map(function(module) {
        var route = module.exports;

        if (typeof route === 'function') {
          var basename = path.basename(module.path, '.js');
          var starConfig = routeConfigs['*'] || {};
          var routeConfig = routeConfigs[basename] || {};
          route = new route(extend({}, starConfig, routeConfig));
        }

        route.filename = module.path;
        return route;
      });

      fulfill(routes);
    });
  });
}

/*
 * Set up a local handler for generic functionality
 * such as authorization, template rendering
 * and error logging/display. A route's `handler` function
 * should return a value or a promise.
 *
 * If the handler promise resolves and the route
 * has a template, the template will be written
 * with the resolved data. If the promise fails,
 * the error handler will be called with the error.
 */
function routeHandler(req, res, next) {
  var self = this;
  if (self.setParams) {
    self.setParams(req);
  }

  Promises
    .try(validateInput)
    .then(authorizeUser)
    .then(runHandler)
    .then(throwErrors)
    .then(render)
    .catch(next);

  function validateInput() {
    if (! self.validation) return;

    return new Promises(function(fulfill, reject) {
      joi.validate(req.body, self.validation, function (err, value) {
        if (err) return reject(err);

        fulfill(value);
      });
    });
  }

  function authorizeUser() {
    return self.authorization(req);
  }

  function runHandler() {
    return self.handler(req, res, next);
  }

  function throwErrors(value) {
    if (value instanceof Error) {
      // we are in a promise, let the promise's error handler
      // take care of the error state.
      throw value;
    }

    return value;
  }

  function render(templateData) {
    if (! self.template) return;

    // if the page was redirected, abort rendering.
    if (res.url) return;

    // explicit opt out of rendering.
    if (templateData === false) return;

    for (var key in self.locals) {
      res.locals[key] = self.locals[key];
    }

    res.render(self.template, templateData);
  }
}

