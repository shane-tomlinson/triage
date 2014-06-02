/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

exports.path = '/static_locals';
exports.method = 'get';
exports.template = 'template';
exports.locals = {
  added_to_locals: 'this is added to the locals sent to the template'
};

exports.authorization = function () {
  return true;
};

exports.handler = function() {
  return {};
};


