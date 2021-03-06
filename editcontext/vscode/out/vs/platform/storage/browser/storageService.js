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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define(["require", "exports", "vs/base/common/lifecycle", "vs/base/common/event", "vs/platform/storage/common/storage", "vs/platform/environment/common/environment", "vs/platform/files/common/files", "vs/base/parts/storage/common/storage", "vs/base/common/resources", "vs/base/common/async"], function (require, exports, lifecycle_1, event_1, storage_1, environment_1, files_1, storage_2, resources_1, async_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let BrowserStorageService = class BrowserStorageService extends lifecycle_1.Disposable {
        constructor(environmentService, fileService) {
            super();
            this.environmentService = environmentService;
            this.fileService = fileService;
            this._onDidChangeStorage = this._register(new event_1.Emitter());
            this.onDidChangeStorage = this._onDidChangeStorage.event;
            this._onWillSaveState = this._register(new event_1.Emitter());
            this.onWillSaveState = this._onWillSaveState.event;
            // In the browser we do not have support for long running unload sequences. As such,
            // we cannot ask for saving state in that moment, because that would result in a
            // long running operation.
            // Instead, periodically ask customers to save save. The library will be clever enough
            // to only save state that has actually changed.
            this.saveStatePeriodically();
        }
        saveStatePeriodically() {
            setTimeout(() => {
                async_1.runWhenIdle(() => {
                    // this event will potentially cause new state to be stored
                    this._onWillSaveState.fire({ reason: storage_1.WillSaveStateReason.NONE });
                    // repeat
                    this.saveStatePeriodically();
                });
            }, 5000);
        }
        initialize(payload) {
            if (!this.initializePromise) {
                this.initializePromise = this.doInitialize(payload);
            }
            return this.initializePromise;
        }
        doInitialize(payload) {
            return __awaiter(this, void 0, void 0, function* () {
                // Ensure state folder exists
                const stateRoot = resources_1.joinPath(this.environmentService.userRoamingDataHome, 'state');
                yield this.fileService.createFolder(stateRoot);
                // Workspace Storage
                this.workspaceStorageFile = resources_1.joinPath(stateRoot, `${payload.id}.json`);
                this.workspaceStorage = new storage_2.Storage(this._register(new storage_1.FileStorageDatabase(this.workspaceStorageFile, this.fileService)));
                this._register(this.workspaceStorage.onDidChangeStorage(key => this._onDidChangeStorage.fire({ key, scope: 1 /* WORKSPACE */ })));
                // Global Storage
                this.globalStorageFile = resources_1.joinPath(stateRoot, 'global.json');
                this.globalStorage = new storage_2.Storage(this._register(new storage_1.FileStorageDatabase(this.globalStorageFile, this.fileService)));
                this._register(this.globalStorage.onDidChangeStorage(key => this._onDidChangeStorage.fire({ key, scope: 0 /* GLOBAL */ })));
                // Init both
                yield Promise.all([
                    this.workspaceStorage.init(),
                    this.globalStorage.init()
                ]);
            });
        }
        get(key, scope, fallbackValue) {
            return this.getStorage(scope).get(key, fallbackValue);
        }
        getBoolean(key, scope, fallbackValue) {
            return this.getStorage(scope).getBoolean(key, fallbackValue);
        }
        getNumber(key, scope, fallbackValue) {
            return this.getStorage(scope).getNumber(key, fallbackValue);
        }
        store(key, value, scope) {
            this.getStorage(scope).set(key, value);
        }
        remove(key, scope) {
            this.getStorage(scope).delete(key);
        }
        getStorage(scope) {
            return scope === 0 /* GLOBAL */ ? this.globalStorage : this.workspaceStorage;
        }
        logStorage() {
            return __awaiter(this, void 0, void 0, function* () {
                const result = yield Promise.all([
                    this.globalStorage.items,
                    this.workspaceStorage.items
                ]);
                return storage_1.logStorage(result[0], result[1], this.globalStorageFile.toString(), this.workspaceStorageFile.toString());
            });
        }
        close() {
            // Signal as event so that clients can still store data
            this._onWillSaveState.fire({ reason: storage_1.WillSaveStateReason.SHUTDOWN });
        }
    };
    BrowserStorageService = __decorate([
        __param(0, environment_1.IEnvironmentService),
        __param(1, files_1.IFileService)
    ], BrowserStorageService);
    exports.BrowserStorageService = BrowserStorageService;
});
//# sourceMappingURL=storageService.js.map