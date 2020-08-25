export type Constructor<T> = new (...args: any[]) => T;

export function makeDisplayName<T>(constructor: Constructor<T>) {
    const { name } = constructor;
    return name == null || name === '' ? 'anonymous class' : name;
}
