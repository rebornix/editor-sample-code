/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/lifecycle", "vs/base/common/arrays", "./gridview", "./gridview", "vs/css!./gridview"], function (require, exports, lifecycle_1, arrays_1, gridview_1, gridview_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Orientation = gridview_2.Orientation;
    exports.GridViewSizing = gridview_2.Sizing;
    var Direction;
    (function (Direction) {
        Direction[Direction["Up"] = 0] = "Up";
        Direction[Direction["Down"] = 1] = "Down";
        Direction[Direction["Left"] = 2] = "Left";
        Direction[Direction["Right"] = 3] = "Right";
    })(Direction = exports.Direction || (exports.Direction = {}));
    function oppositeDirection(direction) {
        switch (direction) {
            case 0 /* Up */: return 1 /* Down */;
            case 1 /* Down */: return 0 /* Up */;
            case 2 /* Left */: return 3 /* Right */;
            case 3 /* Right */: return 2 /* Left */;
        }
    }
    function isGridBranchNode(node) {
        return !!node.children;
    }
    exports.isGridBranchNode = isGridBranchNode;
    function getGridNode(node, location) {
        if (location.length === 0) {
            return node;
        }
        if (!isGridBranchNode(node)) {
            throw new Error('Invalid location');
        }
        const [index, ...rest] = location;
        return getGridNode(node.children[index], rest);
    }
    function intersects(one, other) {
        return !(one.start >= other.end || other.start >= one.end);
    }
    function getBoxBoundary(box, direction) {
        const orientation = getDirectionOrientation(direction);
        const offset = direction === 0 /* Up */ ? box.top :
            direction === 3 /* Right */ ? box.left + box.width :
                direction === 1 /* Down */ ? box.top + box.height :
                    box.left;
        const range = {
            start: orientation === 1 /* HORIZONTAL */ ? box.top : box.left,
            end: orientation === 1 /* HORIZONTAL */ ? box.top + box.height : box.left + box.width
        };
        return { offset, range };
    }
    function findAdjacentBoxLeafNodes(boxNode, direction, boundary) {
        const result = [];
        function _(boxNode, direction, boundary) {
            if (isGridBranchNode(boxNode)) {
                for (const child of boxNode.children) {
                    _(child, direction, boundary);
                }
            }
            else {
                const { offset, range } = getBoxBoundary(boxNode.box, direction);
                if (offset === boundary.offset && intersects(range, boundary.range)) {
                    result.push(boxNode);
                }
            }
        }
        _(boxNode, direction, boundary);
        return result;
    }
    function getLocationOrientation(rootOrientation, location) {
        return location.length % 2 === 0 ? gridview_1.orthogonal(rootOrientation) : rootOrientation;
    }
    function getDirectionOrientation(direction) {
        return direction === 0 /* Up */ || direction === 1 /* Down */ ? 0 /* VERTICAL */ : 1 /* HORIZONTAL */;
    }
    function getRelativeLocation(rootOrientation, location, direction) {
        const orientation = getLocationOrientation(rootOrientation, location);
        const directionOrientation = getDirectionOrientation(direction);
        if (orientation === directionOrientation) {
            let [rest, index] = arrays_1.tail2(location);
            if (direction === 3 /* Right */ || direction === 1 /* Down */) {
                index += 1;
            }
            return [...rest, index];
        }
        else {
            const index = (direction === 3 /* Right */ || direction === 1 /* Down */) ? 1 : 0;
            return [...location, index];
        }
    }
    exports.getRelativeLocation = getRelativeLocation;
    function indexInParent(element) {
        const parentElement = element.parentElement;
        if (!parentElement) {
            throw new Error('Invalid grid element');
        }
        let el = parentElement.firstElementChild;
        let index = 0;
        while (el !== element && el !== parentElement.lastElementChild && el) {
            el = el.nextElementSibling;
            index++;
        }
        return index;
    }
    /**
     * Find the grid location of a specific DOM element by traversing the parent
     * chain and finding each child index on the way.
     *
     * This will break as soon as DOM structures of the Splitview or Gridview change.
     */
    function getGridLocation(element) {
        const parentElement = element.parentElement;
        if (!parentElement) {
            throw new Error('Invalid grid element');
        }
        if (/\bmonaco-grid-view\b/.test(parentElement.className)) {
            return [];
        }
        const index = indexInParent(parentElement);
        const ancestor = parentElement.parentElement.parentElement.parentElement;
        return [...getGridLocation(ancestor), index];
    }
    var Sizing;
    (function (Sizing) {
        Sizing["Distribute"] = "distribute";
        Sizing["Split"] = "split";
    })(Sizing = exports.Sizing || (exports.Sizing = {}));
    class Grid extends lifecycle_1.Disposable {
        constructor(view, options = {}) {
            super();
            this.views = new Map();
            this.gridview = new gridview_1.GridView(options);
            this._register(this.gridview);
            this._register(this.gridview.onDidSashReset(this.doResetViewSize, this));
            this._addView(view, 0, [0]);
        }
        get orientation() { return this.gridview.orientation; }
        set orientation(orientation) { this.gridview.orientation = orientation; }
        get width() { return this.gridview.width; }
        get height() { return this.gridview.height; }
        get minimumWidth() { return this.gridview.minimumWidth; }
        get minimumHeight() { return this.gridview.minimumHeight; }
        get maximumWidth() { return this.gridview.maximumWidth; }
        get maximumHeight() { return this.gridview.maximumHeight; }
        get onDidChange() { return this.gridview.onDidChange; }
        get element() { return this.gridview.element; }
        style(styles) {
            this.gridview.style(styles);
        }
        layout(width, height) {
            this.gridview.layout(width, height);
        }
        hasView(view) {
            return this.views.has(view);
        }
        addView(newView, size, referenceView, direction) {
            if (this.views.has(newView)) {
                throw new Error('Can\'t add same view twice');
            }
            const orientation = getDirectionOrientation(direction);
            if (this.views.size === 1 && this.orientation !== orientation) {
                this.orientation = orientation;
            }
            const referenceLocation = this.getViewLocation(referenceView);
            const location = getRelativeLocation(this.gridview.orientation, referenceLocation, direction);
            let viewSize;
            if (size === "split" /* Split */) {
                const [, index] = arrays_1.tail2(referenceLocation);
                viewSize = gridview_1.Sizing.Split(index);
            }
            else if (size === "distribute" /* Distribute */) {
                viewSize = gridview_1.Sizing.Distribute;
            }
            else {
                viewSize = size;
            }
            this._addView(newView, viewSize, location);
        }
        _addView(newView, size, location) {
            this.views.set(newView, newView.element);
            this.gridview.addView(newView, size, location);
        }
        removeView(view, sizing) {
            if (this.views.size === 1) {
                throw new Error('Can\'t remove last view');
            }
            const location = this.getViewLocation(view);
            this.gridview.removeView(location, sizing === "distribute" /* Distribute */ ? gridview_1.Sizing.Distribute : undefined);
            this.views.delete(view);
        }
        moveView(view, sizing, referenceView, direction) {
            const sourceLocation = this.getViewLocation(view);
            const [sourceParentLocation, from] = arrays_1.tail2(sourceLocation);
            const referenceLocation = this.getViewLocation(referenceView);
            const targetLocation = getRelativeLocation(this.gridview.orientation, referenceLocation, direction);
            const [targetParentLocation, to] = arrays_1.tail2(targetLocation);
            if (arrays_1.equals(sourceParentLocation, targetParentLocation)) {
                this.gridview.moveView(sourceParentLocation, from, to);
            }
            else {
                this.removeView(view, typeof sizing === 'number' ? undefined : sizing);
                this.addView(view, sizing, referenceView, direction);
            }
        }
        swapViews(from, to) {
            const fromLocation = this.getViewLocation(from);
            const toLocation = this.getViewLocation(to);
            return this.gridview.swapViews(fromLocation, toLocation);
        }
        resizeView(view, size) {
            const location = this.getViewLocation(view);
            return this.gridview.resizeView(location, size);
        }
        getViewSize(view) {
            const location = this.getViewLocation(view);
            return this.gridview.getViewSize(location);
        }
        maximizeViewSize(view) {
            const location = this.getViewLocation(view);
            this.gridview.maximizeViewSize(location);
        }
        distributeViewSizes() {
            this.gridview.distributeViewSizes();
        }
        isViewVisible(view) {
            const location = this.getViewLocation(view);
            return this.gridview.isViewVisible(location);
        }
        setViewVisible(view, visible) {
            const location = this.getViewLocation(view);
            this.gridview.setViewVisible(location, visible);
        }
        getViews() {
            return this.gridview.getViews();
        }
        getNeighborViews(view, direction, wrap = false) {
            const location = this.getViewLocation(view);
            const root = this.getViews();
            const node = getGridNode(root, location);
            let boundary = getBoxBoundary(node.box, direction);
            if (wrap) {
                if (direction === 0 /* Up */ && node.box.top === 0) {
                    boundary = { offset: root.box.top + root.box.height, range: boundary.range };
                }
                else if (direction === 3 /* Right */ && node.box.left + node.box.width === root.box.width) {
                    boundary = { offset: 0, range: boundary.range };
                }
                else if (direction === 1 /* Down */ && node.box.top + node.box.height === root.box.height) {
                    boundary = { offset: 0, range: boundary.range };
                }
                else if (direction === 2 /* Left */ && node.box.left === 0) {
                    boundary = { offset: root.box.left + root.box.width, range: boundary.range };
                }
            }
            return findAdjacentBoxLeafNodes(root, oppositeDirection(direction), boundary)
                .map(node => node.view);
        }
        getViewLocation(view) {
            const element = this.views.get(view);
            if (!element) {
                throw new Error('View not found');
            }
            return getGridLocation(element);
        }
        doResetViewSize(location) {
            const [parentLocation,] = arrays_1.tail2(location);
            this.gridview.distributeViewSizes(parentLocation);
        }
    }
    exports.Grid = Grid;
    class SerializableGrid extends Grid {
        static serializeNode(node, orientation) {
            const size = orientation === 0 /* VERTICAL */ ? node.box.width : node.box.height;
            if (!isGridBranchNode(node)) {
                return { type: 'leaf', data: node.view.toJSON(), size };
            }
            return { type: 'branch', data: node.children.map(c => SerializableGrid.serializeNode(c, gridview_1.orthogonal(orientation))), size };
        }
        static deserializeNode(json, orientation, box, deserializer) {
            if (!json || typeof json !== 'object') {
                throw new Error('Invalid JSON');
            }
            if (json.type === 'branch') {
                if (!Array.isArray(json.data)) {
                    throw new Error('Invalid JSON: \'data\' property of branch must be an array.');
                }
                const children = [];
                let offset = 0;
                for (const child of json.data) {
                    if (typeof child.size !== 'number') {
                        throw new Error('Invalid JSON: \'size\' property of node must be a number.');
                    }
                    const childBox = orientation === 1 /* HORIZONTAL */
                        ? { top: box.top, left: box.left + offset, width: child.size, height: box.height }
                        : { top: box.top + offset, left: box.left, width: box.width, height: child.size };
                    children.push(SerializableGrid.deserializeNode(child, gridview_1.orthogonal(orientation), childBox, deserializer));
                    offset += child.size;
                }
                return { children, box };
            }
            else if (json.type === 'leaf') {
                const view = deserializer.fromJSON(json.data);
                return { view, box };
            }
            throw new Error('Invalid JSON: \'type\' property must be either \'branch\' or \'leaf\'.');
        }
        static getFirstLeaf(node) {
            if (!isGridBranchNode(node)) {
                return node;
            }
            return SerializableGrid.getFirstLeaf(node.children[0]);
        }
        static deserialize(json, deserializer, options = {}) {
            if (typeof json.orientation !== 'number') {
                throw new Error('Invalid JSON: \'orientation\' property must be a number.');
            }
            else if (typeof json.width !== 'number') {
                throw new Error('Invalid JSON: \'width\' property must be a number.');
            }
            else if (typeof json.height !== 'number') {
                throw new Error('Invalid JSON: \'height\' property must be a number.');
            }
            const orientation = json.orientation;
            const width = json.width;
            const height = json.height;
            const box = { top: 0, left: 0, width, height };
            const root = SerializableGrid.deserializeNode(json.root, orientation, box, deserializer);
            const firstLeaf = SerializableGrid.getFirstLeaf(root);
            if (!firstLeaf) {
                throw new Error('Invalid serialized state, first leaf not found');
            }
            const result = new SerializableGrid(firstLeaf.view, options);
            result.orientation = orientation;
            result.restoreViews(firstLeaf.view, orientation, root);
            result.initialLayoutContext = { width, height, root };
            return result;
        }
        serialize() {
            return {
                root: SerializableGrid.serializeNode(this.getViews(), this.orientation),
                orientation: this.orientation,
                width: this.width,
                height: this.height
            };
        }
        layout(width, height) {
            super.layout(width, height);
            if (this.initialLayoutContext) {
                const widthScale = width / this.initialLayoutContext.width;
                const heightScale = height / this.initialLayoutContext.height;
                this.restoreViewsSize([], this.initialLayoutContext.root, this.orientation, widthScale, heightScale);
                this.initialLayoutContext = undefined;
                this.gridview.trySet2x2();
            }
        }
        /**
         * Recursively restores views which were just deserialized.
         */
        restoreViews(referenceView, orientation, node) {
            if (!isGridBranchNode(node)) {
                return;
            }
            const direction = orientation === 0 /* VERTICAL */ ? 1 /* Down */ : 3 /* Right */;
            const firstLeaves = node.children.map(c => SerializableGrid.getFirstLeaf(c));
            for (let i = 1; i < firstLeaves.length; i++) {
                const size = orientation === 0 /* VERTICAL */ ? firstLeaves[i].box.height : firstLeaves[i].box.width;
                this.addView(firstLeaves[i].view, size, referenceView, direction);
                referenceView = firstLeaves[i].view;
            }
            for (let i = 0; i < node.children.length; i++) {
                this.restoreViews(firstLeaves[i].view, gridview_1.orthogonal(orientation), node.children[i]);
            }
        }
        /**
         * Recursively restores view sizes.
         * This should be called only after the very first layout call.
         */
        restoreViewsSize(location, node, orientation, widthScale, heightScale) {
            if (!isGridBranchNode(node)) {
                return;
            }
            const scale = orientation === 0 /* VERTICAL */ ? heightScale : widthScale;
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                const childLocation = [...location, i];
                if (i < node.children.length - 1) {
                    const size = orientation === 0 /* VERTICAL */
                        ? { height: Math.floor(child.box.height * scale) }
                        : { width: Math.floor(child.box.width * scale) };
                    this.gridview.resizeView(childLocation, size);
                }
                this.restoreViewsSize(childLocation, child, gridview_1.orthogonal(orientation), widthScale, heightScale);
            }
        }
    }
    exports.SerializableGrid = SerializableGrid;
    function sanitizeGridNodeDescriptor(nodeDescriptor) {
        if (nodeDescriptor.groups && nodeDescriptor.groups.length === 0) {
            nodeDescriptor.groups = undefined;
        }
        if (!nodeDescriptor.groups) {
            return;
        }
        let totalDefinedSize = 0;
        let totalDefinedSizeCount = 0;
        for (const child of nodeDescriptor.groups) {
            sanitizeGridNodeDescriptor(child);
            if (child.size) {
                totalDefinedSize += child.size;
                totalDefinedSizeCount++;
            }
        }
        const totalUndefinedSize = totalDefinedSizeCount > 0 ? totalDefinedSize : 1;
        const totalUndefinedSizeCount = nodeDescriptor.groups.length - totalDefinedSizeCount;
        const eachUndefinedSize = totalUndefinedSize / totalUndefinedSizeCount;
        for (const child of nodeDescriptor.groups) {
            if (!child.size) {
                child.size = eachUndefinedSize;
            }
        }
    }
    exports.sanitizeGridNodeDescriptor = sanitizeGridNodeDescriptor;
    function createSerializedNode(nodeDescriptor) {
        if (nodeDescriptor.groups) {
            return { type: 'branch', data: nodeDescriptor.groups.map(c => createSerializedNode(c)), size: nodeDescriptor.size };
        }
        else {
            return { type: 'leaf', data: null, size: nodeDescriptor.size };
        }
    }
    function getDimensions(node, orientation) {
        if (node.type === 'branch') {
            const childrenDimensions = node.data.map(c => getDimensions(c, gridview_1.orthogonal(orientation)));
            if (orientation === 0 /* VERTICAL */) {
                const width = node.size || (childrenDimensions.length === 0 ? undefined : Math.max(...childrenDimensions.map(d => d.width || 0)));
                const height = childrenDimensions.length === 0 ? undefined : childrenDimensions.reduce((r, d) => r + (d.height || 0), 0);
                return { width, height };
            }
            else {
                const width = childrenDimensions.length === 0 ? undefined : childrenDimensions.reduce((r, d) => r + (d.width || 0), 0);
                const height = node.size || (childrenDimensions.length === 0 ? undefined : Math.max(...childrenDimensions.map(d => d.height || 0)));
                return { width, height };
            }
        }
        else {
            const width = orientation === 0 /* VERTICAL */ ? node.size : undefined;
            const height = orientation === 0 /* VERTICAL */ ? undefined : node.size;
            return { width, height };
        }
    }
    function createSerializedGrid(gridDescriptor) {
        sanitizeGridNodeDescriptor(gridDescriptor);
        const root = createSerializedNode(gridDescriptor);
        const { width, height } = getDimensions(root, gridDescriptor.orientation);
        return {
            root,
            orientation: gridDescriptor.orientation,
            width: width || 1,
            height: height || 1
        };
    }
    exports.createSerializedGrid = createSerializedGrid;
});
//# sourceMappingURL=grid.js.map