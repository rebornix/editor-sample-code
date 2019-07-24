/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/lifecycle", "vs/base/common/async", "vs/base/common/map"], function (require, exports, lifecycle_1, async_1, map_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class URLService {
        constructor() {
            this.handlers = new Set();
        }
        open(uri) {
            const handlers = map_1.values(this.handlers);
            return async_1.first(handlers.map(h => () => h.handleURL(uri)), undefined, false).then(val => val || false);
        }
        registerHandler(handler) {
            this.handlers.add(handler);
            return lifecycle_1.toDisposable(() => this.handlers.delete(handler));
        }
    }
    exports.URLService = URLService;
});
//# sourceMappingURL=urlService.js.map