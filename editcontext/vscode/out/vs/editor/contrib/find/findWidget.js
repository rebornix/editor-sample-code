/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/nls", "vs/base/browser/dom", "vs/base/browser/ui/sash/sash", "vs/base/browser/ui/widget", "vs/base/common/async", "vs/base/common/errors", "vs/base/common/lifecycle", "vs/base/common/platform", "vs/base/common/strings", "vs/editor/common/core/range", "vs/editor/contrib/find/findModel", "vs/platform/theme/common/colorRegistry", "vs/platform/theme/common/themeService", "vs/platform/browser/contextScopedHistoryWidget", "vs/base/browser/ui/aria/aria", "vs/css!./findWidget"], function (require, exports, nls, dom, sash_1, widget_1, async_1, errors_1, lifecycle_1, platform, strings, range_1, findModel_1, colorRegistry_1, themeService_1, contextScopedHistoryWidget_1, aria_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const NLS_FIND_INPUT_LABEL = nls.localize('label.find', "Find");
    const NLS_FIND_INPUT_PLACEHOLDER = nls.localize('placeholder.find', "Find");
    const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize('label.previousMatchButton', "Previous match");
    const NLS_NEXT_MATCH_BTN_LABEL = nls.localize('label.nextMatchButton', "Next match");
    const NLS_TOGGLE_SELECTION_FIND_TITLE = nls.localize('label.toggleSelectionFind', "Find in selection");
    const NLS_CLOSE_BTN_LABEL = nls.localize('label.closeButton', "Close");
    const NLS_REPLACE_INPUT_LABEL = nls.localize('label.replace', "Replace");
    const NLS_REPLACE_INPUT_PLACEHOLDER = nls.localize('placeholder.replace', "Replace");
    const NLS_REPLACE_BTN_LABEL = nls.localize('label.replaceButton', "Replace");
    const NLS_REPLACE_ALL_BTN_LABEL = nls.localize('label.replaceAllButton', "Replace All");
    const NLS_TOGGLE_REPLACE_MODE_BTN_LABEL = nls.localize('label.toggleReplaceButton', "Toggle Replace mode");
    const NLS_MATCHES_COUNT_LIMIT_TITLE = nls.localize('title.matchesCountLimit', "Only the first {0} results are highlighted, but all find operations work on the entire text.", findModel_1.MATCHES_LIMIT);
    const NLS_MATCHES_LOCATION = nls.localize('label.matchesLocation', "{0} of {1}");
    const NLS_NO_RESULTS = nls.localize('label.noResults', "No Results");
    const FIND_WIDGET_INITIAL_WIDTH = 411;
    const PART_WIDTH = 275;
    const FIND_INPUT_AREA_WIDTH = PART_WIDTH - 54;
    const REPLACE_INPUT_AREA_WIDTH = FIND_INPUT_AREA_WIDTH;
    let MAX_MATCHES_COUNT_WIDTH = 69;
    let FIND_ALL_CONTROLS_WIDTH = 17 /** Find Input margin-left */ + (MAX_MATCHES_COUNT_WIDTH + 3 + 1) /** Match Results */ + 23 /** Button */ * 4 + 2 /** sash */;
    const FIND_INPUT_AREA_HEIGHT = 34; // The height of Find Widget when Replace Input is not visible.
    const FIND_REPLACE_AREA_HEIGHT = 64; // The height of Find Widget when Replace Input is  visible.
    class FindWidgetViewZone {
        constructor(afterLineNumber) {
            this.afterLineNumber = afterLineNumber;
            this.heightInPx = FIND_INPUT_AREA_HEIGHT;
            this.suppressMouseDown = false;
            this.domNode = document.createElement('div');
            this.domNode.className = 'dock-find-viewzone';
        }
    }
    exports.FindWidgetViewZone = FindWidgetViewZone;
    class FindWidget extends widget_1.Widget {
        constructor(codeEditor, controller, state, contextViewProvider, keybindingService, contextKeyService, themeService) {
            super();
            this._codeEditor = codeEditor;
            this._controller = controller;
            this._state = state;
            this._contextViewProvider = contextViewProvider;
            this._keybindingService = keybindingService;
            this._contextKeyService = contextKeyService;
            this._isVisible = false;
            this._isReplaceVisible = false;
            this._ignoreChangeEvent = false;
            this._updateHistoryDelayer = new async_1.Delayer(500);
            this._register(lifecycle_1.toDisposable(() => this._updateHistoryDelayer.cancel()));
            this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
            this._buildDomNode();
            this._updateButtons();
            this._tryUpdateWidgetWidth();
            this._register(this._codeEditor.onDidChangeConfiguration((e) => {
                if (e.readOnly) {
                    if (this._codeEditor.getConfiguration().readOnly) {
                        // Hide replace part if editor becomes read only
                        this._state.change({ isReplaceRevealed: false }, false);
                    }
                    this._updateButtons();
                }
                if (e.layoutInfo) {
                    this._tryUpdateWidgetWidth();
                }
                if (e.accessibilitySupport) {
                    this.updateAccessibilitySupport();
                }
                if (e.contribInfo) {
                    const addExtraSpaceOnTop = this._codeEditor.getConfiguration().contribInfo.find.addExtraSpaceOnTop;
                    if (addExtraSpaceOnTop && !this._viewZone) {
                        this._viewZone = new FindWidgetViewZone(0);
                        this._showViewZone();
                    }
                    if (!addExtraSpaceOnTop && this._viewZone) {
                        this._removeViewZone();
                    }
                }
            }));
            this.updateAccessibilitySupport();
            this._register(this._codeEditor.onDidChangeCursorSelection(() => {
                if (this._isVisible) {
                    this._updateToggleSelectionFindButton();
                }
            }));
            this._register(this._codeEditor.onDidFocusEditorWidget(() => {
                if (this._isVisible) {
                    let globalBufferTerm = this._controller.getGlobalBufferTerm();
                    if (globalBufferTerm && globalBufferTerm !== this._state.searchString) {
                        this._state.change({ searchString: globalBufferTerm }, true);
                        this._findInput.select();
                    }
                }
            }));
            this._findInputFocused = findModel_1.CONTEXT_FIND_INPUT_FOCUSED.bindTo(contextKeyService);
            this._findFocusTracker = this._register(dom.trackFocus(this._findInput.inputBox.inputElement));
            this._register(this._findFocusTracker.onDidFocus(() => {
                this._findInputFocused.set(true);
                this._updateSearchScope();
            }));
            this._register(this._findFocusTracker.onDidBlur(() => {
                this._findInputFocused.set(false);
            }));
            this._replaceInputFocused = findModel_1.CONTEXT_REPLACE_INPUT_FOCUSED.bindTo(contextKeyService);
            this._replaceFocusTracker = this._register(dom.trackFocus(this._replaceInputBox.inputElement));
            this._register(this._replaceFocusTracker.onDidFocus(() => {
                this._replaceInputFocused.set(true);
                this._updateSearchScope();
            }));
            this._register(this._replaceFocusTracker.onDidBlur(() => {
                this._replaceInputFocused.set(false);
            }));
            this._codeEditor.addOverlayWidget(this);
            if (this._codeEditor.getConfiguration().contribInfo.find.addExtraSpaceOnTop) {
                this._viewZone = new FindWidgetViewZone(0); // Put it before the first line then users can scroll beyond the first line.
            }
            this._applyTheme(themeService.getTheme());
            this._register(themeService.onThemeChange(this._applyTheme.bind(this)));
            this._register(this._codeEditor.onDidChangeModel(() => {
                if (!this._isVisible) {
                    return;
                }
                if (this._viewZoneId === undefined) {
                    return;
                }
                this._codeEditor.changeViewZones((accessor) => {
                    if (this._viewZoneId) {
                        accessor.removeZone(this._viewZoneId);
                    }
                    this._viewZoneId = undefined;
                });
            }));
            this._register(this._codeEditor.onDidScrollChange((e) => {
                if (e.scrollTopChanged) {
                    this._layoutViewZone();
                    return;
                }
                // for other scroll changes, layout the viewzone in next tick to avoid ruining current rendering.
                setTimeout(() => {
                    this._layoutViewZone();
                }, 0);
            }));
        }
        // ----- IOverlayWidget API
        getId() {
            return FindWidget.ID;
        }
        getDomNode() {
            return this._domNode;
        }
        getPosition() {
            if (this._isVisible) {
                return {
                    preference: 0 /* TOP_RIGHT_CORNER */
                };
            }
            return null;
        }
        // ----- React to state changes
        _onStateChanged(e) {
            if (e.searchString) {
                try {
                    this._ignoreChangeEvent = true;
                    this._findInput.setValue(this._state.searchString);
                }
                finally {
                    this._ignoreChangeEvent = false;
                }
                this._updateButtons();
            }
            if (e.replaceString) {
                this._replaceInputBox.value = this._state.replaceString;
            }
            if (e.isRevealed) {
                if (this._state.isRevealed) {
                    this._reveal();
                }
                else {
                    this._hide(true);
                }
            }
            if (e.isReplaceRevealed) {
                if (this._state.isReplaceRevealed) {
                    if (!this._codeEditor.getConfiguration().readOnly && !this._isReplaceVisible) {
                        this._isReplaceVisible = true;
                        this._replaceInputBox.width = this._findInput.inputBox.width;
                        this._updateButtons();
                    }
                }
                else {
                    if (this._isReplaceVisible) {
                        this._isReplaceVisible = false;
                        this._updateButtons();
                    }
                }
            }
            if (e.isRegex) {
                this._findInput.setRegex(this._state.isRegex);
            }
            if (e.wholeWord) {
                this._findInput.setWholeWords(this._state.wholeWord);
            }
            if (e.matchCase) {
                this._findInput.setCaseSensitive(this._state.matchCase);
            }
            if (e.searchScope) {
                if (this._state.searchScope) {
                    this._toggleSelectionFind.checked = true;
                }
                else {
                    this._toggleSelectionFind.checked = false;
                }
                this._updateToggleSelectionFindButton();
            }
            if (e.searchString || e.matchesCount || e.matchesPosition) {
                let showRedOutline = (this._state.searchString.length > 0 && this._state.matchesCount === 0);
                dom.toggleClass(this._domNode, 'no-results', showRedOutline);
                this._updateMatchesCount();
                this._updateButtons();
            }
            if (e.searchString || e.currentMatch) {
                this._layoutViewZone();
            }
            if (e.updateHistory) {
                this._delayedUpdateHistory();
            }
        }
        _delayedUpdateHistory() {
            this._updateHistoryDelayer.trigger(this._updateHistory.bind(this));
        }
        _updateHistory() {
            if (this._state.searchString) {
                this._findInput.inputBox.addToHistory();
            }
            if (this._state.replaceString) {
                this._replaceInputBox.addToHistory();
            }
        }
        _updateMatchesCount() {
            this._matchesCount.style.minWidth = MAX_MATCHES_COUNT_WIDTH + 'px';
            if (this._state.matchesCount >= findModel_1.MATCHES_LIMIT) {
                this._matchesCount.title = NLS_MATCHES_COUNT_LIMIT_TITLE;
            }
            else {
                this._matchesCount.title = '';
            }
            // remove previous content
            if (this._matchesCount.firstChild) {
                this._matchesCount.removeChild(this._matchesCount.firstChild);
            }
            let label;
            if (this._state.matchesCount > 0) {
                let matchesCount = String(this._state.matchesCount);
                if (this._state.matchesCount >= findModel_1.MATCHES_LIMIT) {
                    matchesCount += '+';
                }
                let matchesPosition = String(this._state.matchesPosition);
                if (matchesPosition === '0') {
                    matchesPosition = '?';
                }
                label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
            }
            else {
                label = NLS_NO_RESULTS;
            }
            this._matchesCount.appendChild(document.createTextNode(label));
            aria_1.alert(this._getAriaLabel(label, this._state.currentMatch, this._state.searchString), true);
            MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
        }
        // ----- actions
        _getAriaLabel(label, currentMatch, searchString) {
            if (label === NLS_NO_RESULTS) {
                return searchString === ''
                    ? nls.localize('ariaSearchNoResultEmpty', "{0} found", label)
                    : nls.localize('ariaSearchNoResult', "{0} found for {1}", label, searchString);
            }
            return currentMatch
                ? nls.localize('ariaSearchNoResultWithLineNum', "{0} found for {1} at line {2} column {3}", label, searchString, currentMatch.startLineNumber, currentMatch.startColumn)
                : nls.localize('ariaSearchNoResultWithLineNumNoCurrentMatch', "{0} found for {1}", label, searchString);
        }
        /**
         * If 'selection find' is ON we should not disable the button (its function is to cancel 'selection find').
         * If 'selection find' is OFF we enable the button only if there is a selection.
         */
        _updateToggleSelectionFindButton() {
            let selection = this._codeEditor.getSelection();
            let isSelection = selection ? (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) : false;
            let isChecked = this._toggleSelectionFind.checked;
            this._toggleSelectionFind.setEnabled(this._isVisible && (isChecked || isSelection));
        }
        _updateButtons() {
            this._findInput.setEnabled(this._isVisible);
            this._replaceInputBox.setEnabled(this._isVisible && this._isReplaceVisible);
            this._updateToggleSelectionFindButton();
            this._closeBtn.setEnabled(this._isVisible);
            let findInputIsNonEmpty = (this._state.searchString.length > 0);
            let matchesCount = this._state.matchesCount ? true : false;
            this._prevBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount);
            this._nextBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount);
            this._replaceBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
            this._replaceAllBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
            dom.toggleClass(this._domNode, 'replaceToggled', this._isReplaceVisible);
            this._toggleReplaceBtn.toggleClass('collapse', !this._isReplaceVisible);
            this._toggleReplaceBtn.toggleClass('expand', this._isReplaceVisible);
            this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
            let canReplace = !this._codeEditor.getConfiguration().readOnly;
            this._toggleReplaceBtn.setEnabled(this._isVisible && canReplace);
        }
        _reveal() {
            if (!this._isVisible) {
                this._isVisible = true;
                const selection = this._codeEditor.getSelection();
                const isSelection = selection ? (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) : false;
                if (isSelection && this._codeEditor.getConfiguration().contribInfo.find.autoFindInSelection) {
                    this._toggleSelectionFind.checked = true;
                }
                else {
                    this._toggleSelectionFind.checked = false;
                }
                this._tryUpdateWidgetWidth();
                this._updateButtons();
                setTimeout(() => {
                    dom.addClass(this._domNode, 'visible');
                    this._domNode.setAttribute('aria-hidden', 'false');
                }, 0);
                // validate query again as it's being dismissed when we hide the find widget.
                setTimeout(() => {
                    this._findInput.validate();
                }, 200);
                this._codeEditor.layoutOverlayWidget(this);
                let adjustEditorScrollTop = true;
                if (this._codeEditor.getConfiguration().contribInfo.find.seedSearchStringFromSelection && selection) {
                    const domNode = this._codeEditor.getDomNode();
                    if (domNode) {
                        const editorCoords = dom.getDomNodePagePosition(domNode);
                        const startCoords = this._codeEditor.getScrolledVisiblePosition(selection.getStartPosition());
                        const startLeft = editorCoords.left + (startCoords ? startCoords.left : 0);
                        const startTop = startCoords ? startCoords.top : 0;
                        if (this._viewZone && startTop < this._viewZone.heightInPx) {
                            if (selection.endLineNumber > selection.startLineNumber) {
                                adjustEditorScrollTop = false;
                            }
                            const leftOfFindWidget = dom.getTopLeftOffset(this._domNode).left;
                            if (startLeft > leftOfFindWidget) {
                                adjustEditorScrollTop = false;
                            }
                            const endCoords = this._codeEditor.getScrolledVisiblePosition(selection.getEndPosition());
                            const endLeft = editorCoords.left + (endCoords ? endCoords.left : 0);
                            if (endLeft > leftOfFindWidget) {
                                adjustEditorScrollTop = false;
                            }
                        }
                    }
                }
                this._showViewZone(adjustEditorScrollTop);
            }
        }
        _hide(focusTheEditor) {
            if (this._isVisible) {
                this._isVisible = false;
                this._updateButtons();
                dom.removeClass(this._domNode, 'visible');
                this._domNode.setAttribute('aria-hidden', 'true');
                this._findInput.clearMessage();
                if (focusTheEditor) {
                    this._codeEditor.focus();
                }
                this._codeEditor.layoutOverlayWidget(this);
                this._removeViewZone();
            }
        }
        _layoutViewZone() {
            const addExtraSpaceOnTop = this._codeEditor.getConfiguration().contribInfo.find.addExtraSpaceOnTop;
            if (!addExtraSpaceOnTop) {
                this._removeViewZone();
                return;
            }
            if (!this._isVisible) {
                return;
            }
            const viewZone = this._viewZone;
            if (this._viewZoneId !== undefined || !viewZone) {
                return;
            }
            this._codeEditor.changeViewZones((accessor) => {
                if (this._state.isReplaceRevealed) {
                    viewZone.heightInPx = FIND_REPLACE_AREA_HEIGHT;
                }
                else {
                    viewZone.heightInPx = FIND_INPUT_AREA_HEIGHT;
                }
                this._viewZoneId = accessor.addZone(viewZone);
                // scroll top adjust to make sure the editor doesn't scroll when adding viewzone at the beginning.
                this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + viewZone.heightInPx);
            });
        }
        _showViewZone(adjustScroll = true) {
            const viewZone = this._viewZone;
            if (!this._isVisible || !viewZone) {
                return;
            }
            this._codeEditor.changeViewZones((accessor) => {
                let scrollAdjustment = FIND_INPUT_AREA_HEIGHT;
                if (this._viewZoneId !== undefined) {
                    if (this._state.isReplaceRevealed) {
                        viewZone.heightInPx = FIND_REPLACE_AREA_HEIGHT;
                        scrollAdjustment = FIND_REPLACE_AREA_HEIGHT - FIND_INPUT_AREA_HEIGHT;
                    }
                    else {
                        viewZone.heightInPx = FIND_INPUT_AREA_HEIGHT;
                        scrollAdjustment = FIND_INPUT_AREA_HEIGHT - FIND_REPLACE_AREA_HEIGHT;
                    }
                    accessor.removeZone(this._viewZoneId);
                }
                else {
                    viewZone.heightInPx = FIND_INPUT_AREA_HEIGHT;
                }
                this._viewZoneId = accessor.addZone(viewZone);
                if (adjustScroll) {
                    this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + scrollAdjustment);
                }
            });
        }
        _removeViewZone() {
            this._codeEditor.changeViewZones((accessor) => {
                if (this._viewZoneId !== undefined) {
                    accessor.removeZone(this._viewZoneId);
                    this._viewZoneId = undefined;
                    if (this._viewZone) {
                        this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() - this._viewZone.heightInPx);
                        this._viewZone = undefined;
                    }
                }
            });
        }
        _applyTheme(theme) {
            let inputStyles = {
                inputActiveOptionBorder: theme.getColor(colorRegistry_1.inputActiveOptionBorder),
                inputActiveOptionBackground: theme.getColor(colorRegistry_1.inputActiveOptionBackground),
                inputBackground: theme.getColor(colorRegistry_1.inputBackground),
                inputForeground: theme.getColor(colorRegistry_1.inputForeground),
                inputBorder: theme.getColor(colorRegistry_1.inputBorder),
                inputValidationInfoBackground: theme.getColor(colorRegistry_1.inputValidationInfoBackground),
                inputValidationInfoForeground: theme.getColor(colorRegistry_1.inputValidationInfoForeground),
                inputValidationInfoBorder: theme.getColor(colorRegistry_1.inputValidationInfoBorder),
                inputValidationWarningBackground: theme.getColor(colorRegistry_1.inputValidationWarningBackground),
                inputValidationWarningForeground: theme.getColor(colorRegistry_1.inputValidationWarningForeground),
                inputValidationWarningBorder: theme.getColor(colorRegistry_1.inputValidationWarningBorder),
                inputValidationErrorBackground: theme.getColor(colorRegistry_1.inputValidationErrorBackground),
                inputValidationErrorForeground: theme.getColor(colorRegistry_1.inputValidationErrorForeground),
                inputValidationErrorBorder: theme.getColor(colorRegistry_1.inputValidationErrorBorder),
            };
            this._findInput.style(inputStyles);
            this._replaceInputBox.style(inputStyles);
        }
        _tryUpdateWidgetWidth() {
            if (!this._isVisible) {
                return;
            }
            let editorWidth = this._codeEditor.getConfiguration().layoutInfo.width;
            let minimapWidth = this._codeEditor.getConfiguration().layoutInfo.minimapWidth;
            let collapsedFindWidget = false;
            let reducedFindWidget = false;
            let narrowFindWidget = false;
            if (this._resized) {
                let widgetWidth = dom.getTotalWidth(this._domNode);
                if (widgetWidth > FIND_WIDGET_INITIAL_WIDTH) {
                    // as the widget is resized by users, we may need to change the max width of the widget as the editor width changes.
                    this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
                    this._replaceInputBox.inputElement.style.width = `${dom.getTotalWidth(this._findInput.inputBox.inputElement)}px`;
                    return;
                }
            }
            if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth >= editorWidth) {
                reducedFindWidget = true;
            }
            if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth) {
                narrowFindWidget = true;
            }
            if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth + 50) {
                collapsedFindWidget = true;
            }
            dom.toggleClass(this._domNode, 'collapsed-find-widget', collapsedFindWidget);
            dom.toggleClass(this._domNode, 'narrow-find-widget', narrowFindWidget);
            dom.toggleClass(this._domNode, 'reduced-find-widget', reducedFindWidget);
            if (!narrowFindWidget && !collapsedFindWidget) {
                // the minimal left offset of findwidget is 15px.
                this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
            }
            if (this._resized) {
                let findInputWidth = dom.getTotalWidth(this._findInput.inputBox.inputElement);
                if (findInputWidth > 0) {
                    this._replaceInputBox.inputElement.style.width = `${findInputWidth}px`;
                }
            }
        }
        // ----- Public
        focusFindInput() {
            this._findInput.select();
            // Edge browser requires focus() in addition to select()
            this._findInput.focus();
        }
        focusReplaceInput() {
            this._replaceInputBox.select();
            // Edge browser requires focus() in addition to select()
            this._replaceInputBox.focus();
        }
        highlightFindOptions() {
            this._findInput.highlightFindOptions();
        }
        _updateSearchScope() {
            if (!this._codeEditor.hasModel()) {
                return;
            }
            if (this._toggleSelectionFind.checked) {
                let selection = this._codeEditor.getSelection();
                if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
                    selection = selection.setEndPosition(selection.endLineNumber - 1, this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
                }
                const currentMatch = this._state.currentMatch;
                if (selection.startLineNumber !== selection.endLineNumber) {
                    if (!range_1.Range.equalsRange(selection, currentMatch)) {
                        // Reseed find scope
                        this._state.change({ searchScope: selection }, true);
                    }
                }
            }
        }
        _onFindInputMouseDown(e) {
            // on linux, middle key does pasting.
            if (e.middleButton) {
                e.stopPropagation();
            }
        }
        _onFindInputKeyDown(e) {
            if (e.equals(3 /* Enter */)) {
                this._codeEditor.getAction(findModel_1.FIND_IDS.NextMatchFindAction).run().then(undefined, errors_1.onUnexpectedError);
                e.preventDefault();
                return;
            }
            if (e.equals(1024 /* Shift */ | 3 /* Enter */)) {
                this._codeEditor.getAction(findModel_1.FIND_IDS.PreviousMatchFindAction).run().then(undefined, errors_1.onUnexpectedError);
                e.preventDefault();
                return;
            }
            if (e.equals(2 /* Tab */)) {
                if (this._isReplaceVisible) {
                    this._replaceInputBox.focus();
                }
                else {
                    this._findInput.focusOnCaseSensitive();
                }
                e.preventDefault();
                return;
            }
            if (e.equals(2048 /* CtrlCmd */ | 18 /* DownArrow */)) {
                this._codeEditor.focus();
                e.preventDefault();
                return;
            }
        }
        _onReplaceInputKeyDown(e) {
            if (e.equals(3 /* Enter */)) {
                this._controller.replace();
                e.preventDefault();
                return;
            }
            if (e.equals(2048 /* CtrlCmd */ | 3 /* Enter */)) {
                this._controller.replaceAll();
                e.preventDefault();
                return;
            }
            if (e.equals(2 /* Tab */)) {
                this._findInput.focusOnCaseSensitive();
                e.preventDefault();
                return;
            }
            if (e.equals(1024 /* Shift */ | 2 /* Tab */)) {
                this._findInput.focus();
                e.preventDefault();
                return;
            }
            if (e.equals(2048 /* CtrlCmd */ | 18 /* DownArrow */)) {
                this._codeEditor.focus();
                e.preventDefault();
                return;
            }
        }
        // ----- sash
        getHorizontalSashTop(_sash) {
            return 0;
        }
        getHorizontalSashLeft(_sash) {
            return 0;
        }
        getHorizontalSashWidth(_sash) {
            return 500;
        }
        // ----- initialization
        _keybindingLabelFor(actionId) {
            let kb = this._keybindingService.lookupKeybinding(actionId);
            if (!kb) {
                return '';
            }
            return ` (${kb.getLabel()})`;
        }
        _buildFindPart() {
            // Find input
            this._findInput = this._register(new contextScopedHistoryWidget_1.ContextScopedFindInput(null, this._contextViewProvider, {
                width: FIND_INPUT_AREA_WIDTH,
                label: NLS_FIND_INPUT_LABEL,
                placeholder: NLS_FIND_INPUT_PLACEHOLDER,
                appendCaseSensitiveLabel: this._keybindingLabelFor(findModel_1.FIND_IDS.ToggleCaseSensitiveCommand),
                appendWholeWordsLabel: this._keybindingLabelFor(findModel_1.FIND_IDS.ToggleWholeWordCommand),
                appendRegexLabel: this._keybindingLabelFor(findModel_1.FIND_IDS.ToggleRegexCommand),
                validation: (value) => {
                    if (value.length === 0 || !this._findInput.getRegex()) {
                        return null;
                    }
                    try {
                        /* tslint:disable-next-line:no-unused-expression */
                        new RegExp(value);
                        return null;
                    }
                    catch (e) {
                        return { content: e.message };
                    }
                }
            }, this._contextKeyService, true));
            this._findInput.setRegex(!!this._state.isRegex);
            this._findInput.setCaseSensitive(!!this._state.matchCase);
            this._findInput.setWholeWords(!!this._state.wholeWord);
            this._register(this._findInput.onKeyDown((e) => this._onFindInputKeyDown(e)));
            this._register(this._findInput.inputBox.onDidChange(() => {
                if (this._ignoreChangeEvent) {
                    return;
                }
                this._state.change({ searchString: this._findInput.getValue() }, true);
            }));
            this._register(this._findInput.onDidOptionChange(() => {
                this._state.change({
                    isRegex: this._findInput.getRegex(),
                    wholeWord: this._findInput.getWholeWords(),
                    matchCase: this._findInput.getCaseSensitive()
                }, true);
            }));
            this._register(this._findInput.onCaseSensitiveKeyDown((e) => {
                if (e.equals(1024 /* Shift */ | 2 /* Tab */)) {
                    if (this._isReplaceVisible) {
                        this._replaceInputBox.focus();
                        e.preventDefault();
                    }
                }
            }));
            if (platform.isLinux) {
                this._register(this._findInput.onMouseDown((e) => this._onFindInputMouseDown(e)));
            }
            this._matchesCount = document.createElement('div');
            this._matchesCount.className = 'matchesCount';
            this._updateMatchesCount();
            // Previous button
            this._prevBtn = this._register(new SimpleButton({
                label: NLS_PREVIOUS_MATCH_BTN_LABEL + this._keybindingLabelFor(findModel_1.FIND_IDS.PreviousMatchFindAction),
                className: 'previous',
                onTrigger: () => {
                    this._codeEditor.getAction(findModel_1.FIND_IDS.PreviousMatchFindAction).run().then(undefined, errors_1.onUnexpectedError);
                }
            }));
            // Next button
            this._nextBtn = this._register(new SimpleButton({
                label: NLS_NEXT_MATCH_BTN_LABEL + this._keybindingLabelFor(findModel_1.FIND_IDS.NextMatchFindAction),
                className: 'next',
                onTrigger: () => {
                    this._codeEditor.getAction(findModel_1.FIND_IDS.NextMatchFindAction).run().then(undefined, errors_1.onUnexpectedError);
                }
            }));
            let findPart = document.createElement('div');
            findPart.className = 'find-part';
            findPart.appendChild(this._findInput.domNode);
            findPart.appendChild(this._matchesCount);
            findPart.appendChild(this._prevBtn.domNode);
            findPart.appendChild(this._nextBtn.domNode);
            // Toggle selection button
            this._toggleSelectionFind = this._register(new SimpleCheckbox({
                parent: findPart,
                title: NLS_TOGGLE_SELECTION_FIND_TITLE + this._keybindingLabelFor(findModel_1.FIND_IDS.ToggleSearchScopeCommand),
                onChange: () => {
                    if (this._toggleSelectionFind.checked) {
                        if (this._codeEditor.hasModel()) {
                            let selection = this._codeEditor.getSelection();
                            if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
                                selection = selection.setEndPosition(selection.endLineNumber - 1, this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
                            }
                            if (!selection.isEmpty()) {
                                this._state.change({ searchScope: selection }, true);
                            }
                        }
                    }
                    else {
                        this._state.change({ searchScope: null }, true);
                    }
                }
            }));
            // Close button
            this._closeBtn = this._register(new SimpleButton({
                label: NLS_CLOSE_BTN_LABEL + this._keybindingLabelFor(findModel_1.FIND_IDS.CloseFindWidgetCommand),
                className: 'close-fw',
                onTrigger: () => {
                    this._state.change({ isRevealed: false, searchScope: null }, false);
                },
                onKeyDown: (e) => {
                    if (e.equals(2 /* Tab */)) {
                        if (this._isReplaceVisible) {
                            if (this._replaceBtn.isEnabled()) {
                                this._replaceBtn.focus();
                            }
                            else {
                                this._codeEditor.focus();
                            }
                            e.preventDefault();
                        }
                    }
                }
            }));
            findPart.appendChild(this._closeBtn.domNode);
            return findPart;
        }
        _buildReplacePart() {
            // Replace input
            let replaceInput = document.createElement('div');
            replaceInput.className = 'replace-input';
            replaceInput.style.width = REPLACE_INPUT_AREA_WIDTH + 'px';
            this._replaceInputBox = this._register(new contextScopedHistoryWidget_1.ContextScopedHistoryInputBox(replaceInput, undefined, {
                ariaLabel: NLS_REPLACE_INPUT_LABEL,
                placeholder: NLS_REPLACE_INPUT_PLACEHOLDER,
                history: []
            }, this._contextKeyService));
            this._register(dom.addStandardDisposableListener(this._replaceInputBox.inputElement, 'keydown', (e) => this._onReplaceInputKeyDown(e)));
            this._register(this._replaceInputBox.onDidChange(() => {
                this._state.change({ replaceString: this._replaceInputBox.value }, false);
            }));
            // Replace one button
            this._replaceBtn = this._register(new SimpleButton({
                label: NLS_REPLACE_BTN_LABEL + this._keybindingLabelFor(findModel_1.FIND_IDS.ReplaceOneAction),
                className: 'replace',
                onTrigger: () => {
                    this._controller.replace();
                },
                onKeyDown: (e) => {
                    if (e.equals(1024 /* Shift */ | 2 /* Tab */)) {
                        this._closeBtn.focus();
                        e.preventDefault();
                    }
                }
            }));
            // Replace all button
            this._replaceAllBtn = this._register(new SimpleButton({
                label: NLS_REPLACE_ALL_BTN_LABEL + this._keybindingLabelFor(findModel_1.FIND_IDS.ReplaceAllAction),
                className: 'replace-all',
                onTrigger: () => {
                    this._controller.replaceAll();
                }
            }));
            let replacePart = document.createElement('div');
            replacePart.className = 'replace-part';
            replacePart.appendChild(replaceInput);
            replacePart.appendChild(this._replaceBtn.domNode);
            replacePart.appendChild(this._replaceAllBtn.domNode);
            return replacePart;
        }
        _buildDomNode() {
            // Find part
            let findPart = this._buildFindPart();
            // Replace part
            let replacePart = this._buildReplacePart();
            // Toggle replace button
            this._toggleReplaceBtn = this._register(new SimpleButton({
                label: NLS_TOGGLE_REPLACE_MODE_BTN_LABEL,
                className: 'toggle left',
                onTrigger: () => {
                    this._state.change({ isReplaceRevealed: !this._isReplaceVisible }, false);
                    if (this._isReplaceVisible) {
                        this._replaceInputBox.width = this._findInput.inputBox.width;
                    }
                    this._showViewZone();
                }
            }));
            this._toggleReplaceBtn.toggleClass('expand', this._isReplaceVisible);
            this._toggleReplaceBtn.toggleClass('collapse', !this._isReplaceVisible);
            this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
            // Widget
            this._domNode = document.createElement('div');
            this._domNode.className = 'editor-widget find-widget';
            this._domNode.setAttribute('aria-hidden', 'true');
            // We need to set this explicitly, otherwise on IE11, the width inheritence of flex doesn't work.
            this._domNode.style.width = `${FIND_WIDGET_INITIAL_WIDTH}px`;
            this._domNode.appendChild(this._toggleReplaceBtn.domNode);
            this._domNode.appendChild(findPart);
            this._domNode.appendChild(replacePart);
            this._buildSash();
        }
        _buildSash() {
            this._resizeSash = new sash_1.Sash(this._domNode, this, { orientation: 0 /* VERTICAL */ });
            this._resized = false;
            let originalWidth = FIND_WIDGET_INITIAL_WIDTH;
            this._register(this._resizeSash.onDidStart(() => {
                originalWidth = dom.getTotalWidth(this._domNode);
            }));
            this._register(this._resizeSash.onDidChange((evt) => {
                this._resized = true;
                let width = originalWidth + evt.startX - evt.currentX;
                if (width < FIND_WIDGET_INITIAL_WIDTH) {
                    // narrow down the find widget should be handled by CSS.
                    return;
                }
                const inputBoxWidth = width - FIND_ALL_CONTROLS_WIDTH;
                const maxWidth = parseFloat(dom.getComputedStyle(this._domNode).maxWidth) || 0;
                if (width > maxWidth) {
                    return;
                }
                this._domNode.style.width = `${width}px`;
                if (this._isReplaceVisible) {
                    this._replaceInputBox.width = inputBoxWidth;
                }
            }));
        }
        updateAccessibilitySupport() {
            const value = this._codeEditor.getConfiguration().accessibilitySupport;
            this._findInput.setFocusInputOnOptionClick(value !== 2 /* Enabled */);
        }
    }
    FindWidget.ID = 'editor.contrib.findWidget';
    exports.FindWidget = FindWidget;
    class SimpleCheckbox extends widget_1.Widget {
        constructor(opts) {
            super();
            this._opts = opts;
            this._domNode = document.createElement('div');
            this._domNode.className = 'monaco-checkbox';
            this._domNode.title = this._opts.title;
            this._domNode.tabIndex = 0;
            this._checkbox = document.createElement('input');
            this._checkbox.type = 'checkbox';
            this._checkbox.className = 'checkbox';
            this._checkbox.id = 'checkbox-' + SimpleCheckbox._COUNTER++;
            this._checkbox.tabIndex = -1;
            this._label = document.createElement('label');
            this._label.className = 'label';
            // Connect the label and the checkbox. Checkbox will get checked when the label receives a click.
            this._label.htmlFor = this._checkbox.id;
            this._label.tabIndex = -1;
            this._domNode.appendChild(this._checkbox);
            this._domNode.appendChild(this._label);
            this._opts.parent.appendChild(this._domNode);
            this.onchange(this._checkbox, () => {
                this._opts.onChange();
            });
        }
        get domNode() {
            return this._domNode;
        }
        get checked() {
            return this._checkbox.checked;
        }
        set checked(newValue) {
            this._checkbox.checked = newValue;
        }
        focus() {
            this._checkbox.focus();
        }
        enable() {
            this._checkbox.removeAttribute('disabled');
        }
        disable() {
            this._checkbox.disabled = true;
        }
        setEnabled(enabled) {
            if (enabled) {
                this.enable();
                this.domNode.tabIndex = 0;
            }
            else {
                this.disable();
                this.domNode.tabIndex = -1;
            }
        }
    }
    SimpleCheckbox._COUNTER = 0;
    class SimpleButton extends widget_1.Widget {
        constructor(opts) {
            super();
            this._opts = opts;
            this._domNode = document.createElement('div');
            this._domNode.title = this._opts.label;
            this._domNode.tabIndex = 0;
            this._domNode.className = 'button ' + this._opts.className;
            this._domNode.setAttribute('role', 'button');
            this._domNode.setAttribute('aria-label', this._opts.label);
            this.onclick(this._domNode, (e) => {
                this._opts.onTrigger();
                e.preventDefault();
            });
            this.onkeydown(this._domNode, (e) => {
                if (e.equals(10 /* Space */) || e.equals(3 /* Enter */)) {
                    this._opts.onTrigger();
                    e.preventDefault();
                    return;
                }
                if (this._opts.onKeyDown) {
                    this._opts.onKeyDown(e);
                }
            });
        }
        get domNode() {
            return this._domNode;
        }
        isEnabled() {
            return (this._domNode.tabIndex >= 0);
        }
        focus() {
            this._domNode.focus();
        }
        setEnabled(enabled) {
            dom.toggleClass(this._domNode, 'disabled', !enabled);
            this._domNode.setAttribute('aria-disabled', String(!enabled));
            this._domNode.tabIndex = enabled ? 0 : -1;
        }
        setExpanded(expanded) {
            this._domNode.setAttribute('aria-expanded', String(!!expanded));
        }
        toggleClass(className, shouldHaveIt) {
            dom.toggleClass(this._domNode, className, shouldHaveIt);
        }
    }
    exports.SimpleButton = SimpleButton;
    // theming
    themeService_1.registerThemingParticipant((theme, collector) => {
        const addBackgroundColorRule = (selector, color) => {
            if (color) {
                collector.addRule(`.monaco-editor ${selector} { background-color: ${color}; }`);
            }
        };
        addBackgroundColorRule('.findMatch', theme.getColor(colorRegistry_1.editorFindMatchHighlight));
        addBackgroundColorRule('.currentFindMatch', theme.getColor(colorRegistry_1.editorFindMatch));
        addBackgroundColorRule('.findScope', theme.getColor(colorRegistry_1.editorFindRangeHighlight));
        const widgetBackground = theme.getColor(colorRegistry_1.editorWidgetBackground);
        addBackgroundColorRule('.find-widget', widgetBackground);
        const widgetShadowColor = theme.getColor(colorRegistry_1.widgetShadow);
        if (widgetShadowColor) {
            collector.addRule(`.monaco-editor .find-widget { box-shadow: 0 2px 8px ${widgetShadowColor}; }`);
        }
        const findMatchHighlightBorder = theme.getColor(colorRegistry_1.editorFindMatchHighlightBorder);
        if (findMatchHighlightBorder) {
            collector.addRule(`.monaco-editor .findMatch { border: 1px ${theme.type === 'hc' ? 'dotted' : 'solid'} ${findMatchHighlightBorder}; box-sizing: border-box; }`);
        }
        const findMatchBorder = theme.getColor(colorRegistry_1.editorFindMatchBorder);
        if (findMatchBorder) {
            collector.addRule(`.monaco-editor .currentFindMatch { border: 2px solid ${findMatchBorder}; padding: 1px; box-sizing: border-box; }`);
        }
        const findRangeHighlightBorder = theme.getColor(colorRegistry_1.editorFindRangeHighlightBorder);
        if (findRangeHighlightBorder) {
            collector.addRule(`.monaco-editor .findScope { border: 1px ${theme.type === 'hc' ? 'dashed' : 'solid'} ${findRangeHighlightBorder}; }`);
        }
        const hcBorder = theme.getColor(colorRegistry_1.contrastBorder);
        if (hcBorder) {
            collector.addRule(`.monaco-editor .find-widget { border: 2px solid ${hcBorder}; }`);
        }
        const foreground = theme.getColor(colorRegistry_1.editorWidgetForeground);
        if (foreground) {
            collector.addRule(`.monaco-editor .find-widget { color: ${foreground}; }`);
        }
        const error = theme.getColor(colorRegistry_1.errorForeground);
        if (error) {
            collector.addRule(`.monaco-editor .find-widget.no-results .matchesCount { color: ${error}; }`);
        }
        const resizeBorderBackground = theme.getColor(colorRegistry_1.editorWidgetResizeBorder);
        if (resizeBorderBackground) {
            collector.addRule(`.monaco-editor .find-widget .monaco-sash { background-color: ${resizeBorderBackground}; width: 3px !important; margin-left: -4px;}`);
        }
        else {
            const border = theme.getColor(colorRegistry_1.editorWidgetBorder);
            if (border) {
                collector.addRule(`.monaco-editor .find-widget .monaco-sash { background-color: ${border}; width: 3px !important; margin-left: -4px;}`);
            }
        }
        const inputActiveBorder = theme.getColor(colorRegistry_1.inputActiveOptionBorder);
        if (inputActiveBorder) {
            collector.addRule(`.monaco-editor .find-widget .monaco-checkbox .checkbox:checked + .label { border: 1px solid ${inputActiveBorder.toString()}; }`);
        }
        const inputActiveBackground = theme.getColor(colorRegistry_1.inputActiveOptionBackground);
        if (inputActiveBackground) {
            collector.addRule(`.monaco-editor .find-widget .monaco-checkbox .checkbox:checked + .label { background-color: ${inputActiveBackground.toString()}; }`);
        }
    });
});
//# sourceMappingURL=findWidget.js.map