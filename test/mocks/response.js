/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = {
  _headers: {},
  getHeader: function (field) {
    return this._headers[field];
  },
  setHeader: function (field, value) {
    this._headers[field] = value;
  },
  set: function (field, value) {
    this._headers[field] = value;
    return this;
  },
  locals: {}
};

