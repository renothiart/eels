var express = require('express');
var router = express.Router();
let aws = require('../aws/aws');

/* GET editor. */
router.get('/', function(req, res, next) {
    res.render('editor', {});
});

// Get beacon data
router.get('/beacons', function(req, res, next) {
    aws.retrieveBeaconData();
});

module.exports = router;
