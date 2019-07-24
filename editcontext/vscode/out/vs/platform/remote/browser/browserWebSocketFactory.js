/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/buffer", "vs/base/common/lifecycle", "vs/base/common/errors"], function (require, exports, buffer_1, lifecycle_1, errors_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BrowserSocket {
        constructor(socket) {
            this.socket = socket;
        }
        dispose() {
            this.socket.close();
        }
        onData(_listener) {
            const fileReader = new FileReader();
            const queue = [];
            let isReading = false;
            fileReader.onload = function (event) {
                isReading = false;
                const buff = event.target.result;
                try {
                    _listener(buffer_1.VSBuffer.wrap(new Uint8Array(buff)));
                }
                catch (err) {
                    errors_1.onUnexpectedError(err);
                }
                if (queue.length > 0) {
                    enqueue(queue.shift());
                }
            };
            const enqueue = (blob) => {
                if (isReading) {
                    queue.push(blob);
                    return;
                }
                isReading = true;
                fileReader.readAsArrayBuffer(blob);
            };
            const listener = (e) => {
                enqueue(e.data);
            };
            this.socket.addEventListener('message', listener);
            return {
                dispose: () => this.socket.removeEventListener('message', listener)
            };
        }
        onClose(listener) {
            this.socket.addEventListener('close', listener);
            return {
                dispose: () => this.socket.removeEventListener('close', listener)
            };
        }
        onEnd(listener) {
            return lifecycle_1.Disposable.None;
        }
        write(buffer) {
            this.socket.send(buffer.buffer);
        }
        end() {
            this.socket.close();
        }
    }
    exports.browserWebSocketFactory = new class {
        connect(host, port, query, callback) {
            const errorListener = (err) => callback(err, undefined);
            const socket = new WebSocket(`ws://${host}:${port}/?${query}&skipWebSocketFrames=false`);
            socket.onopen = function (event) {
                socket.removeEventListener('error', errorListener);
                callback(undefined, new BrowserSocket(socket));
            };
            socket.addEventListener('error', errorListener);
        }
    };
});
//# sourceMappingURL=browserWebSocketFactory.js.map