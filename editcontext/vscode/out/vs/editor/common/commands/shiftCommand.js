/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/strings", "vs/editor/common/controller/cursorCommon", "vs/editor/common/core/range", "vs/editor/common/core/selection", "vs/editor/common/modes/languageConfigurationRegistry"], function (require, exports, strings, cursorCommon_1, range_1, selection_1, languageConfigurationRegistry_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const repeatCache = Object.create(null);
    function cachedStringRepeat(str, count) {
        if (!repeatCache[str]) {
            repeatCache[str] = ['', str];
        }
        const cache = repeatCache[str];
        for (let i = cache.length; i <= count; i++) {
            cache[i] = cache[i - 1] + str;
        }
        return cache[count];
    }
    exports.cachedStringRepeat = cachedStringRepeat;
    class ShiftCommand {
        static unshiftIndent(line, column, tabSize, indentSize, insertSpaces) {
            // Determine the visible column where the content starts
            const contentStartVisibleColumn = cursorCommon_1.CursorColumns.visibleColumnFromColumn(line, column, tabSize);
            if (insertSpaces) {
                const indent = cachedStringRepeat(' ', indentSize);
                const desiredTabStop = cursorCommon_1.CursorColumns.prevIndentTabStop(contentStartVisibleColumn, indentSize);
                const indentCount = desiredTabStop / indentSize; // will be an integer
                return cachedStringRepeat(indent, indentCount);
            }
            else {
                const indent = '\t';
                const desiredTabStop = cursorCommon_1.CursorColumns.prevRenderTabStop(contentStartVisibleColumn, tabSize);
                const indentCount = desiredTabStop / tabSize; // will be an integer
                return cachedStringRepeat(indent, indentCount);
            }
        }
        static shiftIndent(line, column, tabSize, indentSize, insertSpaces) {
            // Determine the visible column where the content starts
            const contentStartVisibleColumn = cursorCommon_1.CursorColumns.visibleColumnFromColumn(line, column, tabSize);
            if (insertSpaces) {
                const indent = cachedStringRepeat(' ', indentSize);
                const desiredTabStop = cursorCommon_1.CursorColumns.nextIndentTabStop(contentStartVisibleColumn, indentSize);
                const indentCount = desiredTabStop / indentSize; // will be an integer
                return cachedStringRepeat(indent, indentCount);
            }
            else {
                const indent = '\t';
                const desiredTabStop = cursorCommon_1.CursorColumns.nextRenderTabStop(contentStartVisibleColumn, tabSize);
                const indentCount = desiredTabStop / tabSize; // will be an integer
                return cachedStringRepeat(indent, indentCount);
            }
        }
        constructor(range, opts) {
            this._opts = opts;
            this._selection = range;
            this._useLastEditRangeForCursorEndPosition = false;
            this._selectionStartColumnStaysPut = false;
        }
        _addEditOperation(builder, range, text) {
            if (this._useLastEditRangeForCursorEndPosition) {
                builder.addTrackedEditOperation(range, text);
            }
            else {
                builder.addEditOperation(range, text);
            }
        }
        getEditOperations(model, builder) {
            const startLine = this._selection.startLineNumber;
            let endLine = this._selection.endLineNumber;
            if (this._selection.endColumn === 1 && startLine !== endLine) {
                endLine = endLine - 1;
            }
            const { tabSize, indentSize, insertSpaces } = this._opts;
            const shouldIndentEmptyLines = (startLine === endLine);
            // if indenting or outdenting on a whitespace only line
            if (this._selection.isEmpty()) {
                if (/^\s*$/.test(model.getLineContent(startLine))) {
                    this._useLastEditRangeForCursorEndPosition = true;
                }
            }
            if (this._opts.useTabStops) {
                // keep track of previous line's "miss-alignment"
                let previousLineExtraSpaces = 0, extraSpaces = 0;
                for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++, previousLineExtraSpaces = extraSpaces) {
                    extraSpaces = 0;
                    let lineText = model.getLineContent(lineNumber);
                    let indentationEndIndex = strings.firstNonWhitespaceIndex(lineText);
                    if (this._opts.isUnshift && (lineText.length === 0 || indentationEndIndex === 0)) {
                        // empty line or line with no leading whitespace => nothing to do
                        continue;
                    }
                    if (!shouldIndentEmptyLines && !this._opts.isUnshift && lineText.length === 0) {
                        // do not indent empty lines => nothing to do
                        continue;
                    }
                    if (indentationEndIndex === -1) {
                        // the entire line is whitespace
                        indentationEndIndex = lineText.length;
                    }
                    if (lineNumber > 1) {
                        let contentStartVisibleColumn = cursorCommon_1.CursorColumns.visibleColumnFromColumn(lineText, indentationEndIndex + 1, tabSize);
                        if (contentStartVisibleColumn % indentSize !== 0) {
                            // The current line is "miss-aligned", so let's see if this is expected...
                            // This can only happen when it has trailing commas in the indent
                            if (model.isCheapToTokenize(lineNumber - 1)) {
                                let enterAction = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getRawEnterActionAtPosition(model, lineNumber - 1, model.getLineMaxColumn(lineNumber - 1));
                                if (enterAction) {
                                    extraSpaces = previousLineExtraSpaces;
                                    if (enterAction.appendText) {
                                        for (let j = 0, lenJ = enterAction.appendText.length; j < lenJ && extraSpaces < indentSize; j++) {
                                            if (enterAction.appendText.charCodeAt(j) === 32 /* Space */) {
                                                extraSpaces++;
                                            }
                                            else {
                                                break;
                                            }
                                        }
                                    }
                                    if (enterAction.removeText) {
                                        extraSpaces = Math.max(0, extraSpaces - enterAction.removeText);
                                    }
                                    // Act as if `prefixSpaces` is not part of the indentation
                                    for (let j = 0; j < extraSpaces; j++) {
                                        if (indentationEndIndex === 0 || lineText.charCodeAt(indentationEndIndex - 1) !== 32 /* Space */) {
                                            break;
                                        }
                                        indentationEndIndex--;
                                    }
                                }
                            }
                        }
                    }
                    if (this._opts.isUnshift && indentationEndIndex === 0) {
                        // line with no leading whitespace => nothing to do
                        continue;
                    }
                    let desiredIndent;
                    if (this._opts.isUnshift) {
                        desiredIndent = ShiftCommand.unshiftIndent(lineText, indentationEndIndex + 1, tabSize, indentSize, insertSpaces);
                    }
                    else {
                        desiredIndent = ShiftCommand.shiftIndent(lineText, indentationEndIndex + 1, tabSize, indentSize, insertSpaces);
                    }
                    this._addEditOperation(builder, new range_1.Range(lineNumber, 1, lineNumber, indentationEndIndex + 1), desiredIndent);
                    if (lineNumber === startLine) {
                        // Force the startColumn to stay put because we're inserting after it
                        this._selectionStartColumnStaysPut = (this._selection.startColumn <= indentationEndIndex + 1);
                    }
                }
            }
            else {
                const oneIndent = (insertSpaces ? cachedStringRepeat(' ', indentSize) : '\t');
                for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
                    const lineText = model.getLineContent(lineNumber);
                    let indentationEndIndex = strings.firstNonWhitespaceIndex(lineText);
                    if (this._opts.isUnshift && (lineText.length === 0 || indentationEndIndex === 0)) {
                        // empty line or line with no leading whitespace => nothing to do
                        continue;
                    }
                    if (!shouldIndentEmptyLines && !this._opts.isUnshift && lineText.length === 0) {
                        // do not indent empty lines => nothing to do
                        continue;
                    }
                    if (indentationEndIndex === -1) {
                        // the entire line is whitespace
                        indentationEndIndex = lineText.length;
                    }
                    if (this._opts.isUnshift && indentationEndIndex === 0) {
                        // line with no leading whitespace => nothing to do
                        continue;
                    }
                    if (this._opts.isUnshift) {
                        indentationEndIndex = Math.min(indentationEndIndex, indentSize);
                        for (let i = 0; i < indentationEndIndex; i++) {
                            const chr = lineText.charCodeAt(i);
                            if (chr === 9 /* Tab */) {
                                indentationEndIndex = i + 1;
                                break;
                            }
                        }
                        this._addEditOperation(builder, new range_1.Range(lineNumber, 1, lineNumber, indentationEndIndex + 1), '');
                    }
                    else {
                        this._addEditOperation(builder, new range_1.Range(lineNumber, 1, lineNumber, 1), oneIndent);
                        if (lineNumber === startLine) {
                            // Force the startColumn to stay put because we're inserting after it
                            this._selectionStartColumnStaysPut = (this._selection.startColumn === 1);
                        }
                    }
                }
            }
            this._selectionId = builder.trackSelection(this._selection);
        }
        computeCursorState(model, helper) {
            if (this._useLastEditRangeForCursorEndPosition) {
                let lastOp = helper.getInverseEditOperations()[0];
                return new selection_1.Selection(lastOp.range.endLineNumber, lastOp.range.endColumn, lastOp.range.endLineNumber, lastOp.range.endColumn);
            }
            const result = helper.getTrackedSelection(this._selectionId);
            if (this._selectionStartColumnStaysPut) {
                // The selection start should not move
                let initialStartColumn = this._selection.startColumn;
                let resultStartColumn = result.startColumn;
                if (resultStartColumn <= initialStartColumn) {
                    return result;
                }
                if (result.getDirection() === 0 /* LTR */) {
                    return new selection_1.Selection(result.startLineNumber, initialStartColumn, result.endLineNumber, result.endColumn);
                }
                return new selection_1.Selection(result.endLineNumber, result.endColumn, result.startLineNumber, initialStartColumn);
            }
            return result;
        }
    }
    exports.ShiftCommand = ShiftCommand;
});
//# sourceMappingURL=shiftCommand.js.map