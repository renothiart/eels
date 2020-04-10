var express = require('express');
var router = express.Router();

/* GET canvas test. */
router.get('/', function(req, res, next) {
    res.render('viewer', {});
});

module.exports = router;
