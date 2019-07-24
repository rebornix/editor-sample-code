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
define(["require", "exports", "vs/base/common/path", "vs/platform/log/common/log"], function (require, exports, path, log_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function createSpdLogLogger(processName, logsFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            // Do not crash if spdlog cannot be loaded
            try {
                const _spdlog = yield new Promise((resolve_1, reject_1) => { require(['spdlog'], resolve_1, reject_1); });
                _spdlog.setAsyncMode(8192, 500);
                const logfilePath = path.join(logsFolder, `${processName}.log`);
                return _spdlog.createRotatingLoggerAsync(processName, logfilePath, 1024 * 1024 * 5, 6);
            }
            catch (e) {
                console.error(e);
            }
            return null;
        });
    }
    function createRotatingLogger(name, filename, filesize, filecount) {
        const _spdlog = require.__$__nodeRequire('spdlog');
        return _spdlog.createRotatingLogger(name, filename, filesize, filecount);
    }
    exports.createRotatingLogger = createRotatingLogger;
    function log(logger, level, message) {
        switch (level) {
            case log_1.LogLevel.Trace: return logger.trace(message);
            case log_1.LogLevel.Debug: return logger.debug(message);
            case log_1.LogLevel.Info: return logger.info(message);
            case log_1.LogLevel.Warning: return logger.warn(message);
            case log_1.LogLevel.Error: return logger.error(message);
            case log_1.LogLevel.Critical: return logger.critical(message);
            default: throw new Error('Invalid log level');
        }
    }
    class SpdLogService extends log_1.AbstractLogService {
        constructor(name, logsFolder, level) {
            super();
            this.name = name;
            this.logsFolder = logsFolder;
            this.buffer = [];
            this._loggerCreationPromise = undefined;
            this.setLevel(level);
            this._createSpdLogLogger();
            this._register(this.onDidChangeLogLevel(level => {
                if (this._logger) {
                    this._logger.setLevel(level);
                }
            }));
        }
        _createSpdLogLogger() {
            if (!this._loggerCreationPromise) {
                this._loggerCreationPromise = createSpdLogLogger(this.name, this.logsFolder)
                    .then(logger => {
                    if (logger) {
                        this._logger = logger;
                        this._logger.setLevel(this.getLevel());
                        for (const { level, message } of this.buffer) {
                            log(this._logger, level, message);
                        }
                        this.buffer = [];
                    }
                });
            }
            return this._loggerCreationPromise;
        }
        _log(level, message) {
            if (this._logger) {
                log(this._logger, level, message);
            }
            else if (this.getLevel() <= level) {
                this.buffer.push({ level, message });
            }
        }
        trace() {
            if (this.getLevel() <= log_1.LogLevel.Trace) {
                this._log(log_1.LogLevel.Trace, this.format(arguments));
            }
        }
        debug() {
            if (this.getLevel() <= log_1.LogLevel.Debug) {
                this._log(log_1.LogLevel.Debug, this.format(arguments));
            }
        }
        info() {
            if (this.getLevel() <= log_1.LogLevel.Info) {
                this._log(log_1.LogLevel.Info, this.format(arguments));
            }
        }
        warn() {
            if (this.getLevel() <= log_1.LogLevel.Warning) {
                this._log(log_1.LogLevel.Warning, this.format(arguments));
            }
        }
        error() {
            if (this.getLevel() <= log_1.LogLevel.Error) {
                const arg = arguments[0];
                if (arg instanceof Error) {
                    const array = Array.prototype.slice.call(arguments);
                    array[0] = arg.stack;
                    this._log(log_1.LogLevel.Error, this.format(array));
                }
                else {
                    this._log(log_1.LogLevel.Error, this.format(arguments));
                }
            }
        }
        critical() {
            if (this.getLevel() <= log_1.LogLevel.Critical) {
                this._log(log_1.LogLevel.Critical, this.format(arguments));
            }
        }
        dispose() {
            if (this._logger) {
                this.disposeLogger();
            }
            else if (this._loggerCreationPromise) {
                this._loggerCreationPromise.then(() => this.disposeLogger());
            }
            this._loggerCreationPromise = undefined;
        }
        disposeLogger() {
            if (this._logger) {
                this._logger.drop();
                this._logger = undefined;
            }
        }
        format(args) {
            let result = '';
            for (let i = 0; i < args.length; i++) {
                let a = args[i];
                if (typeof a === 'object') {
                    try {
                        a = JSON.stringify(a);
                    }
                    catch (e) { }
                }
                result += (i > 0 ? ' ' : '') + a;
            }
            return result;
        }
    }
    exports.SpdLogService = SpdLogService;
});
//# sourceMappingURL=spdlogService.js.map