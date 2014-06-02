/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Promises = require('bluebird');
const path = require('path');
const cors = require('cors');
const corsMiddleware = cors();
const joi = require('joi');
const globRequire = require('glob-require');

const Router = require('express').Router;
const router = new Router();

const logger = require('./logger');
const getQuery = require('./site-query');
const httpErrors = require('./http-errors');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// All routes are loaded from the individual files in the routes subdirectory.
// Each .js file in the routes subdirectory should contain 3 fields:
//  * verb - get, post, put, delete, etc.
//  * path - path the respond to
//  * handler - function to handle the route.
loadRoutesFromDirectory(ROUTES_DIR, router);

function loadRoutesFromDirectory(root, router) {
  globRequire(root, function (err, modules) {
    modules.forEach(function(module) {
      var route = module.exports;
      if (typeof route === 'function') {
        route = new route();
      }
      addRoute(route, router);
    });
  });
}

// router is passed in for testing.
function addRoute(route, router) {
  if ( ! (route.path && route.verb)) return new Error('invalid route');

  if (route.enable_cors) {
    router[route.verb](route.path, corsMiddleware, routeHandler.bind(route));
  } else {
    router[route.verb](route.path, routeHandler.bind(route));
  }
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

  // Set up some helpers on the request.
  req.dbQuery = getQuery(req);
  req.start = req.dbQuery.start;
  req.end = req.dbQuery.end;

  Promises
    .try(validateInput)
    .then(authorizeUser)
    .then(processRoute)
    .then(throwErrors)
    .then(render)
    .catch(handleError);

  function validateInput() {
    if (! self.validation) return;

    var err = joi.validate(req.body, self.validation);
    if (err) {
      throw err;
    }
  }

  function authorizeUser() {
    if (! self.authorization) {
      logger.warn('no authorization function set for: `%s`', req.url);
    } else {
      return self.authorization(req);
    }
  }

  function processRoute() {
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

  // XXX Consider moving rendering functions to their own middleware.
  function render(templateData) {
    if (! self.template) return;

    // if the page was redirected, abort rendering.
    if (res.url) return;

    // explicit opt out of rendering.
    if (templateData === false) return;

    if (! templateData) templateData = {};

    // XXX This should probably be somewhere else,
    // perhaps in its own middleware
    if (! templateData.email && req.session.email) {
      templateData.email = req.session.email;
    }

    if (templateData.resources && self['js-resources']) {
      logger.warn('%s: self defines `js-resources`, `resources` will be ignored. Pick one.', req.url);
    }
    templateData.resources = self['js-resources'];
    res.render(self.template, templateData);
  }

  function handleError(err) {
    if (httpErrors.is(err, httpErrors.UnauthorizedError)) {
      // user is not authenticated, redirect them to the signin page.
      req.session.redirectTo = encodeURIComponent(req.url);
      res.redirect(307, '/user');
      return;
    }

    var httpStatusCode = err.httpError || 500;
    logger.error('%s(%s): %s', req.url, httpStatusCode, String(err));
    res.send(httpStatusCode, err.message);
  }
}


module.exports = router;
module.exports.loadRoutesFromDirectory = loadRoutesFromDirectory;
module.exports.addRoute = addRoute;
