(function () {
    const AWS = require('aws-sdk');
    const async = require('async');
    AWS.config.loadFromPath('./config.json');

    if (!AWS.config.credentials || !AWS.config.credentials.accessKeyId) {
        throw 'Need to update config.json to specify your access key!';
    }

    const db = new AWS.DynamoDB();

    function KeyValueStore(table,
                           partitionKey={name:'keyword', type:'S'},
                           sortKey=undefined) {
        this.initialized = false;
        this.inx = 0;

        this.LRU = require("lru-cache");
        this.cache = new this.LRU({max: 500});

        this.tableName = table;

        this.partitionKey = partitionKey;
        this.sortKey = sortKey;
        this.hasCompositeKey = (sortKey !== undefined);
    }

    /**
     * Initialize the table
     * This *must* be called on a table before using any other methods!
     */
    KeyValueStore.prototype.init = function (callback) {
        const self = this;

        const tableName = this.tableName;
        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        db.listTables(function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                console.log("Connected to AWS DynamoDB");

                const tables = data.TableNames.toString().split(",");
                console.log("Tables in DynamoDB: " + tables);
                if (tables.indexOf(tableName) === -1) {
                    console.log("Creating new table " + tableName);

                    let params = {
                        AttributeDefinitions:
                            [ /* required */
                                {
                                    AttributeName: partitionKey.name, /* required */
                                    AttributeType: partitionKey.type /* required */
                                }
                            ],
                        KeySchema:
                            [ /* required */
                                {
                                    AttributeName: partitionKey.name, /* required */
                                    KeyType: 'HASH' /* required */
                                }
                            ],
                        ProvisionedThroughput: { /* required */
                            ReadCapacityUnits: 1, /* required */
                            WriteCapacityUnits: 1 /* required */
                        },
                        TableName: tableName /* required */
                    };

                    console.log(params);

                    if (hasCompositeKey) {
                        params.AttributeDefinitions.push({
                            AttributeName: sortKey.name, /* required */
                            AttributeType: sortKey.type /* required */
                        });
                        params.KeySchema.push({
                            AttributeName: sortKey.name, /* required */
                            KeyType: 'RANGE' /* required */
                        });
                    }

                    console.log(params);

                    db.createTable(params, function (err) {
                        if (err) {
                            console.log(err)
                        } else {
                            self.initialized = true;
                            callback()
                        }
                    });
                } else {
                    self.initCount(callback);
                    self.initialized = true;
                }
            }
        });
    };

    /**
     * Counts how many rows are in the table for init.
     */
    KeyValueStore.prototype.initCount = function (whendone) {
        const self = this;
        if (!self.initialized) {
            whendone("Error using table - call init first!", null);
            return;
        }

        const params = {
            TableName: self.tableName,
            Select: 'COUNT'
        };

        db.scan(params, function (err, data) {
            if (err) {
                console.log(err, err.stack);
            } else {
                self.inx = data.ScannedCount;

                console.log("Found " + self.inx + " indexed entries in " + self.tableName);
                whendone();
            }
        });
    };

    /**
     * Retrieves items from the table matching the specified argument.
     * Has three use cases:
     * - in a table without a composite key, retrieves the element that matches pKey if one exists.
     * - in a table with a composite key, retrieves the element that matches pKey and sKey if one exists.
     * - in a table with a composite key, retrieves all elements that match pKey if any exist.
     *
     * @param pKey Partition key to retrieve.
     * @param sKey Sort key to retrieve or undefined.
     * @param callback Callback function
     * @param loadOffset Where to begin retrieval.
     * @param loadMax Maximum number of items to retrieve or undefined for retrieval of all available.
     * @callback Data is, if at least one item matches, an array of item objects with the sort key and 'value' as keys
     * or is null if no such item matches/there was an error.
     */
    KeyValueStore.prototype.get = function (pKey, sKey, callback, loadOffset=0, loadMax=undefined) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (!hasCompositeKey && sKey) {
            callback("Error - sort key was given for a table without a composite key", null);
            return;
        }

        if (sKey && self.cache.get(pKey + "/"  + sKey)) {
            callback(null, self.cache.get(pKey + "/"  + sKey));
        } else if (!sKey && self.cache.get(pKey)) {
            callback(null, self.cache.get(pKey).slice(loadOffset, ((loadMax) ? loadMax + loadOffset : loadMax)));
        } else {
            let params = {
                KeyConditions: {
                    [partitionKey.name]: {
                        ComparisonOperator: 'EQ',
                        AttributeValueList: [{[partitionKey.type]: pKey}]
                    }
                },
                TableName: self.tableName,
                AttributesToGet: ['Value']
            };

            if (sKey) {
                params.KeyConditions[sortKey.name] = {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{[sortKey.type]: sKey}]
                };
            }

            if (hasCompositeKey) {
                params.AttributesToGet.unshift(sortKey.name);
                params.ScanIndexForward = false;
            }

            db.query(params, function (err, data) {
                if (err || data.Items.length === 0) {
                    callback(err, null);
                } else {
                    let items = [];
                    for (let i = 0; i < data.Items.length; i++) {
                        if (hasCompositeKey) {
                            items.push({
                                [sortKey.name]: data.Items[i][sortKey.name][sortKey.type],
                                "Value": data.Items[i].Value.S
                            });
                        } else {
                            items.push({"Value": data.Items[i].Value.S});
                        }
                    }

                    if (sKey) {
                        self.cache.set(pKey + "/" + sKey, items[0]);
                    } else {
                        self.cache.set(pKey, items);
                    }
                    callback(err, items.slice(loadOffset, ((loadMax) ? loadMax + loadOffset : loadMax)));
                }
            });
        }
    };

    /**
     * Retrieves items from the table matching the specified argument.
     * Has three use cases:
     * - in a table without a composite key, retrieves the element that matches pKey if one exists.
     * - in a table with a composite key, retrieves the element that matches pKey and sKey if one exists.
     * - in a table with a composite key, retrieves all elements that match pKey if any exist.
     *
     * @param pKey Partition key to retrieve.
     * @param sKey Sort key to retrieve or undefined.
     * @param callback Callback function
     * @param loadOffset Where to begin retrieval.
     * @param loadMax Maximum number of items to retrieve or undefined for retrieval of all available.
     * @callback Data is, if at least one item matches, an array of item objects with the sort key and 'value' as keys
     * or is null if no such item matches/there was an error.
     */
    KeyValueStore.prototype.getAttr = function (pKey, sKey, attributes, callback, loadOffset=0, loadMax=undefined) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (!hasCompositeKey && sKey) {
            callback("Error - sort key was given for a table without a composite key", null);
            return;
        }

        if (sKey && self.cache.get(pKey + "/"  + sKey)) {
            callback(null, self.cache.get(pKey + "/"  + sKey));
        } else if (!sKey && self.cache.get(pKey)) {
            callback(null, self.cache.get(pKey).slice(loadOffset, ((loadMax) ? loadMax + loadOffset : loadMax)));
        } else {
            let params = {
                KeyConditions: {
                    [partitionKey.name]: {
                        ComparisonOperator: 'EQ',
                        AttributeValueList: [{[partitionKey.type]: pKey}]
                    }
                },
                TableName: self.tableName,
                AttributesToGet: []
            };

            for (let attrIdx in attributes) {
                params.AttributesToGet.push(attributes[attrIdx].name);
            }

            if (sKey) {
                params.KeyConditions[sortKey.name] = {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [{[sortKey.type]: sKey}]
                };
            }

            if (hasCompositeKey) {
                params.AttributesToGet.unshift(sortKey.name);
                params.ScanIndexForward = false;
            }

            db.query(params, function (err, data) {
                if (err || data.Items.length === 0) {
                    callback(err, null);
                } else {
                    let items = [];
                    for (let i = 0; i < data.Items.length; i++) {
                        if (hasCompositeKey) {
                            items.push({
                                [sortKey.name]: data.Items[i][sortKey.name][sortKey.type]
                            });
                        }

                        for (let attrIdx in attributes) {
                            items.push({ [attributes[attrIdx].name]: data.Items[i][attributes[attrIdx].name][attributes[attrIdx].type] });
                        }
                    }

                    if (sKey) {
                        self.cache.set(pKey + "/" + sKey, items[0]);
                    } else {
                        self.cache.set(pKey, items);
                    }
                    callback(err, items.slice(loadOffset, ((loadMax) ? loadMax + loadOffset : loadMax)));
                }
            });
        }
    };

    /**
     * Checks if an item matching the given partition key value and sort key value exists.
     * Check if an item matching just the given partition key exists by passing sKey undefined.
     *
     * @param pKey Partition key value to check.
     * @param sKey Sort key value to check or undefined.
     * @param callback Callback function.
     * @callback Data is true if such an item exists, false if not, null if an error occurs.
     */
    KeyValueStore.prototype.exists = function (pKey, sKey, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        if ((!sKey && self.cache.get(pKey)) || (sKey && self.cache.get(pKey + "/" + sKey))) {
            callback(null, true);
        } else {
            self.get(pKey, sKey, function (err, data) {
                if (err) {
                    callback(err, false);
                } else {
                    callback(err, data !== null);
                }
            });
        }
    };

    /**
     * Get result set by key prefix
     * Callback returns a list of objects with keys "inx" and "value"
     */
    KeyValueStore.prototype.getPrefix = function (prefix, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;

        let params = {
            KeyConditions: {
                [partitionKey.name]: {
                    ComparisonOperator: 'BEGINS_WITH',
                    AttributeValueList: [{[partitionKey.type]: prefix}]
                }
            },
            TableName: self.tableName,
            AttributesToGet: [partitionKey.name, 'Value']
        };

        db.query(params, function (err, data) {
            if (err || data.Items.length === 0)
                callback(err, null);
            else {
                let items = [];
                for (let i = 0; i < data.Items.length; i++) {
                    items.push({[partitionKey.name]: data.Items[i][partitionKey.name][partitionKey.type], "Value": data.Items[i].Value.S});
                }
                callback(err, items);
            }
        });
    };

    /**
     * Adds value to the table with the specified partition key and sort key values.
     * Adds value to the table with just the specified partition key if sKey is undefined.
     *
     * @param pKey Partition key of value to add.
     * @param sKey Sort key of value to add or undefined.
     * @param value Value to add, must be a string.
     * @param callback Callback function.
     * @callback Data is true if addition was successful, false otherwise. TODO check array put partial success
     */
    KeyValueStore.prototype.put = function (pKey, sKey, value, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (hasCompositeKey && !sKey) {
            callback("Error - sort key required for put on table with composite key", null);
            return;
        }

        self.cache.del(pKey);
        if (sKey) {
            self.cache.del(pKey + "/" + sKey);
        }

        let tasks = [];
        if (value.constructor === Array) {
            for (let i = 0; i < value.length; i++) {
                let params = {
                    Item: {
                        [partitionKey.name]: {
                            [partitionKey.type]: pKey
                        },
                        Value: {
                            S: value[i]
                        }
                    },
                    TableName: self.tableName,
                    ReturnValues: 'NONE'
                };

                if (hasCompositeKey) {
                    params.Item[sortKey.name] = {
                        [sortKey.type]: sKey
                    };
                }

                tasks.push(function (callback) {
                    db.putItem(params, callback);
                });
            }
            async.parallel(tasks, function (err, data) {
                if (err) {
                    callback(err, false);
                } else {
                    callback(null, true);
                }
            })
        } else {
            let params = {
                Item: {
                    [partitionKey.name]: {
                        [partitionKey.type]: pKey
                    },
                    Value: {
                        S: value
                    }
                },
                TableName: self.tableName,
                ReturnValues: 'NONE'
            };

            if (hasCompositeKey) {
                params.Item[sortKey.name] = {
                    [sortKey.type]: sKey
                };
            }

            db.putItem(params, function (err, data) {
                if (err) {
                    callback(err, false);
                } else {
                    callback(null, true)
                }
            });
        }
    };

    /**
     * Delete value matching the keyword and inx
     * callback with value of entry that was deleted
     */
    KeyValueStore.prototype.remove = function (pKey, sKey, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (hasCompositeKey && !sKey) {
            callback("Error - sort key required for remove on table with composite key", null);
            return;
        }

        self.cache.del(pKey);
        if (hasCompositeKey) {
            self.cache.del(pKey + "/" + sKey);
        }

        let params = {
            "Key": {
                [partitionKey.name]: {
                    [partitionKey.type]: pKey
                }
            },
            TableName: self.tableName,
            ReturnValues: 'ALL_OLD'
        };

        if (hasCompositeKey) {
            params.Key[sortKey.name] = {
                [sortKey.type]: sKey
            };
        }

        db.deleteItem(params, function (err, data) {
            if (err || !data.Attributes) {
                if (!err) {
                    err = "No such item " + pKey + " " + sKey;
                }
                callback(err, null);
            } else {
                callback(null, data.Attributes);
            }
        });
    };

    /**
     * Gets all of the keys by performing a scan.
     *
     * Callback with a list of objects with keys "key", "inx"
     */
    KeyValueStore.prototype.scanKeys = function (callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        let params = {
            TableName: self.tableName,
            AttributesToGet: [partitionKey.name]
        };

        if (hasCompositeKey) {
            params.AttributesToGet.push(sortKey.name);
        }

        db.scan(params, function (err, data) {
            let values = [];
            if (!err) {
                for (let i = 0; i < data.Count; i++) {
                    let toPush = {
                        [partitionKey.name]: data.Items[i][partitionKey.name][partitionKey.type]
                    };

                    if (hasCompositeKey) {
                        toPush[sortKey.name] = data.Items[i][sortKey.name][sortKey.type]
                    }

                    values.push(toPush);
                }
            }
            callback(err, values);
        });
    };

    /**
     * Gets all of the keys by performing a scan.
     *
     * Callback with a list of objects with keys "key", "inx"
     */
    KeyValueStore.prototype.scanKeysForAttr = function (attr, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        let params = {
            TableName: self.tableName,
            AttributesToGet: [partitionKey.name, attr.name]
        };

        if (hasCompositeKey) {
            params.AttributesToGet.push(sortKey.name);
        }

        db.scan(params, function (err, data) {
            let values = [];
            if (!err) {
                for (let i = 0; i < data.Count; i++) {
                    let toPush = {
                        [partitionKey.name]: data.Items[i][partitionKey.name][partitionKey.type],
                        [attr.name]: data.Items[i][attr.name][attr.type]
                    };

                    if (hasCompositeKey) {
                        toPush[sortKey.name] = data.Items[i][sortKey.name][sortKey.type]
                    }

                    values.push(toPush);
                }
            }
            callback(err, values);
        });
    };

    /**
     * Update entry matching the keyword and inx
     * Assumes that the existing value is a JSON string!
     * Attributes is a dictionary of attr to update
     */
    KeyValueStore.prototype.update = function (pKey, sKey, attributes, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (hasCompositeKey && !sKey) {
            callback("Error - sort key required for update on table with composite key", null);
            return;
        }

        self.remove(pKey, sKey, function (err, data) {
            console.log('data ', data);

            let params = {
                Item: {
                    [partitionKey.name]: {
                        [partitionKey.type]: pKey
                    }
                },
                TableName: self.tableName,
                ReturnValues: 'NONE'
            };

            for (const attrIdx in attributes) {
                params.Item[attributes[attrIdx].name] = {
                    [attributes[attrIdx].type]: attributes[attrIdx].value
                };
            }

            if (hasCompositeKey) {
                params.Item[sortKey.name] = {
                    [sortKey.type]: sKey
                };
            }

            console.log(params);

            db.putItem(params, callback);
        });
    };

    /**
     * Appends contents of attributes to entry matching the given partition key and sort key.
     * Assumes that the existing value is a JSON string array!
     *
     * @param pKey Partition key of item to append to.
     * @param sKey Sort key of item to append to.
     * @param attributes Attributes to union with current value.
     * @param callback Callback function.
     * @callback Data is unused.
     */
    KeyValueStore.prototype.union = function (pKey, sKey, attributes, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (hasCompositeKey && !sKey) {
            callback("Error - sort key required for union on table with composite key", null);
            return;
        }

        self.remove(pKey, sKey, function (err, data) {
            if (err) {
                callback(err, null);
            } else {
                data = JSON.parse(data);
                for (const attr in attributes) {
                    if (attributes[attr].constructor === Array) {
                        data[attr].concat(attributes[attr]);
                    } else {
                        data[attr].push(attributes[attr]);
                    }
                }

                let params = {
                    Item: {
                        [partitionKey.name]: {
                            [partitionKey.type]: pKey
                        },
                        Value: {
                            S: JSON.stringify(data)
                        }
                    },
                    TableName: self.tableName,
                    ReturnValues: 'NONE'
                };

                if (hasCompositeKey) {
                    params.Item[sortKey.name] = {
                        [sortKey.type]: sKey
                    };
                }

                db.putItem(params, callback);
            }
        })
    };

    /**
     * Subtracts contents of attributes from entry matching the given partition key and sort key.
     * Assumes that the existing value is a JSON string array, not including objects!
     *
     * @param pKey Partition key of item to subtract from.
     * @param sKey Sort key of item to subtract from.
     * @param attributes Attributes to set difference with current value.
     * @param callback Callback function.
     * @callback Data is unused.
     */
    KeyValueStore.prototype.difference = function (pKey, sKey, attributes, callback) {
        const self = this;
        if (!self.initialized) {
            callback("Error using table - call init first!", null);
            return;
        }

        const partitionKey = this.partitionKey;
        const sortKey = this.sortKey;
        const hasCompositeKey = this.hasCompositeKey;

        if (hasCompositeKey && !sKey) {
            callback("Error - sort key required for difference on table with composite key", null);
            return;
        }

        self.remove(pKey, sKey, function (err, data) {
            if (err) {
                callback(err, null);
            } else {
                data = JSON.parse(data);
                for (const attr in attributes) {
                    if (attributes[attr].constructor === Array) {
                        data[attr].filter(function (e) { return !attributes[attr].includes(e); });
                    } else {
                        data[attr].filter(function (e) { return e !== attributes[attr]; });
                    }
                }

                let params = {
                    Item: {
                        [partitionKey.name]: {
                            [partitionKey.type]: pKey
                        },
                        Value: {
                            S: JSON.stringify(data)
                        }
                    },
                    TableName: self.tableName,
                    ReturnValues: 'NONE'
                };

                if (hasCompositeKey) {
                    params.Item[sortKey.name] = {
                        [sortKey.type]: sKey
                    };
                }

                db.putItem(params, callback);
            }
        })
    };

    module.exports = KeyValueStore;
}());