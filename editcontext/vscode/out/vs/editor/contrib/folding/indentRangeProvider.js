/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/editor/contrib/folding/foldingRanges", "vs/editor/common/model/textModel", "vs/editor/common/modes/languageConfigurationRegistry"], function (require, exports, foldingRanges_1, textModel_1, languageConfigurationRegistry_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const MAX_FOLDING_REGIONS_FOR_INDENT_LIMIT = 5000;
    exports.ID_INDENT_PROVIDER = 'indent';
    class IndentRangeProvider {
        constructor(editorModel) {
            this.editorModel = editorModel;
            this.id = exports.ID_INDENT_PROVIDER;
        }
        dispose() {
        }
        compute(cancelationToken) {
            let foldingRules = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getFoldingRules(this.editorModel.getLanguageIdentifier().id);
            let offSide = foldingRules && !!foldingRules.offSide;
            let markers = foldingRules && foldingRules.markers;
            return Promise.resolve(computeRanges(this.editorModel, offSide, markers));
        }
    }
    exports.IndentRangeProvider = IndentRangeProvider;
    // public only for testing
    class RangesCollector {
        constructor(foldingRangesLimit) {
            this._startIndexes = [];
            this._endIndexes = [];
            this._indentOccurrences = [];
            this._length = 0;
            this._foldingRangesLimit = foldingRangesLimit;
        }
        insertFirst(startLineNumber, endLineNumber, indent) {
            if (startLineNumber > foldingRanges_1.MAX_LINE_NUMBER || endLineNumber > foldingRanges_1.MAX_LINE_NUMBER) {
                return;
            }
            let index = this._length;
            this._startIndexes[index] = startLineNumber;
            this._endIndexes[index] = endLineNumber;
            this._length++;
            if (indent < 1000) {
                this._indentOccurrences[indent] = (this._indentOccurrences[indent] || 0) + 1;
            }
        }
        toIndentRanges(model) {
            if (this._length <= this._foldingRangesLimit) {
                // reverse and create arrays of the exact length
                let startIndexes = new Uint32Array(this._length);
                let endIndexes = new Uint32Array(this._length);
                for (let i = this._length - 1, k = 0; i >= 0; i--, k++) {
                    startIndexes[k] = this._startIndexes[i];
                    endIndexes[k] = this._endIndexes[i];
                }
                return new foldingRanges_1.FoldingRegions(startIndexes, endIndexes);
            }
            else {
                let entries = 0;
                let maxIndent = this._indentOccurrences.length;
                for (let i = 0; i < this._indentOccurrences.length; i++) {
                    let n = this._indentOccurrences[i];
                    if (n) {
                        if (n + entries > this._foldingRangesLimit) {
                            maxIndent = i;
                            break;
                        }
                        entries += n;
                    }
                }
                const tabSize = model.getOptions().tabSize;
                // reverse and create arrays of the exact length
                let startIndexes = new Uint32Array(this._foldingRangesLimit);
                let endIndexes = new Uint32Array(this._foldingRangesLimit);
                for (let i = this._length - 1, k = 0; i >= 0; i--) {
                    let startIndex = this._startIndexes[i];
                    let lineContent = model.getLineContent(startIndex);
                    let indent = textModel_1.TextModel.computeIndentLevel(lineContent, tabSize);
                    if (indent < maxIndent || (indent === maxIndent && entries++ < this._foldingRangesLimit)) {
                        startIndexes[k] = startIndex;
                        endIndexes[k] = this._endIndexes[i];
                        k++;
                    }
                }
                return new foldingRanges_1.FoldingRegions(startIndexes, endIndexes);
            }
        }
    }
    exports.RangesCollector = RangesCollector;
    function computeRanges(model, offSide, markers, foldingRangesLimit = MAX_FOLDING_REGIONS_FOR_INDENT_LIMIT) {
        const tabSize = model.getOptions().tabSize;
        let result = new RangesCollector(foldingRangesLimit);
        let pattern = undefined;
        if (markers) {
            pattern = new RegExp(`(${markers.start.source})|(?:${markers.end.source})`);
        }
        let previousRegions = [];
        previousRegions.push({ indent: -1, line: model.getLineCount() + 1, marker: false }); // sentinel, to make sure there's at least one entry
        for (let line = model.getLineCount(); line > 0; line--) {
            let lineContent = model.getLineContent(line);
            let indent = textModel_1.TextModel.computeIndentLevel(lineContent, tabSize);
            let previous = previousRegions[previousRegions.length - 1];
            if (indent === -1) {
                if (offSide && !previous.marker) {
                    // for offSide languages, empty lines are associated to the next block
                    previous.line = line;
                }
                continue; // only whitespace
            }
            let m;
            if (pattern && (m = lineContent.match(pattern))) {
                // folding pattern match
                if (m[1]) { // start pattern match
                    // discard all regions until the folding pattern
                    let i = previousRegions.length - 1;
                    while (i > 0 && !previousRegions[i].marker) {
                        i--;
                    }
                    if (i > 0) {
                        previousRegions.length = i + 1;
                        previous = previousRegions[i];
                        // new folding range from pattern, includes the end line
                        result.insertFirst(line, previous.line, indent);
                        previous.marker = false;
                        previous.indent = indent;
                        previous.line = line;
                        continue;
                    }
                    else {
                        // no end marker found, treat line as a regular line
                    }
                }
                else { // end pattern match
                    previousRegions.push({ indent: -2, line, marker: true });
                    continue;
                }
            }
            if (previous.indent > indent) {
                // discard all regions with larger indent
                do {
                    previousRegions.pop();
                    previous = previousRegions[previousRegions.length - 1];
                } while (previous.indent > indent);
                // new folding range
                let endLineNumber = previous.line - 1;
                if (endLineNumber - line >= 1) { // needs at east size 1
                    result.insertFirst(line, endLineNumber, indent);
                }
            }
            if (previous.indent === indent) {
                previous.line = line;
            }
            else { // previous.indent < indent
                // new region with a bigger indent
                previousRegions.push({ indent, line, marker: false });
            }
        }
        return result.toIndentRanges(model);
    }
    exports.computeRanges = computeRanges;
});
//# sourceMappingURL=indentRangeProvider.js.map