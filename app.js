var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// router imports
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
let editorRouter = require('./routes/editor');
let cloudRouter = require('./routes/cloud');
let viewerRouter = require('./routes/viewer');

// express set up
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// route installation
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/editor', editorRouter);
app.use('/cloud', cloudRouter);
app.use('/viewer', viewerRouter);

app.use(express.static('public'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
