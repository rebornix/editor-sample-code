/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/browser/dom", "vs/base/common/idGenerator", "vs/base/common/strings", "vs/base/common/htmlContent", "vs/base/common/marked/marked", "vs/base/common/errors", "vs/base/common/uri", "vs/base/common/marshalling", "vs/base/common/objects"], function (require, exports, DOM, idGenerator_1, strings_1, htmlContent_1, marked, errors_1, uri_1, marshalling_1, objects_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function createElement(options) {
        const tagName = options.inline ? 'span' : 'div';
        const element = document.createElement(tagName);
        if (options.className) {
            element.className = options.className;
        }
        return element;
    }
    function renderText(text, options = {}) {
        const element = createElement(options);
        element.textContent = text;
        return element;
    }
    exports.renderText = renderText;
    function renderFormattedText(formattedText, options = {}) {
        const element = createElement(options);
        _renderFormattedText(element, parseFormattedText(formattedText), options.actionHandler);
        return element;
    }
    exports.renderFormattedText = renderFormattedText;
    /**
     * Create html nodes for the given content element.
     */
    function renderMarkdown(markdown, options = {}) {
        const element = createElement(options);
        const _uriMassage = function (part) {
            let data;
            try {
                data = marshalling_1.parse(decodeURIComponent(part));
            }
            catch (e) {
                // ignore
            }
            if (!data) {
                return part;
            }
            data = objects_1.cloneAndChange(data, value => {
                if (markdown.uris && markdown.uris[value]) {
                    return uri_1.URI.revive(markdown.uris[value]);
                }
                else {
                    return undefined;
                }
            });
            return encodeURIComponent(JSON.stringify(data));
        };
        const _href = function (href, isDomUri) {
            const data = markdown.uris && markdown.uris[href];
            if (!data) {
                return href;
            }
            let uri = uri_1.URI.revive(data);
            if (isDomUri) {
                uri = DOM.asDomUri(uri);
            }
            if (uri.query) {
                uri = uri.with({ query: _uriMassage(uri.query) });
            }
            if (data) {
                href = uri.toString(true);
            }
            return href;
        };
        // signal to code-block render that the
        // element has been created
        let signalInnerHTML;
        const withInnerHTML = new Promise(c => signalInnerHTML = c);
        const renderer = new marked.Renderer();
        renderer.image = (href, title, text) => {
            let dimensions = [];
            let attributes = [];
            if (href) {
                ({ href, dimensions } = htmlContent_1.parseHrefAndDimensions(href));
                href = _href(href, true);
                attributes.push(`src="${href}"`);
            }
            if (text) {
                attributes.push(`alt="${text}"`);
            }
            if (title) {
                attributes.push(`title="${title}"`);
            }
            if (dimensions.length) {
                attributes = attributes.concat(dimensions);
            }
            return '<img ' + attributes.join(' ') + '>';
        };
        renderer.link = (href, title, text) => {
            // Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
            if (href === text) { // raw link case
                text = htmlContent_1.removeMarkdownEscapes(text);
            }
            href = _href(href, false);
            title = htmlContent_1.removeMarkdownEscapes(title);
            href = htmlContent_1.removeMarkdownEscapes(href);
            if (!href
                || href.match(/^data:|javascript:/i)
                || (href.match(/^command:/i) && !markdown.isTrusted)
                || href.match(/^command:(\/\/\/)?_workbench\.downloadResource/i)) {
                // drop the link
                return text;
            }
            else {
                // HTML Encode href
                href = href.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
                return `<a href="#" data-href="${href}" title="${title || href}">${text}</a>`;
            }
        };
        renderer.paragraph = (text) => {
            return `<p>${text}</p>`;
        };
        if (options.codeBlockRenderer) {
            renderer.code = (code, lang) => {
                const value = options.codeBlockRenderer(lang, code);
                // when code-block rendering is async we return sync
                // but update the node with the real result later.
                const id = idGenerator_1.defaultGenerator.nextId();
                const promise = Promise.all([value, withInnerHTML]).then(values => {
                    const strValue = values[0];
                    const span = element.querySelector(`div[data-code="${id}"]`);
                    if (span) {
                        span.innerHTML = strValue;
                    }
                }).catch(err => {
                    // ignore
                });
                if (options.codeBlockRenderCallback) {
                    promise.then(options.codeBlockRenderCallback);
                }
                return `<div class="code" data-code="${id}">${strings_1.escape(code)}</div>`;
            };
        }
        if (options.actionHandler) {
            options.actionHandler.disposeables.add(DOM.addStandardDisposableListener(element, 'click', event => {
                let target = event.target;
                if (target.tagName !== 'A') {
                    target = target.parentElement;
                    if (!target || target.tagName !== 'A') {
                        return;
                    }
                }
                try {
                    const href = target.dataset['href'];
                    if (href) {
                        options.actionHandler.callback(href, event);
                    }
                }
                catch (err) {
                    errors_1.onUnexpectedError(err);
                }
                finally {
                    event.preventDefault();
                }
            }));
        }
        const markedOptions = {
            sanitize: true,
            renderer
        };
        element.innerHTML = marked.parse(markdown.value, markedOptions);
        signalInnerHTML();
        return element;
    }
    exports.renderMarkdown = renderMarkdown;
    // --- formatted string parsing
    class StringStream {
        constructor(source) {
            this.source = source;
            this.index = 0;
        }
        eos() {
            return this.index >= this.source.length;
        }
        next() {
            const next = this.peek();
            this.advance();
            return next;
        }
        peek() {
            return this.source[this.index];
        }
        advance() {
            this.index++;
        }
    }
    var FormatType;
    (function (FormatType) {
        FormatType[FormatType["Invalid"] = 0] = "Invalid";
        FormatType[FormatType["Root"] = 1] = "Root";
        FormatType[FormatType["Text"] = 2] = "Text";
        FormatType[FormatType["Bold"] = 3] = "Bold";
        FormatType[FormatType["Italics"] = 4] = "Italics";
        FormatType[FormatType["Action"] = 5] = "Action";
        FormatType[FormatType["ActionClose"] = 6] = "ActionClose";
        FormatType[FormatType["NewLine"] = 7] = "NewLine";
    })(FormatType || (FormatType = {}));
    function _renderFormattedText(element, treeNode, actionHandler) {
        let child;
        if (treeNode.type === 2 /* Text */) {
            child = document.createTextNode(treeNode.content || '');
        }
        else if (treeNode.type === 3 /* Bold */) {
            child = document.createElement('b');
        }
        else if (treeNode.type === 4 /* Italics */) {
            child = document.createElement('i');
        }
        else if (treeNode.type === 5 /* Action */ && actionHandler) {
            const a = document.createElement('a');
            a.href = '#';
            actionHandler.disposeables.add(DOM.addStandardDisposableListener(a, 'click', (event) => {
                actionHandler.callback(String(treeNode.index), event);
            }));
            child = a;
        }
        else if (treeNode.type === 7 /* NewLine */) {
            child = document.createElement('br');
        }
        else if (treeNode.type === 1 /* Root */) {
            child = element;
        }
        if (child && element !== child) {
            element.appendChild(child);
        }
        if (child && Array.isArray(treeNode.children)) {
            treeNode.children.forEach((nodeChild) => {
                _renderFormattedText(child, nodeChild, actionHandler);
            });
        }
    }
    function parseFormattedText(content) {
        const root = {
            type: 1 /* Root */,
            children: []
        };
        let actionViewItemIndex = 0;
        let current = root;
        const stack = [];
        const stream = new StringStream(content);
        while (!stream.eos()) {
            let next = stream.next();
            const isEscapedFormatType = (next === '\\' && formatTagType(stream.peek()) !== 0 /* Invalid */);
            if (isEscapedFormatType) {
                next = stream.next(); // unread the backslash if it escapes a format tag type
            }
            if (!isEscapedFormatType && isFormatTag(next) && next === stream.peek()) {
                stream.advance();
                if (current.type === 2 /* Text */) {
                    current = stack.pop();
                }
                const type = formatTagType(next);
                if (current.type === type || (current.type === 5 /* Action */ && type === 6 /* ActionClose */)) {
                    current = stack.pop();
                }
                else {
                    const newCurrent = {
                        type: type,
                        children: []
                    };
                    if (type === 5 /* Action */) {
                        newCurrent.index = actionViewItemIndex;
                        actionViewItemIndex++;
                    }
                    current.children.push(newCurrent);
                    stack.push(current);
                    current = newCurrent;
                }
            }
            else if (next === '\n') {
                if (current.type === 2 /* Text */) {
                    current = stack.pop();
                }
                current.children.push({
                    type: 7 /* NewLine */
                });
            }
            else {
                if (current.type !== 2 /* Text */) {
                    const textCurrent = {
                        type: 2 /* Text */,
                        content: next
                    };
                    current.children.push(textCurrent);
                    stack.push(current);
                    current = textCurrent;
                }
                else {
                    current.content += next;
                }
            }
        }
        if (current.type === 2 /* Text */) {
            current = stack.pop();
        }
        if (stack.length) {
            // incorrectly formatted string literal
        }
        return root;
    }
    function isFormatTag(char) {
        return formatTagType(char) !== 0 /* Invalid */;
    }
    function formatTagType(char) {
        switch (char) {
            case '*':
                return 3 /* Bold */;
            case '_':
                return 4 /* Italics */;
            case '[':
                return 5 /* Action */;
            case ']':
                return 6 /* ActionClose */;
            default:
                return 0 /* Invalid */;
        }
    }
});
//# sourceMappingURL=htmlContentRenderer.js.map