import {IDependencyDefinition} from "./dependencyDefinitions";

export function makeDisplayName<T>(constructor: IDiConstructor<T>) {
    const {name} = constructor;
    return name == null || name === '' ? 'anonymous class' : name;
}

export interface IDiConstructor<T> {
    new(...args: any[]): T;

    serviceNames?: string[];
    depends?: (string | IDependencyDefinition)[];
}
