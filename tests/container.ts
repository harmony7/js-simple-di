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

test('Should be ok to add same class multiple time', function() {

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

    @di.depends("Clock")
    class MyClass2 {
        static depends = ['Clock'];
        c: Clock;
        constructor(c: Clock) {
            this.c = c;
        }
    }

    di.addClass(Clock);
    di.addClass(MyClass);
    di.addClass(MyClass);

    di.addClass(MyClass2);
    di.addClass(MyClass2);

    const obj = di.constructByName<MyClass>('MyClass');

    expect(obj.c.i).toBe('x');

});
