/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/errors", "vs/base/common/strings", "vs/editor/common/core/position", "vs/editor/common/core/range", "vs/editor/common/core/selection", "vs/editor/common/model/textModel", "vs/editor/common/modes/languageConfigurationRegistry"], function (require, exports, errors_1, strings, position_1, range_1, selection_1, textModel_1, languageConfigurationRegistry_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var RevealTarget;
    (function (RevealTarget) {
        RevealTarget[RevealTarget["Primary"] = 0] = "Primary";
        RevealTarget[RevealTarget["TopMost"] = 1] = "TopMost";
        RevealTarget[RevealTarget["BottomMost"] = 2] = "BottomMost";
    })(RevealTarget = exports.RevealTarget || (exports.RevealTarget = {}));
    /**
     * This is an operation type that will be recorded for undo/redo purposes.
     * The goal is to introduce an undo stop when the controller switches between different operation types.
     */
    var EditOperationType;
    (function (EditOperationType) {
        EditOperationType[EditOperationType["Other"] = 0] = "Other";
        EditOperationType[EditOperationType["Typing"] = 1] = "Typing";
        EditOperationType[EditOperationType["DeletingLeft"] = 2] = "DeletingLeft";
        EditOperationType[EditOperationType["DeletingRight"] = 3] = "DeletingRight";
    })(EditOperationType = exports.EditOperationType || (exports.EditOperationType = {}));
    const autoCloseAlways = () => true;
    const autoCloseNever = () => false;
    const autoCloseBeforeWhitespace = (chr) => (chr === ' ' || chr === '\t');
    class CursorConfiguration {
        static shouldRecreate(e) {
            return (e.layoutInfo
                || e.wordSeparators
                || e.emptySelectionClipboard
                || e.multiCursorMergeOverlapping
                || e.autoClosingBrackets
                || e.autoClosingQuotes
                || e.autoSurround
                || e.useTabStops
                || e.lineHeight
                || e.readOnly);
        }
        constructor(languageIdentifier, modelOptions, configuration) {
            this._languageIdentifier = languageIdentifier;
            let c = configuration.editor;
            this.readOnly = c.readOnly;
            this.tabSize = modelOptions.tabSize;
            this.indentSize = modelOptions.indentSize;
            this.insertSpaces = modelOptions.insertSpaces;
            this.pageSize = Math.max(1, Math.floor(c.layoutInfo.height / c.fontInfo.lineHeight) - 2);
            this.lineHeight = c.lineHeight;
            this.useTabStops = c.useTabStops;
            this.wordSeparators = c.wordSeparators;
            this.emptySelectionClipboard = c.emptySelectionClipboard;
            this.copyWithSyntaxHighlighting = c.copyWithSyntaxHighlighting;
            this.multiCursorMergeOverlapping = c.multiCursorMergeOverlapping;
            this.autoClosingBrackets = c.autoClosingBrackets;
            this.autoClosingQuotes = c.autoClosingQuotes;
            this.autoSurround = c.autoSurround;
            this.autoIndent = c.autoIndent;
            this.autoClosingPairsOpen = {};
            this.autoClosingPairsClose = {};
            this.surroundingPairs = {};
            this._electricChars = null;
            this.shouldAutoCloseBefore = {
                quote: CursorConfiguration._getShouldAutoClose(languageIdentifier, this.autoClosingQuotes),
                bracket: CursorConfiguration._getShouldAutoClose(languageIdentifier, this.autoClosingBrackets)
            };
            let autoClosingPairs = CursorConfiguration._getAutoClosingPairs(languageIdentifier);
            if (autoClosingPairs) {
                for (const pair of autoClosingPairs) {
                    this.autoClosingPairsOpen[pair.open] = pair.close;
                    this.autoClosingPairsClose[pair.close] = pair.open;
                }
            }
            let surroundingPairs = CursorConfiguration._getSurroundingPairs(languageIdentifier);
            if (surroundingPairs) {
                for (const pair of surroundingPairs) {
                    this.surroundingPairs[pair.open] = pair.close;
                }
            }
        }
        get electricChars() {
            if (!this._electricChars) {
                this._electricChars = {};
                let electricChars = CursorConfiguration._getElectricCharacters(this._languageIdentifier);
                if (electricChars) {
                    for (const char of electricChars) {
                        this._electricChars[char] = true;
                    }
                }
            }
            return this._electricChars;
        }
        normalizeIndentation(str) {
            return textModel_1.TextModel.normalizeIndentation(str, this.indentSize, this.insertSpaces);
        }
        static _getElectricCharacters(languageIdentifier) {
            try {
                return languageConfigurationRegistry_1.LanguageConfigurationRegistry.getElectricCharacters(languageIdentifier.id);
            }
            catch (e) {
                errors_1.onUnexpectedError(e);
                return null;
            }
        }
        static _getAutoClosingPairs(languageIdentifier) {
            try {
                return languageConfigurationRegistry_1.LanguageConfigurationRegistry.getAutoClosingPairs(languageIdentifier.id);
            }
            catch (e) {
                errors_1.onUnexpectedError(e);
                return null;
            }
        }
        static _getShouldAutoClose(languageIdentifier, autoCloseConfig) {
            switch (autoCloseConfig) {
                case 'beforeWhitespace':
                    return autoCloseBeforeWhitespace;
                case 'languageDefined':
                    return CursorConfiguration._getLanguageDefinedShouldAutoClose(languageIdentifier);
                case 'always':
                    return autoCloseAlways;
                case 'never':
                    return autoCloseNever;
            }
        }
        static _getLanguageDefinedShouldAutoClose(languageIdentifier) {
            try {
                const autoCloseBeforeSet = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getAutoCloseBeforeSet(languageIdentifier.id);
                return c => autoCloseBeforeSet.indexOf(c) !== -1;
            }
            catch (e) {
                errors_1.onUnexpectedError(e);
                return autoCloseNever;
            }
        }
        static _getSurroundingPairs(languageIdentifier) {
            try {
                return languageConfigurationRegistry_1.LanguageConfigurationRegistry.getSurroundingPairs(languageIdentifier.id);
            }
            catch (e) {
                errors_1.onUnexpectedError(e);
                return null;
            }
        }
    }
    exports.CursorConfiguration = CursorConfiguration;
    /**
     * Represents the cursor state on either the model or on the view model.
     */
    class SingleCursorState {
        constructor(selectionStart, selectionStartLeftoverVisibleColumns, position, leftoverVisibleColumns) {
            this.selectionStart = selectionStart;
            this.selectionStartLeftoverVisibleColumns = selectionStartLeftoverVisibleColumns;
            this.position = position;
            this.leftoverVisibleColumns = leftoverVisibleColumns;
            this.selection = SingleCursorState._computeSelection(this.selectionStart, this.position);
        }
        equals(other) {
            return (this.selectionStartLeftoverVisibleColumns === other.selectionStartLeftoverVisibleColumns
                && this.leftoverVisibleColumns === other.leftoverVisibleColumns
                && this.position.equals(other.position)
                && this.selectionStart.equalsRange(other.selectionStart));
        }
        hasSelection() {
            return (!this.selection.isEmpty() || !this.selectionStart.isEmpty());
        }
        move(inSelectionMode, lineNumber, column, leftoverVisibleColumns) {
            if (inSelectionMode) {
                // move just position
                return new SingleCursorState(this.selectionStart, this.selectionStartLeftoverVisibleColumns, new position_1.Position(lineNumber, column), leftoverVisibleColumns);
            }
            else {
                // move everything
                return new SingleCursorState(new range_1.Range(lineNumber, column, lineNumber, column), leftoverVisibleColumns, new position_1.Position(lineNumber, column), leftoverVisibleColumns);
            }
        }
        static _computeSelection(selectionStart, position) {
            let startLineNumber, startColumn, endLineNumber, endColumn;
            if (selectionStart.isEmpty()) {
                startLineNumber = selectionStart.startLineNumber;
                startColumn = selectionStart.startColumn;
                endLineNumber = position.lineNumber;
                endColumn = position.column;
            }
            else {
                if (position.isBeforeOrEqual(selectionStart.getStartPosition())) {
                    startLineNumber = selectionStart.endLineNumber;
                    startColumn = selectionStart.endColumn;
                    endLineNumber = position.lineNumber;
                    endColumn = position.column;
                }
                else {
                    startLineNumber = selectionStart.startLineNumber;
                    startColumn = selectionStart.startColumn;
                    endLineNumber = position.lineNumber;
                    endColumn = position.column;
                }
            }
            return new selection_1.Selection(startLineNumber, startColumn, endLineNumber, endColumn);
        }
    }
    exports.SingleCursorState = SingleCursorState;
    class CursorContext {
        constructor(configuration, model, viewModel) {
            this.model = model;
            this.viewModel = viewModel;
            this.config = new CursorConfiguration(this.model.getLanguageIdentifier(), this.model.getOptions(), configuration);
        }
        validateViewPosition(viewPosition, modelPosition) {
            return this.viewModel.coordinatesConverter.validateViewPosition(viewPosition, modelPosition);
        }
        validateViewRange(viewRange, expectedModelRange) {
            return this.viewModel.coordinatesConverter.validateViewRange(viewRange, expectedModelRange);
        }
        convertViewRangeToModelRange(viewRange) {
            return this.viewModel.coordinatesConverter.convertViewRangeToModelRange(viewRange);
        }
        convertViewPositionToModelPosition(lineNumber, column) {
            return this.viewModel.coordinatesConverter.convertViewPositionToModelPosition(new position_1.Position(lineNumber, column));
        }
        convertModelPositionToViewPosition(modelPosition) {
            return this.viewModel.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
        }
        convertModelRangeToViewRange(modelRange) {
            return this.viewModel.coordinatesConverter.convertModelRangeToViewRange(modelRange);
        }
        getCurrentScrollTop() {
            return this.viewModel.viewLayout.getCurrentScrollTop();
        }
        getCompletelyVisibleViewRange() {
            return this.viewModel.getCompletelyVisibleViewRange();
        }
        getCompletelyVisibleModelRange() {
            const viewRange = this.viewModel.getCompletelyVisibleViewRange();
            return this.viewModel.coordinatesConverter.convertViewRangeToModelRange(viewRange);
        }
        getCompletelyVisibleViewRangeAtScrollTop(scrollTop) {
            return this.viewModel.getCompletelyVisibleViewRangeAtScrollTop(scrollTop);
        }
        getVerticalOffsetForViewLine(viewLineNumber) {
            return this.viewModel.viewLayout.getVerticalOffsetForLineNumber(viewLineNumber);
        }
    }
    exports.CursorContext = CursorContext;
    class PartialModelCursorState {
        constructor(modelState) {
            this.modelState = modelState;
            this.viewState = null;
        }
    }
    exports.PartialModelCursorState = PartialModelCursorState;
    class PartialViewCursorState {
        constructor(viewState) {
            this.modelState = null;
            this.viewState = viewState;
        }
    }
    exports.PartialViewCursorState = PartialViewCursorState;
    class CursorState {
        static fromModelState(modelState) {
            return new PartialModelCursorState(modelState);
        }
        static fromViewState(viewState) {
            return new PartialViewCursorState(viewState);
        }
        static fromModelSelection(modelSelection) {
            const selectionStartLineNumber = modelSelection.selectionStartLineNumber;
            const selectionStartColumn = modelSelection.selectionStartColumn;
            const positionLineNumber = modelSelection.positionLineNumber;
            const positionColumn = modelSelection.positionColumn;
            const modelState = new SingleCursorState(new range_1.Range(selectionStartLineNumber, selectionStartColumn, selectionStartLineNumber, selectionStartColumn), 0, new position_1.Position(positionLineNumber, positionColumn), 0);
            return CursorState.fromModelState(modelState);
        }
        static fromModelSelections(modelSelections) {
            let states = [];
            for (let i = 0, len = modelSelections.length; i < len; i++) {
                states[i] = this.fromModelSelection(modelSelections[i]);
            }
            return states;
        }
        constructor(modelState, viewState) {
            this.modelState = modelState;
            this.viewState = viewState;
        }
        equals(other) {
            return (this.viewState.equals(other.viewState) && this.modelState.equals(other.modelState));
        }
    }
    exports.CursorState = CursorState;
    class EditOperationResult {
        constructor(type, commands, opts) {
            this.type = type;
            this.commands = commands;
            this.shouldPushStackElementBefore = opts.shouldPushStackElementBefore;
            this.shouldPushStackElementAfter = opts.shouldPushStackElementAfter;
        }
    }
    exports.EditOperationResult = EditOperationResult;
    /**
     * Common operations that work and make sense both on the model and on the view model.
     */
    class CursorColumns {
        static isLowSurrogate(model, lineNumber, charOffset) {
            let lineContent = model.getLineContent(lineNumber);
            if (charOffset < 0 || charOffset >= lineContent.length) {
                return false;
            }
            return strings.isLowSurrogate(lineContent.charCodeAt(charOffset));
        }
        static isHighSurrogate(model, lineNumber, charOffset) {
            let lineContent = model.getLineContent(lineNumber);
            if (charOffset < 0 || charOffset >= lineContent.length) {
                return false;
            }
            return strings.isHighSurrogate(lineContent.charCodeAt(charOffset));
        }
        static isInsideSurrogatePair(model, lineNumber, column) {
            return this.isHighSurrogate(model, lineNumber, column - 2);
        }
        static visibleColumnFromColumn(lineContent, column, tabSize) {
            let endOffset = lineContent.length;
            if (endOffset > column - 1) {
                endOffset = column - 1;
            }
            let result = 0;
            for (let i = 0; i < endOffset; i++) {
                let charCode = lineContent.charCodeAt(i);
                if (charCode === 9 /* Tab */) {
                    result = this.nextRenderTabStop(result, tabSize);
                }
                else if (strings.isFullWidthCharacter(charCode)) {
                    result = result + 2;
                }
                else {
                    result = result + 1;
                }
            }
            return result;
        }
        static visibleColumnFromColumn2(config, model, position) {
            return this.visibleColumnFromColumn(model.getLineContent(position.lineNumber), position.column, config.tabSize);
        }
        static columnFromVisibleColumn(lineContent, visibleColumn, tabSize) {
            if (visibleColumn <= 0) {
                return 1;
            }
            const lineLength = lineContent.length;
            let beforeVisibleColumn = 0;
            for (let i = 0; i < lineLength; i++) {
                let charCode = lineContent.charCodeAt(i);
                let afterVisibleColumn;
                if (charCode === 9 /* Tab */) {
                    afterVisibleColumn = this.nextRenderTabStop(beforeVisibleColumn, tabSize);
                }
                else if (strings.isFullWidthCharacter(charCode)) {
                    afterVisibleColumn = beforeVisibleColumn + 2;
                }
                else {
                    afterVisibleColumn = beforeVisibleColumn + 1;
                }
                if (afterVisibleColumn >= visibleColumn) {
                    let prevDelta = visibleColumn - beforeVisibleColumn;
                    let afterDelta = afterVisibleColumn - visibleColumn;
                    if (afterDelta < prevDelta) {
                        return i + 2;
                    }
                    else {
                        return i + 1;
                    }
                }
                beforeVisibleColumn = afterVisibleColumn;
            }
            // walked the entire string
            return lineLength + 1;
        }
        static columnFromVisibleColumn2(config, model, lineNumber, visibleColumn) {
            let result = this.columnFromVisibleColumn(model.getLineContent(lineNumber), visibleColumn, config.tabSize);
            let minColumn = model.getLineMinColumn(lineNumber);
            if (result < minColumn) {
                return minColumn;
            }
            let maxColumn = model.getLineMaxColumn(lineNumber);
            if (result > maxColumn) {
                return maxColumn;
            }
            return result;
        }
        /**
         * ATTENTION: This works with 0-based columns (as oposed to the regular 1-based columns)
         */
        static nextRenderTabStop(visibleColumn, tabSize) {
            return visibleColumn + tabSize - visibleColumn % tabSize;
        }
        /**
         * ATTENTION: This works with 0-based columns (as oposed to the regular 1-based columns)
         */
        static nextIndentTabStop(visibleColumn, indentSize) {
            return visibleColumn + indentSize - visibleColumn % indentSize;
        }
        /**
         * ATTENTION: This works with 0-based columns (as oposed to the regular 1-based columns)
         */
        static prevRenderTabStop(column, tabSize) {
            return column - 1 - (column - 1) % tabSize;
        }
        /**
         * ATTENTION: This works with 0-based columns (as oposed to the regular 1-based columns)
         */
        static prevIndentTabStop(column, indentSize) {
            return column - 1 - (column - 1) % indentSize;
        }
    }
    exports.CursorColumns = CursorColumns;
    function isQuote(ch) {
        return (ch === '\'' || ch === '"' || ch === '`');
    }
    exports.isQuote = isQuote;
});
//# sourceMappingURL=cursorCommon.js.map