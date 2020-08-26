import * as fs from 'fs';
import * as path from 'path';

import Debug from 'debug';
const debug = Debug('js-simple-di');

import { DiContext } from './DiContext';
import { IDependencyDefinition, parseDepends } from '../utils/dependencyDefinitions';
import { Constructor, makeDisplayName } from '../utils/constructors';

interface IDiConstructor<T> extends Constructor<T> {
    serviceNames?: string[];
    depends?: (string | IDependencyDefinition)[];
}

function findClassDependencies<T>(ctor: IDiConstructor<T>) {
    // Each class can be registered as one or more "service" names.
    // The class can either specify an array of service names to
    // make itself available by, or if not specified, it will
    // use the class name.

    const { serviceNames, name, depends } = ctor;

    const displayName = makeDisplayName(ctor);

    const classServiceNames: string[] = [];
    if (Array.isArray(serviceNames)) {
        // this MUST not be empty and the entries must all
        // be strings.

        // We will log to console if this is not valid.
        if (serviceNames.length < 1) {
            debug('ERROR: Cannot add ' + displayName + ' to DI container. If provided, serviceNames must not be empty');
            return null;
        }

        for (const serviceName of serviceNames) {
            // type check here in case we are calling from non-TS
            if ((typeof serviceName as any) !== 'string') {
                debug(
                    'ERROR: Cannot add ' +
                        displayName +
                        ' to DI container. Every entry of serviceNames must be a string.',
                );
                return null;
            }
            classServiceNames.push(serviceName);
        }
    } else {
        // If the class has a name and defines a depends field (even if it's null or
        // and empty list) then this class becomes available under its class name.
        if (name == null || name === '') {
            debug('ERROR: Cannot add ' + displayName + " to DI container, and the class doesn't have a name");
            return null;
        }
        if (depends === undefined) {
            debug(
                'WARNING: Not adding ' +
                    displayName +
                    ' to DI container as it does not specify a list of serviceNames nor does it define a depends field.',
            );
            return null;
        }

        classServiceNames.push(name);
    }

    return { serviceNames: classServiceNames, depends: depends ?? null };
}

export class DiContainer {
    private readonly serviceNameToConstructor: { [s: string]: Constructor<any>[] };
    private readonly serviceToDepends: Map<Constructor<any>, IDependencyDefinition[] | null>;

    public constructor() {
        this.serviceNameToConstructor = {};
        this.serviceToDepends = new Map<Constructor<any>, IDependencyDefinition[]>();
    }

    public dependency<T>(names?: string[] | string) {
        return <TService extends Constructor<T>>(ctor: TService): TService => {
            if (names === undefined) {
                names = [ctor.name];
            } else if (!Array.isArray(names)) {
                names = [names];
            }
            this.setupDependency(ctor, names);
            this.setupDepends(ctor, null);
            return ctor;
        };
    }

    public depends<T>(
        depends: (string | IDependencyDefinition)[],
    ): <TService extends Constructor<T>>(ctor: TService) => TService;
    public depends<T>(
        ...depends: (string | IDependencyDefinition)[]
    ): <TService extends Constructor<T>>(ctor: TService) => TService;
    public depends<T>(...params: any[]) {
        return <TService extends Constructor<T>>(ctor: TService): TService => {
            let depends: (string | IDependencyDefinition)[] | null;
            if (params.length === 1 && Array.isArray(params[0])) {
                depends = params[0];
            } else {
                depends = params.length > 0 ? params : null;
            }
            this.setupDepends(ctor, depends);
            return ctor;
        };
    }

    public setupDependency<T>(ctor: Constructor<T>, serviceNames: string[]) {
        const displayName = makeDisplayName(ctor);

        debug('Setting up dependencies of ' + displayName);

        for (const serviceName of serviceNames) {
            debug('Service Name ' + serviceName);

            if (this.serviceNameToConstructor[serviceName] == null) {
                this.serviceNameToConstructor[serviceName] = [];
            }
            if (!this.serviceNameToConstructor[serviceName].includes(ctor)) {
                this.serviceNameToConstructor[serviceName].push(ctor);
            }
        }
    }

    public setupDepends<T>(ctor: Constructor<T>, depends: (string | IDependencyDefinition)[] | null | undefined) {
        const displayName = makeDisplayName(ctor);

        debug('Setting up depends of ' + displayName);
        debug('Depends', depends);

        const currentList = this.serviceToDepends.get(ctor);

        if (depends == null) {
            if (currentList === undefined) {
                debug('Defining depends as null');
                this.serviceToDepends.set(ctor, null);
            } else if (currentList === null) {
                debug('current list is null and new is null, we are skipping');
            } else {
                debug('current is not null and new is null, we are skipping.');
            }
            return;
        }

        const parsedDepends = parseDepends(depends);
        if (currentList === undefined) {
            debug('Adding new depends');
        } else if (currentList === null) {
            debug('Redefining depends from null');
        } else {
            if (JSON.stringify(currentList) === JSON.stringify(parsedDepends)) {
                debug("Redefining to same value, we are skipping");
                return ;
            }
            throw new Error('Cannot redefine depends of ' + displayName);
        }

        this.serviceToDepends.set(ctor, parsedDepends);

        if (parsedDepends.length > 0) {
            const dependencyList = parsedDepends.map((dep) => {
                return dep.name + ', type ' + dep.type;
            });
            debug('It holds dependencies on ' + dependencyList.join('; '));
        } else {
            debug('No depends added');
        }
    }

    public getConstructorsByName(name: string) {
        return this.serviceNameToConstructor[name];
    }

    public getServiceDepends<T>(ctor: Constructor<T>) {
        return this.serviceToDepends.get(ctor);
    }

    public constructByName<T>(name: string): T {
        const constructors = this.getConstructorsByName(name);
        if (!Array.isArray(constructors) || constructors.length === 0) {
            throw new Error(`constructByName: No constructors registered with name ${name}`);
        }
        if (constructors.length > 1) {
            throw new Error(`constructByName: More than one constructor defined for ${name}`);
        }
        const ctor = constructors[0];
        return this.constructObject<T>(ctor) as T;
    }

    public addClassesFromPaths(dirs: string[]) {
        for (const dir of dirs) {
            this.addClassesWorker(dir);
        }
    }

    public addClass<T>(ctor: Constructor<T>) {
        const classDependencies = findClassDependencies(ctor as IDiConstructor<T>);
        if (classDependencies != null) {
            const { serviceNames, depends } = classDependencies;
            this.setupDependency(ctor, serviceNames);
            this.setupDepends(ctor, depends);
        }
    }

    public addClassesWorker(dir: string) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
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
                        const ctor = require(filePath);
                        if (typeof ctor === 'function') {
                            this.addClass(ctor);
                        }
                    } catch (ex) {
                        // Could not load, but no big deal.
                    }
                }
            }
        }
    }

    public constructObject<T>(constructor: Constructor<T>) {
        const context = new DiContext<T>(this, constructor);
        return context.construct();
    }
}
