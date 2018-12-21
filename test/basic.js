var Depository = require('../Depository.js');

var assert = require('assert');
describe('Depository', function() {

    describe('Basics', function() {

        it('Creating a Depository works', function() {
            var depo  = new Depository();
            assert.equal(typeof depo , 'object');
            assert.equal(typeof depo.get, 'function');
            assert.equal(typeof depo.set, 'function');
            assert.equal(typeof depo.delete, 'function');
        });
        

        it('Setting and getting data works', function() {
            var depo = new Depository();

            depo.set('foo.bar', 17);
            let new_val = depo.get('foo.bar')
            assert.strictEqual(new_val, 17);
        });

        it('Set root data works', function() {
            var depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});

            let new_val = depo.get('foo.baz')
            //console.log('new_val is', new_val);
            assert.deepStrictEqual(new_val, [18]);
        });

        it('Set element of nonexistant array creates array', function() {
            var depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});

            depo.set('foo.bar.0', 99);
            let new_val = depo.get('foo.bar')
            //console.log('new_val is', new_val);
            assert.deepStrictEqual(new_val, [99]);

            depo.set('foo.bal.0.foo', "fizz");
            new_val = depo.get('foo.bal')
            assert.deepStrictEqual(new_val, [{"foo": "fizz"}]);
        });

        it('Set element of nonexistant object creates objects', function() {
            var depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});

            depo.set('foo.bar.no', 99);
            let new_val = depo.get('foo.bar')
            //console.log('new_val is', new_val);
            assert.deepStrictEqual(new_val, {"no": 99});

            depo.set('foo.bal.yes.foo', "fizz");
            new_val = depo.get('foo.bal')
            assert.deepStrictEqual(new_val, {"yes": {"foo": "fizz"}});
        });

        it('delete data works', function() {
            var depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.delete('foo.baz.0');
            let new_val = depo.get('foo.baz')
            //console.log('new_val is', new_val);
            assert.deepStrictEqual(new_val, []);

            depo.delete('foo.baz');
            new_val = depo.get('foo.baz')
            //console.log('new_val is', new_val);
            assert.deepStrictEqual(new_val, undefined);
        });

        it('getting data that does not exist fails', function() {
            var depo = new Depository();
            
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let new_val = depo.get('foo.bar');
            assert.strictEqual(new_val, undefined);
            new_val = depo.get('foo.baz.0.foo');
            assert.strictEqual(new_val, undefined);
        });

        it('deleting data that does not exist fails', function() {
            var depo = new Depository();
            
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let new_val = depo.delete('foo.bar');
            assert.strictEqual(new_val, undefined);
            new_val = depo.delete('foo.bar.0');

            new_val = depo.delete('foo.baz.0.foo.bar');
            assert.strictEqual(new_val, undefined);
        });

        it("Separate Depo's do not collide", function() {
            var depo1 = new Depository();
            var depo2 = new Depository();

            depo1.set('foo.bar', 17);
            depo1.set('foo.baz', 13);
            depo2.set('foo.bar', 12);
            depo2.set('foo.baz', 19);
            depo2.set('foo.bibble', "blub");
            
            let new_val = depo1.get('foo.bar')
            assert.strictEqual(depo1.get('foo.bar'), 17);
            assert.strictEqual(depo1.get('foo.baz'), 13);
            assert.strictEqual(depo2.get('foo.bar'), 12);
            assert.strictEqual(depo2.get('foo.baz'), 19);
            assert.strictEqual(depo2.get('foo.bibble'), "blub");
            assert.strictEqual(depo1.get('foo.bibble'), undefined);
        });

        it('Modifying returned data does not change depo', function() {
            var depo = new Depository();

            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let new_val = depo.get('foo');
            new_val.baz.push('12');
            let depo_val = depo.get('foo');
            assert.deepStrictEqual(depo_val, { "baz": [18] });
        });


    });

    describe('Watchers', function() {
        it('does exact watcher', function(done) {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.watch('foo.baz', function(notification) {
                //console.log('notification', notification);
                done();
            });
            depo.set("foo.baz", [ 19, 22]);
        });

        it('does multiple exact watchers', function(done) {
            let depo = new Depository();
            let watchers_fired = 0;
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.watch('foo.baz', function(notification) {
                watchers_fired++;
                if (watchers_fired == 3) {
                    done();
                }
            });
            depo.watch('foo.baz', function(notification) {
                watchers_fired += 2;
                if (watchers_fired == 3) {
                    done();
                }
            });
            depo.set("foo.baz", [ 19, 22]);
        });

        it('does higher level watcher', function(done) {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.watch('foo', function(notification) {
                //console.log(notification);
                done();
            });
            depo.set("foo.baz", [ 19, 22]);
        });

        it('remove watcher works', function(done) {
            let depo = new Depository();
            let count = 0;
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let func = function(notification) {
                count++;
            };
            depo.watch('foo', func);
            depo.set("foo.baz", [ 19, 22]);
            depo.remove_watcher('foo', func);
            depo.set("foo.bar", "wibble");
            setTimeout(function() {
                assert.strictEqual(count, 1);
                done();
            }, 100);
        });

        it('does multiple level watchers', function(done) {
            let depo = new Depository();
            let watchers_fired = 0;
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.watch('foo.baz', function(notification) {
                watchers_fired++;
                if (watchers_fired == 5) {
                    done();
                }
            });
            depo.watch('foo', function(notification) {
                watchers_fired += 4;
                if (watchers_fired == 5) {
                    done();
                }
            });
            depo.set("foo.baz", [ 19, 22]);
        });
    });
    describe('Filters', function() {
        it('filter approval works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.add_filter('foo.baz', function(notification) {
                //console.log('notification', notification);
                return true;
            });
            depo.set("foo.baz", "wibble");
            var value = depo.get("foo.baz");
            assert.strictEqual(value, "wibble");
        });

        it('filter reject works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.add_filter('foo.baz', function(notification) {
                //console.log('notification', notification);
                return false;
            });
            let res = depo.set("foo.baz", "wibble");
            //console.log("Result", res);
            var value = depo.get("foo.baz");
            assert.deepStrictEqual(value, [ 18 ]);
        });

        it('filter change works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            depo.add_filter('foo.baz', function(notification) {
                //console.log('notification', notification);
                return { key: ".", value: "bob_" + notification.provided_value };
            });
            let res = depo.set("foo.baz", "wibble");
            //console.log("Result", res);
            var value = depo.get("foo.baz");
            assert.deepStrictEqual(value, 'bob_wibble');
        });

        it('filter subelement change works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});

            depo.add_filter('foo.baz', function(notification) {
                //console.log('notification', notification);
                return { key: "1", value: "bob_" + notification.provided_value };
            });

            let res = depo.set("foo.baz", "wibble");

            //console.log("Result", res);
            let value = depo.get("foo.baz");
            assert.deepStrictEqual(value, [ 18, 'bob_wibble']);
        });

        it('filter removal works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let func = function(notification) {
                //console.log('notification', notification);
                return false;
            };
            depo.add_filter('foo.baz', func);
            depo.set("foo.baz", "wibble");
            let value = depo.get("foo.baz");
            // expect that the filter prevented the edit
            assert.deepStrictEqual(value, [ 18 ]);
            
            depo.remove_filter('foo.baz', func);
            depo.set("foo.baz", "wibble");
            value = depo.get("foo.baz");

            // expect that since we removed the filter, the set was successful
            assert.deepStrictEqual(value, "wibble");
        });
        it('removal of nonexistent filters works', function() {
            let depo = new Depository();
            depo.set('.', { "foo": { "baz": [ 18 ] }});
            let func = function(notification) {
                //console.log('notification', notification);
                return false;
            };
            let truefunc = function(notification) {
                //console.log('notification', notification);
                return true;
            };
            depo.add_filter('foo.baz', func);
            
            depo.remove_filter('foo.bar', func);
            depo.remove_filter('foo.baz', truefunc);
        });
    });
});



