define(["require", "exports", "vs/editor/common/core/selection", "vs/editor/contrib/comment/blockCommentCommand", "vs/editor/test/browser/testCommand", "vs/editor/test/common/commentMode"], function (require, exports, selection_1, blockCommentCommand_1, testCommand_1, commentMode_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function testBlockCommentCommand(lines, selection, expectedLines, expectedSelection) {
        let mode = new commentMode_1.CommentMode({ lineComment: '!@#', blockComment: ['<0', '0>'] });
        testCommand_1.testCommand(lines, mode.getLanguageIdentifier(), selection, (sel) => new blockCommentCommand_1.BlockCommentCommand(sel), expectedLines, expectedSelection);
        mode.dispose();
    }
    suite('Editor Contrib - Block Comment Command', () => {
        test('empty selection wraps itself', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 3, 1, 3), [
                'fi<0  0>rst',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 6));
        });
        test('invisible selection ignored', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 1, 1, 1), [
                '<0 first',
                ' 0>\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 4, 2, 1));
        });
        test('bug9511', () => {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 1), [
                '<0 first 0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 4, 1, 9));
            testBlockCommentCommand([
                '<0first0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 8, 1, 3), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 1, 6));
        });
        test('one line selection', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 3), [
                'fi<0 rst 0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 9));
        });
        test('one line selection toggle', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 3), [
                'fi<0 rst 0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 6, 1, 9));
            testBlockCommentCommand([
                'fi<0rst0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 8, 1, 5), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 3, 1, 6));
            testBlockCommentCommand([
                '<0 first 0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 10, 1, 1), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 1, 6));
            testBlockCommentCommand([
                '<0 first0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 9, 1, 1), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 1, 6));
            testBlockCommentCommand([
                '<0first 0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 9, 1, 1), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 1, 6));
            testBlockCommentCommand([
                'fi<0rst0>',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 8, 1, 5), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 3, 1, 6));
        });
        test('multi line selection', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 1), [
                '<0 first',
                '\tse 0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 4, 2, 4));
        });
        test('multi line selection toggle', function () {
            testBlockCommentCommand([
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 1), [
                '<0 first',
                '\tse 0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 4, 2, 4));
            testBlockCommentCommand([
                '<0first',
                '\tse0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 3), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 2, 4));
            testBlockCommentCommand([
                '<0 first',
                '\tse0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 3), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 2, 4));
            testBlockCommentCommand([
                '<0first',
                '\tse 0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 3), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 2, 4));
            testBlockCommentCommand([
                '<0 first',
                '\tse 0>cond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(2, 4, 1, 3), [
                'first',
                '\tsecond line',
                'third line',
                'fourth line',
                'fifth'
            ], new selection_1.Selection(1, 1, 2, 4));
        });
        test('fuzzy removes', function () {
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 5, 1, 7), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 5, 1, 6), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 5, 1, 5), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 5, 1, 11), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 1, 1, 11), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
            testBlockCommentCommand([
                'asd <0 qwe',
                'asd 0> qwe'
            ], new selection_1.Selection(2, 7, 1, 11), [
                'asd qwe',
                'asd qwe'
            ], new selection_1.Selection(1, 5, 2, 4));
        });
        test('bug #30358', function () {
            testBlockCommentCommand([
                '<0 start 0> middle end',
            ], new selection_1.Selection(1, 20, 1, 23), [
                '<0 start 0> middle <0 end 0>'
            ], new selection_1.Selection(1, 23, 1, 26));
            testBlockCommentCommand([
                '<0 start 0> middle <0 end 0>'
            ], new selection_1.Selection(1, 13, 1, 19), [
                '<0 start 0> <0 middle 0> <0 end 0>'
            ], new selection_1.Selection(1, 16, 1, 22));
        });
        test('issue #34618', function () {
            testBlockCommentCommand([
                '<0  0> middle end',
            ], new selection_1.Selection(1, 4, 1, 4), [
                ' middle end'
            ], new selection_1.Selection(1, 1, 1, 1));
        });
    });
});
//# sourceMappingURL=blockCommentCommand.test.js.map