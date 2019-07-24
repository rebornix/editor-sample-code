/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/browser/dom", "vs/editor/browser/view/viewPart", "vs/editor/common/core/range", "vs/editor/common/core/position", "vs/editor/common/core/selection", "vs/base/common/event"], function (require, exports, dom, viewPart_1, range_1, position_1, selection_1, event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class EditContextHandler extends viewPart_1.ViewPart {
        constructor(context, viewController, editContext) {
            super(context);
            this._onFocus = this._register(new event_1.Emitter());
            this.onFocus = this._onFocus.event;
            this._onBlur = this._register(new event_1.Emitter());
            this.onBlur = this._onBlur.event;
            this._onKeyDown = this._register(new event_1.Emitter());
            this.onKeyDown = this._onKeyDown.event;
            this._onKeyUp = this._register(new event_1.Emitter());
            this.onKeyUp = this._onKeyUp.event;
            this._primaryCursorVisibleRange = null;
            this._viewController = viewController;
            this._editContext = editContext;
            this._hasFocus = false;
            const conf = this._context.configuration.editor;
            this._accessibilitySupport = conf.accessibilitySupport;
            this._contentLeft = conf.layoutInfo.contentLeft;
            this._contentWidth = conf.layoutInfo.contentWidth;
            this._contentHeight = conf.layoutInfo.contentHeight;
            this._scrollLeft = 0;
            this._scrollTop = 0;
            this._fontInfo = conf.fontInfo;
            this._lineHeight = conf.lineHeight;
            this._emptySelectionClipboard = conf.emptySelectionClipboard;
            this._copyWithSyntaxHighlighting = conf.copyWithSyntaxHighlighting;
            this._selections = [new selection_1.Selection(1, 1, 1, 1)];
            const lineCnt = this._context.model.getLineCount();
            const maxColumnOfLastLine = this._context.model.getLineMaxColumn(lineCnt);
            const originalModelText = this._context.model.getValueInRange(new range_1.Range(1, 1, lineCnt, maxColumnOfLastLine), 0 /* TextDefined */);
            this._editContext.textChanged(/*insertAt*/ 0, /*charsToRemove*/ 0, originalModelText);
            this._editContext.selectionChanged(new EditContextTextRange(originalModelText.length, originalModelText.length));
            this._editContext.addEventListener('keydown', () => {
                console.log('keydown');
            });
            this._editContext.addEventListener('textupdate', ((e) => {
                const replaceCharCnt = e.updateRange.end - e.updateRange.start;
                const text = e.updateText;
                if (!this._selections[0].isEmpty()) {
                    this._viewController.type('keyboard', text);
                }
                else {
                    this._viewController.replacePreviousChar('keyboard', text, replaceCharCnt);
                }
            }).bind(this));
        }
        registerParent(info) {
            this._containerDOM = info.viewDomNode;
            this._viewLineDomNode = info.viewLineDomNode;
            console.log('register listener');
            this._register(dom.addStandardDisposableListener(this._viewLineDomNode, 'keydown', (e) => {
                console.log('keydown');
                // if (this._isDoingComposition &&
                // 	(e.keyCode === KeyCode.KEY_IN_COMPOSITION || e.keyCode === KeyCode.Backspace)) {
                // 	// Stop propagation for keyDown events if the IME is processing key input
                // 	e.stopPropagation();
                // }
                if (e.equals(9 /* Escape */)) {
                    // Prevent default always for `Esc`, otherwise it will generate a keypress
                    // See https://msdn.microsoft.com/en-us/library/ie/ms536939(v=vs.85).aspx
                    e.preventDefault();
                }
                this._viewController.emitKeyDown(e);
            }));
            this._register(dom.addStandardDisposableListener(this._viewLineDomNode, 'keyup', (e) => {
                this._viewController.emitKeyUp(e);
            }));
        }
        onConfigurationChanged(e) {
            const conf = this._context.configuration.editor;
            if (e.fontInfo) {
                this._fontInfo = conf.fontInfo;
            }
            if (e.viewInfo) {
                this.textArea.setAttribute('aria-label', conf.viewInfo.ariaLabel);
            }
            if (e.layoutInfo) {
                this._contentLeft = conf.layoutInfo.contentLeft;
                this._contentWidth = conf.layoutInfo.contentWidth;
                this._contentHeight = conf.layoutInfo.contentHeight;
            }
            if (e.lineHeight) {
                this._lineHeight = conf.lineHeight;
            }
            if (e.accessibilitySupport) {
                this._accessibilitySupport = conf.accessibilitySupport;
                this._textAreaInput.writeScreenReaderContent('strategy changed');
            }
            if (e.emptySelectionClipboard) {
                this._emptySelectionClipboard = conf.emptySelectionClipboard;
            }
            if (e.copyWithSyntaxHighlighting) {
                this._copyWithSyntaxHighlighting = conf.copyWithSyntaxHighlighting;
            }
            return true;
        }
        onCursorStateChanged(e) {
            this._selections = e.selections.slice(0);
            // this._textAreaInput.writeScreenReaderContent('selection changed');
            return true;
        }
        onLinesChanged(e) {
            return true;
        }
        onLinesDeleted(e) {
            return true;
        }
        onLinesInserted(e) {
            return true;
        }
        onScrollChanged(e) {
            this._scrollLeft = e.scrollLeft;
            this._scrollTop = e.scrollTop;
            return true;
        }
        onZonesChanged(e) {
            return true;
        }
        isFocused() {
            return true;
        }
        focusEditContext() {
            this._setHasFocus(true);
            this._viewLineDomNode.focus();
            this._editContext.focus();
        }
        _setHasFocus(newHasFocus) {
            if (this._hasFocus === newHasFocus) {
                // no change
                return;
            }
            this._hasFocus = newHasFocus;
            if (this._hasFocus) {
                this._onFocus.fire();
            }
            else {
                this._onBlur.fire();
            }
        }
        prepareRender(ctx) {
            if (this._accessibilitySupport === 2 /* Enabled */) {
                // Do not move the textarea with the cursor, as this generates accessibility events that might confuse screen readers
                // See https://github.com/Microsoft/vscode/issues/26730
                this._primaryCursorVisibleRange = null;
            }
            else {
                const primaryCursorPosition = new position_1.Position(this._selections[0].positionLineNumber, this._selections[0].positionColumn);
                this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(primaryCursorPosition);
            }
        }
        render(ctx) {
            if (!this._primaryCursorVisibleRange) {
                // The primary cursor is outside the viewport => place textarea to the top left
                // this._renderAtTopLeft();
                return;
            }
            const left = this._contentLeft + this._primaryCursorVisibleRange.left - this._scrollLeft;
            if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
                // cursor is outside the viewport
                // this._renderAtTopLeft();
                return;
            }
            const top = this._context.viewLayout.getVerticalOffsetForLineNumber(this._selections[0].positionLineNumber) - this._scrollTop;
            if (top < 0 || top > this._contentHeight) {
                // cursor is outside the viewport
                // this._renderAtTopLeft();
                return;
            }
            const lineCnt = this._context.model.getLineCount();
            const maxColumnOfLastLine = this._context.model.getLineMaxColumn(lineCnt);
            const originalModelText = this._context.model.getValueInRange(new range_1.Range(1, 1, lineCnt, maxColumnOfLastLine), 0 /* TextDefined */);
            this._editContext.textChanged(/*insertAt*/ 0, /*charsToRemove*/ 0, originalModelText);
            const startOffset = this._context.model.getOffsetAt(this._selections[0].getStartPosition());
            const endOffset = this._context.model.getOffsetAt(this._selections[0].getEndPosition());
            this._editContext.selectionChanged(new EditContextTextRange(startOffset, endOffset));
            const viewRect = this._containerDOM.getBoundingClientRect();
            const editControlRect = new DOMRect(
            /*x*/ window.screenLeft + viewRect.x, 
            /*y*/ window.screenTop + viewRect.y, 
            /*width*/ viewRect.width, 
            /*height*/ viewRect.height);
            // console.log(editControlRect);
            const caretRect = new DOMRect(
            /*x*/ editControlRect.x + viewRect.x + left, 
            /*y*/ editControlRect.y + viewRect.y + top, 
            /*width*/ 10, 
            /*height*/ this._fontInfo.lineHeight);
            // console.log(caretRect);
            this._editContext.layoutChanged(editControlRect, caretRect);
        }
    }
    exports.EditContextHandler = EditContextHandler;
});
//# sourceMappingURL=EditContextHandler.js.map