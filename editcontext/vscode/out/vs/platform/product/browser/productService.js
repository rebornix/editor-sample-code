/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ProductService {
        constructor() {
            const element = document.getElementById('vscode-remote-product-configuration');
            this.productConfiguration = element ? JSON.parse(element.getAttribute('data-settings')) : null;
        }
        get version() { return '1.35.0'; }
        get commit() { return this.productConfiguration ? this.productConfiguration.commit : undefined; }
        get nameLong() { return ''; }
        get urlProtocol() { return ''; }
        get extensionAllowedProposedApi() { return this.productConfiguration ? this.productConfiguration.extensionAllowedProposedApi : []; }
        get uiExtensions() { return this.productConfiguration ? this.productConfiguration.uiExtensions : undefined; }
        get enableTelemetry() { return false; }
        get sendASmile() { return this.productConfiguration ? this.productConfiguration.sendASmile : undefined; }
        get extensionsGallery() { return this.productConfiguration ? this.productConfiguration.extensionsGallery : undefined; }
        get settingsSearchBuildId() { return this.productConfiguration ? this.productConfiguration.settingsSearchBuildId : undefined; }
        get settingsSearchUrl() { return this.productConfiguration ? this.productConfiguration.settingsSearchUrl : undefined; }
        get experimentsUrl() { return this.productConfiguration ? this.productConfiguration.experimentsUrl : undefined; }
        get extensionKeywords() { return this.productConfiguration ? this.productConfiguration.extensionKeywords : undefined; }
        get extensionAllowedBadgeProviders() { return this.productConfiguration ? this.productConfiguration.extensionAllowedBadgeProviders : undefined; }
        get aiConfig() { return this.productConfiguration ? this.productConfiguration.aiConfig : undefined; }
    }
    exports.ProductService = ProductService;
});
//# sourceMappingURL=productService.js.map