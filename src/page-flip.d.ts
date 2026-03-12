declare module 'page-flip' {
    export class PageFlip {
        constructor(element: HTMLElement, settings: object);
        loadFromHTML(elements: HTMLElement[]): void;
        updateFromHtml(elements: HTMLElement[]): void;
        getFlipController(): unknown;
        clear(): void;
        flipNext(): void;
        flipPrev(): void;
        turnToPage(page: number): void;
        on(event: string, callback: (e: unknown) => void): void;
        off(event: string): void;
        [key: string]: unknown;
    }
}
