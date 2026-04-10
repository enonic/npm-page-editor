interface JQuery {
    simulate(event: string, ...data: any[]): JQuery;
}

declare module '*.css?inline' {
    const content: string;
    export default content;
}
