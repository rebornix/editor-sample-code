/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/platform/product/node/product", "vs/platform/product/node/package"], function (require, exports, product_1, package_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ProductService {
        get version() { return package_1.default.version; }
        get commit() { return product_1.default.commit; }
        get nameLong() { return product_1.default.nameLong; }
        get urlProtocol() { return product_1.default.urlProtocol; }
        get extensionAllowedProposedApi() { return product_1.default.extensionAllowedProposedApi; }
        get uiExtensions() { return product_1.default.uiExtensions; }
        get enableTelemetry() { return product_1.default.enableTelemetry; }
        get sendASmile() { return product_1.default.sendASmile; }
        get extensionsGallery() { return product_1.default.extensionsGallery; }
        get settingsSearchBuildId() { return product_1.default.settingsSearchBuildId; }
        get settingsSearchUrl() { return product_1.default.settingsSearchUrl; }
        get experimentsUrl() { return product_1.default.experimentsUrl; }
        get extensionKeywords() { return product_1.default.extensionKeywords; }
        get extensionAllowedBadgeProviders() { return product_1.default.extensionAllowedBadgeProviders; }
    }
    exports.ProductService = ProductService;
});
//# sourceMappingURL=productService.js.map