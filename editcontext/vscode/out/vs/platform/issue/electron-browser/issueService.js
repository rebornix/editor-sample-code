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
define(["require", "exports", "vs/platform/ipc/electron-browser/mainProcessService"], function (require, exports, mainProcessService_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let IssueService = class IssueService {
        constructor(mainProcessService) {
            this.channel = mainProcessService.getChannel('issue');
        }
        openReporter(data) {
            return this.channel.call('openIssueReporter', data);
        }
        openProcessExplorer(data) {
            return this.channel.call('openProcessExplorer', data);
        }
        getSystemStatus() {
            return this.channel.call('getSystemStatus');
        }
    };
    IssueService = __decorate([
        __param(0, mainProcessService_1.IMainProcessService)
    ], IssueService);
    exports.IssueService = IssueService;
});
//# sourceMappingURL=issueService.js.map