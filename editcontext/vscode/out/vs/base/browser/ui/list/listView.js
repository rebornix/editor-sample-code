/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "vs/base/common/objects", "vs/base/common/lifecycle", "vs/base/browser/touch", "vs/base/browser/dom", "vs/base/common/event", "vs/base/browser/event", "vs/base/browser/ui/scrollbar/scrollableElement", "./rangeMap", "./rowCache", "vs/base/common/platform", "vs/base/browser/browser", "vs/base/common/decorators", "vs/base/common/range", "vs/base/common/arrays", "vs/base/browser/dnd", "vs/base/common/async"], function (require, exports, objects_1, lifecycle_1, touch_1, DOM, event_1, event_2, scrollableElement_1, rangeMap_1, rowCache_1, platform_1, browser, decorators_1, range_1, arrays_1, dnd_1, async_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const DefaultOptions = {
        useShadows: true,
        verticalScrollMode: 1 /* Auto */,
        setRowLineHeight: true,
        supportDynamicHeights: false,
        dnd: {
            getDragElements(e) { return [e]; },
            getDragURI() { return null; },
            onDragStart() { },
            onDragOver() { return false; },
            drop() { }
        },
        horizontalScrolling: false
    };
    class ElementsDragAndDropData {
        constructor(elements) {
            this.elements = elements;
        }
        update() { }
        getData() {
            return this.elements;
        }
    }
    exports.ElementsDragAndDropData = ElementsDragAndDropData;
    class ExternalElementsDragAndDropData {
        constructor(elements) {
            this.elements = elements;
        }
        update() { }
        getData() {
            return this.elements;
        }
    }
    exports.ExternalElementsDragAndDropData = ExternalElementsDragAndDropData;
    class DesktopDragAndDropData {
        constructor() {
            this.types = [];
            this.files = [];
        }
        update(dataTransfer) {
            if (dataTransfer.types) {
                this.types.splice(0, this.types.length, ...dataTransfer.types);
            }
            if (dataTransfer.files) {
                this.files.splice(0, this.files.length);
                for (let i = 0; i < dataTransfer.files.length; i++) {
                    const file = dataTransfer.files.item(i);
                    if (file && (file.size || file.type)) {
                        this.files.push(file);
                    }
                }
            }
        }
        getData() {
            return {
                types: this.types,
                files: this.files
            };
        }
    }
    exports.DesktopDragAndDropData = DesktopDragAndDropData;
    function equalsDragFeedback(f1, f2) {
        if (Array.isArray(f1) && Array.isArray(f2)) {
            return arrays_1.equals(f1, f2);
        }
        return f1 === f2;
    }
    class ListView {
        constructor(container, virtualDelegate, renderers, options = DefaultOptions) {
            this.virtualDelegate = virtualDelegate;
            this.domId = `list_id_${++ListView.InstanceCount}`;
            this.renderers = new Map();
            this.renderWidth = 0;
            this.scrollableElementUpdateDisposable = null;
            this.scrollableElementWidthDelayer = new async_1.Delayer(50);
            this.splicing = false;
            this.dragOverAnimationStopDisposable = lifecycle_1.Disposable.None;
            this.canUseTranslate3d = undefined;
            this.canDrop = false;
            this.currentDragFeedbackDisposable = lifecycle_1.Disposable.None;
            this.onDragLeaveTimeout = lifecycle_1.Disposable.None;
            this._onDidChangeContentHeight = new event_1.Emitter();
            this.onDidChangeContentHeight = event_1.Event.latch(this._onDidChangeContentHeight.event);
            if (options.horizontalScrolling && options.supportDynamicHeights) {
                throw new Error('Horizontal scrolling and dynamic heights not supported simultaneously');
            }
            this.items = [];
            this.itemId = 0;
            this.rangeMap = new rangeMap_1.RangeMap();
            for (const renderer of renderers) {
                this.renderers.set(renderer.templateId, renderer);
            }
            this.cache = new rowCache_1.RowCache(this.renderers);
            this.lastRenderTop = 0;
            this.lastRenderHeight = 0;
            this.domNode = document.createElement('div');
            this.domNode.className = 'monaco-list';
            DOM.addClass(this.domNode, this.domId);
            this.domNode.tabIndex = 0;
            DOM.toggleClass(this.domNode, 'mouse-support', typeof options.mouseSupport === 'boolean' ? options.mouseSupport : true);
            this.horizontalScrolling = objects_1.getOrDefault(options, o => o.horizontalScrolling, DefaultOptions.horizontalScrolling);
            DOM.toggleClass(this.domNode, 'horizontal-scrolling', this.horizontalScrolling);
            this.ariaProvider = options.ariaProvider || { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };
            this.rowsContainer = document.createElement('div');
            this.rowsContainer.className = 'monaco-list-rows';
            touch_1.Gesture.addTarget(this.rowsContainer);
            this.scrollableElement = new scrollableElement_1.ScrollableElement(this.rowsContainer, {
                alwaysConsumeMouseWheel: true,
                horizontal: this.horizontalScrolling ? 1 /* Auto */ : 2 /* Hidden */,
                vertical: objects_1.getOrDefault(options, o => o.verticalScrollMode, DefaultOptions.verticalScrollMode),
                useShadows: objects_1.getOrDefault(options, o => o.useShadows, DefaultOptions.useShadows)
            });
            this.domNode.appendChild(this.scrollableElement.getDomNode());
            container.appendChild(this.domNode);
            this.disposables = [this.rangeMap, this.gesture, this.scrollableElement, this.cache];
            this.scrollableElement.onScroll(this.onScroll, this, this.disposables);
            event_2.domEvent(this.rowsContainer, touch_1.EventType.Change)(this.onTouchChange, this, this.disposables);
            // Prevent the monaco-scrollable-element from scrolling
            // https://github.com/Microsoft/vscode/issues/44181
            event_2.domEvent(this.scrollableElement.getDomNode(), 'scroll')(e => e.target.scrollTop = 0, null, this.disposables);
            event_1.Event.map(event_2.domEvent(this.domNode, 'dragover'), e => this.toDragEvent(e))(this.onDragOver, this, this.disposables);
            event_1.Event.map(event_2.domEvent(this.domNode, 'drop'), e => this.toDragEvent(e))(this.onDrop, this, this.disposables);
            event_2.domEvent(this.domNode, 'dragleave')(this.onDragLeave, this, this.disposables);
            event_2.domEvent(window, 'dragend')(this.onDragEnd, this, this.disposables);
            this.setRowLineHeight = objects_1.getOrDefault(options, o => o.setRowLineHeight, DefaultOptions.setRowLineHeight);
            this.supportDynamicHeights = objects_1.getOrDefault(options, o => o.supportDynamicHeights, DefaultOptions.supportDynamicHeights);
            this.dnd = objects_1.getOrDefault(options, o => o.dnd, DefaultOptions.dnd);
            this.layout();
        }
        get contentHeight() { return this.rangeMap.size; }
        get onDidScroll() { return this.scrollableElement.onScroll; }
        splice(start, deleteCount, elements = []) {
            if (this.splicing) {
                throw new Error('Can\'t run recursive splices.');
            }
            this.splicing = true;
            try {
                return this._splice(start, deleteCount, elements);
            }
            finally {
                this.splicing = false;
                this._onDidChangeContentHeight.fire(this.contentHeight);
            }
        }
        _splice(start, deleteCount, elements = []) {
            const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            const deleteRange = { start, end: start + deleteCount };
            const removeRange = range_1.Range.intersect(previousRenderRange, deleteRange);
            for (let i = removeRange.start; i < removeRange.end; i++) {
                this.removeItemFromDOM(i);
            }
            const previousRestRange = { start: start + deleteCount, end: this.items.length };
            const previousRenderedRestRange = range_1.Range.intersect(previousRestRange, previousRenderRange);
            const previousUnrenderedRestRanges = range_1.Range.relativeComplement(previousRestRange, previousRenderRange);
            const inserted = elements.map(element => ({
                id: String(this.itemId++),
                element,
                templateId: this.virtualDelegate.getTemplateId(element),
                size: this.virtualDelegate.getHeight(element),
                width: undefined,
                hasDynamicHeight: !!this.virtualDelegate.hasDynamicHeight && this.virtualDelegate.hasDynamicHeight(element),
                lastDynamicHeightWidth: undefined,
                row: null,
                uri: undefined,
                dropTarget: false,
                dragStartDisposable: lifecycle_1.Disposable.None
            }));
            let deleted;
            // TODO@joao: improve this optimization to catch even more cases
            if (start === 0 && deleteCount >= this.items.length) {
                this.rangeMap = new rangeMap_1.RangeMap();
                this.rangeMap.splice(0, 0, inserted);
                this.items = inserted;
                deleted = [];
            }
            else {
                this.rangeMap.splice(start, deleteCount, inserted);
                deleted = this.items.splice(start, deleteCount, ...inserted);
            }
            const delta = elements.length - deleteCount;
            const renderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            const renderedRestRange = rangeMap_1.shift(previousRenderedRestRange, delta);
            const updateRange = range_1.Range.intersect(renderRange, renderedRestRange);
            for (let i = updateRange.start; i < updateRange.end; i++) {
                this.updateItemInDOM(this.items[i], i);
            }
            const removeRanges = range_1.Range.relativeComplement(renderedRestRange, renderRange);
            for (const range of removeRanges) {
                for (let i = range.start; i < range.end; i++) {
                    this.removeItemFromDOM(i);
                }
            }
            const unrenderedRestRanges = previousUnrenderedRestRanges.map(r => rangeMap_1.shift(r, delta));
            const elementsRange = { start, end: start + elements.length };
            const insertRanges = [elementsRange, ...unrenderedRestRanges].map(r => range_1.Range.intersect(renderRange, r));
            const beforeElement = this.getNextToLastElement(insertRanges);
            for (const range of insertRanges) {
                for (let i = range.start; i < range.end; i++) {
                    this.insertItemInDOM(i, beforeElement);
                }
            }
            this.eventuallyUpdateScrollDimensions();
            if (this.supportDynamicHeights) {
                this._rerender(this.scrollTop, this.renderHeight);
            }
            return deleted.map(i => i.element);
        }
        eventuallyUpdateScrollDimensions() {
            this._scrollHeight = this.contentHeight;
            this.rowsContainer.style.height = `${this._scrollHeight}px`;
            if (!this.scrollableElementUpdateDisposable) {
                this.scrollableElementUpdateDisposable = DOM.scheduleAtNextAnimationFrame(() => {
                    this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
                    this.updateScrollWidth();
                    this.scrollableElementUpdateDisposable = null;
                });
            }
        }
        eventuallyUpdateScrollWidth() {
            if (!this.horizontalScrolling) {
                return;
            }
            this.scrollableElementWidthDelayer.trigger(() => this.updateScrollWidth());
        }
        updateScrollWidth() {
            if (!this.horizontalScrolling) {
                return;
            }
            if (this.items.length === 0) {
                this.scrollableElement.setScrollDimensions({ scrollWidth: 0 });
            }
            let scrollWidth = 0;
            for (const item of this.items) {
                if (typeof item.width !== 'undefined') {
                    scrollWidth = Math.max(scrollWidth, item.width);
                }
            }
            this.scrollWidth = scrollWidth;
            this.scrollableElement.setScrollDimensions({ scrollWidth: scrollWidth + 10 });
        }
        updateWidth(index) {
            if (!this.horizontalScrolling || typeof this.scrollWidth === 'undefined') {
                return;
            }
            const item = this.items[index];
            this.measureItemWidth(item);
            if (typeof item.width !== 'undefined' && item.width > this.scrollWidth) {
                this.scrollWidth = item.width;
                this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth + 10 });
            }
        }
        rerender() {
            if (!this.supportDynamicHeights) {
                return;
            }
            for (const item of this.items) {
                item.lastDynamicHeightWidth = undefined;
            }
            this._rerender(this.lastRenderTop, this.lastRenderHeight);
        }
        get length() {
            return this.items.length;
        }
        get renderHeight() {
            const scrollDimensions = this.scrollableElement.getScrollDimensions();
            return scrollDimensions.height;
        }
        get firstVisibleIndex() {
            const range = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            const firstElTop = this.rangeMap.positionAt(range.start);
            const nextElTop = this.rangeMap.positionAt(range.start + 1);
            if (nextElTop !== -1) {
                const firstElMidpoint = (nextElTop - firstElTop) / 2 + firstElTop;
                if (firstElMidpoint < this.scrollTop) {
                    return range.start + 1;
                }
            }
            return range.start;
        }
        get lastVisibleIndex() {
            const range = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            return range.end - 1;
        }
        element(index) {
            return this.items[index].element;
        }
        domElement(index) {
            const row = this.items[index].row;
            return row && row.domNode;
        }
        elementHeight(index) {
            return this.items[index].size;
        }
        elementTop(index) {
            return this.rangeMap.positionAt(index);
        }
        indexAt(position) {
            return this.rangeMap.indexAt(position);
        }
        indexAfter(position) {
            return this.rangeMap.indexAfter(position);
        }
        layout(height, width) {
            let scrollDimensions = {
                height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
            };
            if (this.scrollableElementUpdateDisposable) {
                this.scrollableElementUpdateDisposable.dispose();
                this.scrollableElementUpdateDisposable = null;
                scrollDimensions.scrollHeight = this.scrollHeight;
            }
            this.scrollableElement.setScrollDimensions(scrollDimensions);
            if (typeof width !== 'undefined') {
                this.renderWidth = width;
                if (this.supportDynamicHeights) {
                    this._rerender(this.scrollTop, this.renderHeight);
                }
                if (this.horizontalScrolling) {
                    this.scrollableElement.setScrollDimensions({
                        width: typeof width === 'number' ? width : DOM.getContentWidth(this.domNode)
                    });
                }
            }
        }
        // Render
        render(renderTop, renderHeight, renderLeft, scrollWidth) {
            const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
            const renderRange = this.getRenderRange(renderTop, renderHeight);
            const rangesToInsert = range_1.Range.relativeComplement(renderRange, previousRenderRange);
            const rangesToRemove = range_1.Range.relativeComplement(previousRenderRange, renderRange);
            const beforeElement = this.getNextToLastElement(rangesToInsert);
            for (const range of rangesToInsert) {
                for (let i = range.start; i < range.end; i++) {
                    this.insertItemInDOM(i, beforeElement);
                }
            }
            for (const range of rangesToRemove) {
                for (let i = range.start; i < range.end; i++) {
                    this.removeItemFromDOM(i);
                }
            }
            const canUseTranslate3d = !platform_1.isWindows && !browser.isFirefox && browser.getZoomLevel() === 0;
            if (canUseTranslate3d) {
                const transform = `translate3d(-${renderLeft}px, -${renderTop}px, 0px)`;
                this.rowsContainer.style.transform = transform;
                this.rowsContainer.style.webkitTransform = transform;
                if (canUseTranslate3d !== this.canUseTranslate3d) {
                    this.rowsContainer.style.left = '0';
                    this.rowsContainer.style.top = '0';
                }
            }
            else {
                this.rowsContainer.style.left = `-${renderLeft}px`;
                this.rowsContainer.style.top = `-${renderTop}px`;
                if (canUseTranslate3d !== this.canUseTranslate3d) {
                    this.rowsContainer.style.transform = '';
                    this.rowsContainer.style.webkitTransform = '';
                }
            }
            if (this.horizontalScrolling) {
                this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;
            }
            this.canUseTranslate3d = canUseTranslate3d;
            this.lastRenderTop = renderTop;
            this.lastRenderHeight = renderHeight;
        }
        // DOM operations
        insertItemInDOM(index, beforeElement) {
            const item = this.items[index];
            if (!item.row) {
                item.row = this.cache.alloc(item.templateId);
                const role = this.ariaProvider.getRole ? this.ariaProvider.getRole(item.element) : 'treeitem';
                item.row.domNode.setAttribute('role', role);
                const checked = this.ariaProvider.isChecked ? this.ariaProvider.isChecked(item.element) : undefined;
                if (typeof checked !== 'undefined') {
                    item.row.domNode.setAttribute('aria-checked', String(checked));
                }
            }
            if (!item.row.domNode.parentElement) {
                if (beforeElement) {
                    this.rowsContainer.insertBefore(item.row.domNode, beforeElement);
                }
                else {
                    this.rowsContainer.appendChild(item.row.domNode);
                }
            }
            this.updateItemInDOM(item, index);
            const renderer = this.renderers.get(item.templateId);
            if (!renderer) {
                throw new Error(`No renderer found for template id ${item.templateId}`);
            }
            if (renderer) {
                renderer.renderElement(item.element, index, item.row.templateData, item.size);
            }
            const uri = this.dnd.getDragURI(item.element);
            item.dragStartDisposable.dispose();
            item.row.domNode.draggable = !!uri;
            if (uri) {
                const onDragStart = event_2.domEvent(item.row.domNode, 'dragstart');
                item.dragStartDisposable = onDragStart(event => this.onDragStart(item.element, uri, event));
            }
            if (this.horizontalScrolling) {
                this.measureItemWidth(item);
                this.eventuallyUpdateScrollWidth();
            }
        }
        measureItemWidth(item) {
            if (!item.row || !item.row.domNode) {
                return;
            }
            item.row.domNode.style.width = 'fit-content';
            item.width = DOM.getContentWidth(item.row.domNode);
            const style = window.getComputedStyle(item.row.domNode);
            if (style.paddingLeft) {
                item.width += parseFloat(style.paddingLeft);
            }
            if (style.paddingRight) {
                item.width += parseFloat(style.paddingRight);
            }
            item.row.domNode.style.width = '';
        }
        updateItemInDOM(item, index) {
            item.row.domNode.style.top = `${this.elementTop(index)}px`;
            item.row.domNode.style.height = `${item.size}px`;
            if (this.setRowLineHeight) {
                item.row.domNode.style.lineHeight = `${item.size}px`;
            }
            item.row.domNode.setAttribute('data-index', `${index}`);
            item.row.domNode.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
            item.row.domNode.setAttribute('aria-setsize', String(this.ariaProvider.getSetSize(item.element, index, this.length)));
            item.row.domNode.setAttribute('aria-posinset', String(this.ariaProvider.getPosInSet(item.element, index)));
            item.row.domNode.setAttribute('id', this.getElementDomId(index));
            DOM.toggleClass(item.row.domNode, 'drop-target', item.dropTarget);
        }
        removeItemFromDOM(index) {
            const item = this.items[index];
            item.dragStartDisposable.dispose();
            const renderer = this.renderers.get(item.templateId);
            if (renderer && renderer.disposeElement) {
                renderer.disposeElement(item.element, index, item.row.templateData, item.size);
            }
            this.cache.release(item.row);
            item.row = null;
            if (this.horizontalScrolling) {
                this.eventuallyUpdateScrollWidth();
            }
        }
        getScrollTop() {
            const scrollPosition = this.scrollableElement.getScrollPosition();
            return scrollPosition.scrollTop;
        }
        setScrollTop(scrollTop) {
            if (this.scrollableElementUpdateDisposable) {
                this.scrollableElementUpdateDisposable.dispose();
                this.scrollableElementUpdateDisposable = null;
                this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
            }
            this.scrollableElement.setScrollPosition({ scrollTop });
        }
        get scrollTop() {
            return this.getScrollTop();
        }
        set scrollTop(scrollTop) {
            this.setScrollTop(scrollTop);
        }
        get scrollHeight() {
            return this._scrollHeight + (this.horizontalScrolling ? 10 : 0);
        }
        // Events
        get onMouseClick() { return event_1.Event.map(event_2.domEvent(this.domNode, 'click'), e => this.toMouseEvent(e)); }
        get onMouseDblClick() { return event_1.Event.map(event_2.domEvent(this.domNode, 'dblclick'), e => this.toMouseEvent(e)); }
        get onMouseMiddleClick() { return event_1.Event.filter(event_1.Event.map(event_2.domEvent(this.domNode, 'auxclick'), e => this.toMouseEvent(e)), e => e.browserEvent.button === 1); }
        get onMouseUp() { return event_1.Event.map(event_2.domEvent(this.domNode, 'mouseup'), e => this.toMouseEvent(e)); }
        get onMouseDown() { return event_1.Event.map(event_2.domEvent(this.domNode, 'mousedown'), e => this.toMouseEvent(e)); }
        get onMouseOver() { return event_1.Event.map(event_2.domEvent(this.domNode, 'mouseover'), e => this.toMouseEvent(e)); }
        get onMouseMove() { return event_1.Event.map(event_2.domEvent(this.domNode, 'mousemove'), e => this.toMouseEvent(e)); }
        get onMouseOut() { return event_1.Event.map(event_2.domEvent(this.domNode, 'mouseout'), e => this.toMouseEvent(e)); }
        get onContextMenu() { return event_1.Event.map(event_2.domEvent(this.domNode, 'contextmenu'), e => this.toMouseEvent(e)); }
        get onTouchStart() { return event_1.Event.map(event_2.domEvent(this.domNode, 'touchstart'), e => this.toTouchEvent(e)); }
        get onTap() { return event_1.Event.map(event_2.domEvent(this.rowsContainer, touch_1.EventType.Tap), e => this.toGestureEvent(e)); }
        toMouseEvent(browserEvent) {
            const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
            const item = typeof index === 'undefined' ? undefined : this.items[index];
            const element = item && item.element;
            return { browserEvent, index, element };
        }
        toTouchEvent(browserEvent) {
            const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
            const item = typeof index === 'undefined' ? undefined : this.items[index];
            const element = item && item.element;
            return { browserEvent, index, element };
        }
        toGestureEvent(browserEvent) {
            const index = this.getItemIndexFromEventTarget(browserEvent.initialTarget || null);
            const item = typeof index === 'undefined' ? undefined : this.items[index];
            const element = item && item.element;
            return { browserEvent, index, element };
        }
        toDragEvent(browserEvent) {
            const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
            const item = typeof index === 'undefined' ? undefined : this.items[index];
            const element = item && item.element;
            return { browserEvent, index, element };
        }
        onScroll(e) {
            try {
                this.render(e.scrollTop, e.height, e.scrollLeft, e.scrollWidth);
                if (this.supportDynamicHeights) {
                    this._rerender(e.scrollTop, e.height);
                }
            }
            catch (err) {
                console.error('Got bad scroll event:', e);
                throw err;
            }
        }
        onTouchChange(event) {
            event.preventDefault();
            event.stopPropagation();
            this.scrollTop -= event.translationY;
        }
        // DND
        onDragStart(element, uri, event) {
            if (!event.dataTransfer) {
                return;
            }
            const elements = this.dnd.getDragElements(element);
            event.dataTransfer.effectAllowed = 'copyMove';
            event.dataTransfer.setData(dnd_1.DataTransfers.RESOURCES, JSON.stringify([uri]));
            if (event.dataTransfer.setDragImage) {
                let label;
                if (this.dnd.getDragLabel) {
                    label = this.dnd.getDragLabel(elements);
                }
                if (typeof label === 'undefined') {
                    label = String(elements.length);
                }
                const dragImage = DOM.$('.monaco-drag-image');
                dragImage.textContent = label;
                document.body.appendChild(dragImage);
                event.dataTransfer.setDragImage(dragImage, -10, -10);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            }
            this.currentDragData = new ElementsDragAndDropData(elements);
            dnd_1.StaticDND.CurrentDragAndDropData = new ExternalElementsDragAndDropData(elements);
            if (this.dnd.onDragStart) {
                this.dnd.onDragStart(this.currentDragData, event);
            }
        }
        onDragOver(event) {
            event.browserEvent.preventDefault(); // needed so that the drop event fires (https://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome)
            this.onDragLeaveTimeout.dispose();
            if (dnd_1.StaticDND.CurrentDragAndDropData && dnd_1.StaticDND.CurrentDragAndDropData.getData() === 'vscode-ui') {
                return false;
            }
            this.setupDragAndDropScrollTopAnimation(event.browserEvent);
            if (!event.browserEvent.dataTransfer) {
                return false;
            }
            // Drag over from outside
            if (!this.currentDragData) {
                if (dnd_1.StaticDND.CurrentDragAndDropData) {
                    // Drag over from another list
                    this.currentDragData = dnd_1.StaticDND.CurrentDragAndDropData;
                }
                else {
                    // Drag over from the desktop
                    if (!event.browserEvent.dataTransfer.types) {
                        return false;
                    }
                    this.currentDragData = new DesktopDragAndDropData();
                }
            }
            const result = this.dnd.onDragOver(this.currentDragData, event.element, event.index, event.browserEvent);
            this.canDrop = typeof result === 'boolean' ? result : result.accept;
            if (!this.canDrop) {
                this.currentDragFeedback = undefined;
                this.currentDragFeedbackDisposable.dispose();
                return false;
            }
            event.browserEvent.dataTransfer.dropEffect = (typeof result !== 'boolean' && result.effect === 0 /* Copy */) ? 'copy' : 'move';
            let feedback;
            if (typeof result !== 'boolean' && result.feedback) {
                feedback = result.feedback;
            }
            else {
                if (typeof event.index === 'undefined') {
                    feedback = [-1];
                }
                else {
                    feedback = [event.index];
                }
            }
            // sanitize feedback list
            feedback = arrays_1.distinct(feedback).filter(i => i >= -1 && i < this.length).sort();
            feedback = feedback[0] === -1 ? [-1] : feedback;
            if (feedback.length === 0) {
                throw new Error('Invalid empty feedback list');
            }
            if (equalsDragFeedback(this.currentDragFeedback, feedback)) {
                return true;
            }
            this.currentDragFeedback = feedback;
            this.currentDragFeedbackDisposable.dispose();
            if (feedback[0] === -1) { // entire list feedback
                DOM.addClass(this.domNode, 'drop-target');
                this.currentDragFeedbackDisposable = lifecycle_1.toDisposable(() => DOM.removeClass(this.domNode, 'drop-target'));
            }
            else {
                for (const index of feedback) {
                    const item = this.items[index];
                    item.dropTarget = true;
                    if (item.row && item.row.domNode) {
                        DOM.addClass(item.row.domNode, 'drop-target');
                    }
                }
                this.currentDragFeedbackDisposable = lifecycle_1.toDisposable(() => {
                    for (const index of feedback) {
                        const item = this.items[index];
                        item.dropTarget = false;
                        if (item.row && item.row.domNode) {
                            DOM.removeClass(item.row.domNode, 'drop-target');
                        }
                    }
                });
            }
            return true;
        }
        onDragLeave() {
            this.onDragLeaveTimeout.dispose();
            this.onDragLeaveTimeout = async_1.disposableTimeout(() => this.clearDragOverFeedback(), 100);
        }
        onDrop(event) {
            if (!this.canDrop) {
                return;
            }
            const dragData = this.currentDragData;
            this.teardownDragAndDropScrollTopAnimation();
            this.clearDragOverFeedback();
            this.currentDragData = undefined;
            dnd_1.StaticDND.CurrentDragAndDropData = undefined;
            if (!dragData || !event.browserEvent.dataTransfer) {
                return;
            }
            event.browserEvent.preventDefault();
            dragData.update(event.browserEvent.dataTransfer);
            this.dnd.drop(dragData, event.element, event.index, event.browserEvent);
        }
        onDragEnd() {
            this.canDrop = false;
            this.teardownDragAndDropScrollTopAnimation();
            this.clearDragOverFeedback();
            this.currentDragData = undefined;
            dnd_1.StaticDND.CurrentDragAndDropData = undefined;
        }
        clearDragOverFeedback() {
            this.currentDragFeedback = undefined;
            this.currentDragFeedbackDisposable.dispose();
            this.currentDragFeedbackDisposable = lifecycle_1.Disposable.None;
        }
        // DND scroll top animation
        setupDragAndDropScrollTopAnimation(event) {
            if (!this.dragOverAnimationDisposable) {
                const viewTop = DOM.getTopLeftOffset(this.domNode).top;
                this.dragOverAnimationDisposable = DOM.animate(this.animateDragAndDropScrollTop.bind(this, viewTop));
            }
            this.dragOverAnimationStopDisposable.dispose();
            this.dragOverAnimationStopDisposable = async_1.disposableTimeout(() => {
                if (this.dragOverAnimationDisposable) {
                    this.dragOverAnimationDisposable.dispose();
                    this.dragOverAnimationDisposable = undefined;
                }
            }, 1000);
            this.dragOverMouseY = event.pageY;
        }
        animateDragAndDropScrollTop(viewTop) {
            if (this.dragOverMouseY === undefined) {
                return;
            }
            const diff = this.dragOverMouseY - viewTop;
            const upperLimit = this.renderHeight - 35;
            if (diff < 35) {
                this.scrollTop += Math.max(-14, Math.floor(0.3 * (diff - 35)));
            }
            else if (diff > upperLimit) {
                this.scrollTop += Math.min(14, Math.floor(0.3 * (diff - upperLimit)));
            }
        }
        teardownDragAndDropScrollTopAnimation() {
            this.dragOverAnimationStopDisposable.dispose();
            if (this.dragOverAnimationDisposable) {
                this.dragOverAnimationDisposable.dispose();
                this.dragOverAnimationDisposable = undefined;
            }
        }
        // Util
        getItemIndexFromEventTarget(target) {
            let element = target;
            while (element instanceof HTMLElement && element !== this.rowsContainer) {
                const rawIndex = element.getAttribute('data-index');
                if (rawIndex) {
                    const index = Number(rawIndex);
                    if (!isNaN(index)) {
                        return index;
                    }
                }
                element = element.parentElement;
            }
            return undefined;
        }
        getRenderRange(renderTop, renderHeight) {
            return {
                start: this.rangeMap.indexAt(renderTop),
                end: this.rangeMap.indexAfter(renderTop + renderHeight - 1)
            };
        }
        /**
         * Given a stable rendered state, checks every rendered element whether it needs
         * to be probed for dynamic height. Adjusts scroll height and top if necessary.
         */
        _rerender(renderTop, renderHeight) {
            const previousRenderRange = this.getRenderRange(renderTop, renderHeight);
            // Let's remember the second element's position, this helps in scrolling up
            // and preserving a linear upwards scroll movement
            let anchorElementIndex;
            let anchorElementTopDelta;
            if (renderTop === this.elementTop(previousRenderRange.start)) {
                anchorElementIndex = previousRenderRange.start;
                anchorElementTopDelta = 0;
            }
            else if (previousRenderRange.end - previousRenderRange.start > 1) {
                anchorElementIndex = previousRenderRange.start + 1;
                anchorElementTopDelta = this.elementTop(anchorElementIndex) - renderTop;
            }
            let heightDiff = 0;
            while (true) {
                const renderRange = this.getRenderRange(renderTop, renderHeight);
                let didChange = false;
                for (let i = renderRange.start; i < renderRange.end; i++) {
                    const diff = this.probeDynamicHeight(i);
                    if (diff !== 0) {
                        this.rangeMap.splice(i, 1, [this.items[i]]);
                    }
                    heightDiff += diff;
                    didChange = didChange || diff !== 0;
                }
                if (!didChange) {
                    if (heightDiff !== 0) {
                        this.eventuallyUpdateScrollDimensions();
                    }
                    const unrenderRanges = range_1.Range.relativeComplement(previousRenderRange, renderRange);
                    for (const range of unrenderRanges) {
                        for (let i = range.start; i < range.end; i++) {
                            if (this.items[i].row) {
                                this.removeItemFromDOM(i);
                            }
                        }
                    }
                    const renderRanges = range_1.Range.relativeComplement(renderRange, previousRenderRange);
                    for (const range of renderRanges) {
                        for (let i = range.start; i < range.end; i++) {
                            const afterIndex = i + 1;
                            const beforeRow = afterIndex < this.items.length ? this.items[afterIndex].row : null;
                            const beforeElement = beforeRow ? beforeRow.domNode : null;
                            this.insertItemInDOM(i, beforeElement);
                        }
                    }
                    for (let i = renderRange.start; i < renderRange.end; i++) {
                        if (this.items[i].row) {
                            this.updateItemInDOM(this.items[i], i);
                        }
                    }
                    if (typeof anchorElementIndex === 'number') {
                        this.scrollTop = this.elementTop(anchorElementIndex) - anchorElementTopDelta;
                    }
                    this._onDidChangeContentHeight.fire(this.contentHeight);
                    return;
                }
            }
        }
        probeDynamicHeight(index) {
            const item = this.items[index];
            if (!item.hasDynamicHeight || item.lastDynamicHeightWidth === this.renderWidth) {
                return 0;
            }
            const size = item.size;
            const row = this.cache.alloc(item.templateId);
            row.domNode.style.height = '';
            this.rowsContainer.appendChild(row.domNode);
            const renderer = this.renderers.get(item.templateId);
            if (renderer) {
                renderer.renderElement(item.element, index, row.templateData, undefined);
                if (renderer.disposeElement) {
                    renderer.disposeElement(item.element, index, row.templateData, undefined);
                }
            }
            item.size = row.domNode.offsetHeight;
            if (this.virtualDelegate.setDynamicHeight) {
                this.virtualDelegate.setDynamicHeight(item.element, item.size);
            }
            item.lastDynamicHeightWidth = this.renderWidth;
            this.rowsContainer.removeChild(row.domNode);
            this.cache.release(row);
            return item.size - size;
        }
        getNextToLastElement(ranges) {
            const lastRange = ranges[ranges.length - 1];
            if (!lastRange) {
                return null;
            }
            const nextToLastItem = this.items[lastRange.end];
            if (!nextToLastItem) {
                return null;
            }
            if (!nextToLastItem.row) {
                return null;
            }
            return nextToLastItem.row.domNode;
        }
        getElementDomId(index) {
            return `${this.domId}_${index}`;
        }
        // Dispose
        dispose() {
            if (this.items) {
                for (const item of this.items) {
                    if (item.row) {
                        const renderer = this.renderers.get(item.row.templateId);
                        if (renderer) {
                            renderer.disposeTemplate(item.row.templateData);
                        }
                    }
                }
                this.items = [];
            }
            if (this.domNode && this.domNode.parentNode) {
                this.domNode.parentNode.removeChild(this.domNode);
            }
            this.disposables = lifecycle_1.dispose(this.disposables);
        }
    }
    ListView.InstanceCount = 0;
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseClick", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseDblClick", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseMiddleClick", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseUp", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseDown", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseOver", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseMove", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onMouseOut", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onContextMenu", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onTouchStart", null);
    __decorate([
        decorators_1.memoize
    ], ListView.prototype, "onTap", null);
    exports.ListView = ListView;
});
//# sourceMappingURL=listView.js.map