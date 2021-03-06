/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/network"], function (require, exports, network_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REMOTE_HOST_SCHEME = network_1.Schemas.vscodeRemote;
    function getRemoteAuthority(uri) {
        return uri.scheme === exports.REMOTE_HOST_SCHEME ? uri.authority : undefined;
    }
    exports.getRemoteAuthority = getRemoteAuthority;
});
//# sourceMappingURL=remoteHosts.js.map