import {ItemViewPlaceholder} from '../ItemViewPlaceholder';

export class FragmentPlaceholder
    extends ItemViewPlaceholder {

    constructor() {
        super();
        this.addClassEx('fragment-placeholder').addClass('icon-pie');
    }
}
