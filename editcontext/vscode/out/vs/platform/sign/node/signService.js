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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define(["require", "exports", "vs/base/common/decorators"], function (require, exports, decorators_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SignService {
        // Cache the 'vsda' import, because when the same missing module is imported multiple times,
        // the ones after the first will not throw an error. And this will break the contract of the sign method.
        vsda() {
            return new Promise((resolve_1, reject_1) => { require(['vsda'], resolve_1, reject_1); });
        }
        sign(value) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const vsda = yield this.vsda();
                    const signer = new vsda.signer();
                    if (signer) {
                        return signer.sign(value);
                    }
                }
                catch (e) {
                    console.error('signer.sign: ' + e);
                }
                return value;
            });
        }
    }
    __decorate([
        decorators_1.memoize
    ], SignService.prototype, "vsda", null);
    exports.SignService = SignService;
});
//# sourceMappingURL=signService.js.map