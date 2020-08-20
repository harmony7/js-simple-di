import * as fs from 'fs';
import * as path from 'path';

import Debug from 'debug';
const debug = Debug('js-simple-di');

import {DiContext} from "./DiContext";
import {parseDepends} from "../utils/dependencyDefinitions";
import {IDiConstructor, makeDisplayName} from "../utils/constructors";

export class DiContainer {
    private readonly map: { [s: string]: IDiConstructor<any>[] };

    public constructor() {
        // Maps constructor names to their classes.
        this.map = {};
    }

    public registerClass<T>(constructor: IDiConstructor<T>) {
        // Each class can be registered as one or more "service" names.
        // The class can either specify an array of service names to
        // make itself available by, or if not specified, it will
        // use the class name.
        const serviceNamesForClass = [];

        const {serviceNames, name, depends} = constructor;

        const displayName = makeDisplayName(constructor);

        if (Array.isArray(serviceNames)) {
            // this MUST not be empty and the entries must all
            // be strings.

            // We will log to console if this is not valid.
            if (serviceNames.length < 1) {
                debug('ERROR: Cannot add ' + displayName + ' to DI container. If provided, serviceNames must not be empty');
                return;
            }

            for (const serviceName of serviceNames) {
                // type check here in case we are calling from non-TS
                if ((typeof serviceName as any) !== 'string') {
                    debug('ERROR: Cannot add ' + displayName + ' to DI container. Every entry of serviceNames must be a string.');
                    return;
                }
                serviceNamesForClass.push(serviceName);
            }
        } else {
            // If the class has a name and defines a depends field (even if it's null or
            // and empty list) then this class becomes available under its class name.
            if (name == null || name === '') {
                debug('ERROR: Cannot add ' + displayName + " to DI container, and the class doesn't have a name");
                return;
            }
            if (depends === undefined) {
                debug(
                    'WARNING: Not adding ' +
                    displayName +
                    ' to DI container as it does not specify a list of serviceNames nor does it define a depends field.',
                );
                return;
            }

            serviceNamesForClass.push(name);
        }

        debug('Adding ' + displayName + ' to DI container as dependency name(s): ' + serviceNamesForClass.join(', '));

        if (Array.isArray(depends)) {
            const dependencyList = parseDepends(depends).map((dep) => {
                return dep.name + ', type ' + dep.type;
            });
            debug('It holds dependencies on ' + dependencyList.join('; '));
        }

        for (const serviceName of serviceNamesForClass) {
            if (this.map[serviceName] == null) {
                this.map[serviceName] = [];
            }
            this.map[serviceName].push(constructor);
        }
    }

    public getConstructorsByName(name: string) {
        return this.map[name];
    }

    public addClassesFromPaths(dirs: string[]) {
        for (const dir of dirs) {
            const joined = path.join(__dirname, dir);
            this.addClassesWorker(joined);
        }
    }

    public addClassesWorker(dir: string) {
        debug(dir);
        const files = fs.readdirSync(dir, {withFileTypes: true});
        for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) {
                // Recurse
                this.addClassesWorker(filePath);
            } else if (file.isFile()) {
                // If it's a JS file then require it and see if it's a
                // function (then it could be a constructor).
                // If so, we try registering it.
                if (file.name.endsWith('.js')) {
                    debug('Trying to add ' + filePath);
                    try {
                        const value = require(filePath);
                        if (typeof value === 'function') {
                            this.registerClass(value);
                        }
                    } catch (ex) {
                        // Could not load, but no big deal.
                    }
                }
            }
        }
    }

    public constructObject<T>(constructor: IDiConstructor<T>) {
        const context = new DiContext<T>(this, constructor);
        return context.construct();
    }
}
