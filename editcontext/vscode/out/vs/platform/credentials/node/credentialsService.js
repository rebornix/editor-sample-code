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
define(["require", "exports", "vs/base/common/async"], function (require, exports, async_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class KeytarCredentialsService {
        constructor() {
            this._keytar = new async_1.IdleValue(() => new Promise((resolve_1, reject_1) => { require(['keytar'], resolve_1, reject_1); }));
        }
        getPassword(service, account) {
            return __awaiter(this, void 0, void 0, function* () {
                const keytar = yield this._keytar.getValue();
                return keytar.getPassword(service, account);
            });
        }
        setPassword(service, account, password) {
            return __awaiter(this, void 0, void 0, function* () {
                const keytar = yield this._keytar.getValue();
                return keytar.setPassword(service, account, password);
            });
        }
        deletePassword(service, account) {
            return __awaiter(this, void 0, void 0, function* () {
                const keytar = yield this._keytar.getValue();
                return keytar.deletePassword(service, account);
            });
        }
        findPassword(service) {
            return __awaiter(this, void 0, void 0, function* () {
                const keytar = yield this._keytar.getValue();
                return keytar.findPassword(service);
            });
        }
    }
    exports.KeytarCredentialsService = KeytarCredentialsService;
});
//# sourceMappingURL=credentialsService.js.map