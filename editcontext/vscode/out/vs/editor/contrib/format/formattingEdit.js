/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/editor/common/core/editOperation", "vs/editor/common/core/range"], function (require, exports, editOperation_1, range_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class FormattingEdit {
        static _handleEolEdits(editor, edits) {
            let newEol = undefined;
            let singleEdits = [];
            for (let edit of edits) {
                if (typeof edit.eol === 'number') {
                    newEol = edit.eol;
                }
                if (edit.range && typeof edit.text === 'string') {
                    singleEdits.push(edit);
                }
            }
            if (typeof newEol === 'number') {
                if (editor.hasModel()) {
                    editor.getModel().pushEOL(newEol);
                }
            }
            return singleEdits;
        }
        static _isFullModelReplaceEdit(editor, edit) {
            if (!editor.hasModel()) {
                return false;
            }
            const model = editor.getModel();
            const editRange = model.validateRange(edit.range);
            const fullModelRange = model.getFullModelRange();
            return fullModelRange.equalsRange(editRange);
        }
        static execute(editor, _edits) {
            editor.pushUndoStop();
            const edits = FormattingEdit._handleEolEdits(editor, _edits);
            if (edits.length === 1 && FormattingEdit._isFullModelReplaceEdit(editor, edits[0])) {
                // We use replace semantics and hope that markers stay put...
                editor.executeEdits('formatEditsCommand', edits.map(edit => editOperation_1.EditOperation.replace(range_1.Range.lift(edit.range), edit.text)));
            }
            else {
                editor.executeEdits('formatEditsCommand', edits.map(edit => editOperation_1.EditOperation.replaceMove(range_1.Range.lift(edit.range), edit.text)));
            }
            editor.pushUndoStop();
        }
    }
    exports.FormattingEdit = FormattingEdit;
});
//# sourceMappingURL=formattingEdit.js.map