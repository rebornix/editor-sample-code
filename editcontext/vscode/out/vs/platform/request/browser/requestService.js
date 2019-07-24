/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
define(["require", "exports", "vs/base/common/errors", "vs/platform/configuration/common/configuration", "vs/platform/log/common/log", "vs/base/common/objects", "vs/base/common/buffer"], function (require, exports, errors_1, configuration_1, log_1, objects_1, buffer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * This service exposes the `request` API, while using the global
     * or configured proxy settings.
     */
    let RequestService = class RequestService {
        constructor(configurationService, logService) {
            this.configurationService = configurationService;
            this.logService = logService;
        }
        request(options, token) {
            this.logService.trace('RequestService#request', options.url);
            const authorization = this.configurationService.getValue('http.proxyAuthorization');
            if (authorization) {
                options.headers = objects_1.assign(options.headers || {}, { 'Proxy-Authorization': authorization });
            }
            const xhr = new XMLHttpRequest();
            return new Promise((resolve, reject) => {
                xhr.open(options.type || 'GET', options.url || '', true, options.user, options.password);
                this.setRequestHeaders(xhr, options);
                xhr.responseType = 'arraybuffer';
                xhr.onerror = e => reject(new Error(xhr.statusText && ('XHR failed: ' + xhr.statusText)));
                xhr.onload = (e) => {
                    resolve({
                        res: {
                            statusCode: xhr.status,
                            headers: this.getResponseHeaders(xhr)
                        },
                        stream: buffer_1.bufferToStream(buffer_1.VSBuffer.wrap(new Uint8Array(xhr.response)))
                    });
                };
                xhr.ontimeout = e => reject(new Error(`XHR timeout: ${options.timeout}ms`));
                if (options.timeout) {
                    xhr.timeout = options.timeout;
                }
                xhr.send(options.data);
                // cancel
                token.onCancellationRequested(() => {
                    xhr.abort();
                    reject(errors_1.canceled());
                });
            });
        }
        setRequestHeaders(xhr, options) {
            if (options.headers) {
                outer: for (let k in options.headers) {
                    switch (k) {
                        case 'User-Agent':
                        case 'Accept-Encoding':
                        case 'Content-Length':
                            // unsafe headers
                            continue outer;
                    }
                    xhr.setRequestHeader(k, options.headers[k]);
                }
            }
        }
        getResponseHeaders(xhr) {
            const headers = Object.create(null);
            for (const line of xhr.getAllResponseHeaders().split(/\r\n|\n|\r/g)) {
                if (line) {
                    const idx = line.indexOf(':');
                    headers[line.substr(0, idx).trim().toLowerCase()] = line.substr(idx + 1).trim();
                }
            }
            return headers;
        }
    };
    RequestService = __decorate([
        __param(0, configuration_1.IConfigurationService),
        __param(1, log_1.ILogService)
    ], RequestService);
    exports.RequestService = RequestService;
});
//# sourceMappingURL=requestService.js.map