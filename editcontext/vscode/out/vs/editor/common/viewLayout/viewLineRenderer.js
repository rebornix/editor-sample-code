/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/strings", "vs/editor/common/core/stringBuilder", "vs/editor/common/viewLayout/lineDecorations"], function (require, exports, strings, stringBuilder_1, lineDecorations_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var RenderWhitespace;
    (function (RenderWhitespace) {
        RenderWhitespace[RenderWhitespace["None"] = 0] = "None";
        RenderWhitespace[RenderWhitespace["Boundary"] = 1] = "Boundary";
        RenderWhitespace[RenderWhitespace["Selection"] = 2] = "Selection";
        RenderWhitespace[RenderWhitespace["All"] = 3] = "All";
    })(RenderWhitespace = exports.RenderWhitespace || (exports.RenderWhitespace = {}));
    class LinePart {
        constructor(endIndex, type) {
            this.endIndex = endIndex;
            this.type = type;
        }
    }
    class LineRange {
        constructor(startIndex, endIndex) {
            this.startOffset = startIndex;
            this.endOffset = endIndex;
        }
        equals(otherLineRange) {
            return this.startOffset === otherLineRange.startOffset
                && this.endOffset === otherLineRange.endOffset;
        }
    }
    exports.LineRange = LineRange;
    class RenderLineInput {
        constructor(useMonospaceOptimizations, canUseHalfwidthRightwardsArrow, lineContent, continuesWithWrappedLine, isBasicASCII, containsRTL, fauxIndentLength, lineTokens, lineDecorations, tabSize, spaceWidth, stopRenderingLineAfter, renderWhitespace, renderControlCharacters, fontLigatures, selectionsOnLine) {
            this.useMonospaceOptimizations = useMonospaceOptimizations;
            this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
            this.lineContent = lineContent;
            this.continuesWithWrappedLine = continuesWithWrappedLine;
            this.isBasicASCII = isBasicASCII;
            this.containsRTL = containsRTL;
            this.fauxIndentLength = fauxIndentLength;
            this.lineTokens = lineTokens;
            this.lineDecorations = lineDecorations;
            this.tabSize = tabSize;
            this.spaceWidth = spaceWidth;
            this.stopRenderingLineAfter = stopRenderingLineAfter;
            this.renderWhitespace = (renderWhitespace === 'all'
                ? 3 /* All */
                : renderWhitespace === 'boundary'
                    ? 1 /* Boundary */
                    : renderWhitespace === 'selection'
                        ? 2 /* Selection */
                        : 0 /* None */);
            this.renderControlCharacters = renderControlCharacters;
            this.fontLigatures = fontLigatures;
            this.selectionsOnLine = selectionsOnLine && selectionsOnLine.sort((a, b) => a.startOffset < b.startOffset ? -1 : 1);
        }
        sameSelection(otherSelections) {
            if (this.selectionsOnLine === null) {
                return otherSelections === null;
            }
            if (otherSelections === null) {
                return false;
            }
            if (otherSelections.length !== this.selectionsOnLine.length) {
                return false;
            }
            for (let i = 0; i < this.selectionsOnLine.length; i++) {
                if (!this.selectionsOnLine[i].equals(otherSelections[i])) {
                    return false;
                }
            }
            return true;
        }
        equals(other) {
            return (this.useMonospaceOptimizations === other.useMonospaceOptimizations
                && this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
                && this.lineContent === other.lineContent
                && this.continuesWithWrappedLine === other.continuesWithWrappedLine
                && this.isBasicASCII === other.isBasicASCII
                && this.containsRTL === other.containsRTL
                && this.fauxIndentLength === other.fauxIndentLength
                && this.tabSize === other.tabSize
                && this.spaceWidth === other.spaceWidth
                && this.stopRenderingLineAfter === other.stopRenderingLineAfter
                && this.renderWhitespace === other.renderWhitespace
                && this.renderControlCharacters === other.renderControlCharacters
                && this.fontLigatures === other.fontLigatures
                && lineDecorations_1.LineDecoration.equalsArr(this.lineDecorations, other.lineDecorations)
                && this.lineTokens.equals(other.lineTokens)
                && this.sameSelection(other.selectionsOnLine));
        }
    }
    exports.RenderLineInput = RenderLineInput;
    var CharacterMappingConstants;
    (function (CharacterMappingConstants) {
        CharacterMappingConstants[CharacterMappingConstants["PART_INDEX_MASK"] = 4294901760] = "PART_INDEX_MASK";
        CharacterMappingConstants[CharacterMappingConstants["CHAR_INDEX_MASK"] = 65535] = "CHAR_INDEX_MASK";
        CharacterMappingConstants[CharacterMappingConstants["CHAR_INDEX_OFFSET"] = 0] = "CHAR_INDEX_OFFSET";
        CharacterMappingConstants[CharacterMappingConstants["PART_INDEX_OFFSET"] = 16] = "PART_INDEX_OFFSET";
    })(CharacterMappingConstants = exports.CharacterMappingConstants || (exports.CharacterMappingConstants = {}));
    /**
     * Provides a both direction mapping between a line's character and its rendered position.
     */
    class CharacterMapping {
        static getPartIndex(partData) {
            return (partData & 4294901760 /* PART_INDEX_MASK */) >>> 16 /* PART_INDEX_OFFSET */;
        }
        static getCharIndex(partData) {
            return (partData & 65535 /* CHAR_INDEX_MASK */) >>> 0 /* CHAR_INDEX_OFFSET */;
        }
        constructor(length, partCount) {
            this.length = length;
            this._data = new Uint32Array(this.length);
            this._absoluteOffsets = new Uint32Array(this.length);
        }
        setPartData(charOffset, partIndex, charIndex, partAbsoluteOffset) {
            let partData = ((partIndex << 16 /* PART_INDEX_OFFSET */)
                | (charIndex << 0 /* CHAR_INDEX_OFFSET */)) >>> 0;
            this._data[charOffset] = partData;
            this._absoluteOffsets[charOffset] = partAbsoluteOffset + charIndex;
        }
        getAbsoluteOffsets() {
            return this._absoluteOffsets;
        }
        charOffsetToPartData(charOffset) {
            if (this.length === 0) {
                return 0;
            }
            if (charOffset < 0) {
                return this._data[0];
            }
            if (charOffset >= this.length) {
                return this._data[this.length - 1];
            }
            return this._data[charOffset];
        }
        partDataToCharOffset(partIndex, partLength, charIndex) {
            if (this.length === 0) {
                return 0;
            }
            let searchEntry = ((partIndex << 16 /* PART_INDEX_OFFSET */)
                | (charIndex << 0 /* CHAR_INDEX_OFFSET */)) >>> 0;
            let min = 0;
            let max = this.length - 1;
            while (min + 1 < max) {
                let mid = ((min + max) >>> 1);
                let midEntry = this._data[mid];
                if (midEntry === searchEntry) {
                    return mid;
                }
                else if (midEntry > searchEntry) {
                    max = mid;
                }
                else {
                    min = mid;
                }
            }
            if (min === max) {
                return min;
            }
            let minEntry = this._data[min];
            let maxEntry = this._data[max];
            if (minEntry === searchEntry) {
                return min;
            }
            if (maxEntry === searchEntry) {
                return max;
            }
            let minPartIndex = CharacterMapping.getPartIndex(minEntry);
            let minCharIndex = CharacterMapping.getCharIndex(minEntry);
            let maxPartIndex = CharacterMapping.getPartIndex(maxEntry);
            let maxCharIndex;
            if (minPartIndex !== maxPartIndex) {
                // sitting between parts
                maxCharIndex = partLength;
            }
            else {
                maxCharIndex = CharacterMapping.getCharIndex(maxEntry);
            }
            let minEntryDistance = charIndex - minCharIndex;
            let maxEntryDistance = maxCharIndex - charIndex;
            if (minEntryDistance <= maxEntryDistance) {
                return min;
            }
            return max;
        }
    }
    exports.CharacterMapping = CharacterMapping;
    var ForeignElementType;
    (function (ForeignElementType) {
        ForeignElementType[ForeignElementType["None"] = 0] = "None";
        ForeignElementType[ForeignElementType["Before"] = 1] = "Before";
        ForeignElementType[ForeignElementType["After"] = 2] = "After";
    })(ForeignElementType = exports.ForeignElementType || (exports.ForeignElementType = {}));
    class RenderLineOutput {
        constructor(characterMapping, containsRTL, containsForeignElements) {
            this.characterMapping = characterMapping;
            this.containsRTL = containsRTL;
            this.containsForeignElements = containsForeignElements;
        }
    }
    exports.RenderLineOutput = RenderLineOutput;
    function renderViewLine(input, sb) {
        if (input.lineContent.length === 0) {
            let containsForeignElements = 0 /* None */;
            // This is basically for IE's hit test to work
            let content = '<span><span>\u00a0</span></span>';
            if (input.lineDecorations.length > 0) {
                // This line is empty, but it contains inline decorations
                let classNames = [];
                for (let i = 0, len = input.lineDecorations.length; i < len; i++) {
                    const lineDecoration = input.lineDecorations[i];
                    if (lineDecoration.type === 1 /* Before */) {
                        classNames.push(input.lineDecorations[i].className);
                        containsForeignElements |= 1 /* Before */;
                    }
                    if (lineDecoration.type === 2 /* After */) {
                        classNames.push(input.lineDecorations[i].className);
                        containsForeignElements |= 2 /* After */;
                    }
                }
                if (containsForeignElements !== 0 /* None */) {
                    content = `<span><span class="${classNames.join(' ')}"></span></span>`;
                }
            }
            sb.appendASCIIString(content);
            return new RenderLineOutput(new CharacterMapping(0, 0), false, containsForeignElements);
        }
        return _renderLine(resolveRenderLineInput(input), sb);
    }
    exports.renderViewLine = renderViewLine;
    class RenderLineOutput2 {
        constructor(characterMapping, html, containsRTL, containsForeignElements) {
            this.characterMapping = characterMapping;
            this.html = html;
            this.containsRTL = containsRTL;
            this.containsForeignElements = containsForeignElements;
        }
    }
    exports.RenderLineOutput2 = RenderLineOutput2;
    function renderViewLine2(input) {
        let sb = stringBuilder_1.createStringBuilder(10000);
        let out = renderViewLine(input, sb);
        return new RenderLineOutput2(out.characterMapping, sb.build(), out.containsRTL, out.containsForeignElements);
    }
    exports.renderViewLine2 = renderViewLine2;
    class ResolvedRenderLineInput {
        constructor(fontIsMonospace, canUseHalfwidthRightwardsArrow, lineContent, len, isOverflowing, parts, containsForeignElements, tabSize, containsRTL, spaceWidth, renderWhitespace, renderControlCharacters) {
            this.fontIsMonospace = fontIsMonospace;
            this.canUseHalfwidthRightwardsArrow = canUseHalfwidthRightwardsArrow;
            this.lineContent = lineContent;
            this.len = len;
            this.isOverflowing = isOverflowing;
            this.parts = parts;
            this.containsForeignElements = containsForeignElements;
            this.tabSize = tabSize;
            this.containsRTL = containsRTL;
            this.spaceWidth = spaceWidth;
            this.renderWhitespace = renderWhitespace;
            this.renderControlCharacters = renderControlCharacters;
            //
        }
    }
    function resolveRenderLineInput(input) {
        const useMonospaceOptimizations = input.useMonospaceOptimizations;
        const lineContent = input.lineContent;
        let isOverflowing;
        let len;
        if (input.stopRenderingLineAfter !== -1 && input.stopRenderingLineAfter < lineContent.length) {
            isOverflowing = true;
            len = input.stopRenderingLineAfter;
        }
        else {
            isOverflowing = false;
            len = lineContent.length;
        }
        let tokens = transformAndRemoveOverflowing(input.lineTokens, input.fauxIndentLength, len);
        if (input.renderWhitespace === 3 /* All */ || input.renderWhitespace === 1 /* Boundary */ || (input.renderWhitespace === 2 /* Selection */ && !!input.selectionsOnLine)) {
            tokens = _applyRenderWhitespace(lineContent, len, input.continuesWithWrappedLine, tokens, input.fauxIndentLength, input.tabSize, useMonospaceOptimizations, input.selectionsOnLine, input.renderWhitespace === 1 /* Boundary */);
        }
        let containsForeignElements = 0 /* None */;
        if (input.lineDecorations.length > 0) {
            for (let i = 0, len = input.lineDecorations.length; i < len; i++) {
                const lineDecoration = input.lineDecorations[i];
                if (lineDecoration.type === 3 /* RegularAffectingLetterSpacing */) {
                    // Pretend there are foreign elements... although not 100% accurate.
                    containsForeignElements |= 1 /* Before */;
                }
                else if (lineDecoration.type === 1 /* Before */) {
                    containsForeignElements |= 1 /* Before */;
                }
                else if (lineDecoration.type === 2 /* After */) {
                    containsForeignElements |= 2 /* After */;
                }
            }
            tokens = _applyInlineDecorations(lineContent, len, tokens, input.lineDecorations);
        }
        if (!input.containsRTL) {
            // We can never split RTL text, as it ruins the rendering
            tokens = splitLargeTokens(lineContent, tokens, !input.isBasicASCII || input.fontLigatures);
        }
        return new ResolvedRenderLineInput(useMonospaceOptimizations, input.canUseHalfwidthRightwardsArrow, lineContent, len, isOverflowing, tokens, containsForeignElements, input.tabSize, input.containsRTL, input.spaceWidth, input.renderWhitespace, input.renderControlCharacters);
    }
    /**
     * In the rendering phase, characters are always looped until token.endIndex.
     * Ensure that all tokens end before `len` and the last one ends precisely at `len`.
     */
    function transformAndRemoveOverflowing(tokens, fauxIndentLength, len) {
        let result = [], resultLen = 0;
        // The faux indent part of the line should have no token type
        if (fauxIndentLength > 0) {
            result[resultLen++] = new LinePart(fauxIndentLength, '');
        }
        for (let tokenIndex = 0, tokensLen = tokens.getCount(); tokenIndex < tokensLen; tokenIndex++) {
            const endIndex = tokens.getEndOffset(tokenIndex);
            if (endIndex <= fauxIndentLength) {
                // The faux indent part of the line should have no token type
                continue;
            }
            const type = tokens.getClassName(tokenIndex);
            if (endIndex >= len) {
                result[resultLen++] = new LinePart(len, type);
                break;
            }
            result[resultLen++] = new LinePart(endIndex, type);
        }
        return result;
    }
    /**
     * written as a const enum to get value inlining.
     */
    var Constants;
    (function (Constants) {
        Constants[Constants["LongToken"] = 50] = "LongToken";
    })(Constants || (Constants = {}));
    /**
     * See https://github.com/Microsoft/vscode/issues/6885.
     * It appears that having very large spans causes very slow reading of character positions.
     * So here we try to avoid that.
     */
    function splitLargeTokens(lineContent, tokens, onlyAtSpaces) {
        let lastTokenEndIndex = 0;
        let result = [], resultLen = 0;
        if (onlyAtSpaces) {
            // Split only at spaces => we need to walk each character
            for (let i = 0, len = tokens.length; i < len; i++) {
                const token = tokens[i];
                const tokenEndIndex = token.endIndex;
                if (lastTokenEndIndex + 50 /* LongToken */ < tokenEndIndex) {
                    const tokenType = token.type;
                    let lastSpaceOffset = -1;
                    let currTokenStart = lastTokenEndIndex;
                    for (let j = lastTokenEndIndex; j < tokenEndIndex; j++) {
                        if (lineContent.charCodeAt(j) === 32 /* Space */) {
                            lastSpaceOffset = j;
                        }
                        if (lastSpaceOffset !== -1 && j - currTokenStart >= 50 /* LongToken */) {
                            // Split at `lastSpaceOffset` + 1
                            result[resultLen++] = new LinePart(lastSpaceOffset + 1, tokenType);
                            currTokenStart = lastSpaceOffset + 1;
                            lastSpaceOffset = -1;
                        }
                    }
                    if (currTokenStart !== tokenEndIndex) {
                        result[resultLen++] = new LinePart(tokenEndIndex, tokenType);
                    }
                }
                else {
                    result[resultLen++] = token;
                }
                lastTokenEndIndex = tokenEndIndex;
            }
        }
        else {
            // Split anywhere => we don't need to walk each character
            for (let i = 0, len = tokens.length; i < len; i++) {
                const token = tokens[i];
                const tokenEndIndex = token.endIndex;
                let diff = (tokenEndIndex - lastTokenEndIndex);
                if (diff > 50 /* LongToken */) {
                    const tokenType = token.type;
                    const piecesCount = Math.ceil(diff / 50 /* LongToken */);
                    for (let j = 1; j < piecesCount; j++) {
                        let pieceEndIndex = lastTokenEndIndex + (j * 50 /* LongToken */);
                        result[resultLen++] = new LinePart(pieceEndIndex, tokenType);
                    }
                    result[resultLen++] = new LinePart(tokenEndIndex, tokenType);
                }
                else {
                    result[resultLen++] = token;
                }
                lastTokenEndIndex = tokenEndIndex;
            }
        }
        return result;
    }
    /**
     * Whitespace is rendered by "replacing" tokens with a special-purpose `vs-whitespace` type that is later recognized in the rendering phase.
     * Moreover, a token is created for every visual indent because on some fonts the glyphs used for rendering whitespace (&rarr; or &middot;) do not have the same width as &nbsp;.
     * The rendering phase will generate `style="width:..."` for these tokens.
     */
    function _applyRenderWhitespace(lineContent, len, continuesWithWrappedLine, tokens, fauxIndentLength, tabSize, useMonospaceOptimizations, selections, onlyBoundary) {
        let result = [], resultLen = 0;
        let tokenIndex = 0;
        let tokenType = tokens[tokenIndex].type;
        let tokenEndIndex = tokens[tokenIndex].endIndex;
        const tokensLength = tokens.length;
        let firstNonWhitespaceIndex = strings.firstNonWhitespaceIndex(lineContent);
        let lastNonWhitespaceIndex;
        if (firstNonWhitespaceIndex === -1) {
            // The entire line is whitespace
            firstNonWhitespaceIndex = len;
            lastNonWhitespaceIndex = len;
        }
        else {
            lastNonWhitespaceIndex = strings.lastNonWhitespaceIndex(lineContent);
        }
        let tmpIndent = 0;
        for (let charIndex = 0; charIndex < fauxIndentLength; charIndex++) {
            const chCode = lineContent.charCodeAt(charIndex);
            if (chCode === 9 /* Tab */) {
                tmpIndent = tabSize;
            }
            else if (strings.isFullWidthCharacter(chCode)) {
                tmpIndent += 2;
            }
            else {
                tmpIndent++;
            }
        }
        tmpIndent = tmpIndent % tabSize;
        let wasInWhitespace = false;
        let currentSelectionIndex = 0;
        let currentSelection = selections && selections[currentSelectionIndex];
        for (let charIndex = fauxIndentLength; charIndex < len; charIndex++) {
            const chCode = lineContent.charCodeAt(charIndex);
            if (currentSelection && charIndex >= currentSelection.endOffset) {
                currentSelectionIndex++;
                currentSelection = selections && selections[currentSelectionIndex];
            }
            let isInWhitespace;
            if (charIndex < firstNonWhitespaceIndex || charIndex > lastNonWhitespaceIndex) {
                // in leading or trailing whitespace
                isInWhitespace = true;
            }
            else if (chCode === 9 /* Tab */) {
                // a tab character is rendered both in all and boundary cases
                isInWhitespace = true;
            }
            else if (chCode === 32 /* Space */) {
                // hit a space character
                if (onlyBoundary) {
                    // rendering only boundary whitespace
                    if (wasInWhitespace) {
                        isInWhitespace = true;
                    }
                    else {
                        const nextChCode = (charIndex + 1 < len ? lineContent.charCodeAt(charIndex + 1) : 0 /* Null */);
                        isInWhitespace = (nextChCode === 32 /* Space */ || nextChCode === 9 /* Tab */);
                    }
                }
                else {
                    isInWhitespace = true;
                }
            }
            else {
                isInWhitespace = false;
            }
            // If rendering whitespace on selection, check that the charIndex falls within a selection
            if (isInWhitespace && selections) {
                isInWhitespace = !!currentSelection && currentSelection.startOffset <= charIndex && currentSelection.endOffset > charIndex;
            }
            if (wasInWhitespace) {
                // was in whitespace token
                if (!isInWhitespace || (!useMonospaceOptimizations && tmpIndent >= tabSize)) {
                    // leaving whitespace token or entering a new indent
                    result[resultLen++] = new LinePart(charIndex, 'vs-whitespace');
                    tmpIndent = tmpIndent % tabSize;
                }
            }
            else {
                // was in regular token
                if (charIndex === tokenEndIndex || (isInWhitespace && charIndex > fauxIndentLength)) {
                    result[resultLen++] = new LinePart(charIndex, tokenType);
                    tmpIndent = tmpIndent % tabSize;
                }
            }
            if (chCode === 9 /* Tab */) {
                tmpIndent = tabSize;
            }
            else if (strings.isFullWidthCharacter(chCode)) {
                tmpIndent += 2;
            }
            else {
                tmpIndent++;
            }
            wasInWhitespace = isInWhitespace;
            if (charIndex === tokenEndIndex) {
                tokenIndex++;
                if (tokenIndex < tokensLength) {
                    tokenType = tokens[tokenIndex].type;
                    tokenEndIndex = tokens[tokenIndex].endIndex;
                }
            }
        }
        let generateWhitespace = false;
        if (wasInWhitespace) {
            // was in whitespace token
            if (continuesWithWrappedLine && onlyBoundary) {
                let lastCharCode = (len > 0 ? lineContent.charCodeAt(len - 1) : 0 /* Null */);
                let prevCharCode = (len > 1 ? lineContent.charCodeAt(len - 2) : 0 /* Null */);
                let isSingleTrailingSpace = (lastCharCode === 32 /* Space */ && (prevCharCode !== 32 /* Space */ && prevCharCode !== 9 /* Tab */));
                if (!isSingleTrailingSpace) {
                    generateWhitespace = true;
                }
            }
            else {
                generateWhitespace = true;
            }
        }
        result[resultLen++] = new LinePart(len, generateWhitespace ? 'vs-whitespace' : tokenType);
        return result;
    }
    /**
     * Inline decorations are "merged" on top of tokens.
     * Special care must be taken when multiple inline decorations are at play and they overlap.
     */
    function _applyInlineDecorations(lineContent, len, tokens, _lineDecorations) {
        _lineDecorations.sort(lineDecorations_1.LineDecoration.compare);
        const lineDecorations = lineDecorations_1.LineDecorationsNormalizer.normalize(lineContent, _lineDecorations);
        const lineDecorationsLen = lineDecorations.length;
        let lineDecorationIndex = 0;
        let result = [], resultLen = 0, lastResultEndIndex = 0;
        for (let tokenIndex = 0, len = tokens.length; tokenIndex < len; tokenIndex++) {
            const token = tokens[tokenIndex];
            const tokenEndIndex = token.endIndex;
            const tokenType = token.type;
            while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset < tokenEndIndex) {
                const lineDecoration = lineDecorations[lineDecorationIndex];
                if (lineDecoration.startOffset > lastResultEndIndex) {
                    lastResultEndIndex = lineDecoration.startOffset;
                    result[resultLen++] = new LinePart(lastResultEndIndex, tokenType);
                }
                if (lineDecoration.endOffset + 1 <= tokenEndIndex) {
                    // This line decoration ends before this token ends
                    lastResultEndIndex = lineDecoration.endOffset + 1;
                    result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + ' ' + lineDecoration.className);
                    lineDecorationIndex++;
                }
                else {
                    // This line decoration continues on to the next token
                    lastResultEndIndex = tokenEndIndex;
                    result[resultLen++] = new LinePart(lastResultEndIndex, tokenType + ' ' + lineDecoration.className);
                    break;
                }
            }
            if (tokenEndIndex > lastResultEndIndex) {
                lastResultEndIndex = tokenEndIndex;
                result[resultLen++] = new LinePart(lastResultEndIndex, tokenType);
            }
        }
        const lastTokenEndIndex = tokens[tokens.length - 1].endIndex;
        if (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
            let classNames = [];
            while (lineDecorationIndex < lineDecorationsLen && lineDecorations[lineDecorationIndex].startOffset === lastTokenEndIndex) {
                classNames.push(lineDecorations[lineDecorationIndex].className);
                lineDecorationIndex++;
            }
            result[resultLen++] = new LinePart(lastResultEndIndex, classNames.join(' '));
        }
        return result;
    }
    /**
     * This function is on purpose not split up into multiple functions to allow runtime type inference (i.e. performance reasons).
     * Notice how all the needed data is fully resolved and passed in (i.e. no other calls).
     */
    function _renderLine(input, sb) {
        const fontIsMonospace = input.fontIsMonospace;
        const canUseHalfwidthRightwardsArrow = input.canUseHalfwidthRightwardsArrow;
        const containsForeignElements = input.containsForeignElements;
        const lineContent = input.lineContent;
        const len = input.len;
        const isOverflowing = input.isOverflowing;
        const parts = input.parts;
        const tabSize = input.tabSize;
        const containsRTL = input.containsRTL;
        const spaceWidth = input.spaceWidth;
        const renderWhitespace = input.renderWhitespace;
        const renderControlCharacters = input.renderControlCharacters;
        const characterMapping = new CharacterMapping(len + 1, parts.length);
        let charIndex = 0;
        let tabsCharDelta = 0;
        let charOffsetInPart = 0;
        let prevPartContentCnt = 0;
        let partAbsoluteOffset = 0;
        sb.appendASCIIString('<span>');
        for (let partIndex = 0, tokensLen = parts.length; partIndex < tokensLen; partIndex++) {
            partAbsoluteOffset += prevPartContentCnt;
            const part = parts[partIndex];
            const partEndIndex = part.endIndex;
            const partType = part.type;
            const partRendersWhitespace = (renderWhitespace !== 0 /* None */ && (partType.indexOf('vs-whitespace') >= 0));
            charOffsetInPart = 0;
            sb.appendASCIIString('<span class="');
            sb.appendASCIIString(partType);
            sb.appendASCII(34 /* DoubleQuote */);
            if (partRendersWhitespace) {
                let partContentCnt = 0;
                {
                    let _charIndex = charIndex;
                    let _tabsCharDelta = tabsCharDelta;
                    for (; _charIndex < partEndIndex; _charIndex++) {
                        const charCode = lineContent.charCodeAt(_charIndex);
                        if (charCode === 9 /* Tab */) {
                            let insertSpacesCount = tabSize - (_charIndex + _tabsCharDelta) % tabSize;
                            _tabsCharDelta += insertSpacesCount - 1;
                            partContentCnt += insertSpacesCount;
                        }
                        else {
                            // must be CharCode.Space
                            partContentCnt++;
                        }
                    }
                }
                if (!fontIsMonospace) {
                    const partIsOnlyWhitespace = (partType === 'vs-whitespace');
                    if (partIsOnlyWhitespace || !containsForeignElements) {
                        sb.appendASCIIString(' style="width:');
                        sb.appendASCIIString(String(spaceWidth * partContentCnt));
                        sb.appendASCIIString('px"');
                    }
                }
                sb.appendASCII(62 /* GreaterThan */);
                for (; charIndex < partEndIndex; charIndex++) {
                    characterMapping.setPartData(charIndex, partIndex, charOffsetInPart, partAbsoluteOffset);
                    const charCode = lineContent.charCodeAt(charIndex);
                    if (charCode === 9 /* Tab */) {
                        let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
                        tabsCharDelta += insertSpacesCount - 1;
                        charOffsetInPart += insertSpacesCount - 1;
                        if (insertSpacesCount > 0) {
                            if (!canUseHalfwidthRightwardsArrow || insertSpacesCount > 1) {
                                sb.write1(0x2192); // RIGHTWARDS ARROW
                            }
                            else {
                                sb.write1(0xFFEB); // HALFWIDTH RIGHTWARDS ARROW
                            }
                            insertSpacesCount--;
                        }
                        while (insertSpacesCount > 0) {
                            sb.write1(0xA0); // &nbsp;
                            insertSpacesCount--;
                        }
                    }
                    else {
                        // must be CharCode.Space
                        sb.write1(0xB7); // &middot;
                    }
                    charOffsetInPart++;
                }
                prevPartContentCnt = partContentCnt;
            }
            else {
                let partContentCnt = 0;
                if (containsRTL) {
                    sb.appendASCIIString(' dir="ltr"');
                }
                sb.appendASCII(62 /* GreaterThan */);
                for (; charIndex < partEndIndex; charIndex++) {
                    characterMapping.setPartData(charIndex, partIndex, charOffsetInPart, partAbsoluteOffset);
                    const charCode = lineContent.charCodeAt(charIndex);
                    switch (charCode) {
                        case 9 /* Tab */:
                            let insertSpacesCount = tabSize - (charIndex + tabsCharDelta) % tabSize;
                            tabsCharDelta += insertSpacesCount - 1;
                            charOffsetInPart += insertSpacesCount - 1;
                            while (insertSpacesCount > 0) {
                                sb.write1(0xA0); // &nbsp;
                                partContentCnt++;
                                insertSpacesCount--;
                            }
                            break;
                        case 32 /* Space */:
                            sb.write1(0xA0); // &nbsp;
                            partContentCnt++;
                            break;
                        case 60 /* LessThan */:
                            sb.appendASCIIString('&lt;');
                            partContentCnt++;
                            break;
                        case 62 /* GreaterThan */:
                            sb.appendASCIIString('&gt;');
                            partContentCnt++;
                            break;
                        case 38 /* Ampersand */:
                            sb.appendASCIIString('&amp;');
                            partContentCnt++;
                            break;
                        case 0 /* Null */:
                            sb.appendASCIIString('&#00;');
                            partContentCnt++;
                            break;
                        case 65279 /* UTF8_BOM */:
                        case 8232 /* LINE_SEPARATOR_2028 */:
                            sb.write1(0xFFFD);
                            partContentCnt++;
                            break;
                        default:
                            if (strings.isFullWidthCharacter(charCode)) {
                                tabsCharDelta++;
                            }
                            if (renderControlCharacters && charCode < 32) {
                                sb.write1(9216 + charCode);
                                partContentCnt++;
                            }
                            else {
                                sb.write1(charCode);
                                partContentCnt++;
                            }
                    }
                    charOffsetInPart++;
                }
                prevPartContentCnt = partContentCnt;
            }
            sb.appendASCIIString('</span>');
        }
        // When getting client rects for the last character, we will position the
        // text range at the end of the span, insteaf of at the beginning of next span
        characterMapping.setPartData(len, parts.length - 1, charOffsetInPart, partAbsoluteOffset);
        if (isOverflowing) {
            sb.appendASCIIString('<span>&hellip;</span>');
        }
        sb.appendASCIIString('</span>');
        return new RenderLineOutput(characterMapping, containsRTL, containsForeignElements);
    }
});
//# sourceMappingURL=viewLineRenderer.js.map