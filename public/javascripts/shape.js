/*
Fabric class for a Room. Extends Polygon and maintains built-in
interactivity (highlighting, selecting, coloring).
 */
fabric.RoomShape = fabric.util.createClass(fabric.Polygon, {
    SELECTED_OPACITY: 0.6,
    UNSELECTED_OPACITY: 0.4,
    type: 'RoomShape',
    initialize: function(points, options, selectCallback) {
        this.callSuper('initialize', points, options);

        // fabric attributes
        this.set({ fill: options ? (options.fill || 'blue') : 'blue' });
        this.set({ hasBorders: false });
        this.set({ hasControls: false });
        this.set({ opacity: this.UNSELECTED_OPACITY });
        this.set({ perPixelTargetFind: true });
        this.set({ stroke: '#333333' });
        this.set({ strokeWidth: 0.5 });

        // custom attributes
        this.set({ roomId: options ? (options.roomId || 0) : 0 });
        this.set({ isSelected: false });
        this.set({ selectCallback: selectCallback });

        // event handlers
        this.on('mouseover', this.mouseOverHandler);
        this.on('mouseout', this.mouseOutHandler);
        this.on('mousedown', this.mouseDownHandler);
    },
    mouseDownHandler: function () {
        this.roomSelected();
    },
    mouseOverHandler: function () {
        if (!this.isSelected) {
            this.set({ opacity: this.SELECTED_OPACITY });
            this.set({ dirty: true });
        }
    },
    mouseOutHandler: function () {
        if (!this.isSelected) {
            this.set({ opacity: this.UNSELECTED_OPACITY });
            this.set({ dirty: true });
        }
    },
    roomSelected: function () {
        if (!this.isSelected) {
            this.set({ isSelected: true });
            this.set({ opacity: this.SELECTED_OPACITY});
            this.set({ dirty: true });
            this.selectCallback(this);
        }
    },
    roomDeselected: function () {
        if (this.isSelected) {
            this.set({ isSelected: false });
            this.set({ opacity: this.UNSELECTED_OPACITY });
        }
    },
    linkSelectCallback: function (callback) {
        this.set({ selectCallback: callback });
    },
    colorFromAWS: function(popn) {
        if (popn >= 10) {
            this.set({ fill: 'darkred' });
        } else if (popn > 5) {
            this.set({ fill: 'red' });
        } else if (popn > 2) {
            this.set({ fill: 'orange' });
        } else if (popn > 0) {
            this.set({ fill: 'yellow' });
        } else {
            this.set({ fill: 'green' });
        }
        this.set({ dirty: true });
    },
    toObject: function() {
        return fabric.util.object.extend(this.callSuper('toObject'), {
            roomId: this.get('roomId')
        });
    }
});
fabric.RoomShape.fromObject = function(object, callback) {
    return fabric.Object._fromObject('RoomShape', object, callback, 'points');
};

/*
Fabric class for a Node. Extends Circle and also maintains built-in
interactivity (highlighting, selecting, coloring).
 */
fabric.NodeShape = fabric.util.createClass(fabric.Circle, {
    SELECTED_OPACITY: 1.0,
    UNSELECTED_OPACITY: 0.5,
    type: 'NodeShape',
    initialize: function(options, selectCallback) {

        // circle init
        this.callSuper('initialize', options);

        // fabric attributes
        this.set({ fill: options ? (options.fill || 'blue') : 'blue' });
        this.set({ hasBorders: false });
        this.set({ hasControls: false });
        this.set({ opacity: this.UNSELECTED_OPACITY });
        this.set({ originX: 'center' });
        this.set({ originY:'center' });
        this.set({ radius: 10 });
        this.set({ selectable: true });
        this.set({ stroke: options ? (options.stroke || 'red') : 'red' });
        this.set({ strokeWidth: 0.5 });

        // custom attributes
        this.set({ nodeId: options ? (options.nodeId || 0) : 0 });
        this.set({ isSelected: false });
        this.set({ selectCallback: selectCallback });

        // event handlers
        this.on('mouseover', this.mouseOverHandler);
        this.on('mouseout', this.mouseOutHandler);
        this.on('mousedown', this.mouseDownHandler);
    },
    mouseDownHandler: function () {
        this.nodeSelected();
    },
    mouseOverHandler: function () {
        if (!this.isSelected) {
            this.set({ opacity: this.SELECTED_OPACITY });
            this.set({ dirty: true });
        }
    },
    mouseOutHandler: function () {
        if (!this.isSelected) {
            this.set({ opacity: this.UNSELECTED_OPACITY });
            this.set({ dirty: true });
        }
    },
    nodeSelected: function () {
        if (!this.isSelected) {
            this.set({ isSelected: true });
            this.set({ opacity: this.SELECTED_OPACITY});
            this.set({ dirty: true });
            this.selectCallback(this);
        }
    },
    nodeDeselected: function () {
        if (this.isSelected) {
            this.set({ isSelected: false });
            this.set({ opacity: this.UNSELECTED_OPACITY });
        }
    },
    linkSelectCallback: function (callback) {
        this.set({ selectCallback: callback });
    },
    colorFromAWS: function(lastUpdate) {
        let now = Date.now();
        if (lastUpdate <= now - (5 * 60000)) {
            this.set({ fill: 'darkred' });
        } else if (lastUpdate <= now - (2 * 60000)) {
            this.set({ fill: 'red' });
        } else if (lastUpdate <= now - (1 * 60000)) {
            this.set({ fill: 'orange' });
        } else if (lastUpdate <= now - (0.5 * 60000)) {
            this.set({ fill: 'yellow' });
        } else {
            this.set({ fill: 'green' });
        }
        this.set({ dirty: true });
    },
    toObject: function() {
        return fabric.util.object.extend(this.callSuper('toObject'), {
            nodeId: this.get('nodeId')
        });
    },
    fromObject: function() {
        return this.callSuper('fromObject');
    }
});
fabric.NodeShape.fromObject = function(object, callback) {
    return fabric.Object._fromObject('NodeShape', object, callback);
};