/*
 *
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
function Depository() {

    // root of depository
    let depository_data = {};
    let handlers = {
        filters: {},
        watchers: {}
    };

    function split_key(key) {
        return key.split('.');
    }

    function key_prefix(keys, position) {
        let text = '';
        let new_keys = [];
        for (let i = 0, len = keys.length; i < len; i++) {
            if (i<=position) {
                new_keys.push(keys[i]);
            }
        }
        return (new_keys.join('.'));
    }

    function key_suffix(keys, position) {
        let text = '';
        let new_keys = [];
        for (let i = 0, len = keys.length; i < len; i++) {
            if (i>=position) {
                new_keys.push(keys[i]);
            }
        }
        return (new_keys.join('.'));
    }

    // returns all nodes that deal with the provided key
    // in least-specific to most-specific order;
    function find_handler_nodes(provided_key) {
        let keys = split_key(provided_key);
        let key_has_handlers, descriptor, prefix, suffix, results = []; 

        for (var i = 0, len = keys.length; i < len; i++) {
            key_has_handlers = false;
            prefix = key_prefix(keys, i);
            suffix = key_suffix(keys, i);
            descriptor = {
                "key": prefix,
                "suffix": suffix,
            }
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


    this.get = function(provided_key) {
        // console.log(depository_data);
        let key, keys, new_node, node = depository_data;
        if (provided_key != '.') {
            keys = split_key(provided_key);
            for (var i = 0, len = keys.length; i < len; i++) {
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
        // console.log('node: ', node);
        // always return a copy, not the original data;
        return JSON.parse(JSON.stringify(node));
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

    this.__set_data = function(repo_data, provided_key, data, handler_nodes, filter_start_pos) {
        let key, keys, new_node, node = repo_data;
        let handler_node;
        if (typeof handler_nodes == 'undefined') {
            handler_nodes = find_handler_nodes(provided_key);
        }
        if (typeof filter_start_pos == 'undefined') {
            filter_start_pos = 0;
        }

        let filter_arg, next_key;
        let new_data = data;
        //console.log('handler_nodes:', handler_nodes);
        if (handler_nodes.length) {
            // start at the top level and work our way down. 
            // behavior: call filter.  If filter returns false,
            // the change is cancelled.  If filter returns an 
            // object, it should be in the format:
            // { "key": "bar.baz", value: "new_value"}
            // where key is relative to the current position.
            for (var i = filter_start_pos, len = handler_nodes.length; i < len; i++) {
                handler_node = handler_nodes[i];
                if (Array.isArray(handler_node.filters)) {
                    filter_arg = undefined;
                    // create the filter arguments:
                    for (var j = 0, l2 = handler_node.filters.length; j < l2; j++) {
                        filter_arg = {
                            "provided_key": provided_key,
                            "provided_value": new_data,
                            "current_key": handler_node.key,
                            "key_suffix": handler_node.suffix,
                            "current_value": this.get(handler_node.key)
                        };
                        let result = handler_node.filters[j](filter_arg);
                        let result_type = typeof result;
                        if (result_type == 'boolean') {
                            if (result == false) {
                                // halt processing here and now.
                                return false;
                            } // otherwise continue
                        } else if (result_type == 'object') {
                            if (typeof result.key != 'undefined') {
                                let new_key = handler_node.key;
                                if (result.key != '.') {
                                    new_key += "." + result.key;
                                }
                                if (new_key == provided_key) {
                                    // if the new_key is the same as the provided key
                                    // we simply overwrite the new data and proceed 
                                    // (avoiding an infinite recursion issue)
                                    new_data = result.value;
                                } else {
                                    return this.__set_data(depository_data, new_key, result.value, handler_nodes, i+1);
                                }
                            }
                        }
                    }
                }
            }
        }

        // if we got here, we either had no filters, or the filters were
        // processed without issue;
        //console.log('provided_key', provided_key);
        //console.log('new_data', new_data);
        if (provided_key != '.') {
            keys = split_key(provided_key);
            last_key = keys.pop();
//            console.log('keys', keys);
//            console.log('last_key', last_key);

            for (var i = 0, len = keys.length; i < len; i++) {
//                console.log('depository_data', depository_data);
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
            node[last_key] = new_data;
        } else {
            depository_data = new_data;
        }

        // watchers fire after the data set is complete;
        if (handler_nodes.length) {
            // start at the top level and work our way down. 
            //console.log('handling watchers');
            handler_nodes.map(function(handler_node) {
                //console.log('handler_node', handler_node);
                if (Array.isArray(handler_node.watchers)) {
                    watcher_arg = undefined;
                    // create the filter arguments:
                    handler_node.watchers.map(function(watcher) {
                        let watcher_arg = {
                            "provided_key": provided_key,
                            "provided_value": new_data,
                            "current_key": handler_node.key,
                            "key_suffix": handler_node.suffix,
                            "current_value": this.get(handler_node.key)
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
    }

    this.set = function(provided_key, data) {
        return this.__set_data(depository_data, provided_key, data);
    }

    this.delete = function(provided_key, data) {
        let key, keys, last_key, new_node, node = depository_data;
        if (provided_key != '.') {
            keys = split_key(provided_key);
            last_key = keys.pop();
            for (var i = 0, len = keys.length; i < len; i++) {
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
    }

    this.add_filter = function(provided_key, func) {
        if (!Array.isArray(handlers.filters[provided_key])) {
            handlers.filters[provided_key] = [];
        }
        handlers.filters[provided_key].push(func);
    }

    this.watch = function(provided_key, func) {
        if (!Array.isArray(handlers.watchers[provided_key])) {
            handlers.watchers[provided_key] = [];
        }
        handlers.watchers[provided_key].push(func);
        //console.log(handlers);
    }

    this.remove_filter = function(provided_key, func) {
        if (typeof handlers.filters[provided_key] != 'undefined') {
            let filter_list = handlers.filters[provided_key];
            let index = filter_list.indexOf(func);
            while (index != -1) {
                filter_list.splice(index, 1);
                index = filter_list.indexOf(func);
            }
        }
    }

    this.remove_watcher = function(provided_key, func) {
        if (typeof handlers.watchers[provided_key] != 'undefined') {
            let watcher_list = handlers.watchers[provided_key];
            let index = watcher_list.indexOf(func);
            while (index != -1) {
                watcher_list.splice(index, 1);
                index = watcher_list.indexOf(func);
            }
        }
    }
}

if (typeof(module) !== 'undefined') {
    module.exports = Depository;
} 
