/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/nls"], function (require, exports, nls) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ModifierLabelProvider {
        constructor(mac, windows, linux = windows) {
            this.modifierLabels = [null]; // index 0 will never me accessed.
            this.modifierLabels[2 /* Macintosh */] = mac;
            this.modifierLabels[1 /* Windows */] = windows;
            this.modifierLabels[3 /* Linux */] = linux;
        }
        toLabel(OS, parts, keyLabelProvider) {
            if (parts.length === 0) {
                return null;
            }
            const result = [];
            for (let i = 0, len = parts.length; i < len; i++) {
                const part = parts[i];
                const keyLabel = keyLabelProvider(part);
                if (keyLabel === null) {
                    // this keybinding cannot be expressed...
                    return null;
                }
                result[i] = _simpleAsString(part, keyLabel, this.modifierLabels[OS]);
            }
            return result.join(' ');
        }
    }
    exports.ModifierLabelProvider = ModifierLabelProvider;
    /**
     * A label provider that prints modifiers in a suitable format for displaying in the UI.
     */
    exports.UILabelProvider = new ModifierLabelProvider({
        ctrlKey: '⌃',
        shiftKey: '⇧',
        altKey: '⌥',
        metaKey: '⌘',
        separator: '',
    }, {
        ctrlKey: nls.localize({ key: 'ctrlKey', comment: ['This is the short form for the Control key on the keyboard'] }, "Ctrl"),
        shiftKey: nls.localize({ key: 'shiftKey', comment: ['This is the short form for the Shift key on the keyboard'] }, "Shift"),
        altKey: nls.localize({ key: 'altKey', comment: ['This is the short form for the Alt key on the keyboard'] }, "Alt"),
        metaKey: nls.localize({ key: 'windowsKey', comment: ['This is the short form for the Windows key on the keyboard'] }, "Windows"),
        separator: '+',
    }, {
        ctrlKey: nls.localize({ key: 'ctrlKey', comment: ['This is the short form for the Control key on the keyboard'] }, "Ctrl"),
        shiftKey: nls.localize({ key: 'shiftKey', comment: ['This is the short form for the Shift key on the keyboard'] }, "Shift"),
        altKey: nls.localize({ key: 'altKey', comment: ['This is the short form for the Alt key on the keyboard'] }, "Alt"),
        metaKey: nls.localize({ key: 'superKey', comment: ['This is the short form for the Super key on the keyboard'] }, "Super"),
        separator: '+',
    });
    /**
     * A label provider that prints modifiers in a suitable format for ARIA.
     */
    exports.AriaLabelProvider = new ModifierLabelProvider({
        ctrlKey: nls.localize({ key: 'ctrlKey.long', comment: ['This is the long form for the Control key on the keyboard'] }, "Control"),
        shiftKey: nls.localize({ key: 'shiftKey.long', comment: ['This is the long form for the Shift key on the keyboard'] }, "Shift"),
        altKey: nls.localize({ key: 'altKey.long', comment: ['This is the long form for the Alt key on the keyboard'] }, "Alt"),
        metaKey: nls.localize({ key: 'cmdKey.long', comment: ['This is the long form for the Command key on the keyboard'] }, "Command"),
        separator: '+',
    }, {
        ctrlKey: nls.localize({ key: 'ctrlKey.long', comment: ['This is the long form for the Control key on the keyboard'] }, "Control"),
        shiftKey: nls.localize({ key: 'shiftKey.long', comment: ['This is the long form for the Shift key on the keyboard'] }, "Shift"),
        altKey: nls.localize({ key: 'altKey.long', comment: ['This is the long form for the Alt key on the keyboard'] }, "Alt"),
        metaKey: nls.localize({ key: 'windowsKey.long', comment: ['This is the long form for the Windows key on the keyboard'] }, "Windows"),
        separator: '+',
    }, {
        ctrlKey: nls.localize({ key: 'ctrlKey.long', comment: ['This is the long form for the Control key on the keyboard'] }, "Control"),
        shiftKey: nls.localize({ key: 'shiftKey.long', comment: ['This is the long form for the Shift key on the keyboard'] }, "Shift"),
        altKey: nls.localize({ key: 'altKey.long', comment: ['This is the long form for the Alt key on the keyboard'] }, "Alt"),
        metaKey: nls.localize({ key: 'superKey.long', comment: ['This is the long form for the Super key on the keyboard'] }, "Super"),
        separator: '+',
    });
    /**
     * A label provider that prints modifiers in a suitable format for Electron Accelerators.
     * See https://github.com/electron/electron/blob/master/docs/api/accelerator.md
     */
    exports.ElectronAcceleratorLabelProvider = new ModifierLabelProvider({
        ctrlKey: 'Ctrl',
        shiftKey: 'Shift',
        altKey: 'Alt',
        metaKey: 'Cmd',
        separator: '+',
    }, {
        ctrlKey: 'Ctrl',
        shiftKey: 'Shift',
        altKey: 'Alt',
        metaKey: 'Super',
        separator: '+',
    });
    /**
     * A label provider that prints modifiers in a suitable format for user settings.
     */
    exports.UserSettingsLabelProvider = new ModifierLabelProvider({
        ctrlKey: 'ctrl',
        shiftKey: 'shift',
        altKey: 'alt',
        metaKey: 'cmd',
        separator: '+',
    }, {
        ctrlKey: 'ctrl',
        shiftKey: 'shift',
        altKey: 'alt',
        metaKey: 'win',
        separator: '+',
    }, {
        ctrlKey: 'ctrl',
        shiftKey: 'shift',
        altKey: 'alt',
        metaKey: 'meta',
        separator: '+',
    });
    function _simpleAsString(modifiers, key, labels) {
        if (key === null) {
            return '';
        }
        const result = [];
        // translate modifier keys: Ctrl-Shift-Alt-Meta
        if (modifiers.ctrlKey) {
            result.push(labels.ctrlKey);
        }
        if (modifiers.shiftKey) {
            result.push(labels.shiftKey);
        }
        if (modifiers.altKey) {
            result.push(labels.altKey);
        }
        if (modifiers.metaKey) {
            result.push(labels.metaKey);
        }
        // the actual key
        result.push(key);
        return result.join(labels.separator);
    }
});
//# sourceMappingURL=keybindingLabels.js.map