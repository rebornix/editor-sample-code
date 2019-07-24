/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/nls", "vs/editor/browser/editorExtensions", "vs/base/common/stopwatch"], function (require, exports, nls, editorExtensions_1, stopwatch_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ForceRetokenizeAction extends editorExtensions_1.EditorAction {
        constructor() {
            super({
                id: 'editor.action.forceRetokenize',
                label: nls.localize('forceRetokenize', "Developer: Force Retokenize"),
                alias: 'Developer: Force Retokenize',
                precondition: undefined
            });
        }
        run(accessor, editor) {
            if (!editor.hasModel()) {
                return;
            }
            const model = editor.getModel();
            model.resetTokenization();
            const sw = new stopwatch_1.StopWatch(true);
            model.forceTokenization(model.getLineCount());
            sw.stop();
            console.log(`tokenization took ${sw.elapsed()}`);
            if (!true) {
                extractTokenTypes(model);
            }
        }
    }
    function extractTokenTypes(model) {
        const eolLength = model.getEOL().length;
        let result = [];
        let resultLen = 0;
        let lastTokenType = 0 /* Other */;
        let lastEndOffset = 0;
        let offset = 0;
        for (let lineNumber = 1, lineCount = model.getLineCount(); lineNumber <= lineCount; lineNumber++) {
            const lineTokens = model.getLineTokens(lineNumber);
            for (let i = 0, len = lineTokens.getCount(); i < len; i++) {
                const tokenType = lineTokens.getStandardTokenType(i);
                if (tokenType === 0 /* Other */) {
                    continue;
                }
                const startOffset = offset + lineTokens.getStartOffset(i);
                const endOffset = offset + lineTokens.getEndOffset(i);
                const length = endOffset - startOffset;
                if (length === 0) {
                    continue;
                }
                if (lastTokenType === tokenType && lastEndOffset === startOffset) {
                    result[resultLen - 2] += length;
                    lastEndOffset += length;
                    continue;
                }
                result[resultLen++] = startOffset; // - lastEndOffset
                result[resultLen++] = length;
                result[resultLen++] = tokenType;
                lastTokenType = tokenType;
                lastEndOffset = endOffset;
            }
            offset += lineTokens.getLineContent().length + eolLength;
        }
    }
    editorExtensions_1.registerEditorAction(ForceRetokenizeAction);
});
//# sourceMappingURL=tokenization.js.map