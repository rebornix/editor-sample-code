define(["require", "exports", "assert", "vs/base/common/uri", "vs/editor/browser/services/openerService", "vs/editor/test/browser/editorTestServices", "vs/platform/commands/common/commands"], function (require, exports, assert, uri_1, openerService_1, editorTestServices_1, commands_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    suite('OpenerService', function () {
        const editorService = new editorTestServices_1.TestCodeEditorService();
        let lastCommand;
        const commandService = new class {
            constructor() {
                this.onWillExecuteCommand = () => ({ dispose: () => { } });
            }
            executeCommand(id, ...args) {
                lastCommand = { id, args };
                return Promise.resolve(undefined);
            }
        };
        setup(function () {
            lastCommand = undefined;
        });
        test('delegate to editorService, scheme:///fff', function () {
            const openerService = new openerService_1.OpenerService(editorService, commands_1.NullCommandService);
            openerService.open(uri_1.URI.parse('another:///somepath'));
            assert.equal(editorService.lastInput.options.selection, undefined);
        });
        test('delegate to editorService, scheme:///fff#L123', function () {
            const openerService = new openerService_1.OpenerService(editorService, commands_1.NullCommandService);
            openerService.open(uri_1.URI.parse('file:///somepath#L23'));
            assert.equal(editorService.lastInput.options.selection.startLineNumber, 23);
            assert.equal(editorService.lastInput.options.selection.startColumn, 1);
            assert.equal(editorService.lastInput.options.selection.endLineNumber, undefined);
            assert.equal(editorService.lastInput.options.selection.endColumn, undefined);
            assert.equal(editorService.lastInput.resource.fragment, '');
            openerService.open(uri_1.URI.parse('another:///somepath#L23'));
            assert.equal(editorService.lastInput.options.selection.startLineNumber, 23);
            assert.equal(editorService.lastInput.options.selection.startColumn, 1);
            openerService.open(uri_1.URI.parse('another:///somepath#L23,45'));
            assert.equal(editorService.lastInput.options.selection.startLineNumber, 23);
            assert.equal(editorService.lastInput.options.selection.startColumn, 45);
            assert.equal(editorService.lastInput.options.selection.endLineNumber, undefined);
            assert.equal(editorService.lastInput.options.selection.endColumn, undefined);
            assert.equal(editorService.lastInput.resource.fragment, '');
        });
        test('delegate to editorService, scheme:///fff#123,123', function () {
            const openerService = new openerService_1.OpenerService(editorService, commands_1.NullCommandService);
            openerService.open(uri_1.URI.parse('file:///somepath#23'));
            assert.equal(editorService.lastInput.options.selection.startLineNumber, 23);
            assert.equal(editorService.lastInput.options.selection.startColumn, 1);
            assert.equal(editorService.lastInput.options.selection.endLineNumber, undefined);
            assert.equal(editorService.lastInput.options.selection.endColumn, undefined);
            assert.equal(editorService.lastInput.resource.fragment, '');
            openerService.open(uri_1.URI.parse('file:///somepath#23,45'));
            assert.equal(editorService.lastInput.options.selection.startLineNumber, 23);
            assert.equal(editorService.lastInput.options.selection.startColumn, 45);
            assert.equal(editorService.lastInput.options.selection.endLineNumber, undefined);
            assert.equal(editorService.lastInput.options.selection.endColumn, undefined);
            assert.equal(editorService.lastInput.resource.fragment, '');
        });
        test('delegate to commandsService, command:someid', function () {
            const openerService = new openerService_1.OpenerService(editorService, commandService);
            const id = `aCommand${Math.random()}`;
            commands_1.CommandsRegistry.registerCommand(id, function () { });
            openerService.open(uri_1.URI.parse('command:' + id));
            assert.equal(lastCommand.id, id);
            assert.equal(lastCommand.args.length, 0);
            openerService.open(uri_1.URI.parse('command:' + id).with({ query: '123' }));
            assert.equal(lastCommand.id, id);
            assert.equal(lastCommand.args.length, 1);
            assert.equal(lastCommand.args[0], '123');
            openerService.open(uri_1.URI.parse('command:' + id).with({ query: JSON.stringify([12, true]) }));
            assert.equal(lastCommand.id, id);
            assert.equal(lastCommand.args.length, 2);
            assert.equal(lastCommand.args[0], 12);
            assert.equal(lastCommand.args[1], true);
        });
    });
});
//# sourceMappingURL=openerService.test.js.map