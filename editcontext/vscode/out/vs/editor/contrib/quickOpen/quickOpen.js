/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/errors", "vs/base/common/uri", "vs/editor/common/core/range", "vs/editor/browser/editorExtensions", "vs/editor/common/modes", "vs/editor/common/services/modelService", "vs/base/common/cancellation", "vs/editor/common/services/resolverService"], function (require, exports, errors_1, uri_1, range_1, editorExtensions_1, modes_1, modelService_1, cancellation_1, resolverService_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function getDocumentSymbols(model, flat, token) {
        let roots = [];
        let promises = modes_1.DocumentSymbolProviderRegistry.all(model).map(support => {
            return Promise.resolve(support.provideDocumentSymbols(model, token)).then(result => {
                if (Array.isArray(result)) {
                    roots.push(...result);
                }
            }, err => {
                errors_1.onUnexpectedExternalError(err);
            });
        });
        return Promise.all(promises).then(() => {
            let flatEntries = [];
            if (token.isCancellationRequested) {
                return flatEntries;
            }
            if (flat) {
                flatten(flatEntries, roots, '');
            }
            else {
                flatEntries = roots;
            }
            flatEntries.sort(compareEntriesUsingStart);
            return flatEntries;
        });
    }
    exports.getDocumentSymbols = getDocumentSymbols;
    function compareEntriesUsingStart(a, b) {
        return range_1.Range.compareRangesUsingStarts(a.range, b.range);
    }
    function flatten(bucket, entries, overrideContainerLabel) {
        for (let entry of entries) {
            bucket.push({
                kind: entry.kind,
                name: entry.name,
                detail: entry.detail,
                containerName: entry.containerName || overrideContainerLabel,
                range: entry.range,
                selectionRange: entry.selectionRange,
                children: undefined,
            });
            if (entry.children) {
                flatten(bucket, entry.children, entry.name);
            }
        }
    }
    editorExtensions_1.registerLanguageCommand('_executeDocumentSymbolProvider', function (accessor, args) {
        const { resource } = args;
        if (!(resource instanceof uri_1.URI)) {
            throw errors_1.illegalArgument('resource');
        }
        const model = accessor.get(modelService_1.IModelService).getModel(resource);
        if (model) {
            return getDocumentSymbols(model, false, cancellation_1.CancellationToken.None);
        }
        return accessor.get(resolverService_1.ITextModelService).createModelReference(resource).then(reference => {
            return new Promise((resolve, reject) => {
                try {
                    const result = getDocumentSymbols(reference.object.textEditorModel, false, cancellation_1.CancellationToken.None);
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
            }).finally(() => {
                reference.dispose();
            });
        });
    });
});
//# sourceMappingURL=quickOpen.js.map