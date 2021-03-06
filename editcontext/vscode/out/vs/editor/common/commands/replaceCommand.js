/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/editor/common/core/selection"], function (require, exports, selection_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ReplaceCommand {
        constructor(range, text, insertsAutoWhitespace = false) {
            this._range = range;
            this._text = text;
            this.insertsAutoWhitespace = insertsAutoWhitespace;
        }
        getEditOperations(model, builder) {
            builder.addTrackedEditOperation(this._range, this._text);
        }
        computeCursorState(model, helper) {
            let inverseEditOperations = helper.getInverseEditOperations();
            let srcRange = inverseEditOperations[0].range;
            return new selection_1.Selection(srcRange.endLineNumber, srcRange.endColumn, srcRange.endLineNumber, srcRange.endColumn);
        }
    }
    exports.ReplaceCommand = ReplaceCommand;
    class ReplaceCommandWithoutChangingPosition {
        constructor(range, text, insertsAutoWhitespace = false) {
            this._range = range;
            this._text = text;
            this.insertsAutoWhitespace = insertsAutoWhitespace;
        }
        getEditOperations(model, builder) {
            builder.addTrackedEditOperation(this._range, this._text);
        }
        computeCursorState(model, helper) {
            let inverseEditOperations = helper.getInverseEditOperations();
            let srcRange = inverseEditOperations[0].range;
            return new selection_1.Selection(srcRange.startLineNumber, srcRange.startColumn, srcRange.startLineNumber, srcRange.startColumn);
        }
    }
    exports.ReplaceCommandWithoutChangingPosition = ReplaceCommandWithoutChangingPosition;
    class ReplaceCommandWithOffsetCursorState {
        constructor(range, text, lineNumberDeltaOffset, columnDeltaOffset, insertsAutoWhitespace = false) {
            this._range = range;
            this._text = text;
            this._columnDeltaOffset = columnDeltaOffset;
            this._lineNumberDeltaOffset = lineNumberDeltaOffset;
            this.insertsAutoWhitespace = insertsAutoWhitespace;
        }
        getEditOperations(model, builder) {
            builder.addTrackedEditOperation(this._range, this._text);
        }
        computeCursorState(model, helper) {
            let inverseEditOperations = helper.getInverseEditOperations();
            let srcRange = inverseEditOperations[0].range;
            return new selection_1.Selection(srcRange.endLineNumber + this._lineNumberDeltaOffset, srcRange.endColumn + this._columnDeltaOffset, srcRange.endLineNumber + this._lineNumberDeltaOffset, srcRange.endColumn + this._columnDeltaOffset);
        }
    }
    exports.ReplaceCommandWithOffsetCursorState = ReplaceCommandWithOffsetCursorState;
    class ReplaceCommandThatPreservesSelection {
        constructor(editRange, text, initialSelection) {
            this._range = editRange;
            this._text = text;
            this._initialSelection = initialSelection;
        }
        getEditOperations(model, builder) {
            builder.addEditOperation(this._range, this._text);
            this._selectionId = builder.trackSelection(this._initialSelection);
        }
        computeCursorState(model, helper) {
            return helper.getTrackedSelection(this._selectionId);
        }
    }
    exports.ReplaceCommandThatPreservesSelection = ReplaceCommandThatPreservesSelection;
});
//# sourceMappingURL=replaceCommand.js.map