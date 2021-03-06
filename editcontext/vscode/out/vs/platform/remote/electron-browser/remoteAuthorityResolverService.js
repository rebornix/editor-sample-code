/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "electron", "vs/base/common/errors"], function (require, exports, electron_1, errors) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PendingResolveAuthorityRequest {
        constructor(resolve, reject, promise) {
            this.resolve = resolve;
            this.reject = reject;
            this.promise = promise;
        }
    }
    class RemoteAuthorityResolverService {
        constructor() {
            this._resolveAuthorityRequests = Object.create(null);
        }
        resolveAuthority(authority) {
            if (!this._resolveAuthorityRequests[authority]) {
                let resolve;
                let reject;
                let promise = new Promise((_resolve, _reject) => {
                    resolve = _resolve;
                    reject = _reject;
                });
                this._resolveAuthorityRequests[authority] = new PendingResolveAuthorityRequest(resolve, reject, promise);
            }
            return this._resolveAuthorityRequests[authority].promise;
        }
        clearResolvedAuthority(authority) {
            if (this._resolveAuthorityRequests[authority]) {
                this._resolveAuthorityRequests[authority].reject(errors.canceled());
                delete this._resolveAuthorityRequests[authority];
            }
        }
        setResolvedAuthority(resolvedAuthority, options) {
            if (this._resolveAuthorityRequests[resolvedAuthority.authority]) {
                let request = this._resolveAuthorityRequests[resolvedAuthority.authority];
                electron_1.ipcRenderer.send('vscode:remoteAuthorityResolved', resolvedAuthority);
                request.resolve({ authority: resolvedAuthority, options });
            }
        }
        setResolvedAuthorityError(authority, err) {
            if (this._resolveAuthorityRequests[authority]) {
                let request = this._resolveAuthorityRequests[authority];
                request.reject(err);
            }
        }
    }
    exports.RemoteAuthorityResolverService = RemoteAuthorityResolverService;
});
//# sourceMappingURL=remoteAuthorityResolverService.js.map