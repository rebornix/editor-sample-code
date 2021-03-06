/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/errors", "vs/base/common/event", "vs/base/common/lifecycle", "vs/base/common/strings", "vs/base/common/uri", "vs/editor/common/config/editorOptions", "vs/editor/common/core/position", "vs/editor/common/core/range", "vs/editor/common/core/selection", "vs/editor/common/model", "vs/editor/common/model/editStack", "vs/editor/common/model/indentationGuesser", "vs/editor/common/model/intervalTree", "vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBufferBuilder", "vs/editor/common/model/textModelEvents", "vs/editor/common/model/textModelSearch", "vs/editor/common/model/textModelTokens", "vs/editor/common/model/wordHelper", "vs/editor/common/modes/languageConfigurationRegistry", "vs/editor/common/modes/nullMode", "vs/editor/common/modes/supports", "vs/editor/common/modes/supports/richEditBrackets", "vs/base/common/types", "vs/editor/common/model/tokensStore", "vs/base/common/color"], function (require, exports, errors_1, event_1, lifecycle_1, strings, uri_1, editorOptions_1, position_1, range_1, selection_1, model, editStack_1, indentationGuesser_1, intervalTree_1, pieceTreeTextBufferBuilder_1, textModelEvents_1, textModelSearch_1, textModelTokens_1, wordHelper_1, languageConfigurationRegistry_1, nullMode_1, supports_1, richEditBrackets_1, types_1, tokensStore_1, color_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function createTextBufferBuilder() {
        return new pieceTreeTextBufferBuilder_1.PieceTreeTextBufferBuilder();
    }
    function createTextBufferFactory(text) {
        const builder = createTextBufferBuilder();
        builder.acceptChunk(text);
        return builder.finish();
    }
    exports.createTextBufferFactory = createTextBufferFactory;
    function createTextBufferFactoryFromStream(stream, filter, validator) {
        return new Promise((resolve, reject) => {
            const builder = createTextBufferBuilder();
            let done = false;
            stream.on('data', (chunk) => {
                if (validator) {
                    const error = validator(chunk);
                    if (error) {
                        done = true;
                        reject(error);
                    }
                }
                if (filter) {
                    chunk = filter(chunk);
                }
                builder.acceptChunk((typeof chunk === 'string') ? chunk : chunk.toString());
            });
            stream.on('error', (error) => {
                if (!done) {
                    done = true;
                    reject(error);
                }
            });
            stream.on('end', () => {
                if (!done) {
                    done = true;
                    resolve(builder.finish());
                }
            });
        });
    }
    exports.createTextBufferFactoryFromStream = createTextBufferFactoryFromStream;
    function createTextBufferFactoryFromSnapshot(snapshot) {
        let builder = createTextBufferBuilder();
        let chunk;
        while (typeof (chunk = snapshot.read()) === 'string') {
            builder.acceptChunk(chunk);
        }
        return builder.finish();
    }
    exports.createTextBufferFactoryFromSnapshot = createTextBufferFactoryFromSnapshot;
    function createTextBuffer(value, defaultEOL) {
        const factory = (typeof value === 'string' ? createTextBufferFactory(value) : value);
        return factory.create(defaultEOL);
    }
    exports.createTextBuffer = createTextBuffer;
    let MODEL_ID = 0;
    /**
     * Produces 'a'-'z', followed by 'A'-'Z'... followed by 'a'-'z', etc.
     */
    function singleLetter(result) {
        const LETTERS_CNT = (90 /* Z */ - 65 /* A */ + 1);
        result = result % (2 * LETTERS_CNT);
        if (result < LETTERS_CNT) {
            return String.fromCharCode(97 /* a */ + result);
        }
        return String.fromCharCode(65 /* A */ + result - LETTERS_CNT);
    }
    const LIMIT_FIND_COUNT = 999;
    exports.LONG_LINE_BOUNDARY = 10000;
    class TextModelSnapshot {
        constructor(source) {
            this._source = source;
            this._eos = false;
        }
        read() {
            if (this._eos) {
                return null;
            }
            let result = [], resultCnt = 0, resultLength = 0;
            do {
                let tmp = this._source.read();
                if (tmp === null) {
                    // end-of-stream
                    this._eos = true;
                    if (resultCnt === 0) {
                        return null;
                    }
                    else {
                        return result.join('');
                    }
                }
                if (tmp.length > 0) {
                    result[resultCnt++] = tmp;
                    resultLength += tmp.length;
                }
                if (resultLength >= 64 * 1024) {
                    return result.join('');
                }
            } while (true);
        }
    }
    const invalidFunc = () => { throw new Error(`Invalid change accessor`); };
    class TextModel extends lifecycle_1.Disposable {
        //#endregion
        constructor(source, creationOptions, languageIdentifier, associatedResource = null) {
            super();
            //#region Events
            this._onWillDispose = this._register(new event_1.Emitter());
            this.onWillDispose = this._onWillDispose.event;
            this._onDidChangeDecorations = this._register(new DidChangeDecorationsEmitter());
            this.onDidChangeDecorations = this._onDidChangeDecorations.event;
            this._onDidChangeLanguage = this._register(new event_1.Emitter());
            this.onDidChangeLanguage = this._onDidChangeLanguage.event;
            this._onDidChangeLanguageConfiguration = this._register(new event_1.Emitter());
            this.onDidChangeLanguageConfiguration = this._onDidChangeLanguageConfiguration.event;
            this._onDidChangeTokens = this._register(new event_1.Emitter());
            this.onDidChangeTokens = this._onDidChangeTokens.event;
            this._onDidChangeOptions = this._register(new event_1.Emitter());
            this.onDidChangeOptions = this._onDidChangeOptions.event;
            this._onDidChangeAttached = this._register(new event_1.Emitter());
            this.onDidChangeAttached = this._onDidChangeAttached.event;
            this._eventEmitter = this._register(new DidChangeContentEmitter());
            // Generate a new unique model id
            MODEL_ID++;
            this.id = '$model' + MODEL_ID;
            this.isForSimpleWidget = creationOptions.isForSimpleWidget;
            if (typeof associatedResource === 'undefined' || associatedResource === null) {
                this._associatedResource = uri_1.URI.parse('inmemory://model/' + MODEL_ID);
            }
            else {
                this._associatedResource = associatedResource;
            }
            this._attachedEditorCount = 0;
            this._buffer = createTextBuffer(source, creationOptions.defaultEOL);
            this._options = TextModel.resolveOptions(this._buffer, creationOptions);
            const bufferLineCount = this._buffer.getLineCount();
            const bufferTextLength = this._buffer.getValueLengthInRange(new range_1.Range(1, 1, bufferLineCount, this._buffer.getLineLength(bufferLineCount) + 1), 0 /* TextDefined */);
            // !!! Make a decision in the ctor and permanently respect this decision !!!
            // If a model is too large at construction time, it will never get tokenized,
            // under no circumstances.
            if (creationOptions.largeFileOptimizations) {
                this._isTooLargeForTokenization = ((bufferTextLength > TextModel.LARGE_FILE_SIZE_THRESHOLD)
                    || (bufferLineCount > TextModel.LARGE_FILE_LINE_COUNT_THRESHOLD));
            }
            else {
                this._isTooLargeForTokenization = false;
            }
            this._isTooLargeForSyncing = (bufferTextLength > TextModel.MODEL_SYNC_LIMIT);
            this._setVersionId(1);
            this._isDisposed = false;
            this._isDisposing = false;
            this._languageIdentifier = languageIdentifier || nullMode_1.NULL_LANGUAGE_IDENTIFIER;
            this._languageRegistryListener = languageConfigurationRegistry_1.LanguageConfigurationRegistry.onDidChange((e) => {
                if (e.languageIdentifier.id === this._languageIdentifier.id) {
                    this._onDidChangeLanguageConfiguration.fire({});
                }
            });
            this._instanceId = singleLetter(MODEL_ID);
            this._lastDecorationId = 0;
            this._decorations = Object.create(null);
            this._decorationsTree = new DecorationsTrees();
            this._commandManager = new editStack_1.EditStack(this);
            this._isUndoing = false;
            this._isRedoing = false;
            this._trimAutoWhitespaceLines = null;
            this._tokens = new tokensStore_1.TokensStore();
            this._tokenization = new textModelTokens_1.TextModelTokenization(this);
        }
        static createFromString(text, options = TextModel.DEFAULT_CREATION_OPTIONS, languageIdentifier = null, uri = null) {
            return new TextModel(text, options, languageIdentifier, uri);
        }
        static resolveOptions(textBuffer, options) {
            if (options.detectIndentation) {
                const guessedIndentation = indentationGuesser_1.guessIndentation(textBuffer, options.tabSize, options.insertSpaces);
                return new model.TextModelResolvedOptions({
                    tabSize: guessedIndentation.tabSize,
                    indentSize: guessedIndentation.tabSize,
                    insertSpaces: guessedIndentation.insertSpaces,
                    trimAutoWhitespace: options.trimAutoWhitespace,
                    defaultEOL: options.defaultEOL
                });
            }
            return new model.TextModelResolvedOptions({
                tabSize: options.tabSize,
                indentSize: options.indentSize,
                insertSpaces: options.insertSpaces,
                trimAutoWhitespace: options.trimAutoWhitespace,
                defaultEOL: options.defaultEOL
            });
        }
        onDidChangeRawContentFast(listener) {
            return this._eventEmitter.fastEvent((e) => listener(e.rawContentChangedEvent));
        }
        onDidChangeRawContent(listener) {
            return this._eventEmitter.slowEvent((e) => listener(e.rawContentChangedEvent));
        }
        onDidChangeContentFast(listener) {
            return this._eventEmitter.fastEvent((e) => listener(e.contentChangedEvent));
        }
        onDidChangeContent(listener) {
            return this._eventEmitter.slowEvent((e) => listener(e.contentChangedEvent));
        }
        dispose() {
            this._isDisposing = true;
            this._onWillDispose.fire();
            this._languageRegistryListener.dispose();
            this._tokenization.dispose();
            this._isDisposed = true;
            super.dispose();
            this._isDisposing = false;
        }
        _assertNotDisposed() {
            if (this._isDisposed) {
                throw new Error('Model is disposed!');
            }
        }
        equalsTextBuffer(other) {
            this._assertNotDisposed();
            return this._buffer.equals(other);
        }
        _emitContentChangedEvent(rawChange, change) {
            if (this._isDisposing) {
                // Do not confuse listeners by emitting any event after disposing
                return;
            }
            this._eventEmitter.fire(new textModelEvents_1.InternalModelContentChangeEvent(rawChange, change));
        }
        setValue(value) {
            this._assertNotDisposed();
            if (value === null) {
                // There's nothing to do
                return;
            }
            const textBuffer = createTextBuffer(value, this._options.defaultEOL);
            this.setValueFromTextBuffer(textBuffer);
        }
        _createContentChanged2(range, rangeOffset, rangeLength, text, isUndoing, isRedoing, isFlush) {
            return {
                changes: [{
                        range: range,
                        rangeOffset: rangeOffset,
                        rangeLength: rangeLength,
                        text: text,
                    }],
                eol: this._buffer.getEOL(),
                versionId: this.getVersionId(),
                isUndoing: isUndoing,
                isRedoing: isRedoing,
                isFlush: isFlush
            };
        }
        setValueFromTextBuffer(textBuffer) {
            this._assertNotDisposed();
            if (textBuffer === null) {
                // There's nothing to do
                return;
            }
            const oldFullModelRange = this.getFullModelRange();
            const oldModelValueLength = this.getValueLengthInRange(oldFullModelRange);
            const endLineNumber = this.getLineCount();
            const endColumn = this.getLineMaxColumn(endLineNumber);
            this._buffer = textBuffer;
            this._increaseVersionId();
            // Flush all tokens
            this._tokens.flush();
            // Destroy all my decorations
            this._decorations = Object.create(null);
            this._decorationsTree = new DecorationsTrees();
            // Destroy my edit history and settings
            this._commandManager = new editStack_1.EditStack(this);
            this._trimAutoWhitespaceLines = null;
            this._emitContentChangedEvent(new textModelEvents_1.ModelRawContentChangedEvent([
                new textModelEvents_1.ModelRawFlush()
            ], this._versionId, false, false), this._createContentChanged2(new range_1.Range(1, 1, endLineNumber, endColumn), 0, oldModelValueLength, this.getValue(), false, false, true));
        }
        setEOL(eol) {
            this._assertNotDisposed();
            const newEOL = (eol === 1 /* CRLF */ ? '\r\n' : '\n');
            if (this._buffer.getEOL() === newEOL) {
                // Nothing to do
                return;
            }
            const oldFullModelRange = this.getFullModelRange();
            const oldModelValueLength = this.getValueLengthInRange(oldFullModelRange);
            const endLineNumber = this.getLineCount();
            const endColumn = this.getLineMaxColumn(endLineNumber);
            this._onBeforeEOLChange();
            this._buffer.setEOL(newEOL);
            this._increaseVersionId();
            this._onAfterEOLChange();
            this._emitContentChangedEvent(new textModelEvents_1.ModelRawContentChangedEvent([
                new textModelEvents_1.ModelRawEOLChanged()
            ], this._versionId, false, false), this._createContentChanged2(new range_1.Range(1, 1, endLineNumber, endColumn), 0, oldModelValueLength, this.getValue(), false, false, false));
        }
        _onBeforeEOLChange() {
            // Ensure all decorations get their `range` set.
            const versionId = this.getVersionId();
            const allDecorations = this._decorationsTree.search(0, false, false, versionId);
            this._ensureNodesHaveRanges(allDecorations);
        }
        _onAfterEOLChange() {
            // Transform back `range` to offsets
            const versionId = this.getVersionId();
            const allDecorations = this._decorationsTree.collectNodesPostOrder();
            for (let i = 0, len = allDecorations.length; i < len; i++) {
                const node = allDecorations[i];
                const delta = node.cachedAbsoluteStart - node.start;
                const startOffset = this._buffer.getOffsetAt(node.range.startLineNumber, node.range.startColumn);
                const endOffset = this._buffer.getOffsetAt(node.range.endLineNumber, node.range.endColumn);
                node.cachedAbsoluteStart = startOffset;
                node.cachedAbsoluteEnd = endOffset;
                node.cachedVersionId = versionId;
                node.start = startOffset - delta;
                node.end = endOffset - delta;
                intervalTree_1.recomputeMaxEnd(node);
            }
        }
        onBeforeAttached() {
            this._attachedEditorCount++;
            if (this._attachedEditorCount === 1) {
                this._onDidChangeAttached.fire(undefined);
            }
        }
        onBeforeDetached() {
            this._attachedEditorCount--;
            if (this._attachedEditorCount === 0) {
                this._onDidChangeAttached.fire(undefined);
            }
        }
        isAttachedToEditor() {
            return this._attachedEditorCount > 0;
        }
        getAttachedEditorCount() {
            return this._attachedEditorCount;
        }
        isTooLargeForSyncing() {
            return this._isTooLargeForSyncing;
        }
        isTooLargeForTokenization() {
            return this._isTooLargeForTokenization;
        }
        isDisposed() {
            return this._isDisposed;
        }
        isDominatedByLongLines() {
            this._assertNotDisposed();
            if (this.isTooLargeForTokenization()) {
                // Cannot word wrap huge files anyways, so it doesn't really matter
                return false;
            }
            let smallLineCharCount = 0;
            let longLineCharCount = 0;
            const lineCount = this._buffer.getLineCount();
            for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
                const lineLength = this._buffer.getLineLength(lineNumber);
                if (lineLength >= exports.LONG_LINE_BOUNDARY) {
                    longLineCharCount += lineLength;
                }
                else {
                    smallLineCharCount += lineLength;
                }
            }
            return (longLineCharCount > smallLineCharCount);
        }
        get uri() {
            return this._associatedResource;
        }
        //#region Options
        getOptions() {
            this._assertNotDisposed();
            return this._options;
        }
        getFormattingOptions() {
            return {
                tabSize: this._options.indentSize,
                insertSpaces: this._options.insertSpaces
            };
        }
        updateOptions(_newOpts) {
            this._assertNotDisposed();
            let tabSize = (typeof _newOpts.tabSize !== 'undefined') ? _newOpts.tabSize : this._options.tabSize;
            let indentSize = (typeof _newOpts.indentSize !== 'undefined') ? _newOpts.indentSize : this._options.indentSize;
            let insertSpaces = (typeof _newOpts.insertSpaces !== 'undefined') ? _newOpts.insertSpaces : this._options.insertSpaces;
            let trimAutoWhitespace = (typeof _newOpts.trimAutoWhitespace !== 'undefined') ? _newOpts.trimAutoWhitespace : this._options.trimAutoWhitespace;
            let newOpts = new model.TextModelResolvedOptions({
                tabSize: tabSize,
                indentSize: indentSize,
                insertSpaces: insertSpaces,
                defaultEOL: this._options.defaultEOL,
                trimAutoWhitespace: trimAutoWhitespace
            });
            if (this._options.equals(newOpts)) {
                return;
            }
            let e = this._options.createChangeEvent(newOpts);
            this._options = newOpts;
            this._onDidChangeOptions.fire(e);
        }
        detectIndentation(defaultInsertSpaces, defaultTabSize) {
            this._assertNotDisposed();
            let guessedIndentation = indentationGuesser_1.guessIndentation(this._buffer, defaultTabSize, defaultInsertSpaces);
            this.updateOptions({
                insertSpaces: guessedIndentation.insertSpaces,
                tabSize: guessedIndentation.tabSize,
                indentSize: guessedIndentation.tabSize,
            });
        }
        static _normalizeIndentationFromWhitespace(str, indentSize, insertSpaces) {
            let spacesCnt = 0;
            for (let i = 0; i < str.length; i++) {
                if (str.charAt(i) === '\t') {
                    spacesCnt += indentSize;
                }
                else {
                    spacesCnt++;
                }
            }
            let result = '';
            if (!insertSpaces) {
                let tabsCnt = Math.floor(spacesCnt / indentSize);
                spacesCnt = spacesCnt % indentSize;
                for (let i = 0; i < tabsCnt; i++) {
                    result += '\t';
                }
            }
            for (let i = 0; i < spacesCnt; i++) {
                result += ' ';
            }
            return result;
        }
        static normalizeIndentation(str, indentSize, insertSpaces) {
            let firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(str);
            if (firstNonWhitespaceIndex === -1) {
                firstNonWhitespaceIndex = str.length;
            }
            return TextModel._normalizeIndentationFromWhitespace(str.substring(0, firstNonWhitespaceIndex), indentSize, insertSpaces) + str.substring(firstNonWhitespaceIndex);
        }
        normalizeIndentation(str) {
            this._assertNotDisposed();
            return TextModel.normalizeIndentation(str, this._options.indentSize, this._options.insertSpaces);
        }
        //#endregion
        //#region Reading
        getVersionId() {
            this._assertNotDisposed();
            return this._versionId;
        }
        mightContainRTL() {
            return this._buffer.mightContainRTL();
        }
        mightContainNonBasicASCII() {
            return this._buffer.mightContainNonBasicASCII();
        }
        getAlternativeVersionId() {
            this._assertNotDisposed();
            return this._alternativeVersionId;
        }
        getOffsetAt(rawPosition) {
            this._assertNotDisposed();
            let position = this._validatePosition(rawPosition.lineNumber, rawPosition.column, false);
            return this._buffer.getOffsetAt(position.lineNumber, position.column);
        }
        getPositionAt(rawOffset) {
            this._assertNotDisposed();
            let offset = (Math.min(this._buffer.getLength(), Math.max(0, rawOffset)));
            return this._buffer.getPositionAt(offset);
        }
        _increaseVersionId() {
            this._setVersionId(this._versionId + 1);
        }
        _setVersionId(newVersionId) {
            this._versionId = newVersionId;
            this._alternativeVersionId = this._versionId;
        }
        _overwriteAlternativeVersionId(newAlternativeVersionId) {
            this._alternativeVersionId = newAlternativeVersionId;
        }
        getValue(eol, preserveBOM = false) {
            this._assertNotDisposed();
            const fullModelRange = this.getFullModelRange();
            const fullModelValue = this.getValueInRange(fullModelRange, eol);
            if (preserveBOM) {
                return this._buffer.getBOM() + fullModelValue;
            }
            return fullModelValue;
        }
        createSnapshot(preserveBOM = false) {
            return new TextModelSnapshot(this._buffer.createSnapshot(preserveBOM));
        }
        getValueLength(eol, preserveBOM = false) {
            this._assertNotDisposed();
            const fullModelRange = this.getFullModelRange();
            const fullModelValue = this.getValueLengthInRange(fullModelRange, eol);
            if (preserveBOM) {
                return this._buffer.getBOM().length + fullModelValue;
            }
            return fullModelValue;
        }
        getValueInRange(rawRange, eol = 0 /* TextDefined */) {
            this._assertNotDisposed();
            return this._buffer.getValueInRange(this.validateRange(rawRange), eol);
        }
        getValueLengthInRange(rawRange, eol = 0 /* TextDefined */) {
            this._assertNotDisposed();
            return this._buffer.getValueLengthInRange(this.validateRange(rawRange), eol);
        }
        getLineCount() {
            this._assertNotDisposed();
            return this._buffer.getLineCount();
        }
        getLineContent(lineNumber) {
            this._assertNotDisposed();
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._buffer.getLineContent(lineNumber);
        }
        getLineLength(lineNumber) {
            this._assertNotDisposed();
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._buffer.getLineLength(lineNumber);
        }
        getLinesContent() {
            this._assertNotDisposed();
            return this._buffer.getLinesContent();
        }
        getEOL() {
            this._assertNotDisposed();
            return this._buffer.getEOL();
        }
        getLineMinColumn(lineNumber) {
            this._assertNotDisposed();
            return 1;
        }
        getLineMaxColumn(lineNumber) {
            this._assertNotDisposed();
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._buffer.getLineLength(lineNumber) + 1;
        }
        getLineFirstNonWhitespaceColumn(lineNumber) {
            this._assertNotDisposed();
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._buffer.getLineFirstNonWhitespaceColumn(lineNumber);
        }
        getLineLastNonWhitespaceColumn(lineNumber) {
            this._assertNotDisposed();
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._buffer.getLineLastNonWhitespaceColumn(lineNumber);
        }
        /**
         * Validates `range` is within buffer bounds, but allows it to sit in between surrogate pairs, etc.
         * Will try to not allocate if possible.
         */
        _validateRangeRelaxedNoAllocations(range) {
            const linesCount = this._buffer.getLineCount();
            const initialStartLineNumber = range.startLineNumber;
            const initialStartColumn = range.startColumn;
            let startLineNumber;
            let startColumn;
            if (initialStartLineNumber < 1) {
                startLineNumber = 1;
                startColumn = 1;
            }
            else if (initialStartLineNumber > linesCount) {
                startLineNumber = linesCount;
                startColumn = this.getLineMaxColumn(startLineNumber);
            }
            else {
                startLineNumber = initialStartLineNumber | 0;
                if (initialStartColumn <= 1) {
                    startColumn = 1;
                }
                else {
                    const maxColumn = this.getLineMaxColumn(startLineNumber);
                    if (initialStartColumn >= maxColumn) {
                        startColumn = maxColumn;
                    }
                    else {
                        startColumn = initialStartColumn | 0;
                    }
                }
            }
            const initialEndLineNumber = range.endLineNumber;
            const initialEndColumn = range.endColumn;
            let endLineNumber;
            let endColumn;
            if (initialEndLineNumber < 1) {
                endLineNumber = 1;
                endColumn = 1;
            }
            else if (initialEndLineNumber > linesCount) {
                endLineNumber = linesCount;
                endColumn = this.getLineMaxColumn(endLineNumber);
            }
            else {
                endLineNumber = initialEndLineNumber | 0;
                if (initialEndColumn <= 1) {
                    endColumn = 1;
                }
                else {
                    const maxColumn = this.getLineMaxColumn(endLineNumber);
                    if (initialEndColumn >= maxColumn) {
                        endColumn = maxColumn;
                    }
                    else {
                        endColumn = initialEndColumn | 0;
                    }
                }
            }
            if (initialStartLineNumber === startLineNumber
                && initialStartColumn === startColumn
                && initialEndLineNumber === endLineNumber
                && initialEndColumn === endColumn
                && range instanceof range_1.Range
                && !(range instanceof selection_1.Selection)) {
                return range;
            }
            return new range_1.Range(startLineNumber, startColumn, endLineNumber, endColumn);
        }
        /**
         * @param strict Do NOT allow a position inside a high-low surrogate pair
         */
        _isValidPosition(lineNumber, column, strict) {
            if (typeof lineNumber !== 'number' || typeof column !== 'number') {
                return false;
            }
            if (isNaN(lineNumber) || isNaN(column)) {
                return false;
            }
            if (lineNumber < 1 || column < 1) {
                return false;
            }
            if ((lineNumber | 0) !== lineNumber || (column | 0) !== column) {
                return false;
            }
            const lineCount = this._buffer.getLineCount();
            if (lineNumber > lineCount) {
                return false;
            }
            const maxColumn = this.getLineMaxColumn(lineNumber);
            if (column > maxColumn) {
                return false;
            }
            if (strict) {
                if (column > 1) {
                    const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
                    if (strings.isHighSurrogate(charCodeBefore)) {
                        return false;
                    }
                }
            }
            return true;
        }
        /**
         * @param strict Do NOT allow a position inside a high-low surrogate pair
         */
        _validatePosition(_lineNumber, _column, strict) {
            const lineNumber = Math.floor((typeof _lineNumber === 'number' && !isNaN(_lineNumber)) ? _lineNumber : 1);
            const column = Math.floor((typeof _column === 'number' && !isNaN(_column)) ? _column : 1);
            const lineCount = this._buffer.getLineCount();
            if (lineNumber < 1) {
                return new position_1.Position(1, 1);
            }
            if (lineNumber > lineCount) {
                return new position_1.Position(lineCount, this.getLineMaxColumn(lineCount));
            }
            if (column <= 1) {
                return new position_1.Position(lineNumber, 1);
            }
            const maxColumn = this.getLineMaxColumn(lineNumber);
            if (column >= maxColumn) {
                return new position_1.Position(lineNumber, maxColumn);
            }
            if (strict) {
                // If the position would end up in the middle of a high-low surrogate pair,
                // we move it to before the pair
                // !!At this point, column > 1
                const charCodeBefore = this._buffer.getLineCharCode(lineNumber, column - 2);
                if (strings.isHighSurrogate(charCodeBefore)) {
                    return new position_1.Position(lineNumber, column - 1);
                }
            }
            return new position_1.Position(lineNumber, column);
        }
        validatePosition(position) {
            this._assertNotDisposed();
            // Avoid object allocation and cover most likely case
            if (position instanceof position_1.Position) {
                if (this._isValidPosition(position.lineNumber, position.column, true)) {
                    return position;
                }
            }
            return this._validatePosition(position.lineNumber, position.column, true);
        }
        /**
         * @param strict Do NOT allow a range to have its boundaries inside a high-low surrogate pair
         */
        _isValidRange(range, strict) {
            const startLineNumber = range.startLineNumber;
            const startColumn = range.startColumn;
            const endLineNumber = range.endLineNumber;
            const endColumn = range.endColumn;
            if (!this._isValidPosition(startLineNumber, startColumn, false)) {
                return false;
            }
            if (!this._isValidPosition(endLineNumber, endColumn, false)) {
                return false;
            }
            if (strict) {
                const charCodeBeforeStart = (startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0);
                const charCodeBeforeEnd = (endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0);
                const startInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeStart);
                const endInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeEnd);
                if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
                    return true;
                }
                return false;
            }
            return true;
        }
        validateRange(_range) {
            this._assertNotDisposed();
            // Avoid object allocation and cover most likely case
            if ((_range instanceof range_1.Range) && !(_range instanceof selection_1.Selection)) {
                if (this._isValidRange(_range, true)) {
                    return _range;
                }
            }
            const start = this._validatePosition(_range.startLineNumber, _range.startColumn, false);
            const end = this._validatePosition(_range.endLineNumber, _range.endColumn, false);
            const startLineNumber = start.lineNumber;
            const startColumn = start.column;
            const endLineNumber = end.lineNumber;
            const endColumn = end.column;
            const charCodeBeforeStart = (startColumn > 1 ? this._buffer.getLineCharCode(startLineNumber, startColumn - 2) : 0);
            const charCodeBeforeEnd = (endColumn > 1 && endColumn <= this._buffer.getLineLength(endLineNumber) ? this._buffer.getLineCharCode(endLineNumber, endColumn - 2) : 0);
            const startInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeStart);
            const endInsideSurrogatePair = strings.isHighSurrogate(charCodeBeforeEnd);
            if (!startInsideSurrogatePair && !endInsideSurrogatePair) {
                return new range_1.Range(startLineNumber, startColumn, endLineNumber, endColumn);
            }
            if (startLineNumber === endLineNumber && startColumn === endColumn) {
                // do not expand a collapsed range, simply move it to a valid location
                return new range_1.Range(startLineNumber, startColumn - 1, endLineNumber, endColumn - 1);
            }
            if (startInsideSurrogatePair && endInsideSurrogatePair) {
                // expand range at both ends
                return new range_1.Range(startLineNumber, startColumn - 1, endLineNumber, endColumn + 1);
            }
            if (startInsideSurrogatePair) {
                // only expand range at the start
                return new range_1.Range(startLineNumber, startColumn - 1, endLineNumber, endColumn);
            }
            // only expand range at the end
            return new range_1.Range(startLineNumber, startColumn, endLineNumber, endColumn + 1);
        }
        modifyPosition(rawPosition, offset) {
            this._assertNotDisposed();
            let candidate = this.getOffsetAt(rawPosition) + offset;
            return this.getPositionAt(Math.min(this._buffer.getLength(), Math.max(0, candidate)));
        }
        getFullModelRange() {
            this._assertNotDisposed();
            const lineCount = this.getLineCount();
            return new range_1.Range(1, 1, lineCount, this.getLineMaxColumn(lineCount));
        }
        findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount) {
            return this._buffer.findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount);
        }
        findMatches(searchString, rawSearchScope, isRegex, matchCase, wordSeparators, captureMatches, limitResultCount = LIMIT_FIND_COUNT) {
            this._assertNotDisposed();
            let searchRange;
            if (range_1.Range.isIRange(rawSearchScope)) {
                searchRange = this.validateRange(rawSearchScope);
            }
            else {
                searchRange = this.getFullModelRange();
            }
            if (!isRegex && searchString.indexOf('\n') < 0) {
                // not regex, not multi line
                const searchParams = new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators);
                const searchData = searchParams.parseSearchRequest();
                if (!searchData) {
                    return [];
                }
                return this.findMatchesLineByLine(searchRange, searchData, captureMatches, limitResultCount);
            }
            return textModelSearch_1.TextModelSearch.findMatches(this, new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators), searchRange, captureMatches, limitResultCount);
        }
        findNextMatch(searchString, rawSearchStart, isRegex, matchCase, wordSeparators, captureMatches) {
            this._assertNotDisposed();
            const searchStart = this.validatePosition(rawSearchStart);
            if (!isRegex && searchString.indexOf('\n') < 0) {
                const searchParams = new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators);
                const searchData = searchParams.parseSearchRequest();
                if (!searchData) {
                    return null;
                }
                const lineCount = this.getLineCount();
                let searchRange = new range_1.Range(searchStart.lineNumber, searchStart.column, lineCount, this.getLineMaxColumn(lineCount));
                let ret = this.findMatchesLineByLine(searchRange, searchData, captureMatches, 1);
                textModelSearch_1.TextModelSearch.findNextMatch(this, new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
                if (ret.length > 0) {
                    return ret[0];
                }
                searchRange = new range_1.Range(1, 1, searchStart.lineNumber, this.getLineMaxColumn(searchStart.lineNumber));
                ret = this.findMatchesLineByLine(searchRange, searchData, captureMatches, 1);
                if (ret.length > 0) {
                    return ret[0];
                }
                return null;
            }
            return textModelSearch_1.TextModelSearch.findNextMatch(this, new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
        }
        findPreviousMatch(searchString, rawSearchStart, isRegex, matchCase, wordSeparators, captureMatches) {
            this._assertNotDisposed();
            const searchStart = this.validatePosition(rawSearchStart);
            return textModelSearch_1.TextModelSearch.findPreviousMatch(this, new textModelSearch_1.SearchParams(searchString, isRegex, matchCase, wordSeparators), searchStart, captureMatches);
        }
        //#endregion
        //#region Editing
        pushStackElement() {
            this._commandManager.pushStackElement();
        }
        pushEOL(eol) {
            const currentEOL = (this.getEOL() === '\n' ? 0 /* LF */ : 1 /* CRLF */);
            if (currentEOL === eol) {
                return;
            }
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._eventEmitter.beginDeferredEmit();
                this._commandManager.pushEOL(eol);
            }
            finally {
                this._eventEmitter.endDeferredEmit();
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        pushEditOperations(beforeCursorState, editOperations, cursorStateComputer) {
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._eventEmitter.beginDeferredEmit();
                return this._pushEditOperations(beforeCursorState, editOperations, cursorStateComputer);
            }
            finally {
                this._eventEmitter.endDeferredEmit();
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        _pushEditOperations(beforeCursorState, editOperations, cursorStateComputer) {
            if (this._options.trimAutoWhitespace && this._trimAutoWhitespaceLines) {
                // Go through each saved line number and insert a trim whitespace edit
                // if it is safe to do so (no conflicts with other edits).
                let incomingEdits = editOperations.map((op) => {
                    return {
                        range: this.validateRange(op.range),
                        text: op.text
                    };
                });
                // Sometimes, auto-formatters change ranges automatically which can cause undesired auto whitespace trimming near the cursor
                // We'll use the following heuristic: if the edits occur near the cursor, then it's ok to trim auto whitespace
                let editsAreNearCursors = true;
                for (let i = 0, len = beforeCursorState.length; i < len; i++) {
                    let sel = beforeCursorState[i];
                    let foundEditNearSel = false;
                    for (let j = 0, lenJ = incomingEdits.length; j < lenJ; j++) {
                        let editRange = incomingEdits[j].range;
                        let selIsAbove = editRange.startLineNumber > sel.endLineNumber;
                        let selIsBelow = sel.startLineNumber > editRange.endLineNumber;
                        if (!selIsAbove && !selIsBelow) {
                            foundEditNearSel = true;
                            break;
                        }
                    }
                    if (!foundEditNearSel) {
                        editsAreNearCursors = false;
                        break;
                    }
                }
                if (editsAreNearCursors) {
                    for (let i = 0, len = this._trimAutoWhitespaceLines.length; i < len; i++) {
                        let trimLineNumber = this._trimAutoWhitespaceLines[i];
                        let maxLineColumn = this.getLineMaxColumn(trimLineNumber);
                        let allowTrimLine = true;
                        for (let j = 0, lenJ = incomingEdits.length; j < lenJ; j++) {
                            let editRange = incomingEdits[j].range;
                            let editText = incomingEdits[j].text;
                            if (trimLineNumber < editRange.startLineNumber || trimLineNumber > editRange.endLineNumber) {
                                // `trimLine` is completely outside this edit
                                continue;
                            }
                            // At this point:
                            //   editRange.startLineNumber <= trimLine <= editRange.endLineNumber
                            if (trimLineNumber === editRange.startLineNumber && editRange.startColumn === maxLineColumn
                                && editRange.isEmpty() && editText && editText.length > 0 && editText.charAt(0) === '\n') {
                                // This edit inserts a new line (and maybe other text) after `trimLine`
                                continue;
                            }
                            if (trimLineNumber === editRange.startLineNumber && editRange.startColumn === 1
                                && editRange.isEmpty() && editText && editText.length > 0 && editText.charAt(editText.length - 1) === '\n') {
                                // This edit inserts a new line (and maybe other text) before `trimLine`
                                continue;
                            }
                            // Looks like we can't trim this line as it would interfere with an incoming edit
                            allowTrimLine = false;
                            break;
                        }
                        if (allowTrimLine) {
                            editOperations.push({
                                range: new range_1.Range(trimLineNumber, 1, trimLineNumber, maxLineColumn),
                                text: null
                            });
                        }
                    }
                }
                this._trimAutoWhitespaceLines = null;
            }
            return this._commandManager.pushEditOperation(beforeCursorState, editOperations, cursorStateComputer);
        }
        applyEdits(rawOperations) {
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._eventEmitter.beginDeferredEmit();
                return this._applyEdits(rawOperations);
            }
            finally {
                this._eventEmitter.endDeferredEmit();
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        _applyEdits(rawOperations) {
            for (let i = 0, len = rawOperations.length; i < len; i++) {
                rawOperations[i].range = this.validateRange(rawOperations[i].range);
            }
            const oldLineCount = this._buffer.getLineCount();
            const result = this._buffer.applyEdits(rawOperations, this._options.trimAutoWhitespace);
            const newLineCount = this._buffer.getLineCount();
            const contentChanges = result.changes;
            this._trimAutoWhitespaceLines = result.trimAutoWhitespaceLineNumbers;
            if (contentChanges.length !== 0) {
                let rawContentChanges = [];
                let lineCount = oldLineCount;
                for (let i = 0, len = contentChanges.length; i < len; i++) {
                    const change = contentChanges[i];
                    const [eolCount, firstLineLength] = textModelTokens_1.countEOL(change.text);
                    this._tokens.applyEdits(change.range, eolCount, firstLineLength);
                    this._onDidChangeDecorations.fire();
                    this._decorationsTree.acceptReplace(change.rangeOffset, change.rangeLength, change.text.length, change.forceMoveMarkers);
                    const startLineNumber = change.range.startLineNumber;
                    const endLineNumber = change.range.endLineNumber;
                    const deletingLinesCnt = endLineNumber - startLineNumber;
                    const insertingLinesCnt = eolCount;
                    const editingLinesCnt = Math.min(deletingLinesCnt, insertingLinesCnt);
                    const changeLineCountDelta = (insertingLinesCnt - deletingLinesCnt);
                    for (let j = editingLinesCnt; j >= 0; j--) {
                        const editLineNumber = startLineNumber + j;
                        const currentEditLineNumber = newLineCount - lineCount - changeLineCountDelta + editLineNumber;
                        rawContentChanges.push(new textModelEvents_1.ModelRawLineChanged(editLineNumber, this.getLineContent(currentEditLineNumber)));
                    }
                    if (editingLinesCnt < deletingLinesCnt) {
                        // Must delete some lines
                        const spliceStartLineNumber = startLineNumber + editingLinesCnt;
                        rawContentChanges.push(new textModelEvents_1.ModelRawLinesDeleted(spliceStartLineNumber + 1, endLineNumber));
                    }
                    if (editingLinesCnt < insertingLinesCnt) {
                        // Must insert some lines
                        const spliceLineNumber = startLineNumber + editingLinesCnt;
                        const cnt = insertingLinesCnt - editingLinesCnt;
                        const fromLineNumber = newLineCount - lineCount - cnt + spliceLineNumber + 1;
                        let newLines = [];
                        for (let i = 0; i < cnt; i++) {
                            let lineNumber = fromLineNumber + i;
                            newLines[lineNumber - fromLineNumber] = this.getLineContent(lineNumber);
                        }
                        rawContentChanges.push(new textModelEvents_1.ModelRawLinesInserted(spliceLineNumber + 1, startLineNumber + insertingLinesCnt, newLines));
                    }
                    lineCount += changeLineCountDelta;
                }
                this._increaseVersionId();
                this._emitContentChangedEvent(new textModelEvents_1.ModelRawContentChangedEvent(rawContentChanges, this.getVersionId(), this._isUndoing, this._isRedoing), {
                    changes: contentChanges,
                    eol: this._buffer.getEOL(),
                    versionId: this.getVersionId(),
                    isUndoing: this._isUndoing,
                    isRedoing: this._isRedoing,
                    isFlush: false
                });
            }
            return result.reverseEdits;
        }
        _undo() {
            this._isUndoing = true;
            let r = this._commandManager.undo();
            this._isUndoing = false;
            if (!r) {
                return null;
            }
            this._overwriteAlternativeVersionId(r.recordedVersionId);
            return r.selections;
        }
        undo() {
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._eventEmitter.beginDeferredEmit();
                return this._undo();
            }
            finally {
                this._eventEmitter.endDeferredEmit();
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        canUndo() {
            return this._commandManager.canUndo();
        }
        _redo() {
            this._isRedoing = true;
            let r = this._commandManager.redo();
            this._isRedoing = false;
            if (!r) {
                return null;
            }
            this._overwriteAlternativeVersionId(r.recordedVersionId);
            return r.selections;
        }
        redo() {
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._eventEmitter.beginDeferredEmit();
                return this._redo();
            }
            finally {
                this._eventEmitter.endDeferredEmit();
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        canRedo() {
            return this._commandManager.canRedo();
        }
        //#endregion
        //#region Decorations
        changeDecorations(callback, ownerId = 0) {
            this._assertNotDisposed();
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                return this._changeDecorations(ownerId, callback);
            }
            finally {
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        _changeDecorations(ownerId, callback) {
            let changeAccessor = {
                addDecoration: (range, options) => {
                    this._onDidChangeDecorations.fire();
                    return this._deltaDecorationsImpl(ownerId, [], [{ range: range, options: options }])[0];
                },
                changeDecoration: (id, newRange) => {
                    this._onDidChangeDecorations.fire();
                    this._changeDecorationImpl(id, newRange);
                },
                changeDecorationOptions: (id, options) => {
                    this._onDidChangeDecorations.fire();
                    this._changeDecorationOptionsImpl(id, _normalizeOptions(options));
                },
                removeDecoration: (id) => {
                    this._onDidChangeDecorations.fire();
                    this._deltaDecorationsImpl(ownerId, [id], []);
                },
                deltaDecorations: (oldDecorations, newDecorations) => {
                    if (oldDecorations.length === 0 && newDecorations.length === 0) {
                        // nothing to do
                        return [];
                    }
                    this._onDidChangeDecorations.fire();
                    return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
                }
            };
            let result = null;
            try {
                result = callback(changeAccessor);
            }
            catch (e) {
                errors_1.onUnexpectedError(e);
            }
            // Invalidate change accessor
            changeAccessor.addDecoration = invalidFunc;
            changeAccessor.changeDecoration = invalidFunc;
            changeAccessor.changeDecorationOptions = invalidFunc;
            changeAccessor.removeDecoration = invalidFunc;
            changeAccessor.deltaDecorations = invalidFunc;
            return result;
        }
        deltaDecorations(oldDecorations, newDecorations, ownerId = 0) {
            this._assertNotDisposed();
            if (!oldDecorations) {
                oldDecorations = [];
            }
            if (oldDecorations.length === 0 && newDecorations.length === 0) {
                // nothing to do
                return [];
            }
            try {
                this._onDidChangeDecorations.beginDeferredEmit();
                this._onDidChangeDecorations.fire();
                return this._deltaDecorationsImpl(ownerId, oldDecorations, newDecorations);
            }
            finally {
                this._onDidChangeDecorations.endDeferredEmit();
            }
        }
        _getTrackedRange(id) {
            return this.getDecorationRange(id);
        }
        _setTrackedRange(id, newRange, newStickiness) {
            const node = (id ? this._decorations[id] : null);
            if (!node) {
                if (!newRange) {
                    // node doesn't exist, the request is to delete => nothing to do
                    return null;
                }
                // node doesn't exist, the request is to set => add the tracked range
                return this._deltaDecorationsImpl(0, [], [{ range: newRange, options: TRACKED_RANGE_OPTIONS[newStickiness] }])[0];
            }
            if (!newRange) {
                // node exists, the request is to delete => delete node
                this._decorationsTree.delete(node);
                delete this._decorations[node.id];
                return null;
            }
            // node exists, the request is to set => change the tracked range and its options
            const range = this._validateRangeRelaxedNoAllocations(newRange);
            const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
            const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
            this._decorationsTree.delete(node);
            node.reset(this.getVersionId(), startOffset, endOffset, range);
            node.setOptions(TRACKED_RANGE_OPTIONS[newStickiness]);
            this._decorationsTree.insert(node);
            return node.id;
        }
        removeAllDecorationsWithOwnerId(ownerId) {
            if (this._isDisposed) {
                return;
            }
            const nodes = this._decorationsTree.collectNodesFromOwner(ownerId);
            for (let i = 0, len = nodes.length; i < len; i++) {
                const node = nodes[i];
                this._decorationsTree.delete(node);
                delete this._decorations[node.id];
            }
        }
        getDecorationOptions(decorationId) {
            const node = this._decorations[decorationId];
            if (!node) {
                return null;
            }
            return node.options;
        }
        getDecorationRange(decorationId) {
            const node = this._decorations[decorationId];
            if (!node) {
                return null;
            }
            const versionId = this.getVersionId();
            if (node.cachedVersionId !== versionId) {
                this._decorationsTree.resolveNode(node, versionId);
            }
            if (node.range === null) {
                node.range = this._getRangeAt(node.cachedAbsoluteStart, node.cachedAbsoluteEnd);
            }
            return node.range;
        }
        getLineDecorations(lineNumber, ownerId = 0, filterOutValidation = false) {
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                return [];
            }
            return this.getLinesDecorations(lineNumber, lineNumber, ownerId, filterOutValidation);
        }
        getLinesDecorations(_startLineNumber, _endLineNumber, ownerId = 0, filterOutValidation = false) {
            let lineCount = this.getLineCount();
            let startLineNumber = Math.min(lineCount, Math.max(1, _startLineNumber));
            let endLineNumber = Math.min(lineCount, Math.max(1, _endLineNumber));
            let endColumn = this.getLineMaxColumn(endLineNumber);
            return this._getDecorationsInRange(new range_1.Range(startLineNumber, 1, endLineNumber, endColumn), ownerId, filterOutValidation);
        }
        getDecorationsInRange(range, ownerId = 0, filterOutValidation = false) {
            let validatedRange = this.validateRange(range);
            return this._getDecorationsInRange(validatedRange, ownerId, filterOutValidation);
        }
        getOverviewRulerDecorations(ownerId = 0, filterOutValidation = false) {
            const versionId = this.getVersionId();
            const result = this._decorationsTree.search(ownerId, filterOutValidation, true, versionId);
            return this._ensureNodesHaveRanges(result);
        }
        getAllDecorations(ownerId = 0, filterOutValidation = false) {
            const versionId = this.getVersionId();
            const result = this._decorationsTree.search(ownerId, filterOutValidation, false, versionId);
            return this._ensureNodesHaveRanges(result);
        }
        _getDecorationsInRange(filterRange, filterOwnerId, filterOutValidation) {
            const startOffset = this._buffer.getOffsetAt(filterRange.startLineNumber, filterRange.startColumn);
            const endOffset = this._buffer.getOffsetAt(filterRange.endLineNumber, filterRange.endColumn);
            const versionId = this.getVersionId();
            const result = this._decorationsTree.intervalSearch(startOffset, endOffset, filterOwnerId, filterOutValidation, versionId);
            return this._ensureNodesHaveRanges(result);
        }
        _ensureNodesHaveRanges(nodes) {
            for (let i = 0, len = nodes.length; i < len; i++) {
                const node = nodes[i];
                if (node.range === null) {
                    node.range = this._getRangeAt(node.cachedAbsoluteStart, node.cachedAbsoluteEnd);
                }
            }
            return nodes;
        }
        _getRangeAt(start, end) {
            return this._buffer.getRangeAt(start, end - start);
        }
        _changeDecorationImpl(decorationId, _range) {
            const node = this._decorations[decorationId];
            if (!node) {
                return;
            }
            const range = this._validateRangeRelaxedNoAllocations(_range);
            const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
            const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
            this._decorationsTree.delete(node);
            node.reset(this.getVersionId(), startOffset, endOffset, range);
            this._decorationsTree.insert(node);
        }
        _changeDecorationOptionsImpl(decorationId, options) {
            const node = this._decorations[decorationId];
            if (!node) {
                return;
            }
            const nodeWasInOverviewRuler = (node.options.overviewRuler && node.options.overviewRuler.color ? true : false);
            const nodeIsInOverviewRuler = (options.overviewRuler && options.overviewRuler.color ? true : false);
            if (nodeWasInOverviewRuler !== nodeIsInOverviewRuler) {
                // Delete + Insert due to an overview ruler status change
                this._decorationsTree.delete(node);
                node.setOptions(options);
                this._decorationsTree.insert(node);
            }
            else {
                node.setOptions(options);
            }
        }
        _deltaDecorationsImpl(ownerId, oldDecorationsIds, newDecorations) {
            const versionId = this.getVersionId();
            const oldDecorationsLen = oldDecorationsIds.length;
            let oldDecorationIndex = 0;
            const newDecorationsLen = newDecorations.length;
            let newDecorationIndex = 0;
            let result = new Array(newDecorationsLen);
            while (oldDecorationIndex < oldDecorationsLen || newDecorationIndex < newDecorationsLen) {
                let node = null;
                if (oldDecorationIndex < oldDecorationsLen) {
                    // (1) get ourselves an old node
                    do {
                        node = this._decorations[oldDecorationsIds[oldDecorationIndex++]];
                    } while (!node && oldDecorationIndex < oldDecorationsLen);
                    // (2) remove the node from the tree (if it exists)
                    if (node) {
                        this._decorationsTree.delete(node);
                    }
                }
                if (newDecorationIndex < newDecorationsLen) {
                    // (3) create a new node if necessary
                    if (!node) {
                        const internalDecorationId = (++this._lastDecorationId);
                        const decorationId = `${this._instanceId};${internalDecorationId}`;
                        node = new intervalTree_1.IntervalNode(decorationId, 0, 0);
                        this._decorations[decorationId] = node;
                    }
                    // (4) initialize node
                    const newDecoration = newDecorations[newDecorationIndex];
                    const range = this._validateRangeRelaxedNoAllocations(newDecoration.range);
                    const options = _normalizeOptions(newDecoration.options);
                    const startOffset = this._buffer.getOffsetAt(range.startLineNumber, range.startColumn);
                    const endOffset = this._buffer.getOffsetAt(range.endLineNumber, range.endColumn);
                    node.ownerId = ownerId;
                    node.reset(versionId, startOffset, endOffset, range);
                    node.setOptions(options);
                    this._decorationsTree.insert(node);
                    result[newDecorationIndex] = node.id;
                    newDecorationIndex++;
                }
                else {
                    if (node) {
                        delete this._decorations[node.id];
                    }
                }
            }
            return result;
        }
        //#endregion
        //#region Tokenization
        setLineTokens(lineNumber, tokens) {
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            this._tokens.setTokens(this._languageIdentifier.id, lineNumber - 1, this._buffer.getLineLength(lineNumber), tokens);
        }
        setTokens(tokens) {
            if (tokens.length === 0) {
                return;
            }
            let ranges = [];
            for (let i = 0, len = tokens.length; i < len; i++) {
                const element = tokens[i];
                ranges.push({ fromLineNumber: element.startLineNumber, toLineNumber: element.startLineNumber + element.tokens.length - 1 });
                for (let j = 0, lenJ = element.tokens.length; j < lenJ; j++) {
                    this.setLineTokens(element.startLineNumber + j, element.tokens[j]);
                }
            }
            this._emitModelTokensChangedEvent({
                tokenizationSupportChanged: false,
                ranges: ranges
            });
        }
        tokenizeViewport(startLineNumber, endLineNumber) {
            startLineNumber = Math.max(1, startLineNumber);
            endLineNumber = Math.min(this._buffer.getLineCount(), endLineNumber);
            this._tokenization.tokenizeViewport(startLineNumber, endLineNumber);
        }
        clearTokens() {
            this._tokens.flush();
            this._emitModelTokensChangedEvent({
                tokenizationSupportChanged: true,
                ranges: [{
                        fromLineNumber: 1,
                        toLineNumber: this._buffer.getLineCount()
                    }]
            });
        }
        _emitModelTokensChangedEvent(e) {
            if (!this._isDisposing) {
                this._onDidChangeTokens.fire(e);
            }
        }
        resetTokenization() {
            this._tokenization.reset();
        }
        forceTokenization(lineNumber) {
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            this._tokenization.forceTokenization(lineNumber);
        }
        isCheapToTokenize(lineNumber) {
            return this._tokenization.isCheapToTokenize(lineNumber);
        }
        tokenizeIfCheap(lineNumber) {
            if (this.isCheapToTokenize(lineNumber)) {
                this.forceTokenization(lineNumber);
            }
        }
        getLineTokens(lineNumber) {
            if (lineNumber < 1 || lineNumber > this.getLineCount()) {
                throw new Error('Illegal value for lineNumber');
            }
            return this._getLineTokens(lineNumber);
        }
        _getLineTokens(lineNumber) {
            const lineText = this.getLineContent(lineNumber);
            return this._tokens.getTokens(this._languageIdentifier.id, lineNumber - 1, lineText);
        }
        getLanguageIdentifier() {
            return this._languageIdentifier;
        }
        getModeId() {
            return this._languageIdentifier.language;
        }
        setMode(languageIdentifier) {
            if (this._languageIdentifier.id === languageIdentifier.id) {
                // There's nothing to do
                return;
            }
            let e = {
                oldLanguage: this._languageIdentifier.language,
                newLanguage: languageIdentifier.language
            };
            this._languageIdentifier = languageIdentifier;
            this._onDidChangeLanguage.fire(e);
            this._onDidChangeLanguageConfiguration.fire({});
        }
        getLanguageIdAtPosition(lineNumber, column) {
            const position = this.validatePosition(new position_1.Position(lineNumber, column));
            const lineTokens = this.getLineTokens(position.lineNumber);
            return lineTokens.getLanguageId(lineTokens.findTokenIndexAtOffset(position.column - 1));
        }
        // Having tokens allows implementing additional helper methods
        getWordAtPosition(_position) {
            this._assertNotDisposed();
            const position = this.validatePosition(_position);
            const lineContent = this.getLineContent(position.lineNumber);
            const lineTokens = this._getLineTokens(position.lineNumber);
            const tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
            // (1). First try checking right biased word
            const [rbStartOffset, rbEndOffset] = TextModel._findLanguageBoundaries(lineTokens, tokenIndex);
            const rightBiasedWord = wordHelper_1.getWordAtText(position.column, languageConfigurationRegistry_1.LanguageConfigurationRegistry.getWordDefinition(lineTokens.getLanguageId(tokenIndex)), lineContent.substring(rbStartOffset, rbEndOffset), rbStartOffset);
            // Make sure the result touches the original passed in position
            if (rightBiasedWord && rightBiasedWord.startColumn <= _position.column && _position.column <= rightBiasedWord.endColumn) {
                return rightBiasedWord;
            }
            // (2). Else, if we were at a language boundary, check the left biased word
            if (tokenIndex > 0 && rbStartOffset === position.column - 1) {
                // edge case, where `position` sits between two tokens belonging to two different languages
                const [lbStartOffset, lbEndOffset] = TextModel._findLanguageBoundaries(lineTokens, tokenIndex - 1);
                const leftBiasedWord = wordHelper_1.getWordAtText(position.column, languageConfigurationRegistry_1.LanguageConfigurationRegistry.getWordDefinition(lineTokens.getLanguageId(tokenIndex - 1)), lineContent.substring(lbStartOffset, lbEndOffset), lbStartOffset);
                // Make sure the result touches the original passed in position
                if (leftBiasedWord && leftBiasedWord.startColumn <= _position.column && _position.column <= leftBiasedWord.endColumn) {
                    return leftBiasedWord;
                }
            }
            return null;
        }
        static _findLanguageBoundaries(lineTokens, tokenIndex) {
            const languageId = lineTokens.getLanguageId(tokenIndex);
            // go left until a different language is hit
            let startOffset = 0;
            for (let i = tokenIndex; i >= 0 && lineTokens.getLanguageId(i) === languageId; i--) {
                startOffset = lineTokens.getStartOffset(i);
            }
            // go right until a different language is hit
            let endOffset = lineTokens.getLineContent().length;
            for (let i = tokenIndex, tokenCount = lineTokens.getCount(); i < tokenCount && lineTokens.getLanguageId(i) === languageId; i++) {
                endOffset = lineTokens.getEndOffset(i);
            }
            return [startOffset, endOffset];
        }
        getWordUntilPosition(position) {
            const wordAtPosition = this.getWordAtPosition(position);
            if (!wordAtPosition) {
                return {
                    word: '',
                    startColumn: position.column,
                    endColumn: position.column
                };
            }
            return {
                word: wordAtPosition.word.substr(0, position.column - wordAtPosition.startColumn),
                startColumn: wordAtPosition.startColumn,
                endColumn: position.column
            };
        }
        findMatchingBracketUp(_bracket, _position) {
            let bracket = _bracket.toLowerCase();
            let position = this.validatePosition(_position);
            let lineTokens = this._getLineTokens(position.lineNumber);
            let languageId = lineTokens.getLanguageId(lineTokens.findTokenIndexAtOffset(position.column - 1));
            let bracketsSupport = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getBracketsSupport(languageId);
            if (!bracketsSupport) {
                return null;
            }
            let data = bracketsSupport.textIsBracket[bracket];
            if (!data) {
                return null;
            }
            return this._findMatchingBracketUp(data, position);
        }
        matchBracket(position) {
            return this._matchBracket(this.validatePosition(position));
        }
        _matchBracket(position) {
            const lineNumber = position.lineNumber;
            const lineTokens = this._getLineTokens(lineNumber);
            const lineText = this._buffer.getLineContent(lineNumber);
            let tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
            if (tokenIndex < 0) {
                return null;
            }
            const currentModeBrackets = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getBracketsSupport(lineTokens.getLanguageId(tokenIndex));
            // check that the token is not to be ignored
            if (currentModeBrackets && !supports_1.ignoreBracketsInToken(lineTokens.getStandardTokenType(tokenIndex))) {
                // limit search to not go before `maxBracketLength`
                let searchStartOffset = Math.max(lineTokens.getStartOffset(tokenIndex), position.column - 1 - currentModeBrackets.maxBracketLength);
                // limit search to not go after `maxBracketLength`
                const searchEndOffset = Math.min(lineTokens.getEndOffset(tokenIndex), position.column - 1 + currentModeBrackets.maxBracketLength);
                // it might be the case that [currentTokenStart -> currentTokenEnd] contains multiple brackets
                // `bestResult` will contain the most right-side result
                let bestResult = null;
                while (true) {
                    let foundBracket = richEditBrackets_1.BracketsUtils.findNextBracketInToken(currentModeBrackets.forwardRegex, lineNumber, lineText, searchStartOffset, searchEndOffset);
                    if (!foundBracket) {
                        // there are no more brackets in this text
                        break;
                    }
                    // check that we didn't hit a bracket too far away from position
                    if (foundBracket.startColumn <= position.column && position.column <= foundBracket.endColumn) {
                        let foundBracketText = lineText.substring(foundBracket.startColumn - 1, foundBracket.endColumn - 1);
                        foundBracketText = foundBracketText.toLowerCase();
                        let r = this._matchFoundBracket(foundBracket, currentModeBrackets.textIsBracket[foundBracketText], currentModeBrackets.textIsOpenBracket[foundBracketText]);
                        // check that we can actually match this bracket
                        if (r) {
                            bestResult = r;
                        }
                    }
                    searchStartOffset = foundBracket.endColumn - 1;
                }
                if (bestResult) {
                    return bestResult;
                }
            }
            // If position is in between two tokens, try also looking in the previous token
            if (tokenIndex > 0 && lineTokens.getStartOffset(tokenIndex) === position.column - 1) {
                const searchEndOffset = lineTokens.getStartOffset(tokenIndex);
                tokenIndex--;
                const prevModeBrackets = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getBracketsSupport(lineTokens.getLanguageId(tokenIndex));
                // check that previous token is not to be ignored
                if (prevModeBrackets && !supports_1.ignoreBracketsInToken(lineTokens.getStandardTokenType(tokenIndex))) {
                    // limit search in case previous token is very large, there's no need to go beyond `maxBracketLength`
                    const searchStartOffset = Math.max(lineTokens.getStartOffset(tokenIndex), position.column - 1 - prevModeBrackets.maxBracketLength);
                    const foundBracket = richEditBrackets_1.BracketsUtils.findPrevBracketInToken(prevModeBrackets.reversedRegex, lineNumber, lineText, searchStartOffset, searchEndOffset);
                    // check that we didn't hit a bracket too far away from position
                    if (foundBracket && foundBracket.startColumn <= position.column && position.column <= foundBracket.endColumn) {
                        let foundBracketText = lineText.substring(foundBracket.startColumn - 1, foundBracket.endColumn - 1);
                        foundBracketText = foundBracketText.toLowerCase();
                        let r = this._matchFoundBracket(foundBracket, prevModeBrackets.textIsBracket[foundBracketText], prevModeBrackets.textIsOpenBracket[foundBracketText]);
                        // check that we can actually match this bracket
                        if (r) {
                            return r;
                        }
                    }
                }
            }
            return null;
        }
        _matchFoundBracket(foundBracket, data, isOpen) {
            if (!data) {
                return null;
            }
            if (isOpen) {
                let matched = this._findMatchingBracketDown(data, foundBracket.getEndPosition());
                if (matched) {
                    return [foundBracket, matched];
                }
            }
            else {
                let matched = this._findMatchingBracketUp(data, foundBracket.getStartPosition());
                if (matched) {
                    return [foundBracket, matched];
                }
            }
            return null;
        }
        _findMatchingBracketUp(bracket, position) {
            // console.log('_findMatchingBracketUp: ', 'bracket: ', JSON.stringify(bracket), 'startPosition: ', String(position));
            const languageId = bracket.languageIdentifier.id;
            const reversedBracketRegex = bracket.reversedRegex;
            let count = -1;
            for (let lineNumber = position.lineNumber; lineNumber >= 1; lineNumber--) {
                const lineTokens = this._getLineTokens(lineNumber);
                const tokenCount = lineTokens.getCount();
                const lineText = this._buffer.getLineContent(lineNumber);
                let tokenIndex = tokenCount - 1;
                let searchStopOffset = -1;
                if (lineNumber === position.lineNumber) {
                    tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
                    searchStopOffset = position.column - 1;
                }
                for (; tokenIndex >= 0; tokenIndex--) {
                    const tokenLanguageId = lineTokens.getLanguageId(tokenIndex);
                    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
                    const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
                    const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
                    if (searchStopOffset === -1) {
                        searchStopOffset = tokenEndOffset;
                    }
                    if (tokenLanguageId === languageId && !supports_1.ignoreBracketsInToken(tokenType)) {
                        while (true) {
                            let r = richEditBrackets_1.BracketsUtils.findPrevBracketInToken(reversedBracketRegex, lineNumber, lineText, tokenStartOffset, searchStopOffset);
                            if (!r) {
                                break;
                            }
                            let hitText = lineText.substring(r.startColumn - 1, r.endColumn - 1);
                            hitText = hitText.toLowerCase();
                            if (hitText === bracket.open) {
                                count++;
                            }
                            else if (hitText === bracket.close) {
                                count--;
                            }
                            if (count === 0) {
                                return r;
                            }
                            searchStopOffset = r.startColumn - 1;
                        }
                    }
                    searchStopOffset = -1;
                }
            }
            return null;
        }
        _findMatchingBracketDown(bracket, position) {
            // console.log('_findMatchingBracketDown: ', 'bracket: ', JSON.stringify(bracket), 'startPosition: ', String(position));
            const languageId = bracket.languageIdentifier.id;
            const bracketRegex = bracket.forwardRegex;
            let count = 1;
            for (let lineNumber = position.lineNumber, lineCount = this.getLineCount(); lineNumber <= lineCount; lineNumber++) {
                const lineTokens = this._getLineTokens(lineNumber);
                const tokenCount = lineTokens.getCount();
                const lineText = this._buffer.getLineContent(lineNumber);
                let tokenIndex = 0;
                let searchStartOffset = 0;
                if (lineNumber === position.lineNumber) {
                    tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
                    searchStartOffset = position.column - 1;
                }
                for (; tokenIndex < tokenCount; tokenIndex++) {
                    const tokenLanguageId = lineTokens.getLanguageId(tokenIndex);
                    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
                    const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
                    const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
                    if (searchStartOffset === 0) {
                        searchStartOffset = tokenStartOffset;
                    }
                    if (tokenLanguageId === languageId && !supports_1.ignoreBracketsInToken(tokenType)) {
                        while (true) {
                            let r = richEditBrackets_1.BracketsUtils.findNextBracketInToken(bracketRegex, lineNumber, lineText, searchStartOffset, tokenEndOffset);
                            if (!r) {
                                break;
                            }
                            let hitText = lineText.substring(r.startColumn - 1, r.endColumn - 1);
                            hitText = hitText.toLowerCase();
                            if (hitText === bracket.open) {
                                count++;
                            }
                            else if (hitText === bracket.close) {
                                count--;
                            }
                            if (count === 0) {
                                return r;
                            }
                            searchStartOffset = r.endColumn - 1;
                        }
                    }
                    searchStartOffset = 0;
                }
            }
            return null;
        }
        findPrevBracket(_position) {
            const position = this.validatePosition(_position);
            let languageId = -1;
            let modeBrackets = null;
            for (let lineNumber = position.lineNumber; lineNumber >= 1; lineNumber--) {
                const lineTokens = this._getLineTokens(lineNumber);
                const tokenCount = lineTokens.getCount();
                const lineText = this._buffer.getLineContent(lineNumber);
                let tokenIndex = tokenCount - 1;
                let searchStopOffset = -1;
                if (lineNumber === position.lineNumber) {
                    tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
                    searchStopOffset = position.column - 1;
                }
                for (; tokenIndex >= 0; tokenIndex--) {
                    const tokenLanguageId = lineTokens.getLanguageId(tokenIndex);
                    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
                    const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
                    const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
                    if (searchStopOffset === -1) {
                        searchStopOffset = tokenEndOffset;
                    }
                    if (languageId !== tokenLanguageId) {
                        languageId = tokenLanguageId;
                        modeBrackets = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getBracketsSupport(languageId);
                    }
                    if (modeBrackets && !supports_1.ignoreBracketsInToken(tokenType)) {
                        let r = richEditBrackets_1.BracketsUtils.findPrevBracketInToken(modeBrackets.reversedRegex, lineNumber, lineText, tokenStartOffset, searchStopOffset);
                        if (r) {
                            return this._toFoundBracket(modeBrackets, r);
                        }
                    }
                    searchStopOffset = -1;
                }
            }
            return null;
        }
        findNextBracket(_position) {
            const position = this.validatePosition(_position);
            let languageId = -1;
            let modeBrackets = null;
            for (let lineNumber = position.lineNumber, lineCount = this.getLineCount(); lineNumber <= lineCount; lineNumber++) {
                const lineTokens = this._getLineTokens(lineNumber);
                const tokenCount = lineTokens.getCount();
                const lineText = this._buffer.getLineContent(lineNumber);
                let tokenIndex = 0;
                let searchStartOffset = 0;
                if (lineNumber === position.lineNumber) {
                    tokenIndex = lineTokens.findTokenIndexAtOffset(position.column - 1);
                    searchStartOffset = position.column - 1;
                }
                for (; tokenIndex < tokenCount; tokenIndex++) {
                    const tokenLanguageId = lineTokens.getLanguageId(tokenIndex);
                    const tokenType = lineTokens.getStandardTokenType(tokenIndex);
                    const tokenStartOffset = lineTokens.getStartOffset(tokenIndex);
                    const tokenEndOffset = lineTokens.getEndOffset(tokenIndex);
                    if (searchStartOffset === 0) {
                        searchStartOffset = tokenStartOffset;
                    }
                    if (languageId !== tokenLanguageId) {
                        languageId = tokenLanguageId;
                        modeBrackets = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getBracketsSupport(languageId);
                    }
                    if (modeBrackets && !supports_1.ignoreBracketsInToken(tokenType)) {
                        let r = richEditBrackets_1.BracketsUtils.findNextBracketInToken(modeBrackets.forwardRegex, lineNumber, lineText, searchStartOffset, tokenEndOffset);
                        if (r) {
                            return this._toFoundBracket(modeBrackets, r);
                        }
                    }
                    searchStartOffset = 0;
                }
            }
            return null;
        }
        _toFoundBracket(modeBrackets, r) {
            if (!r) {
                return null;
            }
            let text = this.getValueInRange(r);
            text = text.toLowerCase();
            let data = modeBrackets.textIsBracket[text];
            if (!data) {
                return null;
            }
            return {
                range: r,
                open: data.open,
                close: data.close,
                isOpen: modeBrackets.textIsOpenBracket[text]
            };
        }
        /**
         * Returns:
         *  - -1 => the line consists of whitespace
         *  - otherwise => the indent level is returned value
         */
        static computeIndentLevel(line, tabSize) {
            let indent = 0;
            let i = 0;
            let len = line.length;
            while (i < len) {
                let chCode = line.charCodeAt(i);
                if (chCode === 32 /* Space */) {
                    indent++;
                }
                else if (chCode === 9 /* Tab */) {
                    indent = indent - indent % tabSize + tabSize;
                }
                else {
                    break;
                }
                i++;
            }
            if (i === len) {
                return -1; // line only consists of whitespace
            }
            return indent;
        }
        _computeIndentLevel(lineIndex) {
            return TextModel.computeIndentLevel(this._buffer.getLineContent(lineIndex + 1), this._options.tabSize);
        }
        getActiveIndentGuide(lineNumber, minLineNumber, maxLineNumber) {
            this._assertNotDisposed();
            const lineCount = this.getLineCount();
            if (lineNumber < 1 || lineNumber > lineCount) {
                throw new Error('Illegal value for lineNumber');
            }
            const foldingRules = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getFoldingRules(this._languageIdentifier.id);
            const offSide = Boolean(foldingRules && foldingRules.offSide);
            let up_aboveContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let up_aboveContentLineIndent = -1;
            let up_belowContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let up_belowContentLineIndent = -1;
            const up_resolveIndents = (lineNumber) => {
                if (up_aboveContentLineIndex !== -1 && (up_aboveContentLineIndex === -2 || up_aboveContentLineIndex > lineNumber - 1)) {
                    up_aboveContentLineIndex = -1;
                    up_aboveContentLineIndent = -1;
                    // must find previous line with content
                    for (let lineIndex = lineNumber - 2; lineIndex >= 0; lineIndex--) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            up_aboveContentLineIndex = lineIndex;
                            up_aboveContentLineIndent = indent;
                            break;
                        }
                    }
                }
                if (up_belowContentLineIndex === -2) {
                    up_belowContentLineIndex = -1;
                    up_belowContentLineIndent = -1;
                    // must find next line with content
                    for (let lineIndex = lineNumber; lineIndex < lineCount; lineIndex++) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            up_belowContentLineIndex = lineIndex;
                            up_belowContentLineIndent = indent;
                            break;
                        }
                    }
                }
            };
            let down_aboveContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let down_aboveContentLineIndent = -1;
            let down_belowContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let down_belowContentLineIndent = -1;
            const down_resolveIndents = (lineNumber) => {
                if (down_aboveContentLineIndex === -2) {
                    down_aboveContentLineIndex = -1;
                    down_aboveContentLineIndent = -1;
                    // must find previous line with content
                    for (let lineIndex = lineNumber - 2; lineIndex >= 0; lineIndex--) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            down_aboveContentLineIndex = lineIndex;
                            down_aboveContentLineIndent = indent;
                            break;
                        }
                    }
                }
                if (down_belowContentLineIndex !== -1 && (down_belowContentLineIndex === -2 || down_belowContentLineIndex < lineNumber - 1)) {
                    down_belowContentLineIndex = -1;
                    down_belowContentLineIndent = -1;
                    // must find next line with content
                    for (let lineIndex = lineNumber; lineIndex < lineCount; lineIndex++) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            down_belowContentLineIndex = lineIndex;
                            down_belowContentLineIndent = indent;
                            break;
                        }
                    }
                }
            };
            let startLineNumber = 0;
            let goUp = true;
            let endLineNumber = 0;
            let goDown = true;
            let indent = 0;
            for (let distance = 0; goUp || goDown; distance++) {
                const upLineNumber = lineNumber - distance;
                const downLineNumber = lineNumber + distance;
                if (distance !== 0 && (upLineNumber < 1 || upLineNumber < minLineNumber)) {
                    goUp = false;
                }
                if (distance !== 0 && (downLineNumber > lineCount || downLineNumber > maxLineNumber)) {
                    goDown = false;
                }
                if (distance > 50000) {
                    // stop processing
                    goUp = false;
                    goDown = false;
                }
                if (goUp) {
                    // compute indent level going up
                    let upLineIndentLevel;
                    const currentIndent = this._computeIndentLevel(upLineNumber - 1);
                    if (currentIndent >= 0) {
                        // This line has content (besides whitespace)
                        // Use the line's indent
                        up_belowContentLineIndex = upLineNumber - 1;
                        up_belowContentLineIndent = currentIndent;
                        upLineIndentLevel = Math.ceil(currentIndent / this._options.indentSize);
                    }
                    else {
                        up_resolveIndents(upLineNumber);
                        upLineIndentLevel = this._getIndentLevelForWhitespaceLine(offSide, up_aboveContentLineIndent, up_belowContentLineIndent);
                    }
                    if (distance === 0) {
                        // This is the initial line number
                        startLineNumber = upLineNumber;
                        endLineNumber = downLineNumber;
                        indent = upLineIndentLevel;
                        if (indent === 0) {
                            // No need to continue
                            return { startLineNumber, endLineNumber, indent };
                        }
                        continue;
                    }
                    if (upLineIndentLevel >= indent) {
                        startLineNumber = upLineNumber;
                    }
                    else {
                        goUp = false;
                    }
                }
                if (goDown) {
                    // compute indent level going down
                    let downLineIndentLevel;
                    const currentIndent = this._computeIndentLevel(downLineNumber - 1);
                    if (currentIndent >= 0) {
                        // This line has content (besides whitespace)
                        // Use the line's indent
                        down_aboveContentLineIndex = downLineNumber - 1;
                        down_aboveContentLineIndent = currentIndent;
                        downLineIndentLevel = Math.ceil(currentIndent / this._options.indentSize);
                    }
                    else {
                        down_resolveIndents(downLineNumber);
                        downLineIndentLevel = this._getIndentLevelForWhitespaceLine(offSide, down_aboveContentLineIndent, down_belowContentLineIndent);
                    }
                    if (downLineIndentLevel >= indent) {
                        endLineNumber = downLineNumber;
                    }
                    else {
                        goDown = false;
                    }
                }
            }
            return { startLineNumber, endLineNumber, indent };
        }
        getLinesIndentGuides(startLineNumber, endLineNumber) {
            this._assertNotDisposed();
            const lineCount = this.getLineCount();
            if (startLineNumber < 1 || startLineNumber > lineCount) {
                throw new Error('Illegal value for startLineNumber');
            }
            if (endLineNumber < 1 || endLineNumber > lineCount) {
                throw new Error('Illegal value for endLineNumber');
            }
            const foldingRules = languageConfigurationRegistry_1.LanguageConfigurationRegistry.getFoldingRules(this._languageIdentifier.id);
            const offSide = Boolean(foldingRules && foldingRules.offSide);
            let result = new Array(endLineNumber - startLineNumber + 1);
            let aboveContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let aboveContentLineIndent = -1;
            let belowContentLineIndex = -2; /* -2 is a marker for not having computed it */
            let belowContentLineIndent = -1;
            for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
                let resultIndex = lineNumber - startLineNumber;
                const currentIndent = this._computeIndentLevel(lineNumber - 1);
                if (currentIndent >= 0) {
                    // This line has content (besides whitespace)
                    // Use the line's indent
                    aboveContentLineIndex = lineNumber - 1;
                    aboveContentLineIndent = currentIndent;
                    result[resultIndex] = Math.ceil(currentIndent / this._options.indentSize);
                    continue;
                }
                if (aboveContentLineIndex === -2) {
                    aboveContentLineIndex = -1;
                    aboveContentLineIndent = -1;
                    // must find previous line with content
                    for (let lineIndex = lineNumber - 2; lineIndex >= 0; lineIndex--) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            aboveContentLineIndex = lineIndex;
                            aboveContentLineIndent = indent;
                            break;
                        }
                    }
                }
                if (belowContentLineIndex !== -1 && (belowContentLineIndex === -2 || belowContentLineIndex < lineNumber - 1)) {
                    belowContentLineIndex = -1;
                    belowContentLineIndent = -1;
                    // must find next line with content
                    for (let lineIndex = lineNumber; lineIndex < lineCount; lineIndex++) {
                        let indent = this._computeIndentLevel(lineIndex);
                        if (indent >= 0) {
                            belowContentLineIndex = lineIndex;
                            belowContentLineIndent = indent;
                            break;
                        }
                    }
                }
                result[resultIndex] = this._getIndentLevelForWhitespaceLine(offSide, aboveContentLineIndent, belowContentLineIndent);
            }
            return result;
        }
        _getIndentLevelForWhitespaceLine(offSide, aboveContentLineIndent, belowContentLineIndent) {
            if (aboveContentLineIndent === -1 || belowContentLineIndent === -1) {
                // At the top or bottom of the file
                return 0;
            }
            else if (aboveContentLineIndent < belowContentLineIndent) {
                // we are inside the region above
                return (1 + Math.floor(aboveContentLineIndent / this._options.indentSize));
            }
            else if (aboveContentLineIndent === belowContentLineIndent) {
                // we are in between two regions
                return Math.ceil(belowContentLineIndent / this._options.indentSize);
            }
            else {
                if (offSide) {
                    // same level as region below
                    return Math.ceil(belowContentLineIndent / this._options.indentSize);
                }
                else {
                    // we are inside the region that ends below
                    return (1 + Math.floor(belowContentLineIndent / this._options.indentSize));
                }
            }
        }
    }
    TextModel.MODEL_SYNC_LIMIT = 50 * 1024 * 1024; // 50 MB
    TextModel.LARGE_FILE_SIZE_THRESHOLD = 20 * 1024 * 1024; // 20 MB;
    TextModel.LARGE_FILE_LINE_COUNT_THRESHOLD = 300 * 1000; // 300K lines
    TextModel.DEFAULT_CREATION_OPTIONS = {
        isForSimpleWidget: false,
        tabSize: editorOptions_1.EDITOR_MODEL_DEFAULTS.tabSize,
        indentSize: editorOptions_1.EDITOR_MODEL_DEFAULTS.indentSize,
        insertSpaces: editorOptions_1.EDITOR_MODEL_DEFAULTS.insertSpaces,
        detectIndentation: false,
        defaultEOL: 1 /* LF */,
        trimAutoWhitespace: editorOptions_1.EDITOR_MODEL_DEFAULTS.trimAutoWhitespace,
        largeFileOptimizations: editorOptions_1.EDITOR_MODEL_DEFAULTS.largeFileOptimizations,
    };
    exports.TextModel = TextModel;
    //#region Decorations
    class DecorationsTrees {
        constructor() {
            this._decorationsTree0 = new intervalTree_1.IntervalTree();
            this._decorationsTree1 = new intervalTree_1.IntervalTree();
        }
        intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId) {
            const r0 = this._decorationsTree0.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId);
            const r1 = this._decorationsTree1.intervalSearch(start, end, filterOwnerId, filterOutValidation, cachedVersionId);
            return r0.concat(r1);
        }
        search(filterOwnerId, filterOutValidation, overviewRulerOnly, cachedVersionId) {
            if (overviewRulerOnly) {
                return this._decorationsTree1.search(filterOwnerId, filterOutValidation, cachedVersionId);
            }
            else {
                const r0 = this._decorationsTree0.search(filterOwnerId, filterOutValidation, cachedVersionId);
                const r1 = this._decorationsTree1.search(filterOwnerId, filterOutValidation, cachedVersionId);
                return r0.concat(r1);
            }
        }
        collectNodesFromOwner(ownerId) {
            const r0 = this._decorationsTree0.collectNodesFromOwner(ownerId);
            const r1 = this._decorationsTree1.collectNodesFromOwner(ownerId);
            return r0.concat(r1);
        }
        collectNodesPostOrder() {
            const r0 = this._decorationsTree0.collectNodesPostOrder();
            const r1 = this._decorationsTree1.collectNodesPostOrder();
            return r0.concat(r1);
        }
        insert(node) {
            if (intervalTree_1.getNodeIsInOverviewRuler(node)) {
                this._decorationsTree1.insert(node);
            }
            else {
                this._decorationsTree0.insert(node);
            }
        }
        delete(node) {
            if (intervalTree_1.getNodeIsInOverviewRuler(node)) {
                this._decorationsTree1.delete(node);
            }
            else {
                this._decorationsTree0.delete(node);
            }
        }
        resolveNode(node, cachedVersionId) {
            if (intervalTree_1.getNodeIsInOverviewRuler(node)) {
                this._decorationsTree1.resolveNode(node, cachedVersionId);
            }
            else {
                this._decorationsTree0.resolveNode(node, cachedVersionId);
            }
        }
        acceptReplace(offset, length, textLength, forceMoveMarkers) {
            this._decorationsTree0.acceptReplace(offset, length, textLength, forceMoveMarkers);
            this._decorationsTree1.acceptReplace(offset, length, textLength, forceMoveMarkers);
        }
    }
    function cleanClassName(className) {
        return className.replace(/[^a-z0-9\-_]/gi, ' ');
    }
    class DecorationOptions {
        constructor(options) {
            this.color = options.color || strings.empty;
            this.darkColor = options.darkColor || strings.empty;
        }
    }
    class ModelDecorationOverviewRulerOptions extends DecorationOptions {
        constructor(options) {
            super(options);
            this._resolvedColor = null;
            this.position = (typeof options.position === 'number' ? options.position : model.OverviewRulerLane.Center);
        }
        getColor(theme) {
            if (!this._resolvedColor) {
                if (theme.type !== 'light' && this.darkColor) {
                    this._resolvedColor = this._resolveColor(this.darkColor, theme);
                }
                else {
                    this._resolvedColor = this._resolveColor(this.color, theme);
                }
            }
            return this._resolvedColor;
        }
        invalidateCachedColor() {
            this._resolvedColor = null;
        }
        _resolveColor(color, theme) {
            if (typeof color === 'string') {
                return color;
            }
            let c = color ? theme.getColor(color.id) : null;
            if (!c) {
                return strings.empty;
            }
            return c.toString();
        }
    }
    exports.ModelDecorationOverviewRulerOptions = ModelDecorationOverviewRulerOptions;
    class ModelDecorationMinimapOptions extends DecorationOptions {
        constructor(options) {
            super(options);
            this.position = options.position;
        }
        getColor(theme) {
            if (!this._resolvedColor) {
                if (theme.type !== 'light' && this.darkColor) {
                    this._resolvedColor = this._resolveColor(this.darkColor, theme);
                }
                else {
                    this._resolvedColor = this._resolveColor(this.color, theme);
                }
            }
            return this._resolvedColor;
        }
        invalidateCachedColor() {
            this._resolvedColor = undefined;
        }
        _resolveColor(color, theme) {
            if (typeof color === 'string') {
                return color_1.Color.fromHex(color);
            }
            return theme.getColor(color.id);
        }
    }
    exports.ModelDecorationMinimapOptions = ModelDecorationMinimapOptions;
    class ModelDecorationOptions {
        static register(options) {
            return new ModelDecorationOptions(options);
        }
        static createDynamic(options) {
            return new ModelDecorationOptions(options);
        }
        constructor(options) {
            this.stickiness = options.stickiness || 0 /* AlwaysGrowsWhenTypingAtEdges */;
            this.zIndex = options.zIndex || 0;
            this.className = options.className ? cleanClassName(options.className) : null;
            this.hoverMessage = types_1.withUndefinedAsNull(options.hoverMessage);
            this.glyphMarginHoverMessage = types_1.withUndefinedAsNull(options.glyphMarginHoverMessage);
            this.isWholeLine = options.isWholeLine || false;
            this.showIfCollapsed = options.showIfCollapsed || false;
            this.collapseOnReplaceEdit = options.collapseOnReplaceEdit || false;
            this.overviewRuler = options.overviewRuler ? new ModelDecorationOverviewRulerOptions(options.overviewRuler) : null;
            this.minimap = options.minimap ? new ModelDecorationMinimapOptions(options.minimap) : null;
            this.glyphMarginClassName = options.glyphMarginClassName ? cleanClassName(options.glyphMarginClassName) : null;
            this.linesDecorationsClassName = options.linesDecorationsClassName ? cleanClassName(options.linesDecorationsClassName) : null;
            this.marginClassName = options.marginClassName ? cleanClassName(options.marginClassName) : null;
            this.inlineClassName = options.inlineClassName ? cleanClassName(options.inlineClassName) : null;
            this.inlineClassNameAffectsLetterSpacing = options.inlineClassNameAffectsLetterSpacing || false;
            this.beforeContentClassName = options.beforeContentClassName ? cleanClassName(options.beforeContentClassName) : null;
            this.afterContentClassName = options.afterContentClassName ? cleanClassName(options.afterContentClassName) : null;
        }
    }
    exports.ModelDecorationOptions = ModelDecorationOptions;
    ModelDecorationOptions.EMPTY = ModelDecorationOptions.register({});
    /**
     * The order carefully matches the values of the enum.
     */
    const TRACKED_RANGE_OPTIONS = [
        ModelDecorationOptions.register({ stickiness: 0 /* AlwaysGrowsWhenTypingAtEdges */ }),
        ModelDecorationOptions.register({ stickiness: 1 /* NeverGrowsWhenTypingAtEdges */ }),
        ModelDecorationOptions.register({ stickiness: 2 /* GrowsOnlyWhenTypingBefore */ }),
        ModelDecorationOptions.register({ stickiness: 3 /* GrowsOnlyWhenTypingAfter */ }),
    ];
    function _normalizeOptions(options) {
        if (options instanceof ModelDecorationOptions) {
            return options;
        }
        return ModelDecorationOptions.createDynamic(options);
    }
    class DidChangeDecorationsEmitter extends lifecycle_1.Disposable {
        constructor() {
            super();
            this._actual = this._register(new event_1.Emitter());
            this.event = this._actual.event;
            this._deferredCnt = 0;
            this._shouldFire = false;
        }
        beginDeferredEmit() {
            this._deferredCnt++;
        }
        endDeferredEmit() {
            this._deferredCnt--;
            if (this._deferredCnt === 0) {
                if (this._shouldFire) {
                    this._shouldFire = false;
                    this._actual.fire({});
                }
            }
        }
        fire() {
            this._shouldFire = true;
        }
    }
    exports.DidChangeDecorationsEmitter = DidChangeDecorationsEmitter;
    //#endregion
    class DidChangeContentEmitter extends lifecycle_1.Disposable {
        constructor() {
            super();
            /**
             * Both `fastEvent` and `slowEvent` work the same way and contain the same events, but first we invoke `fastEvent` and then `slowEvent`.
             */
            this._fastEmitter = this._register(new event_1.Emitter());
            this.fastEvent = this._fastEmitter.event;
            this._slowEmitter = this._register(new event_1.Emitter());
            this.slowEvent = this._slowEmitter.event;
            this._deferredCnt = 0;
            this._deferredEvent = null;
        }
        beginDeferredEmit() {
            this._deferredCnt++;
        }
        endDeferredEmit() {
            this._deferredCnt--;
            if (this._deferredCnt === 0) {
                if (this._deferredEvent !== null) {
                    const e = this._deferredEvent;
                    this._deferredEvent = null;
                    this._fastEmitter.fire(e);
                    this._slowEmitter.fire(e);
                }
            }
        }
        fire(e) {
            if (this._deferredCnt > 0) {
                if (this._deferredEvent) {
                    this._deferredEvent = this._deferredEvent.merge(e);
                }
                else {
                    this._deferredEvent = e;
                }
                return;
            }
            this._fastEmitter.fire(e);
            this._slowEmitter.fire(e);
        }
    }
    exports.DidChangeContentEmitter = DidChangeContentEmitter;
});
//# sourceMappingURL=textModel.js.map