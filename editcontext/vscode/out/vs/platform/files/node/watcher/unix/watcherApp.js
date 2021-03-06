/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/parts/ipc/node/ipc.cp", "vs/platform/files/node/watcher/unix/watcherIpc", "vs/platform/files/node/watcher/unix/chokidarWatcherService"], function (require, exports, ipc_cp_1, watcherIpc_1, chokidarWatcherService_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const server = new ipc_cp_1.Server('watcher');
    const service = new chokidarWatcherService_1.ChokidarWatcherService();
    const channel = new watcherIpc_1.WatcherChannel(service);
    server.registerChannel('watcher', channel);
});
//# sourceMappingURL=watcherApp.js.map