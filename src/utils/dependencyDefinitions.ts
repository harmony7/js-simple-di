import Debug from 'debug';
const debug = Debug('js-simple-di');

export interface IDependencyDefinition {
    name: string;
    type: string;
}

export function parseDepends(depends: (IDependencyDefinition | string)[]): IDependencyDefinition[] {
    if (depends == null) {
        return [];
    }
    return depends
        .map((dep) => {
            if (typeof dep === 'string') {
                dep = {name: dep, type: 'single'};
            }
            const {name, type} = dep;
            if (type !== 'single' && type !== 'multiple') {
                debug('ERROR: invalid type for ' + name + ': ' + type);
                return null;
            }
            return dep;
        })
        .filter((dep) => dep != null) as IDependencyDefinition[];
}
