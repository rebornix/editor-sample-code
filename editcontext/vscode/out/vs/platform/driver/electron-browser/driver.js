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
define(["require", "exports", "vs/base/common/lifecycle", "vs/platform/driver/node/driver", "vs/platform/instantiation/common/instantiation", "vs/platform/ipc/electron-browser/mainProcessService", "vs/base/browser/dom", "electron", "vs/platform/windows/common/windows", "vs/base/common/async", "vs/base/common/arrays"], function (require, exports, lifecycle_1, driver_1, instantiation_1, mainProcessService_1, dom_1, electron, windows_1, async_1, arrays_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function serializeElement(element, recursive) {
        const attributes = Object.create(null);
        for (let j = 0; j < element.attributes.length; j++) {
            const attr = element.attributes.item(j);
            if (attr) {
                attributes[attr.name] = attr.value;
            }
        }
        const children = [];
        if (recursive) {
            for (let i = 0; i < element.children.length; i++) {
                const child = element.children.item(i);
                if (child) {
                    children.push(serializeElement(child, true));
                }
            }
        }
        const { left, top } = dom_1.getTopLeftOffset(element);
        return {
            tagName: element.tagName,
            className: element.className,
            textContent: element.textContent || '',
            attributes,
            children,
            left,
            top
        };
    }
    let WindowDriver = class WindowDriver {
        constructor(windowService) {
            this.windowService = windowService;
        }
        click(selector, xoffset, yoffset) {
            const offset = typeof xoffset === 'number' && typeof yoffset === 'number' ? { x: xoffset, y: yoffset } : undefined;
            return this._click(selector, 1, offset);
        }
        doubleClick(selector) {
            return this._click(selector, 2);
        }
        _getElementXY(selector, offset) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (!element) {
                    return Promise.reject(new Error(`Element not found: ${selector}`));
                }
                const { left, top } = dom_1.getTopLeftOffset(element);
                const { width, height } = dom_1.getClientArea(element);
                let x, y;
                if (offset) {
                    x = left + offset.x;
                    y = top + offset.y;
                }
                else {
                    x = left + (width / 2);
                    y = top + (height / 2);
                }
                x = Math.round(x);
                y = Math.round(y);
                return { x, y };
            });
        }
        _click(selector, clickCount, offset) {
            return __awaiter(this, void 0, void 0, function* () {
                const { x, y } = yield this._getElementXY(selector, offset);
                const webContents = electron.remote.getCurrentWebContents();
                webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount });
                yield async_1.timeout(10);
                webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount });
                yield async_1.timeout(100);
            });
        }
        setValue(selector, text) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (!element) {
                    return Promise.reject(new Error(`Element not found: ${selector}`));
                }
                const inputElement = element;
                inputElement.value = text;
                const event = new Event('input', { bubbles: true, cancelable: true });
                inputElement.dispatchEvent(event);
            });
        }
        getTitle() {
            return __awaiter(this, void 0, void 0, function* () {
                return document.title;
            });
        }
        isActiveElement(selector) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (element !== document.activeElement) {
                    const chain = [];
                    let el = document.activeElement;
                    while (el) {
                        const tagName = el.tagName;
                        const id = el.id ? `#${el.id}` : '';
                        const classes = arrays_1.coalesce(el.className.split(/\s+/g).map(c => c.trim())).map(c => `.${c}`).join('');
                        chain.unshift(`${tagName}${id}${classes}`);
                        el = el.parentElement;
                    }
                    throw new Error(`Active element not found. Current active element is '${chain.join(' > ')}'. Looking for ${selector}`);
                }
                return true;
            });
        }
        getElements(selector, recursive) {
            return __awaiter(this, void 0, void 0, function* () {
                const query = document.querySelectorAll(selector);
                const result = [];
                for (let i = 0; i < query.length; i++) {
                    const element = query.item(i);
                    result.push(serializeElement(element, recursive));
                }
                return result;
            });
        }
        typeInEditor(selector, text) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (!element) {
                    throw new Error(`Editor not found: ${selector}`);
                }
                const textarea = element;
                const start = textarea.selectionStart;
                const newStart = start + text.length;
                const value = textarea.value;
                const newValue = value.substr(0, start) + text + value.substr(start);
                textarea.value = newValue;
                textarea.setSelectionRange(newStart, newStart);
                const event = new Event('input', { 'bubbles': true, 'cancelable': true });
                textarea.dispatchEvent(event);
            });
        }
        getTerminalBuffer(selector) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (!element) {
                    throw new Error(`Terminal not found: ${selector}`);
                }
                const xterm = element.xterm;
                if (!xterm) {
                    throw new Error(`Xterm not found: ${selector}`);
                }
                const lines = [];
                for (let i = 0; i < xterm.buffer.length; i++) {
                    lines.push(xterm.buffer.getLine(i).translateToString(true));
                }
                return lines;
            });
        }
        writeInTerminal(selector, text) {
            return __awaiter(this, void 0, void 0, function* () {
                const element = document.querySelector(selector);
                if (!element) {
                    throw new Error(`Element not found: ${selector}`);
                }
                const xterm = element.xterm;
                if (!xterm) {
                    throw new Error(`Xterm not found: ${selector}`);
                }
                xterm._core.handler(text);
            });
        }
        openDevTools() {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.windowService.openDevTools({ mode: 'detach' });
            });
        }
    };
    WindowDriver = __decorate([
        __param(0, windows_1.IWindowService)
    ], WindowDriver);
    function registerWindowDriver(accessor) {
        return __awaiter(this, void 0, void 0, function* () {
            const instantiationService = accessor.get(instantiation_1.IInstantiationService);
            const mainProcessService = accessor.get(mainProcessService_1.IMainProcessService);
            const windowService = accessor.get(windows_1.IWindowService);
            const windowDriver = instantiationService.createInstance(WindowDriver);
            const windowDriverChannel = new driver_1.WindowDriverChannel(windowDriver);
            mainProcessService.registerChannel('windowDriver', windowDriverChannel);
            const windowDriverRegistryChannel = mainProcessService.getChannel('windowDriverRegistry');
            const windowDriverRegistry = new driver_1.WindowDriverRegistryChannelClient(windowDriverRegistryChannel);
            yield windowDriverRegistry.registerWindowDriver(windowService.windowId);
            // const options = await windowDriverRegistry.registerWindowDriver(windowId);
            // if (options.verbose) {
            // 	windowDriver.openDevTools();
            // }
            return lifecycle_1.toDisposable(() => windowDriverRegistry.reloadWindowDriver(windowService.windowId));
        });
    }
    exports.registerWindowDriver = registerWindowDriver;
});
//# sourceMappingURL=driver.js.map