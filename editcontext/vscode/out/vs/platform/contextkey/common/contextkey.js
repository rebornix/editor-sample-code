/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/strings", "vs/platform/instantiation/common/instantiation"], function (require, exports, strings_1, instantiation_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ContextKeyExprType;
    (function (ContextKeyExprType) {
        ContextKeyExprType[ContextKeyExprType["Defined"] = 1] = "Defined";
        ContextKeyExprType[ContextKeyExprType["Not"] = 2] = "Not";
        ContextKeyExprType[ContextKeyExprType["Equals"] = 3] = "Equals";
        ContextKeyExprType[ContextKeyExprType["NotEquals"] = 4] = "NotEquals";
        ContextKeyExprType[ContextKeyExprType["And"] = 5] = "And";
        ContextKeyExprType[ContextKeyExprType["Regex"] = 6] = "Regex";
    })(ContextKeyExprType = exports.ContextKeyExprType || (exports.ContextKeyExprType = {}));
    class ContextKeyExpr {
        static has(key) {
            return new ContextKeyDefinedExpr(key);
        }
        static equals(key, value) {
            return new ContextKeyEqualsExpr(key, value);
        }
        static notEquals(key, value) {
            return new ContextKeyNotEqualsExpr(key, value);
        }
        static regex(key, value) {
            return new ContextKeyRegexExpr(key, value);
        }
        static not(key) {
            return new ContextKeyNotExpr(key);
        }
        static and(...expr) {
            return new ContextKeyAndExpr(expr);
        }
        static deserialize(serialized, strict = false) {
            if (!serialized) {
                return undefined;
            }
            let pieces = serialized.split('&&');
            let result = new ContextKeyAndExpr(pieces.map(p => this._deserializeOne(p, strict)));
            return result.normalize();
        }
        static _deserializeOne(serializedOne, strict) {
            serializedOne = serializedOne.trim();
            if (serializedOne.indexOf('!=') >= 0) {
                let pieces = serializedOne.split('!=');
                return new ContextKeyNotEqualsExpr(pieces[0].trim(), this._deserializeValue(pieces[1], strict));
            }
            if (serializedOne.indexOf('==') >= 0) {
                let pieces = serializedOne.split('==');
                return new ContextKeyEqualsExpr(pieces[0].trim(), this._deserializeValue(pieces[1], strict));
            }
            if (serializedOne.indexOf('=~') >= 0) {
                let pieces = serializedOne.split('=~');
                return new ContextKeyRegexExpr(pieces[0].trim(), this._deserializeRegexValue(pieces[1], strict));
            }
            if (/^\!\s*/.test(serializedOne)) {
                return new ContextKeyNotExpr(serializedOne.substr(1).trim());
            }
            return new ContextKeyDefinedExpr(serializedOne);
        }
        static _deserializeValue(serializedValue, strict) {
            serializedValue = serializedValue.trim();
            if (serializedValue === 'true') {
                return true;
            }
            if (serializedValue === 'false') {
                return false;
            }
            let m = /^'([^']*)'$/.exec(serializedValue);
            if (m) {
                return m[1].trim();
            }
            return serializedValue;
        }
        static _deserializeRegexValue(serializedValue, strict) {
            if (strings_1.isFalsyOrWhitespace(serializedValue)) {
                if (strict) {
                    throw new Error('missing regexp-value for =~-expression');
                }
                else {
                    console.warn('missing regexp-value for =~-expression');
                }
                return null;
            }
            let start = serializedValue.indexOf('/');
            let end = serializedValue.lastIndexOf('/');
            if (start === end || start < 0 /* || to < 0 */) {
                if (strict) {
                    throw new Error(`bad regexp-value '${serializedValue}', missing /-enclosure`);
                }
                else {
                    console.warn(`bad regexp-value '${serializedValue}', missing /-enclosure`);
                }
                return null;
            }
            let value = serializedValue.slice(start + 1, end);
            let caseIgnoreFlag = serializedValue[end + 1] === 'i' ? 'i' : '';
            try {
                return new RegExp(value, caseIgnoreFlag);
            }
            catch (e) {
                if (strict) {
                    throw new Error(`bad regexp-value '${serializedValue}', parse error: ${e}`);
                }
                else {
                    console.warn(`bad regexp-value '${serializedValue}', parse error: ${e}`);
                }
                return null;
            }
        }
    }
    exports.ContextKeyExpr = ContextKeyExpr;
    function cmp(a, b) {
        let aType = a.getType();
        let bType = b.getType();
        if (aType !== bType) {
            return aType - bType;
        }
        switch (aType) {
            case 1 /* Defined */:
                return a.cmp(b);
            case 2 /* Not */:
                return a.cmp(b);
            case 3 /* Equals */:
                return a.cmp(b);
            case 4 /* NotEquals */:
                return a.cmp(b);
            case 6 /* Regex */:
                return a.cmp(b);
            default:
                throw new Error('Unknown ContextKeyExpr!');
        }
    }
    class ContextKeyDefinedExpr {
        constructor(key) {
            this.key = key;
        }
        getType() {
            return 1 /* Defined */;
        }
        cmp(other) {
            if (this.key < other.key) {
                return -1;
            }
            if (this.key > other.key) {
                return 1;
            }
            return 0;
        }
        equals(other) {
            if (other instanceof ContextKeyDefinedExpr) {
                return (this.key === other.key);
            }
            return false;
        }
        evaluate(context) {
            return (!!context.getValue(this.key));
        }
        normalize() {
            return this;
        }
        serialize() {
            return this.key;
        }
        keys() {
            return [this.key];
        }
        map(mapFnc) {
            return mapFnc.mapDefined(this.key);
        }
    }
    exports.ContextKeyDefinedExpr = ContextKeyDefinedExpr;
    class ContextKeyEqualsExpr {
        constructor(key, value) {
            this.key = key;
            this.value = value;
        }
        getType() {
            return 3 /* Equals */;
        }
        cmp(other) {
            if (this.key < other.key) {
                return -1;
            }
            if (this.key > other.key) {
                return 1;
            }
            if (this.value < other.value) {
                return -1;
            }
            if (this.value > other.value) {
                return 1;
            }
            return 0;
        }
        equals(other) {
            if (other instanceof ContextKeyEqualsExpr) {
                return (this.key === other.key && this.value === other.value);
            }
            return false;
        }
        evaluate(context) {
            /* tslint:disable:triple-equals */
            // Intentional ==
            return (context.getValue(this.key) == this.value);
            /* tslint:enable:triple-equals */
        }
        normalize() {
            if (typeof this.value === 'boolean') {
                if (this.value) {
                    return new ContextKeyDefinedExpr(this.key);
                }
                return new ContextKeyNotExpr(this.key);
            }
            return this;
        }
        serialize() {
            if (typeof this.value === 'boolean') {
                return this.normalize().serialize();
            }
            return this.key + ' == \'' + this.value + '\'';
        }
        keys() {
            return [this.key];
        }
        map(mapFnc) {
            return mapFnc.mapEquals(this.key, this.value);
        }
    }
    exports.ContextKeyEqualsExpr = ContextKeyEqualsExpr;
    class ContextKeyNotEqualsExpr {
        constructor(key, value) {
            this.key = key;
            this.value = value;
        }
        getType() {
            return 4 /* NotEquals */;
        }
        cmp(other) {
            if (this.key < other.key) {
                return -1;
            }
            if (this.key > other.key) {
                return 1;
            }
            if (this.value < other.value) {
                return -1;
            }
            if (this.value > other.value) {
                return 1;
            }
            return 0;
        }
        equals(other) {
            if (other instanceof ContextKeyNotEqualsExpr) {
                return (this.key === other.key && this.value === other.value);
            }
            return false;
        }
        evaluate(context) {
            /* tslint:disable:triple-equals */
            // Intentional !=
            return (context.getValue(this.key) != this.value);
            /* tslint:enable:triple-equals */
        }
        normalize() {
            if (typeof this.value === 'boolean') {
                if (this.value) {
                    return new ContextKeyNotExpr(this.key);
                }
                return new ContextKeyDefinedExpr(this.key);
            }
            return this;
        }
        serialize() {
            if (typeof this.value === 'boolean') {
                return this.normalize().serialize();
            }
            return this.key + ' != \'' + this.value + '\'';
        }
        keys() {
            return [this.key];
        }
        map(mapFnc) {
            return mapFnc.mapNotEquals(this.key, this.value);
        }
    }
    exports.ContextKeyNotEqualsExpr = ContextKeyNotEqualsExpr;
    class ContextKeyNotExpr {
        constructor(key) {
            this.key = key;
        }
        getType() {
            return 2 /* Not */;
        }
        cmp(other) {
            if (this.key < other.key) {
                return -1;
            }
            if (this.key > other.key) {
                return 1;
            }
            return 0;
        }
        equals(other) {
            if (other instanceof ContextKeyNotExpr) {
                return (this.key === other.key);
            }
            return false;
        }
        evaluate(context) {
            return (!context.getValue(this.key));
        }
        normalize() {
            return this;
        }
        serialize() {
            return '!' + this.key;
        }
        keys() {
            return [this.key];
        }
        map(mapFnc) {
            return mapFnc.mapNot(this.key);
        }
    }
    exports.ContextKeyNotExpr = ContextKeyNotExpr;
    class ContextKeyRegexExpr {
        constructor(key, regexp) {
            this.key = key;
            this.regexp = regexp;
            //
        }
        getType() {
            return 6 /* Regex */;
        }
        cmp(other) {
            if (this.key < other.key) {
                return -1;
            }
            if (this.key > other.key) {
                return 1;
            }
            const thisSource = this.regexp ? this.regexp.source : '';
            const otherSource = other.regexp ? other.regexp.source : '';
            if (thisSource < otherSource) {
                return -1;
            }
            if (thisSource > otherSource) {
                return 1;
            }
            return 0;
        }
        equals(other) {
            if (other instanceof ContextKeyRegexExpr) {
                const thisSource = this.regexp ? this.regexp.source : '';
                const otherSource = other.regexp ? other.regexp.source : '';
                return (this.key === other.key && thisSource === otherSource);
            }
            return false;
        }
        evaluate(context) {
            let value = context.getValue(this.key);
            return this.regexp ? this.regexp.test(value) : false;
        }
        normalize() {
            return this;
        }
        serialize() {
            const value = this.regexp
                ? `/${this.regexp.source}/${this.regexp.ignoreCase ? 'i' : ''}`
                : '/invalid/';
            return `${this.key} =~ ${value}`;
        }
        keys() {
            return [this.key];
        }
        map(mapFnc) {
            return mapFnc.mapRegex(this.key, this.regexp);
        }
    }
    exports.ContextKeyRegexExpr = ContextKeyRegexExpr;
    class ContextKeyAndExpr {
        constructor(expr) {
            this.expr = ContextKeyAndExpr._normalizeArr(expr);
        }
        getType() {
            return 5 /* And */;
        }
        equals(other) {
            if (other instanceof ContextKeyAndExpr) {
                if (this.expr.length !== other.expr.length) {
                    return false;
                }
                for (let i = 0, len = this.expr.length; i < len; i++) {
                    if (!this.expr[i].equals(other.expr[i])) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }
        evaluate(context) {
            for (let i = 0, len = this.expr.length; i < len; i++) {
                if (!this.expr[i].evaluate(context)) {
                    return false;
                }
            }
            return true;
        }
        static _normalizeArr(arr) {
            let expr = [];
            if (arr) {
                for (let i = 0, len = arr.length; i < len; i++) {
                    let e = arr[i];
                    if (!e) {
                        continue;
                    }
                    e = e.normalize();
                    if (!e) {
                        continue;
                    }
                    if (e instanceof ContextKeyAndExpr) {
                        expr = expr.concat(e.expr);
                        continue;
                    }
                    expr.push(e);
                }
                expr.sort(cmp);
            }
            return expr;
        }
        normalize() {
            if (this.expr.length === 0) {
                return undefined;
            }
            if (this.expr.length === 1) {
                return this.expr[0];
            }
            return this;
        }
        serialize() {
            if (this.expr.length === 0) {
                return '';
            }
            if (this.expr.length === 1) {
                const normalized = this.normalize();
                if (!normalized) {
                    return '';
                }
                return normalized.serialize();
            }
            return this.expr.map(e => e.serialize()).join(' && ');
        }
        keys() {
            const result = [];
            for (let expr of this.expr) {
                result.push(...expr.keys());
            }
            return result;
        }
        map(mapFnc) {
            return new ContextKeyAndExpr(this.expr.map(expr => expr.map(mapFnc)));
        }
    }
    exports.ContextKeyAndExpr = ContextKeyAndExpr;
    class RawContextKey extends ContextKeyDefinedExpr {
        constructor(key, defaultValue) {
            super(key);
            this._defaultValue = defaultValue;
        }
        bindTo(target) {
            return target.createKey(this.key, this._defaultValue);
        }
        getValue(target) {
            return target.getContextKeyValue(this.key);
        }
        toNegated() {
            return ContextKeyExpr.not(this.key);
        }
        isEqualTo(value) {
            return ContextKeyExpr.equals(this.key, value);
        }
        notEqualsTo(value) {
            return ContextKeyExpr.notEquals(this.key, value);
        }
    }
    exports.RawContextKey = RawContextKey;
    exports.IContextKeyService = instantiation_1.createDecorator('contextKeyService');
    exports.SET_CONTEXT_COMMAND_ID = 'setContext';
});
//# sourceMappingURL=contextkey.js.map