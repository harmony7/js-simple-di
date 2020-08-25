import {DiContainer} from "../src";

test('thing1', function() {

    const di = new DiContainer();

    @di.dependency()
    class Clock {
        i = 'x';
    }

    @di.dependency()
    @di.depends('Clock')
    class MyClass {
        c: Clock;
        constructor(c: Clock) {
            this.c = c;
        }
    }

    const obj = di.constructByName<MyClass>('MyClass');

    expect(obj.c.i).toBe('x');

});

test('thing2', function() {

    const di = new DiContainer();

    class Clock {
        static depends = null;
        i = 'x';
    }

    class MyClass {
        static depends = ['Clock'];
        c: Clock;
        constructor(c: Clock) {
            this.c = c;
        }
    }

    di.addClass(Clock);
    di.addClass(MyClass);

    const obj = di.constructByName<MyClass>('MyClass');

    expect(obj.c.i).toBe('x');

});

test('thing3', function() {

    const di = new DiContainer();

    @di.dependency()
    class Clock {
        static depends = null;
        i = 'x';
    }

    @di.dependency()
    @di.depends('Clock')
    class MyClass {
        //static depends = ['Clock'];
        c: Clock;
        constructor(c: Clock) {
            this.c = c;
        }
    }

    di.addClass(Clock);
    di.addClass(MyClass);

    const obj = di.constructByName<MyClass>('MyClass');

    expect(obj.c.i).toBe('x');

});