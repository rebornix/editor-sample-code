/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class RemoteAuthorityResolverService {
        constructor() {
        }
        resolveAuthority(authority) {
            if (authority.indexOf(':') >= 0) {
                const pieces = authority.split(':');
                return Promise.resolve({
                    authority: { authority, host: pieces[0], port: parseInt(pieces[1], 10) }
                });
            }
            return Promise.resolve({
                authority: { authority, host: authority, port: 80 }
            });
        }
        clearResolvedAuthority(authority) {
        }
        setResolvedAuthority(resolvedAuthority) {
        }
        setResolvedAuthorityError(authority, err) {
        }
    }
    exports.RemoteAuthorityResolverService = RemoteAuthorityResolverService;
});
//# sourceMappingURL=remoteAuthorityResolverService.js.map