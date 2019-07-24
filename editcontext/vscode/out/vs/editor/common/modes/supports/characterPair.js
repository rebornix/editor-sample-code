/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/editor/common/modes/languageConfiguration"], function (require, exports, languageConfiguration_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class CharacterPairSupport {
        constructor(config) {
            if (config.autoClosingPairs) {
                this._autoClosingPairs = config.autoClosingPairs.map(el => new languageConfiguration_1.StandardAutoClosingPairConditional(el));
            }
            else if (config.brackets) {
                this._autoClosingPairs = config.brackets.map(b => new languageConfiguration_1.StandardAutoClosingPairConditional({ open: b[0], close: b[1] }));
            }
            else {
                this._autoClosingPairs = [];
            }
            this._autoCloseBefore = typeof config.autoCloseBefore === 'string' ? config.autoCloseBefore : CharacterPairSupport.DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED;
            this._surroundingPairs = config.surroundingPairs || this._autoClosingPairs;
        }
        getAutoClosingPairs() {
            return this._autoClosingPairs;
        }
        getAutoCloseBeforeSet() {
            return this._autoCloseBefore;
        }
        shouldAutoClosePair(character, context, column) {
            // Always complete on empty line
            if (context.getTokenCount() === 0) {
                return true;
            }
            let tokenIndex = context.findTokenIndexAtOffset(column - 2);
            let standardTokenType = context.getStandardTokenType(tokenIndex);
            for (const autoClosingPair of this._autoClosingPairs) {
                if (autoClosingPair.open === character) {
                    return autoClosingPair.isOK(standardTokenType);
                }
            }
            return false;
        }
        getSurroundingPairs() {
            return this._surroundingPairs;
        }
    }
    CharacterPairSupport.DEFAULT_AUTOCLOSE_BEFORE_LANGUAGE_DEFINED = ';:.,=}])> \n\t';
    CharacterPairSupport.DEFAULT_AUTOCLOSE_BEFORE_WHITESPACE = ' \n\t';
    exports.CharacterPairSupport = CharacterPairSupport;
});
//# sourceMappingURL=characterPair.js.map