/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/async", "vs/base/common/strings", "vs/editor/common/core/lineTokens", "vs/editor/common/modes", "vs/editor/common/viewLayout/viewLineRenderer", "vs/editor/common/viewModel/viewModel", "vs/editor/standalone/common/monarch/monarchLexer"], function (require, exports, async_1, strings, lineTokens_1, modes_1, viewLineRenderer_1, viewModel_1, monarchLexer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Colorizer {
        static colorizeElement(themeService, modeService, domNode, options) {
            options = options || {};
            let theme = options.theme || 'vs';
            let mimeType = options.mimeType || domNode.getAttribute('lang') || domNode.getAttribute('data-lang');
            if (!mimeType) {
                console.error('Mode not detected');
                return Promise.resolve();
            }
            themeService.setTheme(theme);
            let text = domNode.firstChild ? domNode.firstChild.nodeValue : '';
            domNode.className += ' ' + theme;
            let render = (str) => {
                domNode.innerHTML = str;
            };
            return this.colorize(modeService, text || '', mimeType, options).then(render, (err) => console.error(err));
        }
        static colorize(modeService, text, mimeType, options) {
            let tabSize = 4;
            if (options && typeof options.tabSize === 'number') {
                tabSize = options.tabSize;
            }
            if (strings.startsWithUTF8BOM(text)) {
                text = text.substr(1);
            }
            let lines = text.split(/\r\n|\r|\n/);
            let language = modeService.getModeId(mimeType);
            if (!language) {
                return Promise.resolve(_fakeColorize(lines, tabSize));
            }
            // Send out the event to create the mode
            modeService.triggerMode(language);
            const tokenizationSupport = modes_1.TokenizationRegistry.get(language);
            if (tokenizationSupport) {
                return _colorize(lines, tabSize, tokenizationSupport);
            }
            const tokenizationSupportPromise = modes_1.TokenizationRegistry.getPromise(language);
            if (tokenizationSupportPromise) {
                // A tokenizer will be registered soon
                return new Promise((resolve, reject) => {
                    tokenizationSupportPromise.then(tokenizationSupport => {
                        _colorize(lines, tabSize, tokenizationSupport).then(resolve, reject);
                    }, reject);
                });
            }
            return new Promise((resolve, reject) => {
                let listener = null;
                let timeout = null;
                const execute = () => {
                    if (listener) {
                        listener.dispose();
                        listener = null;
                    }
                    if (timeout) {
                        timeout.dispose();
                        timeout = null;
                    }
                    const tokenizationSupport = modes_1.TokenizationRegistry.get(language);
                    if (tokenizationSupport) {
                        _colorize(lines, tabSize, tokenizationSupport).then(resolve, reject);
                        return;
                    }
                    resolve(_fakeColorize(lines, tabSize));
                };
                // wait 500ms for mode to load, then give up
                timeout = new async_1.TimeoutTimer();
                timeout.cancelAndSet(execute, 500);
                listener = modes_1.TokenizationRegistry.onDidChange((e) => {
                    if (e.changedLanguages.indexOf(language) >= 0) {
                        execute();
                    }
                });
            });
        }
        static colorizeLine(line, mightContainNonBasicASCII, mightContainRTL, tokens, tabSize = 4) {
            const isBasicASCII = viewModel_1.ViewLineRenderingData.isBasicASCII(line, mightContainNonBasicASCII);
            const containsRTL = viewModel_1.ViewLineRenderingData.containsRTL(line, isBasicASCII, mightContainRTL);
            let renderResult = viewLineRenderer_1.renderViewLine2(new viewLineRenderer_1.RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, tokens, [], tabSize, 0, -1, 'none', false, false, null));
            return renderResult.html;
        }
        static colorizeModelLine(model, lineNumber, tabSize = 4) {
            let content = model.getLineContent(lineNumber);
            model.forceTokenization(lineNumber);
            let tokens = model.getLineTokens(lineNumber);
            let inflatedTokens = tokens.inflate();
            return this.colorizeLine(content, model.mightContainNonBasicASCII(), model.mightContainRTL(), inflatedTokens, tabSize);
        }
    }
    exports.Colorizer = Colorizer;
    function _colorize(lines, tabSize, tokenizationSupport) {
        return new Promise((c, e) => {
            const execute = () => {
                const result = _actualColorize(lines, tabSize, tokenizationSupport);
                if (tokenizationSupport instanceof monarchLexer_1.MonarchTokenizer) {
                    const status = tokenizationSupport.getLoadStatus();
                    if (status.loaded === false) {
                        status.promise.then(execute, e);
                        return;
                    }
                }
                c(result);
            };
            execute();
        });
    }
    function _fakeColorize(lines, tabSize) {
        let html = [];
        const defaultMetadata = ((0 /* None */ << 11 /* FONT_STYLE_OFFSET */)
            | (1 /* DefaultForeground */ << 14 /* FOREGROUND_OFFSET */)
            | (2 /* DefaultBackground */ << 23 /* BACKGROUND_OFFSET */)) >>> 0;
        const tokens = new Uint32Array(2);
        tokens[0] = 0;
        tokens[1] = defaultMetadata;
        for (let i = 0, length = lines.length; i < length; i++) {
            let line = lines[i];
            tokens[0] = line.length;
            const lineTokens = new lineTokens_1.LineTokens(tokens, line);
            const isBasicASCII = viewModel_1.ViewLineRenderingData.isBasicASCII(line, /* check for basic ASCII */ true);
            const containsRTL = viewModel_1.ViewLineRenderingData.containsRTL(line, isBasicASCII, /* check for RTL */ true);
            let renderResult = viewLineRenderer_1.renderViewLine2(new viewLineRenderer_1.RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, lineTokens, [], tabSize, 0, -1, 'none', false, false, null));
            html = html.concat(renderResult.html);
            html.push('<br/>');
        }
        return html.join('');
    }
    function _actualColorize(lines, tabSize, tokenizationSupport) {
        let html = [];
        let state = tokenizationSupport.getInitialState();
        for (let i = 0, length = lines.length; i < length; i++) {
            let line = lines[i];
            let tokenizeResult = tokenizationSupport.tokenize2(line, state, 0);
            lineTokens_1.LineTokens.convertToEndOffset(tokenizeResult.tokens, line.length);
            let lineTokens = new lineTokens_1.LineTokens(tokenizeResult.tokens, line);
            const isBasicASCII = viewModel_1.ViewLineRenderingData.isBasicASCII(line, /* check for basic ASCII */ true);
            const containsRTL = viewModel_1.ViewLineRenderingData.containsRTL(line, isBasicASCII, /* check for RTL */ true);
            let renderResult = viewLineRenderer_1.renderViewLine2(new viewLineRenderer_1.RenderLineInput(false, true, line, false, isBasicASCII, containsRTL, 0, lineTokens.inflate(), [], tabSize, 0, -1, 'none', false, false, null));
            html = html.concat(renderResult.html);
            html.push('<br/>');
            state = tokenizeResult.endState;
        }
        return html.join('');
    }
});
//# sourceMappingURL=colorizer.js.map