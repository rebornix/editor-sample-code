/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /*
     * This module exports common types and functionality shared between
     * the Monarch compiler that compiles JSON to ILexer, and the Monarch
     * Tokenizer (that highlights at runtime)
     */
    /*
     * Type definitions to be used internally to Monarch.
     * Inside monarch we use fully typed definitions and compiled versions of the more abstract JSON descriptions.
     */
    var MonarchBracket;
    (function (MonarchBracket) {
        MonarchBracket[MonarchBracket["None"] = 0] = "None";
        MonarchBracket[MonarchBracket["Open"] = 1] = "Open";
        MonarchBracket[MonarchBracket["Close"] = -1] = "Close";
    })(MonarchBracket = exports.MonarchBracket || (exports.MonarchBracket = {}));
    function isFuzzyActionArr(what) {
        return (Array.isArray(what));
    }
    exports.isFuzzyActionArr = isFuzzyActionArr;
    function isFuzzyAction(what) {
        return !isFuzzyActionArr(what);
    }
    exports.isFuzzyAction = isFuzzyAction;
    function isString(what) {
        return (typeof what === 'string');
    }
    exports.isString = isString;
    function isIAction(what) {
        return !isString(what);
    }
    exports.isIAction = isIAction;
    // Small helper functions
    /**
     * Is a string null, undefined, or empty?
     */
    function empty(s) {
        return (s ? false : true);
    }
    exports.empty = empty;
    /**
     * Puts a string to lower case if 'ignoreCase' is set.
     */
    function fixCase(lexer, str) {
        return (lexer.ignoreCase && str ? str.toLowerCase() : str);
    }
    exports.fixCase = fixCase;
    /**
     * Ensures there are no bad characters in a CSS token class.
     */
    function sanitize(s) {
        return s.replace(/[&<>'"_]/g, '-'); // used on all output token CSS classes
    }
    exports.sanitize = sanitize;
    // Logging
    /**
     * Logs a message.
     */
    function log(lexer, msg) {
        console.log(`${lexer.languageId}: ${msg}`);
    }
    exports.log = log;
    // Throwing errors
    function createError(lexer, msg) {
        return new Error(`${lexer.languageId}: ${msg}`);
    }
    exports.createError = createError;
    // Helper functions for rule finding and substitution
    /**
     * substituteMatches is used on lexer strings and can substitutes predefined patterns:
     * 		$$  => $
     * 		$#  => id
     * 		$n  => matched entry n
     * 		@attr => contents of lexer[attr]
     *
     * See documentation for more info
     */
    function substituteMatches(lexer, str, id, matches, state) {
        const re = /\$((\$)|(#)|(\d\d?)|[sS](\d\d?)|@(\w+))/g;
        let stateMatches = null;
        return str.replace(re, function (full, sub, dollar, hash, n, s, attr, ofs, total) {
            if (!empty(dollar)) {
                return '$'; // $$
            }
            if (!empty(hash)) {
                return fixCase(lexer, id); // default $#
            }
            if (!empty(n) && n < matches.length) {
                return fixCase(lexer, matches[n]); // $n
            }
            if (!empty(attr) && lexer && typeof (lexer[attr]) === 'string') {
                return lexer[attr]; //@attribute
            }
            if (stateMatches === null) { // split state on demand
                stateMatches = state.split('.');
                stateMatches.unshift(state);
            }
            if (!empty(s) && s < stateMatches.length) {
                return fixCase(lexer, stateMatches[s]); //$Sn
            }
            return '';
        });
    }
    exports.substituteMatches = substituteMatches;
    /**
     * Find the tokenizer rules for a specific state (i.e. next action)
     */
    function findRules(lexer, inState) {
        let state = inState;
        while (state && state.length > 0) {
            const rules = lexer.tokenizer[state];
            if (rules) {
                return rules;
            }
            const idx = state.lastIndexOf('.');
            if (idx < 0) {
                state = null; // no further parent
            }
            else {
                state = state.substr(0, idx);
            }
        }
        return null;
    }
    exports.findRules = findRules;
    /**
     * Is a certain state defined? In contrast to 'findRules' this works on a ILexerMin.
     * This is used during compilation where we may know the defined states
     * but not yet whether the corresponding rules are correct.
     */
    function stateExists(lexer, inState) {
        let state = inState;
        while (state && state.length > 0) {
            const exist = lexer.stateNames[state];
            if (exist) {
                return true;
            }
            const idx = state.lastIndexOf('.');
            if (idx < 0) {
                state = null; // no further parent
            }
            else {
                state = state.substr(0, idx);
            }
        }
        return false;
    }
    exports.stateExists = stateExists;
});
//# sourceMappingURL=monarchCommon.js.map