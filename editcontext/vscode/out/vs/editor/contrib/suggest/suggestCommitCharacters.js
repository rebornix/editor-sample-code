/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/arrays", "vs/base/common/lifecycle", "vs/editor/common/core/characterClassifier"], function (require, exports, arrays_1, lifecycle_1, characterClassifier_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CommitCharacterController {
        constructor(editor, widget, accept) {
            this._disposables = new lifecycle_1.DisposableStore();
            this._disposables.add(widget.onDidShow(() => this._onItem(widget.getFocusedItem())));
            this._disposables.add(widget.onDidFocus(this._onItem, this));
            this._disposables.add(widget.onDidHide(this.reset, this));
            this._disposables.add(editor.onWillType(text => {
                if (this._active) {
                    const ch = text.charCodeAt(text.length - 1);
                    if (this._active.acceptCharacters.has(ch) && editor.getConfiguration().contribInfo.acceptSuggestionOnCommitCharacter) {
                        accept(this._active.item);
                    }
                }
            }));
        }
        _onItem(selected) {
            if (!selected || !arrays_1.isNonEmptyArray(selected.item.completion.commitCharacters)) {
                this.reset();
                return;
            }
            const acceptCharacters = new characterClassifier_1.CharacterSet();
            for (const ch of selected.item.completion.commitCharacters) {
                if (ch.length > 0) {
                    acceptCharacters.add(ch.charCodeAt(0));
                }
            }
            this._active = { acceptCharacters, item: selected };
        }
        reset() {
            this._active = undefined;
        }
        dispose() {
            this._disposables.dispose();
        }
    }
    exports.CommitCharacterController = CommitCharacterController;
});
//# sourceMappingURL=suggestCommitCharacters.js.map