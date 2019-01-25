# Depository

Depository is a small state management / coordination module for
javascript based applications.

Depository is designed to provide a simple mechanism for storing and
retrieving information. It provides a very straightforward API for
monitoring state changes, as well as adjusting / filtering and or
preventing state changes.

Depository works on node and in the browser.

## Usage

    let Depository = require('depository');

    // create a new empty depo
    let depo = new Depository({});

    // attach a watcher to the entire depo
    // this will be called whenever ANY part
    // of the depo is changed.
    depo.watch('.', function(notification) {

        console.log('data was modified:');
        console.log(notification.provided_key);
        console.log(notification.provided_value);

        // new values from the perspective of the watcher
        console.log('from this watchers perspective:');
        console.log(notification.key);
        console.log(notification.value);

    });

    // Subelements are created automatically if they
    // do not already exist.
    depo.set('foo.bar', { baz: 8 });

    console.log(depo.get('.'));
    // will print:
    // { foo: { bar: { baz: 8 } } }

## Why

In modern applications you often need a reliable place to store your
state. A standard javascript object is easiest, but requires you to do
all your state management manually.

The depository module is designed to be almost as simple as interacting
with a normal javascript object, but provide the mechanism for observing
changes to your state and reacting / responding to them.

At the most basic level, you can create watchers on specific portions of
your state object which will be called when that portion of your state
changes. Then, any time that portion of the state changes, your watcher
will be called and can react to that change. This could be used to
trigger a save whenever your user's profile information changes, for
example, or to trigger a UI update if a new message is added to a message list.

Depository doesn't limit you to merely observing changes.  Depository's
filter mechanism allows you to react before data is changed, allowing
you to intercede and modify data or even reject a change.

## Creating a Depository

Creating a depository, or depo, is simple. Simply load the module (via
`require` in node, or via `script src=` in the browser, then create
a depo object:

    let depo = new Depository({});

This will create a new depo and will initialize it with an empty object.
You can pass any object to the depository and it will become the root
object. Note that the initial object provided is directly modified
during the course of interacting with the `depo` object.

## Setting and Getting data

Interacting with the `depo` is a straightforward process. You set
data by calling `depo.set(key, data)` where the `key` is a
dot-separated string indicating what you wish to change, and `data`
is the data you wish to place at that key. For example, calling
the following with an empty `depo`:

    depo.set('person.name', 'Jennifer');

would result in the depo containing a `person` object, which contains
a `name` attribute. We can see this by getting that data using the same
`person.name` key:

    let name = depo.get('person.name');

    console.log(name);  // outputs 'Jennifer'

Likewise, you get get the entire person object using the key `person`:

    let person = depo.get('person');

    console.log(person); // outputs: { "name": "Jennifer" }

When `depo.set()` is called, the data is replaced at the key
provided.  Meaning this:

    depo.set('person.phone', '867-5309');

Would add `phone` to the person object we created before:

    let person = depo.get('person');

    console.log(person);
    // outputs:
    // {
    //     "name": "Jennifer",
    //     "phone": "867-5309"
    // }

If you want to retrieve the entire depo data, you can use
the special key `.` (that is a solitary period):

    let all_data = depo.get('.');

    console.log(all_data);
    // outputs:
    // {
    //     "person": {
    //         "name": "Jennifer",
    //         "phone": "867-5309"
    //     }
    // }

### Auto-vivification

When data is set on a `depo` - all intermediate objects are created
automatically if possible.  As we saw above, setting `person.name`
automatically created a `person` object, and set a value inside it.

The Deposistory will do its best to create the correct structure based
on the keys you provide.  For example, if you did this:

    depo.set('people.0.name', "Jenny");

Depo would create an array called `people` and create an object in the
first position, and set the name in that object to 'Jenny':

    let all_data = depo.get('.');

    console.log(all_data);
    // outputs:
    // {
    //     "people": [
    //         {
    //             "name": "Jenny"
    //         }
    //     ]
    // }

This can, in rare cases, not do what you expect. For example, if
`people` already existed in the repo as an object, then the same
set as above would instead just add to the existing object:

    let all_data = depo.get('.');

    console.log(all_data);
    // outputs:
    // {
    //     "people": {
    //         0: {
    //             "name": "Jennifer",
    //         }
    //     }
    // }

### Get-ting returns a copy

It's important to be aware that `depo.get()` returns a *copy* of the
data in the repo. This means that while you are free to change an object
returned by `depo.get()`, those changes are not applied to the depo
until you call `depo.set()` to place them there.  A good practice
to get into when using the depo is to `depo.get()` the data you want
to modify, modify the returned object, and then `depo.set()` that back
into the depo:

    let person = depo.get('people.0');
    person.phone = "202-867-5309";
    person.address = "pending confirmaton";
    depo.set('people.0', person);

There are several reasons for this, the primary one being that `depo`
will trigger only one set of filters / notifications for the change, rather
than sending several, one for each attribute changed.

### Watching for data changes

The primary purpose of *Depository* is to allow for monitoring of data
changes. As such, this is made exceedingly simple. To monitor a portion
of your *depo* for changes, you simply call `depo.watch` passing the
key that you want to monitor:



    let Depository = require('./Depository.js');

    // create a new empty depo
    let depo = new Depository({ people: [] });

    // attach a watcher to the people list
    depo.watch('people', function(notification) {
        // when a people element is changed, save it:
        imagineary_api.save(notification.value);

        console.log('people was modified:');
        console.log(notification);
        // people was modified:
        // { provided_key: 'people.0',
        //   provided_value: { name: 'Jenny' },
        //   key: 'people',
        //   key_suffix: '0',
        //   value: [ { name: 'Jenny' } ] }

    });

    depo.set('people.0', { "name": "Jenny" });

The function provided to watch will receive a `notification`
object whenever the portion of the depo it is watching is changed.

The `notification` includes all the information about the change
that was made. The `key` attribute contains the key that was
being watched.  The `key_suffix` will be the key path to the changed
object, and `value` will be the new value.  This information is
provided from the perspective of the watcher.

In addition to the attributes above, the `provided_key` and
`provided_value` provides the key and value actually passed to the
`depo.set()` method.

As you might notice, this means that watchers are aware of changes
anywhere beneath the key you are watching. In other words, if you were
to change the `phone` attribute of a single element in your `people` array,
your watcher would be informed of this change.
