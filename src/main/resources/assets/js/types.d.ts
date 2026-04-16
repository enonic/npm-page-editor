interface JQuery {
    simulate(event: string, ...data: any[]): JQuery;
}

declare module '*.css?inline' {
    const content: string;
    export default content;
}

// ? Preact's VNode is not structurally assignable to React's ReactNode.
// ? This augmentation bridges the gap for @enonic/ui components used with Preact JSX.
declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_REACT_NODES {
        preactVNode: import('preact').VNode;
    }
}
