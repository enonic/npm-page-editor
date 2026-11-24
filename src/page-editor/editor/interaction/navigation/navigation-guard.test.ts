import {OVERLAY_HOST_ID} from '../../constants';
import {initNavigationGuard} from './navigation-guard';

function click(element: Element): MouseEvent {
    const event = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    element.dispatchEvent(event);
    return event;
}

function submit(form: HTMLFormElement): Event {
    const event = new Event('submit', {bubbles: true, cancelable: true});
    form.dispatchEvent(event);
    return event;
}

describe('initNavigationGuard', () => {
    let stop: () => void;

    beforeEach(() => {
        stop = initNavigationGuard();
    });

    afterEach(() => {
        stop();
        document.body.innerHTML = '';
    });

    it('prevents navigation on a link outside tracked components', () => {
        document.body.innerHTML = '<header><a href="/apps">Apps</a></header>';

        expect(click(document.querySelector('a')!).defaultPrevented).toBe(true);
    });

    it('prevents navigation when the click lands on a link descendant', () => {
        document.body.innerHTML = '<a href="/apps"><span>Apps</span></a>';

        expect(click(document.querySelector('span')!).defaultPrevented).toBe(true);
    });

    it('prevents navigation on a link inside a shadow root', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({mode: 'open'});
        shadow.innerHTML = '<a href="/apps"><span>Apps</span></a>';
        document.body.appendChild(host);

        expect(click(shadow.querySelector('span')!).defaultPrevented).toBe(true);
    });

    it('prevents navigation on a middle click', () => {
        document.body.innerHTML = '<a href="/apps">Apps</a>';
        const event = new MouseEvent('auxclick', {bubbles: true, cancelable: true, button: 1});
        document.querySelector('a')!.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });

    it('leaves clicks outside links alone', () => {
        document.body.innerHTML = '<button type="button">Menu</button>';

        expect(click(document.querySelector('button')!).defaultPrevented).toBe(false);
    });

    it('prevents form submission', () => {
        document.body.innerHTML = '<form action="/search"><input name="q" /></form>';

        expect(submit(document.querySelector('form')!).defaultPrevented).toBe(true);
    });

    it('ignores links inside the overlay host', () => {
        document.body.innerHTML = `<div id="${OVERLAY_HOST_ID}"><a href="#docs">Docs</a></div>`;

        expect(click(document.querySelector('a')!).defaultPrevented).toBe(false);
    });

    it('stops guarding after cleanup', () => {
        document.body.innerHTML = '<a href="#apps">Apps</a>';
        stop();

        expect(click(document.querySelector('a')!).defaultPrevented).toBe(false);
    });
});
