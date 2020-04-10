let KeyValueStore = require('./kvs');
let async = require('async');

let kvs_nodes = new KeyValueStore('Nodes', { name: "NodeID", type: "N" });
let kvs_beacons = new KeyValueStore('Beacons', { name: "BeaconID", type: "N" });
let kvs_rooms = new KeyValueStore('Rooms', { name: "RoomID", type: "N" });
let kvs_floorplans = new KeyValueStore('Floorplans', { name: "Name", type: "S" });

kvs_nodes.init(function(){});
kvs_beacons.init(function(){});
kvs_rooms.init(function(){});
kvs_floorplans.init(function(){});

/* TODO functionality thats likely needed:

- Something to declare scale or store scale or something?
 */

//////////////////////
// VIEWER FUNCTIONS //
//////////////////////

// TODO Needs to be updated to retrieve all beacon data.
// Retrieves all beacon data, RSSI values f
let retrieveBeaconRSSI = function(callback) {
    console.log('Retrieving DDB data from.');
    kvs_beacons.get('1', function(err, data) {
        if (err) {
            // deal with err
            console.log('Error - ', err);
        }
        callback(err, data);
    });
};

let retrieveBeaconsLastUpdated = function(callback) {
    console.log("Retrieving beacon 'last updated data");
    kvs_beacons.scanKeysForAttr({ name: "LastUpdated", type: "N" }, function(err, data) {
        callback(err, data);
    });
};

let retrieveNodesLastUpdated = function(callback) {
    console.log("Retrieving node 'last updated' data");
    kvs_nodes.scanKeysForAttr({ name: "LastUpdated", type: "N" }, function(err, data) {
        callback(err, data);
    });
};

let retrieveRoomsPopulation = function(callback) {
    console.log("Retrieving rooms population data");
    kvs_rooms.scanKeysForAttr({ name: "Population", type: "N" }, function(err, data) {
        callback(err, data);
    });
};

let retrieveRoomsPoints = function(callback) {

};

let retrieveFloorplan = function(name, callback) {
    console.log("Retrieving floorplan data");
    let attr = [
        { name: 'JSON', type: 'S'}
    ];
    kvs_floorplans.getAttr(name, null, attr, function(err, data) {
        callback(err, data);
    });
};

let uploadFloorplan = function(name, serial, callback) {
    console.log("Uploading floorplan data");
    let attributes = [ { name: 'JSON', type: 'S', value: serial } ];
    kvs_floorplans.update(name, null, attributes, function(err, data) {
        callback(err, data);
    });
};

// Declare an emergency on location and call the associated
let declareEmergency = function(callback) {

};

//////////////////////
// EDITOR FUNCTIONS //
//////////////////////

// Takes in a list of nodes and, for each node ID, pushes coordinate data to DDB.
let setNodeCoordinates = function (nodes, callback) {
    for (let node in nodes) {
        let attributes = { positionX: node.x, positionY: node.y };
        kvs_nodes.update(node.nid, null, attributes, function(err, data) {
            // TODO finish

        });
    }
};

let setRoomPoints = function (rooms, callback) {
    for (let room in rooms) {
        let attributes = { points: room.points };
        kvs_rooms.update(room.rid, null, attributes, function(err, data) {
            // todo fin
        });
    }
};

let ddb = {
    declareEmergency: declareEmergency,
    retrieveBeaconsLastUpdated: retrieveBeaconsLastUpdated,
    retrieveNodesLastUpdated: retrieveNodesLastUpdated,
    retrieveRoomsPopulation: retrieveRoomsPopulation,
    retrieveFloorplan: retrieveFloorplan,
    uploadFloorplan: uploadFloorplan,
    setNodeCoordinates: setNodeCoordinates
};

module.exports = ddb;