/*
 * Depository - Simple JS data/state management module
 *
 * Manages data for js applications
 *
 * Basic functionality:
 *
 * Set key to a value
 * Get a key's value
 * Add a filter for a particular key
 * Register a watcher when a key is changed
 *
 */
function Depository(initial_data) {
    "use strict";

    // root of depository
    var depository_data = initial_data || {};
    var handlers = {
        filters: {},
        watchers: {}
    };
    var tetchy = false;

    function split_key(key) {
        return key.split('.');
    }

    function key_prefix(keys, position) {
        var i, len, new_keys = [];
        for (i = 1, len = keys.length; i < len; i++) {
            if (i<=position) {
                new_keys.push(keys[i]);
            }
        }
        if (new_keys.length > 0) {
            return (new_keys.join('.'));
        } else {
            return '.';
        }
    }

    function key_suffix(keys, position) {
        var i, len, new_keys = [];
        for (i = 0, len = keys.length; i < len; i++) {
            if (i>position) {
                new_keys.push(keys[i]);
            }
        }
        if (new_keys.length > 0) {
            return (new_keys.join('.'));
        } else {
            return '.';
        }
    }

    // returns all nodes that deal with the provided key
    // in least-specific to most-specific order;
    function find_handler_nodes(provided_key) {
        var i, len;
        var keys = split_key(provided_key);
        var key_has_handlers, descriptor, prefix, suffix, results = [];

        keys.unshift('.');
        for (i = 0, len = keys.length; i < len; i++) {
            key_has_handlers = false;
            prefix = key_prefix(keys, i);
            suffix = key_suffix(keys, i);
            descriptor = {
                "key": prefix,
                "suffix": suffix,
            };
            if (typeof handlers.filters[prefix] != 'undefined') {
                descriptor.filters = handlers.filters[prefix];
                key_has_handlers = true;
            }
            if (typeof handlers.watchers[prefix] != 'undefined') {
                descriptor.watchers = handlers.watchers[prefix];
                key_has_handlers = true;
            }
            if (key_has_handlers) {
                results.push(descriptor);
            }
        }
        return results;
    }

    this.be_tetchy = function(throw_exceptions_on_rejected_set) {

        // if throw_exceptions_on_rejected_set is true turn on tetchy mode
        tetchy = throw_exceptions_on_rejected_set;
    };


    this.get = function(provided_key) {
        // console.log(depository_data);
        var i, len, key, keys, new_node, node = depository_data;
        if (provided_key != '.') {
            keys = split_key(provided_key);
            for (i = 0, len = keys.length; i < len; i++) {
                key = keys[i];
                if (typeof node == 'object') {
                    new_node = node[key];
                    if (typeof new_node == 'undefined') {
                        return undefined;
                    } else {
                        node = new_node;
                    }
                } else {
                    return undefined;
                }
            }
        }
        if (typeof node == 'object') {
            return JSON.parse(JSON.stringify(node));
        } else {
            return node;
        }
    };

    // updates original_data at provided_key using new_data.
    function update_data(data_obj, provided_key, new_data, delete_key) {
        var node = data_obj;
        var keys, key, next_key, last_key, i, len, new_node;

        if (provided_key != '.') {
            keys = split_key(provided_key);
            next_key = keys[0];
            last_key = keys.pop();
            if (typeof data_obj == 'undefined') {
                if (/^\d+$/.test(next_key)) {
                    node = [];
                } else {
                    node = {};
                }
                data_obj = node;
            }

            for (i = 0, len = keys.length; i < len; i++) {
                key = keys[i];
                new_node = node[key];
                if (typeof new_node == 'undefined') {
                    if (i+1 < len) {
                        next_key = keys[i+1];
                    } else {
                        next_key = last_key;
                    }

                    if (/^\d+$/.test(next_key)) {
                        new_node = [];
                    } else {
                        new_node = {};
                    }
                    node[key] = new_node;
                }
                node = new_node;
            }
            if (!delete_key) {
                node[last_key] = new_data;
            } else {
                if (typeof node == 'object') {
                    if (Array.isArray(node)) {
                        if (/^\d+$/.test(last_key)) {
                            node.splice(last_key, 1);
                        }
                    } else {
                        delete node[last_key];
                    }
                }
            }
        } else {
            data_obj = new_data;
        }
        return data_obj;
    }



    // call filter - receives an object:
    // {
    //     "current_key": "foo",
    //     "current_value": { "bar": { baz: "..." } },
    //     "key_suffix": "bar.baz",
    //     "provided_key": "foo.bar.baz",
    //     "provided_value": { .... }
    // }
    // should return one of three things:
    // 1) true - allow set as-is
    // 2) false - prevent set.
    // 3) an object representing a new set relative to the current position:
    //      { "key": "bar", value: { "bag": { "foobar" } } }
    //    if the filter received the object shown earlier in the documentation,
    //    this returned object will result in foo.bar being set to the the
    //    value returned. if no key is provided in the object, the original key
    //    will be used.  All deeper filters will be pre-empted when a filter returns
    //    an object;

    this.__set_data = function(repo_data, provided_key, data, handler_nodes, filter_start_pos, delete_key) {
        var key, keys, new_node, last_key, node = repo_data;
        var handler_node, filter_arg, next_key, new_data;
        var i, len, j, l2, result, result_type, new_key;
        var current_value, proposed_value;
        if (typeof handler_nodes == 'undefined') {
            handler_nodes = find_handler_nodes(provided_key);
        }
        if (typeof filter_start_pos == 'undefined') {
            filter_start_pos = 0;
        }

        // if we are not deleting, then set our new_data appropriately
        if (!delete_key) {
            new_data = data;
        }
        //console.log('handler_nodes:', handler_nodes);
        if (handler_nodes.length) {
            // start at the top level and work our way down.
            // behavior: call filter.  If filter returns false,
            // the change is cancelled.  If filter returns an
            // object, it should be in the format:
            // { "key": "bar.baz", value: "new_value"}
            // where key is relative to the current position.
            for (i = filter_start_pos, len = handler_nodes.length; i < len; i++) {
                handler_node = handler_nodes[i];
                if (Array.isArray(handler_node.filters)) {
                    filter_arg = undefined;
                    current_value = this.get(handler_node.key);
                    proposed_value = update_data(this.get(handler_node.key), handler_node.suffix, new_data, delete_key);
                    // create the filter arguments:
                    for (j = 0, l2 = handler_node.filters.length; j < l2; j++) {
                        filter_arg = {
                            "provided_key": provided_key,
                            "provided_value": new_data,
                            "key": handler_node.key,
                            "proposed_value": proposed_value,
                            "current_value": current_value,
                            "key_suffix": handler_node.suffix
                        };
                        if (delete_key) {
                            filter_arg.delete_key = true;
                        }
                        result = handler_node.filters[j](filter_arg);
                        result_type = typeof result;
                        if (result_type == 'boolean') {
                            if (result == false) {
                                // halt processing here and now.
                                if (tetchy) {
                                    var err = new Error('Error setting ' + provided_key + ', filter prevented set');
                                    err.filter = handler_node.filters[j];
                                    err.filter_args = filter_arg;
                                    throw err;
                                } else {
                                    return false;
                                }
                            } // otherwise continue
                        } else if (result_type == 'object') {
                            // if we have a value we are overiding our provided value
                            if ("value" in result || result.delete_value) {
                                if (typeof result.key == 'undefined') {
                                    new_key = provided_key;
                                } else {
                                    new_key = handler_node.key;
                                    if (result.key != '.') {
                                        new_key += "." + result.key;
                                    }
                                }
                                if (new_key == provided_key) {
                                    // if the new_key is the same as the provided key
                                    // we simply overwrite the new data and proceed
                                    // (avoiding an infinite recursion issue)
                                    if (typeof result.delete_value == 'boolean') {
                                        delete_key = result.delete_value;
                                        new_data = undefined;
                                    } else {
                                        new_data = result.value;
                                        // have to re-set the proposed_data here too so the next filter gets the right thing.
                                        proposed_value = update_data(proposed_value, handler_node.suffix, new_data, delete_key);
                                    }
                                } else {
                                    return this.__set_data(depository_data, new_key, result.value, handler_nodes, i+1, delete_key);
                                }
                            }
                        }
                    }
                }
            }
        }

        // if we got here, we either had no filters, or the filters were
        // processed without issue;
        depository_data = update_data(depository_data, provided_key, new_data, delete_key);
        // watchers fire after the data set is complete;
        if (handler_nodes.length) {
            // start at the top level and work our way down.
            handler_nodes.map(function(handler_node) {
                if (Array.isArray(handler_node.watchers)) {
                    // create the filter arguments:
                    handler_node.watchers.map(function(watcher) {
                        var watcher_arg = {
                            "provided_key": provided_key,
                            "provided_value": new_data,
                            "key": handler_node.key,
                            "key_suffix": handler_node.suffix,
                            "value": this.get(handler_node.key)
                        };
                        // this runs the watcher, but does so after the synchronous
                        // event loop completes, preventing us from hanging;
                        setTimeout(function() {
                            watcher(watcher_arg);
                        }, 0);
                    }.bind(this));
                }
            }.bind(this));
        }
    };

    this.set = function(provided_key, data) {
        return this.__set_data(depository_data, provided_key, data);
    };

    this.delete = function(provided_key, data) {
        // delete is a call to set with undefined as the value, and delete_key = true;
        return this.__set_data(depository_data, provided_key, undefined, undefined, undefined, true);
    };

    this.add_filter = function(provided_key, func) {
        if (!Array.isArray(handlers.filters[provided_key])) {
            handlers.filters[provided_key] = [];
        }
        handlers.filters[provided_key].push(func);
    };

    this.watch = function(provided_key, func) {
        if (!Array.isArray(handlers.watchers[provided_key])) {
            handlers.watchers[provided_key] = [];
        }
        handlers.watchers[provided_key].push(func);
    };

    this.remove_filter = function(provided_key, func) {
        var filter_list, index;
        if (typeof handlers.filters[provided_key] != 'undefined') {
            filter_list = handlers.filters[provided_key];
            index = filter_list.indexOf(func);
            while (index != -1) {
                filter_list.splice(index, 1);
                index = filter_list.indexOf(func);
            }
        }
    };

    this.remove_watcher = function(provided_key, func) {
        var watcher_list, index;
        if (typeof handlers.watchers[provided_key] != 'undefined') {
            watcher_list = handlers.watchers[provided_key];
            index = watcher_list.indexOf(func);
            while (index != -1) {
                watcher_list.splice(index, 1);
                index = watcher_list.indexOf(func);
            }
        }
    };
}

/* istanbul ignore else */
if (typeof(module) !== 'undefined') {
    module.exports = Depository;
}
