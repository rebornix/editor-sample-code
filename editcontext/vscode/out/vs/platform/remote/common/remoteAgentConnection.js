/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define(["require", "exports", "vs/base/parts/ipc/common/ipc.net", "vs/base/common/uuid", "vs/base/common/lifecycle", "vs/base/common/buffer", "vs/base/common/event", "vs/platform/remote/common/remoteAuthorityResolver", "vs/base/common/errors"], function (require, exports, ipc_net_1, uuid_1, lifecycle_1, buffer_1, event_1, remoteAuthorityResolver_1, errors_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ConnectionType;
    (function (ConnectionType) {
        ConnectionType[ConnectionType["Management"] = 1] = "Management";
        ConnectionType[ConnectionType["ExtensionHost"] = 2] = "ExtensionHost";
        ConnectionType[ConnectionType["Tunnel"] = 3] = "Tunnel";
    })(ConnectionType = exports.ConnectionType || (exports.ConnectionType = {}));
    function connectToRemoteExtensionHostAgent(options, connectionType, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const protocol = yield new Promise((c, e) => {
                options.webSocketFactory.connect(options.host, options.port, `reconnectionToken=${options.reconnectionToken}&reconnection=${options.reconnectionProtocol ? 'true' : 'false'}`, (err, socket) => {
                    if (err) {
                        e(err);
                        return;
                    }
                    if (options.reconnectionProtocol) {
                        options.reconnectionProtocol.beginAcceptReconnection(socket, null);
                        c(options.reconnectionProtocol);
                    }
                    else {
                        c(new ipc_net_1.PersistentProtocol(socket, null));
                    }
                });
            });
            return new Promise((c, e) => {
                const messageRegistration = protocol.onControlMessage((raw) => __awaiter(this, void 0, void 0, function* () {
                    const msg = JSON.parse(raw.toString());
                    // Stop listening for further events
                    messageRegistration.dispose();
                    const error = getErrorFromMessage(msg);
                    if (error) {
                        return e(error);
                    }
                    if (msg.type === 'sign') {
                        const signed = yield options.signService.sign(msg.data);
                        const connTypeRequest = {
                            type: 'connectionType',
                            commit: options.commit,
                            signedData: signed,
                            desiredConnectionType: connectionType,
                            isBuilt: options.isBuilt
                        };
                        if (args) {
                            connTypeRequest.args = args;
                        }
                        protocol.sendControl(buffer_1.VSBuffer.fromString(JSON.stringify(connTypeRequest)));
                        c(protocol);
                    }
                    else {
                        e(new Error('handshake error'));
                    }
                }));
                setTimeout(() => {
                    e(new Error('handshake timeout'));
                }, 2000);
                // TODO@vs-remote: use real nonce here
                const authRequest = {
                    type: 'auth',
                    auth: '00000000000000000000'
                };
                protocol.sendControl(buffer_1.VSBuffer.fromString(JSON.stringify(authRequest)));
            });
        });
    }
    function doConnectRemoteAgentManagement(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const protocol = yield connectToRemoteExtensionHostAgent(options, 1 /* Management */, undefined);
            return new Promise((c, e) => {
                const registration = protocol.onControlMessage(raw => {
                    registration.dispose();
                    const msg = JSON.parse(raw.toString());
                    const error = getErrorFromMessage(msg);
                    if (error) {
                        return e(error);
                    }
                    if (options.reconnectionProtocol) {
                        options.reconnectionProtocol.endAcceptReconnection();
                    }
                    c({ protocol });
                });
            });
        });
    }
    function doConnectRemoteAgentExtensionHost(options, startArguments) {
        return __awaiter(this, void 0, void 0, function* () {
            const protocol = yield connectToRemoteExtensionHostAgent(options, 2 /* ExtensionHost */, startArguments);
            return new Promise((c, e) => {
                const registration = protocol.onControlMessage(raw => {
                    registration.dispose();
                    const msg = JSON.parse(raw.toString());
                    const error = getErrorFromMessage(msg);
                    if (error) {
                        return e(error);
                    }
                    const debugPort = msg && msg.debugPort;
                    if (options.reconnectionProtocol) {
                        options.reconnectionProtocol.endAcceptReconnection();
                    }
                    c({ protocol, debugPort });
                });
            });
        });
    }
    function doConnectRemoteAgentTunnel(options, startParams) {
        return __awaiter(this, void 0, void 0, function* () {
            const protocol = yield connectToRemoteExtensionHostAgent(options, 3 /* Tunnel */, startParams);
            return protocol;
        });
    }
    function resolveConnectionOptions(options, reconnectionToken, reconnectionProtocol) {
        return __awaiter(this, void 0, void 0, function* () {
            const { host, port } = yield options.addressProvider.getAddress();
            return {
                isBuilt: options.isBuilt,
                commit: options.commit,
                host: host,
                port: port,
                reconnectionToken: reconnectionToken,
                reconnectionProtocol: reconnectionProtocol,
                webSocketFactory: options.webSocketFactory,
                signService: options.signService
            };
        });
    }
    function connectRemoteAgentManagement(options, remoteAuthority, clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const reconnectionToken = uuid_1.generateUuid();
            const simpleOptions = yield resolveConnectionOptions(options, reconnectionToken, null);
            const { protocol } = yield doConnectRemoteAgentManagement(simpleOptions);
            return new ManagementPersistentConnection(options, remoteAuthority, clientId, reconnectionToken, protocol);
        });
    }
    exports.connectRemoteAgentManagement = connectRemoteAgentManagement;
    function connectRemoteAgentExtensionHost(options, startArguments) {
        return __awaiter(this, void 0, void 0, function* () {
            const reconnectionToken = uuid_1.generateUuid();
            const simpleOptions = yield resolveConnectionOptions(options, reconnectionToken, null);
            const { protocol, debugPort } = yield doConnectRemoteAgentExtensionHost(simpleOptions, startArguments);
            return new ExtensionHostPersistentConnection(options, startArguments, reconnectionToken, protocol, debugPort);
        });
    }
    exports.connectRemoteAgentExtensionHost = connectRemoteAgentExtensionHost;
    function connectRemoteAgentTunnel(options, tunnelRemotePort) {
        return __awaiter(this, void 0, void 0, function* () {
            const simpleOptions = yield resolveConnectionOptions(options, uuid_1.generateUuid(), null);
            const protocol = yield doConnectRemoteAgentTunnel(simpleOptions, { port: tunnelRemotePort });
            return protocol;
        });
    }
    exports.connectRemoteAgentTunnel = connectRemoteAgentTunnel;
    function sleep(seconds) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, seconds * 1000);
        });
    }
    var PersistentConnectionEventType;
    (function (PersistentConnectionEventType) {
        PersistentConnectionEventType[PersistentConnectionEventType["ConnectionLost"] = 0] = "ConnectionLost";
        PersistentConnectionEventType[PersistentConnectionEventType["ReconnectionWait"] = 1] = "ReconnectionWait";
        PersistentConnectionEventType[PersistentConnectionEventType["ReconnectionRunning"] = 2] = "ReconnectionRunning";
        PersistentConnectionEventType[PersistentConnectionEventType["ReconnectionPermanentFailure"] = 3] = "ReconnectionPermanentFailure";
        PersistentConnectionEventType[PersistentConnectionEventType["ConnectionGain"] = 4] = "ConnectionGain";
    })(PersistentConnectionEventType = exports.PersistentConnectionEventType || (exports.PersistentConnectionEventType = {}));
    class ConnectionLostEvent {
        constructor() {
            this.type = 0 /* ConnectionLost */;
        }
    }
    exports.ConnectionLostEvent = ConnectionLostEvent;
    class ReconnectionWaitEvent {
        constructor(durationSeconds) {
            this.durationSeconds = durationSeconds;
            this.type = 1 /* ReconnectionWait */;
        }
    }
    exports.ReconnectionWaitEvent = ReconnectionWaitEvent;
    class ReconnectionRunningEvent {
        constructor() {
            this.type = 2 /* ReconnectionRunning */;
        }
    }
    exports.ReconnectionRunningEvent = ReconnectionRunningEvent;
    class ConnectionGainEvent {
        constructor() {
            this.type = 4 /* ConnectionGain */;
        }
    }
    exports.ConnectionGainEvent = ConnectionGainEvent;
    class ReconnectionPermanentFailureEvent {
        constructor() {
            this.type = 3 /* ReconnectionPermanentFailure */;
        }
    }
    exports.ReconnectionPermanentFailureEvent = ReconnectionPermanentFailureEvent;
    class PersistentConnection extends lifecycle_1.Disposable {
        constructor(options, reconnectionToken, protocol) {
            super();
            this._onDidStateChange = this._register(new event_1.Emitter());
            this.onDidStateChange = this._onDidStateChange.event;
            this._options = options;
            this.reconnectionToken = reconnectionToken;
            this.protocol = protocol;
            this._isReconnecting = false;
            this._permanentFailure = false;
            this._onDidStateChange.fire(new ConnectionGainEvent());
            this._register(protocol.onSocketClose(() => this._beginReconnecting()));
            this._register(protocol.onSocketTimeout(() => this._beginReconnecting()));
        }
        _beginReconnecting() {
            return __awaiter(this, void 0, void 0, function* () {
                // Only have one reconnection loop active at a time.
                if (this._isReconnecting) {
                    return;
                }
                try {
                    this._isReconnecting = true;
                    yield this._runReconnectingLoop();
                }
                finally {
                    this._isReconnecting = false;
                }
            });
        }
        _runReconnectingLoop() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this._permanentFailure) {
                    // no more attempts!
                    return;
                }
                this._onDidStateChange.fire(new ConnectionLostEvent());
                const TIMES = [5, 5, 10, 10, 10, 10, 10, 30];
                const disconnectStartTime = Date.now();
                let attempt = -1;
                do {
                    attempt++;
                    const waitTime = (attempt < TIMES.length ? TIMES[attempt] : TIMES[TIMES.length - 1]);
                    try {
                        this._onDidStateChange.fire(new ReconnectionWaitEvent(waitTime));
                        yield sleep(waitTime);
                        // connection was lost, let's try to re-establish it
                        this._onDidStateChange.fire(new ReconnectionRunningEvent());
                        const simpleOptions = yield resolveConnectionOptions(this._options, this.reconnectionToken, this.protocol);
                        yield connectWithTimeLimit(this._reconnect(simpleOptions), 30 * 1000 /*30s*/);
                        this._onDidStateChange.fire(new ConnectionGainEvent());
                        break;
                    }
                    catch (err) {
                        if (err.code === 'VSCODE_CONNECTION_ERROR') {
                            console.error(`A permanent connection error occurred`);
                            console.error(err);
                            this._permanentFailure = true;
                            this._onDidStateChange.fire(new ReconnectionPermanentFailureEvent());
                            this.protocol.acceptDisconnect();
                            break;
                        }
                        if (Date.now() - disconnectStartTime > 10800000 /* ReconnectionGraceTime */) {
                            console.error(`Giving up after reconnection grace time has expired!`);
                            this._permanentFailure = true;
                            this._onDidStateChange.fire(new ReconnectionPermanentFailureEvent());
                            this.protocol.acceptDisconnect();
                            break;
                        }
                        if (remoteAuthorityResolver_1.RemoteAuthorityResolverError.isTemporarilyNotAvailable(err)) {
                            console.warn(`A temporarily not available error occured while trying to reconnect:`);
                            console.warn(err);
                            // try again!
                            continue;
                        }
                        if ((err.code === 'ETIMEDOUT' || err.code === 'ENETUNREACH' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') && err.syscall === 'connect') {
                            console.warn(`A connect error occured while trying to reconnect:`);
                            console.warn(err);
                            // try again!
                            continue;
                        }
                        if (errors_1.isPromiseCanceledError(err)) {
                            console.warn(`A cancel error occured while trying to reconnect:`);
                            console.warn(err);
                            // try again!
                            continue;
                        }
                        console.error(`An error occured while trying to reconnect:`);
                        console.error(err);
                        this._permanentFailure = true;
                        this._onDidStateChange.fire(new ReconnectionPermanentFailureEvent());
                        this.protocol.acceptDisconnect();
                        break;
                    }
                } while (!this._permanentFailure);
            });
        }
    }
    class ManagementPersistentConnection extends PersistentConnection {
        constructor(options, remoteAuthority, clientId, reconnectionToken, protocol) {
            super(options, reconnectionToken, protocol);
            this.client = this._register(new ipc_net_1.Client(protocol, {
                remoteAuthority: remoteAuthority,
                clientId: clientId
            }));
        }
        _reconnect(options) {
            return __awaiter(this, void 0, void 0, function* () {
                yield doConnectRemoteAgentManagement(options);
            });
        }
    }
    exports.ManagementPersistentConnection = ManagementPersistentConnection;
    class ExtensionHostPersistentConnection extends PersistentConnection {
        constructor(options, startArguments, reconnectionToken, protocol, debugPort) {
            super(options, reconnectionToken, protocol);
            this._startArguments = startArguments;
            this.debugPort = debugPort;
        }
        _reconnect(options) {
            return __awaiter(this, void 0, void 0, function* () {
                yield doConnectRemoteAgentExtensionHost(options, this._startArguments);
            });
        }
    }
    exports.ExtensionHostPersistentConnection = ExtensionHostPersistentConnection;
    function connectWithTimeLimit(p, timeLimit) {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                const err = new Error('Time limit reached');
                err.code = 'ETIMEDOUT';
                err.syscall = 'connect';
                reject(err);
            }, timeLimit);
            p.then(() => {
                clearTimeout(timeout);
                resolve();
            }, (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    function getErrorFromMessage(msg) {
        if (msg && msg.type === 'error') {
            const error = new Error(`Connection error: ${msg.reason}`);
            error.code = 'VSCODE_CONNECTION_ERROR';
            return error;
        }
        return null;
    }
});
//# sourceMappingURL=remoteAgentConnection.js.map