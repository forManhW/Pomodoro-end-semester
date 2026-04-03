import './ToggleBtn.css';

class Toggle {
    #element;
    #getter;
    #setter;

    /**
     * @param {string} className
     * @param {string|null} svg
     * @param {string} svgAlt
     * @param {string} dataName  - localStorage key (used as fallback when no custom get/set)
     * @param {{ get?: () => string, set?: (v: string) => void }} [store]
     */
    constructor(className, svg, svgAlt, dataName, { get, set } = {}) {
        this.#getter = get ?? (() => localStorage.getItem(dataName));
        this.#setter = set ?? ((v) => localStorage.setItem(dataName, v));
        this.#element = this.#createElement(className, svg, svgAlt);
        this.#bindEvents();
        this.#updateState();
    }

    #createElement(className, svg, svgAlt) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="toggle ${className}">
                ${svg ? `<div class="toggle-icon"><img src="${svg}" alt="${svgAlt}"/></div>` : ''}
                <div class="toggle-switch">
                    <div class="toggle-knob"></div>
                </div>
            </div>
        `;
        return wrapper.firstElementChild;
    }

    #bindEvents() {
        this.#element.querySelector('.toggle-switch').addEventListener('click', () => {
            this.#toggle();
        });
    }

    #toggle() {
        const current = this.#getter() === 'true';
        this.#setter((!current).toString());
        this.#updateState();
    }

    #updateState() {
        const isActive = this.#getter() === 'true';
        this.#element.querySelector('.toggle-switch').classList.toggle('toggle-on', isActive);
    }

    get element() {
        return this.#element;
    }
}

export default Toggle;
