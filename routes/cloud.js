var express = require('express');
var router = express.Router();
let aws = require('../aws/aws');

/* GET last updated value for all beacons. */
router.get('/blu', function(req, res, next) {
    aws.retrieveBeaconsLastUpdated(function (err, data) {
        res.send(data);
    });
});

/* GET last updated value for all nodes. */
router.get('/nlu', function(req, res, next) {
    aws.retrieveNodesLastUpdated(function (err, data) {
        res.send(data);
    });
});

/* GET room population for all rooms. */
router.get('/rpop', function(req, res, next) {
    aws.retrieveRoomsPopulation(function (err, data) {
        res.send(data);
    });
});

/* GET floorplan info for a given floorplan. */
router.get('/fget', function(req, res, next) {
    let name = req.query.name;
    aws.retrieveFloorplan(name, function (err, data) {
        res.send(data);
    });
});

/* POST serialized floorplan for a given floorplan. */
router.post('/fput', function(req, res, next) {
    let name = req.body.name;
    let serial = req.body.serial;
    aws.uploadFloorplan(name, serial, function (err, data) {
        res.send(data);
    });
});

router.post('/emergency', function(req, res, next) {
    aws.declareEmergency(function (err, data) {
        // TODO fill out
    });
});

module.exports = router;
