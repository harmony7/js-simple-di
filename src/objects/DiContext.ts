import Debug from 'debug';
const debug = Debug('js-simple-di');

import { DiContainer } from './DiContainer';
import { IDependencyDefinition, parseDepends } from '../utils/dependencyDefinitions';
import { Constructor, makeDisplayName } from '../utils/constructors';

interface IStackItem<T> {
    serviceName: string;
    ctor: Constructor<T>;
}

export class DiContext<T> {
    // parent dependency container
    private readonly diContainer: DiContainer;

    // map of constructor: instance of already created items
    private readonly objects: Map<Constructor<any>, any | null>;

    // current stack of objects being created
    private readonly currentStack: IStackItem<any>[];

    public constructor(diContainer: DiContainer, ctor: Constructor<T>) {
        this.diContainer = diContainer;

        this.objects = new Map();
        this.currentStack = [];
        this.currentStack.push({
            serviceName: 'root',
            ctor,
        });
    }

    private static displayStackItem<T>(item: IStackItem<T>) {
        const displayName = makeDisplayName(item.ctor);
        let message = displayName;
        if (displayName !== item.serviceName) {
            message += ' (as ' + item.serviceName + ')';
        }
        return message;
    }

    public construct() {
        return this.constructItem<T>();
    }

    private constructItem<TItem>(): TItem | null {
        const currentItem = this.currentStack[this.currentStack.length - 1];
        const { ctor } = currentItem;

        const existingInstance = this.objects.get(ctor);
        if (existingInstance === null) {
            // If this strictly equals null then it was in the pending state.
            const parentItem = this.currentStack[this.currentStack.length - 2];
            const message =
                'Problem constructing ' +
                DiContext.displayStackItem(parentItem) +
                '. ' +
                'Cyclic dependency trying to construct ' +
                DiContext.displayStackItem(currentItem) +
                '. ' +
                'The current dependency resolution stack is ' +
                this.currentStack.map(DiContext.displayStackItem).join(' => ');
            debug('ERROR: ' + message);
            return null;
        }
        // PENDING state
        this.objects.set(ctor, null);

        const depends = this.diContainer.getServiceDepends(ctor);

        const displayName = makeDisplayName(ctor);

        if (depends === undefined) {
            // If the class we're trying to build doesn't have a depends field then
            // it's not eligible, and we return null.
            debug("ERROR: Can't use DI to construct " + displayName + ' as it does not define a depends field.');
            return null;
        }

        debug('Constructing dependencies to prepare to call constructor of ' + displayName);
        const constructorParameters = parseDepends(depends ?? []).map((depend) => this.findDepend(depend));
        debug('Constructor Parameters', constructorParameters);

        const instance = new ctor(...constructorParameters);
        this.objects.set(ctor, instance);
        return instance;
    }

    private findDepend(depend: IDependencyDefinition) {
        const currentItem = this.currentStack[this.currentStack.length - 1];
        const displayName = makeDisplayName(currentItem.ctor);

        const { name, type } = depend;
        const constructorsOfDepend = this.diContainer.getConstructorsByName(name);
        debug('dependency', name, type);

        if (constructorsOfDepend == null) {
            debug("ERROR: Can't construct " + displayName + ' because it needs ' + name);
            return null;
        } else if (type === 'single' && constructorsOfDepend.length !== 1) {
            debug(
                "ERROR: Can't construct " +
                    displayName +
                    ' because its dependency ' +
                    name +
                    ' does not have exactly one implementation.',
            );
            return null;
        } else {
            const objectsForDepend = constructorsOfDepend.map((ctor) => {
                try {
                    this.currentStack.push({ serviceName: name, ctor });
                    return this.constructItem();
                } finally {
                    this.currentStack.pop();
                }
            });
            return type === 'single' ? objectsForDepend[0] : objectsForDepend;
        }
    }
}
