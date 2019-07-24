define(["require", "exports", "assert", "vs/base/parts/quickopen/browser/quickOpenModel", "vs/base/parts/quickopen/browser/quickOpenViewer"], function (require, exports, assert, quickOpenModel_1, quickOpenViewer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    suite('QuickOpen', () => {
        test('QuickOpenModel', () => {
            const model = new quickOpenModel_1.QuickOpenModel();
            const entry1 = new quickOpenModel_1.QuickOpenEntry();
            const entry2 = new quickOpenModel_1.QuickOpenEntry();
            const entry3 = new quickOpenModel_1.QuickOpenEntryGroup();
            assert.notEqual(entry1.getId(), entry2.getId());
            assert.notEqual(entry2.getId(), entry3.getId());
            model.addEntries([entry1, entry2, entry3]);
            assert.equal(3, model.getEntries().length);
            model.setEntries([entry1, entry2]);
            assert.equal(2, model.getEntries().length);
            entry1.setHidden(true);
            assert.equal(1, model.getEntries(true).length);
            assert.equal(entry2, model.getEntries(true)[0]);
        });
        test('QuickOpenDataSource', () => {
            const model = new quickOpenModel_1.QuickOpenModel();
            const entry1 = new quickOpenModel_1.QuickOpenEntry();
            const entry2 = new quickOpenModel_1.QuickOpenEntry();
            const entry3 = new quickOpenModel_1.QuickOpenEntryGroup();
            model.addEntries([entry1, entry2, entry3]);
            const ds = new quickOpenViewer_1.DataSource(model);
            assert.equal(entry1.getId(), ds.getId(null, entry1));
            assert.equal(true, ds.hasChildren(null, model));
            assert.equal(false, ds.hasChildren(null, entry1));
            ds.getChildren(null, model).then((children) => {
                assert.equal(3, children.length);
            });
        });
    });
});
//# sourceMappingURL=quickopen.test.js.map